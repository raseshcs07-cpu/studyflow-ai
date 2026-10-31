import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Brain, Mic, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Credits } from "@/components/credits";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyPilot — Your AI study planner for every exam" },
      { name: "description", content: "StudyPilot plans all your subjects and exams with AI, explains basics, and chats or talks with you anytime." },
      { property: "og:title", content: "StudyPilot — Your AI study planner" },
      { property: "og:description", content: "One smart plan for all your subjects and exams, plus an AI study buddy you can talk to." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Brain, title: "One plan for everything", text: "AI mixes all subjects and exams into one daily schedule." },
  { icon: Target, title: "Basics first", text: "Covers fundamentals, then revises before every exam." },
  { icon: CalendarDays, title: "Drag & drop calendar", text: "Move sessions, mark done or missed — missed ones get rescheduled." },
  { icon: Mic, title: "Talk to your buddy", text: "Ask doubts or just chat — by typing or by voice." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl font-semibold">StudyPilot</span>
        <nav className="flex items-center gap-1">
          <Button variant="ghost" asChild><Link to="/help">How to use</Link></Button>
          <ThemeToggle />
          <Button asChild><Link to="/dashboard">Open app</Link></Button>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-16 text-center">
        <h1 className="font-display text-5xl font-semibold leading-tight sm:text-6xl">
          Study smarter,<br />not longer.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Add your subjects and exams. StudyPilot builds one calm, day-by-day plan — and a friendly AI is always one tap away.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild><Link to="/auth">Get started free</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/help">See how it works</Link></Button>
        </div>
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t py-6"><Credits /></footer>
    </div>
  );
}
