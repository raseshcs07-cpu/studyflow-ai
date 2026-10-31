import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Mic, MicOff, Square, Volume2, VolumeX, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;
function getRecognition(): SR | null {
  if (typeof window === "undefined") return null;
  const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return C ? new C() : null;
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[#*_`>-]/g, "").slice(0, 1500);
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

const SUGGESTIONS = ["How do I use this app?", "Explain photosynthesis simply", "I feel stressed about exams", "Give me a 1-hour study routine"];

export function ChatPanel({ className, storageKey = "studypilot-chat" }: { className?: string; storageKey?: string }) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [],
  );
  const { messages, sendMessage, status, stop, error, setMessages } = useChat({ id: storageKey, transport });
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const recRef = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // restore + persist in this browser
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (status === "ready") localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, storageKey]);

  // speak finished assistant replies
  const lastSpoken = useRef<string | null>(null);
  useEffect(() => {
    if (!voiceReplies || status !== "ready") return;
    const last = messages.at(-1);
    if (last?.role === "assistant" && lastSpoken.current !== last.id) {
      lastSpoken.current = last.id;
      speak(last.parts.map((p) => (p.type === "text" ? p.text : "")).join(""));
    }
  }, [messages, status, voiceReplies]);

  useEffect(() => {
    if (!busy) taRef.current?.focus();
  }, [busy]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getRecognition();
    if (!rec) {
      alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    rec.lang = navigator.language || "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput(finalText + interim);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) {
        setVoiceReplies(true);
        send(finalText);
      }
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-xl">How can I help?</p>
              <p className="text-sm text-muted-foreground">Study doubts, app help, or just a chat. Tap the mic to talk.</p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-xl border bg-card px-3 py-2 text-left text-sm hover:bg-muted">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bubble px-4 py-2 text-sm text-bubble-foreground">
                {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="prose-chat min-w-0 flex-1 text-sm leading-relaxed">
                {m.parts.map((p, i) =>
                  p.type === "text" ? <ReactMarkdown key={i}>{p.text}</ReactMarkdown> : null,
                )}
                {status === "ready" && (
                  <button onClick={() => speak(m.parts.map((p) => (p.type === "text" ? p.text : "")).join(""))} className="mt-1 text-muted-foreground hover:text-primary" aria-label="Read aloud">
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ),
        )}
        {status === "submitted" && (
          <div className="flex items-center gap-1 pl-10">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error.message || "Something went wrong."}</p>}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t p-3"
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-soft">
          <Button type="button" size="icon" variant={listening ? "destructive" : "ghost"} onClick={toggleMic} aria-label="Talk">
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={listening ? "Listening…" : "Message StudyPilot Buddy"}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none"
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => { setVoiceReplies((v) => !v); window.speechSynthesis?.cancel(); }} aria-label="Voice replies">
            {voiceReplies ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          {busy ? (
            <Button type="button" size="icon" onClick={() => stop()} aria-label="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
