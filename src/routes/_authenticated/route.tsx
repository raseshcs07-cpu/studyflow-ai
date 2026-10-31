import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, GraduationCap, CalendarDays, Bot, Settings, HelpCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Credits } from "@/components/credits";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppShell,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/planner", label: "AI Planner", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
] as const;

function AppShell() {
  const nav = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex md:sticky md:top-0 md:h-screen">
        <Link to="/" className="px-2 font-display text-xl font-semibold">StudyPilot</Link>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              activeProps={{ className: "bg-sidebar-accent text-foreground font-medium" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
            <ThemeToggle />
          </div>
          <Credits compact />
        </div>
      </aside>
      <div className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b bg-background/95 px-2 py-2 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground" activeProps={{ className: "bg-muted text-foreground font-medium" }}>
            <n.icon className="h-3.5 w-3.5" />{n.label}
          </Link>
        ))}
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
      </div>
      <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-8">
        <Outlet />
        <footer className="mt-12 border-t pt-4 md:hidden"><Credits /></footer>
      </main>
    </div>
  );
}
