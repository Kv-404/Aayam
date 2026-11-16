import { useEffect, useState } from "react";
import type { StudentNotice as Notice } from "@shared/types";
import { showSystem } from "@/hooks/useNotifications";

const dismissedKey = "timetable-notice-ids";
const alertedKey = "timetable-notice-alerted";

function readIds(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function writeIds(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].slice(-40)));
  } catch {
    // The banner still closes for this visit.
  }
}

export function StudentNoticeBar({ notices, optedIn }: { notices: Notice[]; optedIn: boolean }) {
  const [dismissed, setDismissed] = useState(() => readIds(dismissedKey));
  const newest = notices.find((notice) => !dismissed.has(notice.id)) ?? null;

  useEffect(() => {
    if (!newest || !optedIn) return;
    const alerted = readIds(alertedKey);
    if (alerted.has(newest.id)) return;
    alerted.add(newest.id);
    writeIds(alertedKey, alerted);
    void showSystem(newest.title, newest.body, `aayam-notice-${newest.id}`);
  }, [newest, optedIn]);

  if (!newest) return null;

  return (
    <div role="status" data-testid="student-notice" className="flex items-start gap-3 border-b border-border bg-muted/40 px-3 py-3 text-sm sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{newest.title}</p>
        <p className="mt-0.5 text-muted-foreground">{newest.body}</p>
      </div>
      <button
        type="button"
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          const next = new Set(dismissed);
          next.add(newest.id);
          writeIds(dismissedKey, next);
          setDismissed(next);
        }}
      >
        Got it
      </button>
    </div>
  );
}
