import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { generatePlan, examCoach } from "@/lib/ai.functions";
import { useInvalidate } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { ChatPanel } from "@/components/chat-panel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "AI Planner — StudyPilot" },
      { name: "description", content: "Generate one study plan across all subjects and exams." },
      { property: "og:title", content: "AI Planner — StudyPilot" },
      { property: "og:description", content: "AI plan for every subject and exam." },
    ],
  }),
  component: Planner,
});

function Planner() {
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [coach, setCoach] = useState<{ tip: string; strategy: string[] } | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      const r = await generatePlan();
      setSummary(r.summary);
      toast.success(`Planned ${r.count} sessions across all subjects`);
      invalidate("sessions");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Plan failed");
    }
    setBusy(false);
  };
  const getCoach = async () => {
    try { setCoach(await examCoach()); } catch (e) { toast.error(e instanceof Error ? e.message : "Coach failed"); }
  };
  return (
    <div>
      <PageHeader title="AI Planner" subtitle="One plan for ALL subjects and exams together." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <Button onClick={run} disabled={busy}><Bot className="mr-2 h-4 w-4" />{busy ? "Planning…" : "Generate my plan"}</Button>
            {summary && <p className="mt-3 text-sm text-muted-foreground">{summary}</p>}
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <Button variant="outline" onClick={getCoach}>Exam countdown coach</Button>
            {coach && <div className="mt-3 text-sm"><p>{coach.tip}</p><ul className="mt-2 list-disc pl-5">{coach.strategy.map((s) => <li key={s}>{s}</li>)}</ul></div>}
          </div>
        </div>
        <div className="h-[600px] overflow-hidden rounded-2xl border"><ChatPanel /></div>
      </div>
    </div>
  );
}
