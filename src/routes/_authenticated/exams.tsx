import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { examsQuery, subjectsQuery, useInvalidate, currentUserId, daysUntil, todayStr } from "@/lib/queries";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "Exams — StudyPilot" },
      { name: "description", content: "Add Mid and End exams and track days remaining." },
      { property: "og:title", content: "Exams — StudyPilot" },
      { property: "og:description", content: "Exam dates and countdowns." },
    ],
  }),
  component: ExamsPage,
});

const schema = z.object({
  subject_id: z.string().uuid("Pick a subject"),
  type: z.enum(["mid", "end"]),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  syllabus_topics: z.string().max(2000),
  target_marks: z.number().int().min(0).max(1000).nullable(),
});

function ExamsPage() {
  const invalidate = useInvalidate();
  const exams = useQuery(examsQuery);
  const subjects = useQuery(subjectsQuery);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject_id: "", type: "mid", exam_date: "", syllabus_topics: "", target_marks: "" });

  const save = async () => {
    const p = schema.safeParse({ ...form, target_marks: form.target_marks ? Number(form.target_marks) : null });
    if (!p.success) return toast.error(p.error.issues[0].message);
    if (p.data.exam_date < todayStr()) return toast.error("Exam date can't be in the past");
    const { error } = await supabase.from("exams").insert({ ...p.data, user_id: await currentUserId() });
    if (error) return toast.error(error.message);
    toast.success("Exam added");
    setOpen(false);
    setForm({ subject_id: "", type: "mid", exam_date: "", syllabus_topics: "", target_marks: "" });
    invalidate("exams");
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate("exams");
  };

  if (exams.isLoading || subjects.isLoading) return <LoadingBlock />;
  const sub = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  return (
    <div>
      <PageHeader title="Exams" subtitle="Mid and End exams for every subject." action={<Button onClick={() => setOpen(true)} disabled={!subjects.data?.length}><Plus className="mr-1 h-4 w-4" />Add exam</Button>} />
      {!subjects.data?.length ? (
        <EmptyState title="Add a subject first" text="Exams belong to a subject." action={<Button asChild><Link to="/subjects">Go to Subjects</Link></Button>} />
      ) : !exams.data?.length ? (
        <EmptyState title="No exams yet" text="Add your Mid and End exams to get countdowns and revision in your plan." action={<Button onClick={() => setOpen(true)}>Add exam</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.data.map((e) => {
            const d = daysUntil(e.exam_date);
            const s = sub.get(e.subject_id);
            return (
              <div key={e.id} className="rounded-2xl border bg-card p-5" style={{ borderTopColor: s?.color, borderTopWidth: 4 }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{e.type === "mid" ? "Mid exam" : "End exam"}</p>
                    <p className="font-semibold">{s?.name}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(e.id)} aria-label="Delete exam"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <p className="mt-3 text-3xl font-semibold">{d < 0 ? "Done" : d === 0 ? "Today!" : d}<span className="ml-1 text-sm font-normal text-muted-foreground">{d > 0 ? "days left" : ""}</span></p>
                <p className="text-xs text-muted-foreground">{e.exam_date}{e.target_marks != null ? ` · target ${e.target_marks}` : ""}</p>
                {e.syllabus_topics && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{e.syllabus_topics}</p>}
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add exam</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Subject</Label>
                <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{subjects.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="mid">Mid</SelectItem><SelectItem value="end">End</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" min={todayStr()} value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Target marks</Label><Input type="number" min={0} max={1000} value={form.target_marks} onChange={(e) => setForm({ ...form, target_marks: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Syllabus</Label><Textarea maxLength={2000} placeholder="Chapters 1–5, Algebra, …" value={form.syllabus_topics} onChange={(e) => setForm({ ...form, syllabus_topics: e.target.value })} /></div>
            <Button className="w-full" onClick={save}>Save exam</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
