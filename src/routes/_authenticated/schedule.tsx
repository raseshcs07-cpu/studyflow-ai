import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sessionsQuery, subjectsQuery, examsQuery, useInvalidate, todayStr } from "@/lib/queries";
import { PageHeader, LoadingBlock } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — StudyPilot" },
      { name: "description", content: "Monthly and two-week study calendar with drag and drop." },
      { property: "og:title", content: "Schedule — StudyPilot" },
      { property: "og:description", content: "Your study calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Schedule,
});

const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Schedule() {
  const invalidate = useInvalidate();
  const sessions = useQuery(sessionsQuery);
  const subjects = useQuery(subjectsQuery);
  const exams = useQuery(examsQuery);
  const [view, setView] = useState<"month" | "list">("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  if (sessions.isLoading) return <LoadingBlock />;
  const sub = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  const all = sessions.data ?? [];
  const today = todayStr();

  const update = async (id: string, patch: { date?: string; status?: string }) => {
    if (!id) return;
    const { error } = await supabase.from("study_sessions").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate("sessions");
  };

  const DayCell = ({ d, dim, compact }: { d: string; dim?: boolean; compact?: boolean }) => {
    const list = all.filter((s) => s.date === d);
    const dayExams = (exams.data ?? []).filter((e) => e.exam_date === d);
    return (
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => update(e.dataTransfer.getData("id"), { date: d })}
        className={`rounded-xl border bg-card p-1.5 ${compact ? "min-h-24" : "min-h-32"} ${dim ? "opacity-40" : ""} ${d === today ? "ring-2 ring-ring" : ""}`}>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{compact ? Number(d.slice(8)) : new Date(d + "T00:00").toDateString().slice(0, 10)}</p>
        {dayExams.map((e) => (
          <p key={e.id} className="mb-1 truncate rounded bg-destructive/15 px-1 text-[11px] font-semibold text-destructive">📝 {sub.get(e.subject_id)?.name} {e.type}</p>
        ))}
        {list.map((s) => (
          <div key={s.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", s.id)}
            className="mb-1 cursor-grab rounded-md border-l-4 bg-muted px-1 py-0.5 text-[11px]" style={{ borderLeftColor: sub.get(s.subject_id)?.color }}>
            <p className="truncate font-medium">{s.start_time.slice(0, 5)} {sub.get(s.subject_id)?.name}</p>
            {!compact && <p className="text-muted-foreground">{s.status}</p>}
            {s.status === "planned" ? (
              <div className="flex gap-2"><button onClick={() => update(s.id, { status: "done" })} className="text-success">✓</button><button onClick={() => update(s.id, { status: "missed" })} className="text-destructive">✗</button></div>
            ) : compact ? <p className="text-muted-foreground">{s.status}</p> : null}
          </div>
        ))}
      </div>
    );
  };

  // month grid (Mon-first)
  const start = new Date(cursor);
  start.setDate(1 - ((cursor.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const days14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return fmt(d); });

  return (
    <div>
      <PageHeader title="Schedule" subtitle="Drag a session to another day. ✓ done, ✗ missed. Exams shown in red." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5">
          {(["month", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-sm ${view === v ? "bg-primary text-primary-foreground" : ""}`}>{v === "month" ? "Month" : "Next 2 weeks"}</button>
          ))}
        </div>
        {view === "month" && (
          <div className="ml-auto flex items-center gap-2">
            <button aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-md border p-1"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-36 text-center font-medium">{cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}</span>
            <button aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-md border p-1"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      {view === "month" ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-1.5">
            {WEEK.map((w) => <p key={w} className="text-center text-xs font-semibold text-muted-foreground">{w}</p>)}
            {cells.map((d) => <DayCell key={fmt(d)} d={fmt(d)} dim={d.getMonth() !== cursor.getMonth()} compact />)}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days14.map((d) => <DayCell key={d} d={d} />)}
        </div>
      )}
    </div>
  );
}
