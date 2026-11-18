import type { MouseEvent } from "react";
import { DatabaseStatus } from "@/components/DatabaseStatus";

function openPage(event: MouseEvent<HTMLAnchorElement>, path: string) {
  event.preventDefault();
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const link = "underline-offset-4 hover:text-foreground hover:underline";

// One thin full-width row for the gate, setup, and the timetable. Wraps to two centred lines on a phone.
export function SiteFooter({ status = true, credits = true, className = "" }: { status?: boolean; credits?: boolean; className?: string }) {
  const split = status || credits;
  return (
    <footer className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/40 py-4 text-xs text-muted-foreground ${split ? "sm:justify-between" : ""} ${className}`}>
      {split ? (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {status ? <DatabaseStatus plain /> : null}
          {credits ? (
            <p>
              Made by{" "}
              <a href="https://kv404.dev" target="_blank" rel="noopener noreferrer" className={`font-medium text-foreground ${link}`}>
                Kv
              </a>
              <span className="text-muted-foreground/75"> · thanks Neel &amp; Somyajeet</span>
            </p>
          ) : null}
        </div>
      ) : null}
      <nav aria-label="Legal" className="flex items-center gap-3">
        <a href="/terms" onClick={(event) => openPage(event, "/terms")} className={link}>
          Terms
        </a>
        <a href="/privacy" onClick={(event) => openPage(event, "/privacy")} className={link}>
          Privacy
        </a>
      </nav>
    </footer>
  );
}

export default SiteFooter;
