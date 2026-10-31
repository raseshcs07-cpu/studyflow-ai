import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Credits } from "@/components/credits";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "How to use StudyPilot — Quick guide" },
      { name: "description", content: "Short, simple steps to set up subjects, exams and your AI study plan in StudyPilot." },
      { property: "og:title", content: "How to use StudyPilot" },
      { property: "og:description", content: "A quick step-by-step guide to the AI study planner." },
    ],
  }),
  component: Help,
});

const STEPS = [
  { t: "Sign in", p: ["Use Google or email.", "Your data is private — only you can see it."] },
  { t: "Set your study time", p: ["Open Settings.", "Pick daily hours, best time (morning / evening / night) and a day off."] },
  { t: "Add subjects", p: ["Go to Subjects → Add subject.", "Set difficulty and priority (1–5).", "Add topics; tick “Basic” for fundamentals."] },
  { t: "Add exams", p: ["Go to Exams → Add exam.", "Choose Mid or End, date and syllabus.", "See days left on the Dashboard."] },
  { t: "Generate your plan", p: ["Open AI Planner → Generate my plan.", "AI plans ALL subjects and exams together.", "Basics first, revision before each exam."] },
  { t: "Follow the schedule", p: ["Schedule shows week or month.", "Drag a session to another day to move it.", "Mark ✓ done or ✗ missed. Regenerate to reschedule missed ones."] },
  { t: "Ask the AI anytime", p: ["Tap the green chat bubble on any page.", "Type, or tap the mic to talk.", "Turn on the speaker icon to hear replies.", "Chat about anything — doubts, stress, or just hi."] },
];

const DEPLOY = [
  "Click Publish (top-right in the editor).",
  "Click Publish again — your app gets a free link like yourname.lovable.app.",
  "Share that link. After any change, click Publish → Update.",
  "Optional: add your own domain in Settings → Domains.",
  "Optional: connect GitHub (Settings → GitHub) to keep a copy of the code.",
];

function Help() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="font-display text-xl font-semibold">StudyPilot</Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild><Link to="/dashboard">Open app</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <h1 className="font-display text-4xl font-semibold">How to use StudyPilot</h1>
        <p className="mt-2 text-muted-foreground">Seven quick steps. Takes about 3 minutes.</p>
        <ol className="mt-8 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-4 rounded-2xl border bg-card p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
              <div>
                <h2 className="font-semibold">{s.t}</h2>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                  {s.p.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 font-display text-2xl font-semibold">How to put it online (deploy)</h2>
        <ol className="mt-4 list-decimal space-y-1.5 rounded-2xl border bg-card p-5 pl-10 text-sm">
          {DEPLOY.map((d) => <li key={d}>{d}</li>)}
        </ol>

        <h2 className="mt-12 font-display text-2xl font-semibold">Need help?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ask the AI chat bubble, or message the creator on WhatsApp.</p>
        <div className="mt-4 rounded-2xl border bg-card p-5"><Credits /></div>
      </main>
    </div>
  );
}
