import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sessionsQuery, subjectsQuery, useInvalidate, todayStr } from "@/lib/queries";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — StudyPilot" },
      { name: "description", content: "Weekly study calendar with drag and drop." },
      { property: "og:title", content: "Schedule — StudyPilot" },
      { property: "og:description", content: "Your study calendar." },
    ],
  }),
  component: Schedule,
});

const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Schedule() {
  const invalidate = useInvalidate();
  const sessions = useQuery(sessionsQuery);
  const subjects = useQuery(subjectsQuery);
  if (sessions.isLoading) return <LoadingBlock />;
  const sub = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return fmt(d); });
  const update = async (id: string, patch: { date?: string; status?: string }) => {
    const { error } = await supabase.from("study_sessions").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate("sessions");
  };
  if (!sessions.data?.length) return <><PageHeader title="Schedule" /><EmptyState title="No sessions yet" text="Generate a plan in AI Planner." /></>;
  return (
    <div>
      <PageHeader title="Schedule" subtitle="Next 2 weeks. Drag a session to another day." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d) => (
          <div key={d} onDragOver={(e) => e.preventDefault()} onDrop={(e) => update(e.dataTransfer.getData("id"), { date: d })} className={`min-h-32 rounded-xl border bg-card p-2 ${d === todayStr() ? "ring-2 ring-ring" : ""}`}>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{new Date(d + "T00:00").toDateString().slice(0, 10)}</p>
            {sessions.data.filter((s) => s.date === d).map((s) => (
              <div key={s.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", s.id)} className="mb-1.5 cursor-grab rounded-lg border-l-4 bg-muted p-1.5 text-xs" style={{ borderLeftColor: sub.get(s.subject_id)?.color }}>
                <p className="font-medium">{sub.get(s.subject_id)?.name}</p>
                <p className="text-muted-foreground">{s.start_time.slice(0, 5)} · {s.status}</p>
                {s.status === "planned" && <div className="mt-1 flex gap-2"><button onClick={() => update(s.id, { status: "done" })} className="text-success">✓</button><button onClick={() => update(s.id, { status: "missed" })} className="text-destructive">✗</button></div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
