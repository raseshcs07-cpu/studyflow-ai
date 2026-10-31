import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Pencil, Plus, Trash2, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { subjectsQuery, topicsQuery, useInvalidate, currentUserId, SUBJECT_COLORS, type Subject } from "@/lib/queries";
import { explainBasics } from "@/lib/ai.functions";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/subjects")({
  head: () => ({
    meta: [
      { title: "Subjects — StudyPilot" },
      { name: "description", content: "Manage subjects and basic topics." },
      { property: "og:title", content: "Subjects — StudyPilot" },
      { property: "og:description", content: "Your subjects and topic checklists." },
    ],
  }),
  component: SubjectsPage,
});

const subjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  color: z.string(),
  difficulty: z.number().int().min(1).max(5),
  priority: z.number().int().min(1).max(5),
  basics_level: z.enum(["beginner", "intermediate", "strong"]),
});
type SubjectForm = z.infer<typeof subjectSchema>;
const blank: SubjectForm = { name: "", color: SUBJECT_COLORS[0] ?? "#10a37f", difficulty: 3, priority: 3, basics_level: "beginner" };

function SubjectsPage() {
  const invalidate = useInvalidate();
  const subjects = useQuery(subjectsQuery);
  const topics = useQuery(topicsQuery);
  const [editing, setEditing] = useState<{ id?: string; form: SubjectForm } | null>(null);
  const [explain, setExplain] = useState<{ title: string; loading: boolean; data?: Awaited<ReturnType<typeof explainBasics>> } | null>(null);

  const save = async () => {
    if (!editing) return;
    const p = subjectSchema.safeParse(editing.form);
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    const r = editing.id
      ? await supabase.from("subjects").update(p.data).eq("id", editing.id)
      : await supabase.from("subjects").insert({ ...p.data, user_id: await currentUserId() });
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(editing.id ? "Subject updated" : "Subject added");
    setEditing(null);
    invalidate("subjects");
  };
  const remove = async (s: Subject) => {
    if (!confirm(`Delete ${s.name}? Its topics, exams and sessions will be removed.`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Subject deleted");
    invalidate("subjects", "topics", "exams", "sessions");
  };
  const runExplain = async (subject: string, topic?: string) => {
    setExplain({ title: topic ?? subject, loading: true });
    try {
      const data = await explainBasics({ data: topic ? { subject, topic } : { subject } });
      setExplain({ title: topic ?? subject, loading: false, data });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't explain right now");
      setExplain(null);
    }
  };

  if (subjects.isLoading || topics.isLoading) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Subjects" subtitle="Add subjects and tick off basics as you learn." action={<Button onClick={() => setEditing({ form: blank })}><Plus className="mr-1 h-4 w-4" />Add subject</Button>} />
      {!subjects.data?.length ? (
        <EmptyState title="No subjects yet" text="Add your first subject to start planning." action={<Button onClick={() => setEditing({ form: blank })}>Add subject</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {subjects.data.map((s) => (
            <SubjectCard key={s.id} subject={s} topics={(topics.data ?? []).filter((t) => t.subject_id === s.id)} onEdit={() => setEditing({ id: s.id, form: { name: s.name, color: s.color, difficulty: s.difficulty, priority: s.priority, basics_level: s.basics_level as SubjectForm["basics_level"] } })} onDelete={() => remove(s)} onExplain={runExplain} />
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit subject" : "Add subject"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Name</Label><Input value={editing.form.name} maxLength={80} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Color</Label>
                <div className="flex gap-2">{SUBJECT_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setEditing({ ...editing, form: { ...editing.form, color: c } })} className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-background ${editing.form.color === c ? "ring-2 ring-ring" : ""}`} style={{ background: c }} aria-label={c} />
                ))}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["difficulty", "priority"] as const).map((k) => (
                  <div key={k} className="space-y-1.5"><Label className="capitalize">{k} (1–5)</Label>
                    <Select value={String(editing.form[k])} onValueChange={(v) => setEditing({ ...editing, form: { ...editing.form, [k]: Number(v) } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5"><Label>Your basics level</Label>
                <Select value={editing.form.basics_level} onValueChange={(v) => setEditing({ ...editing, form: { ...editing.form, basics_level: v as SubjectForm["basics_level"] } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={save}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!explain} onOpenChange={(o) => !o && setExplain(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Basics: {explain?.title}</DialogTitle></DialogHeader>
          {explain?.loading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-muted" />)}</div> : explain?.data && (
            <div className="prose-chat space-y-3 text-sm">
              <ReactMarkdown>{explain.data.explanation}</ReactMarkdown>
              <h3>Key points</h3><ul>{explain.data.key_points.map((k) => <li key={k}>{k}</li>)}</ul>
              <h3>Practice questions</h3><ol>{explain.data.practice_questions.map((q) => <li key={q}>{q}</li>)}</ol>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubjectCard({ subject: s, topics, onEdit, onDelete, onExplain }: { subject: Subject; topics: import("@/lib/queries").Topic[]; onEdit: () => void; onDelete: () => void; onExplain: (s: string, t?: string) => void }) {
  const invalidate = useInvalidate();
  const [title, setTitle] = useState("");
  const [isBasic, setIsBasic] = useState(true);
  const [hours, setHours] = useState("1");
  const done = topics.filter((t) => t.status === "done").length;

  const addTopic = async () => {
    const p = z.object({ title: z.string().trim().min(1, "Topic title is required").max(160), hours: z.number().positive().max(100) }).safeParse({ title, hours: Number(hours) });
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    const { error } = await supabase.from("topics").insert({ subject_id: s.id, user_id: s.user_id, title: p.data.title, is_basic: isBasic, estimated_hours: p.data.hours });
    if (error) { toast.error(error.message); return; }
    setTitle("");
    invalidate("topics");
  };
  const toggle = async (id: string, checked: boolean) => {
    const { error } = await supabase.from("topics").update({ status: checked ? "done" : "not_started" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate("topics");
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate("topics");
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 rounded-full" style={{ background: s.color }} />
        <div className="flex-1">
          <h2 className="font-semibold">{s.name}</h2>
          <p className="text-xs text-muted-foreground">Difficulty {s.difficulty} · Priority {s.priority} · {s.basics_level} · {done}/{topics.length} done</p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => onExplain(s.name)} aria-label="Explain basics"><Lightbulb className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${topics.length ? (done / topics.length) * 100 : 0}%`, background: s.color }} /></div>
      <ul className="mt-4 space-y-1.5">
        {topics.length === 0 && <li className="text-sm text-muted-foreground">No topics yet — add the basics below.</li>}
        {topics.map((t) => (
          <li key={t.id} className="group flex items-center gap-2 text-sm">
            <Checkbox checked={t.status === "done"} onCheckedChange={(c) => toggle(t.id, !!c)} />
            <span className={t.status === "done" ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{t.title}</span>
            {t.is_basic && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">Basic</span>}
            <span className="text-xs text-muted-foreground">{t.estimated_hours}h</span>
            <button onClick={() => onExplain(s.name, t.title)} className="text-muted-foreground hover:text-primary" aria-label="Explain"><Lightbulb className="h-3.5 w-3.5" /></button>
            <button onClick={() => del(t.id)} className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" aria-label="Delete topic"><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input className="h-8 min-w-0 flex-1" placeholder="New topic" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTopic()} />
        <Input className="h-8 w-16" type="number" min={0.5} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours" />
        <label className="flex items-center gap-1 text-xs"><Checkbox checked={isBasic} onCheckedChange={(c) => setIsBasic(!!c)} />Basic</label>
        <Button size="sm" onClick={addTopic}>Add</Button>
      </div>
    </div>
  );
}
