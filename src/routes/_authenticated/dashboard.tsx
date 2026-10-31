import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Check, Flame, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { examsQuery, profileQuery, sessionsQuery, subjectsQuery, daysUntil, todayStr, seedStarterIfNeeded, useInvalidate } from "@/lib/queries";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — StudyPilot" },
      { name: "description", content: "Today's study tasks, exam countdowns and weekly progress." },
      { property: "og:title", content: "Dashboard — StudyPilot" },
      { property: "og:description", content: "Your study day at a glance." },
    ],
  }),
  component: Dashboard,
});

const hrs = (s: { start_time: string; end_time: string }) => {
  const [a, b] = [s.start_time, s.end_time].map((t) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) + (m ?? 0) / 60; });
  return Math.max(0, (b ?? 0) - (a ?? 0));
};

function Dashboard() {
  const invalidate = useInvalidate();
  const profile = useQuery(profileQuery);
  const subjects = useQuery(subjectsQuery);
  const exams = useQuery(examsQuery);
  const sessions = useQuery(sessionsQuery);

  useEffect(() => {
    if (profile.data) seedStarterIfNeeded(profile.data).then((seeded) => {
      if (seeded) { toast.success("We added a few starter subjects — edit or delete them anytime."); invalidate("subjects", "topics", "profile"); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data?.id]);

  if (subjects.isLoading || sessions.isLoading || exams.isLoading) return <LoadingBlock />;
  const subMap = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  const today = todayStr();
  const todays = (sessions.data ?? []).filter((s) => s.date === today);
  const upcoming = (exams.data ?? []).filter((e) => daysUntil(e.exam_date) >= 0);
  const nextMid = upcoming.find((e) => e.type === "mid");
  const nextEnd = upcoming.find((e) => e.type === "end");

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const done = (sessions.data ?? []).filter((s) => s.date === key && s.status === "done").reduce((a, s) => a + hrs(s), 0);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), hours: +done.toFixed(1) };
  });
  const doneDays = new Set((sessions.data ?? []).filter((s) => s.status === "done").map((s) => s.date));
  let streak = 0;
  for (let d = new Date(); ; d.setDate(d.getDate() - 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (doneDays.has(k)) streak++; else if (k !== today) break;
    if (streak > 365) break;
  }

  const mark = async (id: string, status: "done" | "missed") => {
    const { error } = await supabase.from("study_sessions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate("sessions");
  };

  return (
    <div>
      <PageHeader title={`Hi${profile.data?.display_name ? `, ${profile.data.display_name}` : ""} 👋`} subtitle={new Date().toDateString()} />
      <div className="grid gap-4 md:grid-cols-3">
        {[{ label: "Mid exam", e: nextMid }, { label: "End exam", e: nextEnd }].map(({ label, e }) => (
          <div key={label} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            {e ? (<>
              <p className="mt-1 text-4xl font-semibold">{daysUntil(e.exam_date)}<span className="ml-1 text-base font-normal text-muted-foreground">days</span></p>
              <p className="mt-1 text-sm" style={{ color: subMap.get(e.subject_id)?.color }}>{subMap.get(e.subject_id)?.name} · {e.exam_date}</p>
            </>) : <Link to="/exams" className="mt-2 block text-sm text-primary">Add an exam →</Link>}
          </div>
        ))}
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Study streak</p>
          <p className="mt-1 flex items-center gap-2 text-4xl font-semibold"><Flame className="h-8 w-8 text-warning" />{streak}<span className="text-base font-normal text-muted-foreground">days</span></p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Today's tasks</h2>
          {todays.length === 0 ? (
            <div className="mt-3"><EmptyState title="Nothing planned today" text="Generate a plan with AI to fill your schedule." action={<Button asChild size="sm"><Link to="/planner">Open AI Planner</Link></Button>} /></div>
          ) : (
            <ul className="mt-3 space-y-2">
              {todays.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <span className="h-8 w-1.5 rounded-full" style={{ background: subMap.get(s.subject_id)?.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{subMap.get(s.subject_id)?.name} <span className="text-muted-foreground">· {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{s.notes}</p>
                  </div>
                  {s.status === "planned" ? (<>
                    <Button size="icon" variant="ghost" onClick={() => mark(s.id, "done")} aria-label="Done"><Check className="h-4 w-4 text-success" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => mark(s.id, "missed")} aria-label="Missed"><X className="h-4 w-4 text-destructive" /></Button>
                  </>) : <span className={s.status === "done" ? "text-xs text-success" : "text-xs text-destructive"}>{s.status}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Hours studied this week</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="hours" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
