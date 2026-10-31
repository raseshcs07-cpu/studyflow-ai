import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Subject = Tables<"subjects">;
export type Topic = Tables<"topics">;
export type Exam = Tables<"exams">;
export type Session = Tables<"study_sessions">;
export type Profile = Tables<"profiles">;

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}
export { uid as currentUserId };

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const subjectsQuery = queryOptions({
  queryKey: ["subjects"],
  queryFn: async () => check(await supabase.from("subjects").select("*").order("created_at")) as Subject[],
});
export const topicsQuery = queryOptions({
  queryKey: ["topics"],
  queryFn: async () => check(await supabase.from("topics").select("*").order("created_at")) as Topic[],
});
export const examsQuery = queryOptions({
  queryKey: ["exams"],
  queryFn: async () => check(await supabase.from("exams").select("*").order("exam_date")) as Exam[],
});
export const sessionsQuery = queryOptions({
  queryKey: ["sessions"],
  queryFn: async () => check(await supabase.from("study_sessions").select("*").order("date").order("start_time")) as Session[],
});
export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const id = await uid();
    const r = await supabase.from("profiles").select("*").eq("user_id", id).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    if (r.data) return r.data as Profile;
    return check(await supabase.from("profiles").insert({ user_id: id }).select().single()) as Profile;
  },
});

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export const daysUntil = (date: string) => Math.ceil((+new Date(date + "T00:00:00") - +new Date(new Date().toDateString())) / 864e5);
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const SUBJECT_COLORS = ["#10a37f", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

/** First-login onboarding suggestions (only when the user has nothing yet). */
export async function seedStarterIfNeeded(profile: Profile) {
  if (profile.onboarded) return false;
  const id = profile.user_id;
  const { count } = await supabase.from("subjects").select("id", { count: "exact", head: true });
  if (!count) {
    const starters = [
      { name: "Mathematics", color: "#3b82f6", difficulty: 4, priority: 5, topics: ["Number systems", "Algebra basics", "Linear equations", "Trigonometry intro"] },
      { name: "Physics", color: "#f59e0b", difficulty: 4, priority: 4, topics: ["Units & measurement", "Motion in a line", "Laws of motion"] },
      { name: "English", color: "#10a37f", difficulty: 2, priority: 3, topics: ["Grammar basics", "Reading comprehension", "Essay writing"] },
    ];
    for (const s of starters) {
      const { data } = await supabase.from("subjects").insert({ user_id: id, name: s.name, color: s.color, difficulty: s.difficulty, priority: s.priority }).select().single();
      if (data) await supabase.from("topics").insert(s.topics.map((t, i) => ({ user_id: id, subject_id: data.id, title: t, is_basic: i < 2, estimated_hours: 2 })));
    }
  }
  await supabase.from("profiles").update({ onboarded: true }).eq("user_id", id);
  return !count;
}
