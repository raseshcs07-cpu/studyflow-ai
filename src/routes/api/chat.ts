import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_PROMPT = `You are StudyPilot Buddy, a friendly AI helper inside the StudyPilot study planner app.
- You can chat normally about anything (casual talk, life, motivation) as well as studies.
- Keep answers SHORT and easy to read: small paragraphs, bullet points, simple words. Use markdown.
- Help with: explaining topics, study tips, exam strategy, and how to use the app.
- App guide: Subjects page = add subjects & basic topics. Exams page = add Mid/End exams. AI Planner = "Generate my plan" builds a schedule across ALL subjects and exams. Schedule = calendar, drag sessions to move, mark done/missed. Settings = daily hours, preferred time, off day. Help page = full instructions.
- The app was made by Rasesh Agarwal.`;

async function userContext(request: Request): Promise<string> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return "The user is not signed in.";
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: { Authorization: auth },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data: u } = await supabase.auth.getUser(auth.slice(7));
  if (!u.user) return "The user is not signed in.";
  const [subs, exams] = await Promise.all([
    supabase.from("subjects").select("name,difficulty"),
    supabase.from("exams").select("type,exam_date,subjects(name)").order("exam_date"),
  ]);
  const s = (subs.data ?? []).map((x) => `${x.name} (difficulty ${x.difficulty})`).join(", ") || "none yet";
  const e =
    (exams.data ?? [])
      .map((x) => `${(x.subjects as { name: string } | null)?.name ?? "?"} ${x.type} exam on ${x.exam_date}`)
      .join("; ") || "none yet";
  return `Signed-in user's subjects: ${s}. Exams: ${e}. Today is ${new Date().toISOString().slice(0, 10)}.`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { messages?: UIMessage[] };
          const messages = (body.messages ?? []).slice(-30);
          if (!messages.length) return new Response("No messages", { status: 400 });
          const ctx = await userContext(request).catch(() => "");
          const { streamChat } = await import("@/lib/ai/gateway");
          return await streamChat(request, `${BASE_PROMPT}\n\n${ctx}`, await convertToModelMessages(messages));
        } catch (e) {
          const status = (e as { statusCode?: number })?.statusCode ?? 500;
          console.error("chat error", e);
          return new Response(e instanceof Error ? e.message : "Chat failed", { status });
        }
      },
    },
  },
});
