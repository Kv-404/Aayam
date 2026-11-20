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

function noticeKey(notice: Notice) {
  return notice.updatedAt && notice.updatedAt !== notice.createdAt ? `${notice.id}:${notice.updatedAt}` : notice.id;
}

export function StudentNoticeBar({ notices, optedIn }: { notices: Notice[]; optedIn: boolean }) {
  const [dismissed, setDismissed] = useState(() => readIds(dismissedKey));
  // An edit gets a new key, so an edited notice shows (and alerts) again. Expired ones never show.
  const now = Date.now();
  const live = notices.filter((notice) => !notice.expiresAt || Date.parse(notice.expiresAt) > now);
  const newest = live.find((notice) => !dismissed.has(noticeKey(notice))) ?? null;

  useEffect(() => {
    if (!newest || !optedIn) return;
    const alerted = readIds(alertedKey);
    if (alerted.has(noticeKey(newest))) return;
    alerted.add(noticeKey(newest));
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
          next.add(noticeKey(newest));
          writeIds(dismissedKey, next);
          setDismissed(next);
        }}
      >
        Got it
      </button>
    </div>
  );
}
