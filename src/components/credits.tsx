import { Github, MessageCircle } from "lucide-react";
import { SITE } from "@/lib/site";

export function Credits({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2 text-xs text-muted-foreground" : "flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground"}>
      <span>
        Made by <span className="font-semibold text-foreground">{SITE.author}</span>
      </span>
      <div className="flex items-center gap-3">
        <a href={SITE.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
          <Github className="h-4 w-4" /> GitHub
        </a>
        <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      </div>
    </div>
  );
}
