import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { ChatPanel } from "./chat-panel";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  if (pathname === "/planner") return null; // planner already has a full chat
  return (
    <>
      {open && (
        <div className="fixed inset-x-2 bottom-20 z-50 h-[70vh] overflow-hidden rounded-2xl border shadow-soft sm:inset-x-auto sm:right-5 sm:w-[400px]">
          <div className="flex items-center justify-between border-b bg-card px-4 py-2.5">
            <span className="text-sm font-semibold">StudyPilot Buddy</span>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ChatPanel className="h-[calc(100%-41px)]" />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI help chat"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
