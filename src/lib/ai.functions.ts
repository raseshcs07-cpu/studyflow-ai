import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const planSchema = z.object({
  summary: z.string(),
  sessions: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      start_time: z.string().describe("HH:MM 24h"),
      end_time: z.string().describe("HH:MM 24h"),
      subject_id: z.string(),
      topic_id: z.string().nullable(),
      notes: z.string(),
    }),
  ),
});

const TIME_WINDOWS = { morning: "06:00-12:00", evening: "16:00-21:00", night: "20:00-24:00" } as const;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const [profileR, subjectsR, topicsR, examsR, missedR] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("subjects").select("*"),
      supabase.from("topics").select("*").neq("status", "done"),
      supabase.from("exams").select("*").gte("exam_date", today).order("exam_date"),
      supabase.from("study_sessions").select("subject_id,topic_id,date").eq("status", "missed"),
    ]);
    const subjects = subjectsR.data ?? [];
    if (!subjects.length) throw new Error("Add at least one subject before generating a plan.");
    const p = profileR.data;
    const hours = Number(p?.daily_study_hours ?? 3);
    const pref = (p?.preferred_time ?? "evening") as keyof typeof TIME_WINDOWS;
    const exams = examsR.data ?? [];
    const lastExam = exams.at(-1)?.exam_date;
    const horizon = Math.min(
      28,
      Math.max(7, lastExam ? Math.ceil((+new Date(lastExam) - +new Date(today)) / 864e5) : 14),
    );

    const data = {
      today,
      days_to_plan: horizon,
      daily_study_hours: hours,
      preferred_window: TIME_WINDOWS[pref],
      weekly_off_day: p?.weekly_off_day != null ? DAYS[p.weekly_off_day] : "none",
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, difficulty: s.difficulty, priority: s.priority, basics_level: s.basics_level })),
      pending_topics: (topicsR.data ?? []).map((t) => ({ id: t.id, subject_id: t.subject_id, title: t.title, is_basic: t.is_basic, estimated_hours: t.estimated_hours, status: t.status })),
      upcoming_exams: exams.map((e) => ({ subject_id: e.subject_id, type: e.type, date: e.exam_date, syllabus: e.syllabus_topics })),
      missed_sessions_to_reschedule: (missedR.data ?? []).map((m) => ({ subject_id: m.subject_id, topic_id: m.topic_id })),
    };

    const { generateStructured, describeAiError } = await import("@/lib/ai/gateway");
    let plan: z.infer<typeof planSchema>;
    try {
      plan = await generateStructured(
        planSchema,
        `You are an expert study planner. Build ONE combined day-wise schedule that interleaves ALL subjects and ALL exams together (never plan one subject in isolation).
Rules:
- Plan from today for days_to_plan days. Skip the weekly off day. Total per day ≈ daily_study_hours, inside preferred_window, sessions 45-90 min with gaps.
- Cover basic topics (is_basic) first, beginners need more basics time.
- Harder / higher priority subjects get more time. Subjects with the nearest exam get more weight as it approaches.
- Add revision sessions in the 2-3 days before each mid/end exam for that subject's syllabus; day before exam = light revision only.
- Reschedule every missed session early in the plan.
- Use only the given subject_id / topic_id values (topic_id may be null for revision). notes = short task like "Revise chapter 2 + 10 MCQs".`,
        JSON.stringify(data),
      );
    } catch (e) {
      throw new Error(describeAiError(e));
    }

    const validSubjects = new Set(subjects.map((s) => s.id));
    const validTopics = new Set((topicsR.data ?? []).map((t) => t.id));
    const timeRe = /^\d{2}:\d{2}$/;
    const rows = plan.sessions
      .filter((s) => validSubjects.has(s.subject_id) && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && s.date >= today && timeRe.test(s.start_time) && timeRe.test(s.end_time) && s.start_time < s.end_time)
      .map((s) => ({
        user_id: userId,
        subject_id: s.subject_id,
        topic_id: s.topic_id && validTopics.has(s.topic_id) ? s.topic_id : null,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        notes: s.notes.slice(0, 300),
        status: "planned",
      }));
    if (!rows.length) throw new Error("The AI didn't return a usable plan. Please try again.");

    // Replace future planned sessions; missed ones are rescheduled, so clear them.
    const del1 = await supabase.from("study_sessions").delete().eq("status", "planned").gte("date", today);
    if (del1.error) throw new Error(del1.error.message);
    await supabase.from("study_sessions").delete().eq("status", "missed");
    const ins = await supabase.from("study_sessions").insert(rows);
    if (ins.error) throw new Error(ins.error.message);
    return { count: rows.length, summary: plan.summary };
  });

const explainSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  key_points: z.array(z.string()),
  practice_questions: z.array(z.string()),
});

export const explainBasics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subject: string; topic?: string }) =>
    z.object({ subject: z.string().min(1).max(100), topic: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generateStructured, describeAiError } = await import("@/lib/ai/gateway");
    try {
      return await generateStructured(
        explainSchema,
        "You teach absolute beginners. Give a short, friendly explanation (under 120 words), 4-6 key points, and exactly 5 practice questions from easy to medium.",
        `Subject: ${data.subject}${data.topic ? `\nTopic: ${data.topic}` : ""}`,
      );
    } catch (e) {
      throw new Error(describeAiError(e));
    }
  });

const coachSchema = z.object({ tip: z.string(), strategy: z.array(z.string()) });

export const examCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: exams } = await context.supabase
      .from("exams")
      .select("type,exam_date,syllabus_topics,subjects(name)")
      .gte("exam_date", today)
      .order("exam_date")
      .limit(6);
    if (!exams?.length) return { tip: "Add your Mid and End exams to get a personalised countdown strategy.", strategy: [] };
    const list = exams.map((e) => {
      const days = Math.ceil((+new Date(e.exam_date) - +new Date(today)) / 864e5);
      return `${(e.subjects as { name: string } | null)?.name} ${e.type} exam in ${days} days. Syllabus: ${e.syllabus_topics || "n/a"}`;
    });
    const { generateStructured, describeAiError } = await import("@/lib/ai/gateway");
    try {
      return await generateStructured(
        coachSchema,
        "You are an upbeat exam coach. Give one short motivational tip (1-2 sentences) and 3-5 short revision strategy steps covering ALL upcoming exams together, based on days left.",
        list.join("\n"),
      );
    } catch (e) {
      throw new Error(describeAiError(e));
    }
  });
