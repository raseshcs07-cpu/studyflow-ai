import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, useInvalidate } from "@/lib/queries";
import { PageHeader, LoadingBlock } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — StudyPilot" },
      { name: "description", content: "Daily hours, preferred time and off day." },
      { property: "og:title", content: "Settings — StudyPilot" },
      { property: "og:description", content: "Study preferences." },
    ],
  }),
  component: SettingsPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SettingsPage() {
  const invalidate = useInvalidate();
  const p = useQuery(profileQuery);
  const [hours, setHours] = useState("3");
  const [time, setTime] = useState("evening");
  const [off, setOff] = useState<number | null>(null);
  useEffect(() => { if (p.data) { setHours(String(p.data.daily_study_hours)); setTime(p.data.preferred_time); setOff(p.data.weekly_off_day); } }, [p.data]);
  if (!p.data) return <LoadingBlock />;
  const save = async () => {
    const h = Number(hours);
    if (!(h > 0 && h <= 16)) { toast.error("Daily hours must be between 0.5 and 16"); return; }
    const { error } = await supabase.from("profiles").update({ daily_study_hours: h, preferred_time: time, weekly_off_day: off }).eq("user_id", p.data!.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    invalidate("profile");
  };
  return (
    <div className="max-w-md space-y-5">
      <PageHeader title="Settings" />
      <div className="space-y-1.5"><Label>Daily study hours</Label><Input type="number" min={0.5} max={16} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Preferred time</Label>
        <div className="flex gap-2">{["morning", "evening", "night"].map((t) => <Button key={t} variant={time === t ? "default" : "outline"} size="sm" onClick={() => setTime(t)} className="capitalize">{t}</Button>)}</div>
      </div>
      <div className="space-y-1.5"><Label>Weekly off day</Label>
        <div className="flex flex-wrap gap-2">{DAYS.map((d, i) => <Button key={d} size="sm" variant={off === i ? "default" : "outline"} onClick={() => setOff(off === i ? null : i)}>{d}</Button>)}</div>
      </div>
      <Button onClick={save}>Save settings</Button>
    </div>
  );
}
