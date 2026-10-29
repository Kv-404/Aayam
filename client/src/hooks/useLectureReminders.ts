import type { PublicLecture } from "@shared/types";
import { cohortLabel } from "@shared/cohort";
import { dueReminder, reminderText, type ReminderKind } from "@shared/reminders";
import { useEffect, useState } from "react";
import { showSystem } from "@/hooks/useNotifications";

const sentKey = "timetable-reminded";
const noticeKey = "timetable-reminder-notice";

const rank: Record<ReminderKind, number> = { start: 0, "5": 1, "10": 2 };

type Watch = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  subject: string;
  division: string;
};

function readSent() {
  try {
    const raw = sessionStorage.getItem(sentKey);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function writeSent(ids: Set<string>) {
  try {
    sessionStorage.setItem(sentKey, JSON.stringify([...ids]));
  } catch {
    // This visit still remembers the set in memory until the next reload.
  }
}

function readNotice(today: string) {
  try {
    const raw = sessionStorage.getItem(noticeKey);
    if (!raw) return null;
    const [day, ...rest] = raw.split("\n");
    return day === today ? rest.join("\n") : null;
  } catch {
    return null;
  }
}

function writeNotice(today: string, text: string | null) {
  try {
    if (text) sessionStorage.setItem(noticeKey, `${today}\n${text}`);
    else sessionStorage.removeItem(noticeKey);
  } catch {
    // The note on the page still updates.
  }
}

function watchList(lectures: PublicLecture[], today: string): Watch[] {
  return lectures
    .filter((lecture) => lecture.kind === "lecture" && lecture.displayStatus !== "cancelled" && lecture.subject !== "OFF" && lecture.date === today)
    .map((lecture) => ({
      id: lecture.id,
      startMinutes: lecture.startMinutes,
      endMinutes: lecture.endMinutes,
      subject: lecture.subject,
      division: lecture.division,
    }));
}

export function useLectureReminders({
  lectures,
  today,
  minutes,
  enabled,
  showCohort,
}: {
  lectures: PublicLecture[];
  today: string;
  minutes: number;
  enabled: boolean;
  showCohort: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(() => (enabled ? readNotice(today) : null));
  const [pulse, setPulse] = useState(0);
  const watchKey = JSON.stringify(watchList(lectures, today));

  useEffect(() => {
    if (!enabled) {
      setNotice(null);
      writeNotice(today, null);
      return;
    }
    const rows = JSON.parse(watchKey) as Watch[];
    const sent = readSent();
    const due = rows
      .flatMap((lecture) => {
        const kind = dueReminder(lecture.startMinutes, lecture.endMinutes, minutes);
        if (!kind) return [];
        const key = `${lecture.id}:${kind}`;
        if (sent.has(key)) return [];
        return [{ lecture, kind, key }];
      })
      .sort((a, b) => rank[a.kind] - rank[b.kind] || a.lecture.startMinutes - b.lecture.startMinutes);
    if (due.length === 0) return;
    for (const item of due) sent.add(item.key);
    writeSent(sent);
    const first = due[0]!;
    const text = reminderText(first.lecture.subject, first.kind, showCohort ? cohortLabel(first.lecture.division) : undefined);
    writeNotice(today, text);
    setNotice(text);
    setPulse((current) => current + 1);
    for (const item of due) {
      const body = reminderText(item.lecture.subject, item.kind, showCohort ? cohortLabel(item.lecture.division) : undefined);
      void showSystem(item.lecture.subject, body, `lecture-${item.lecture.id}`);
    }
  }, [enabled, minutes, showCohort, today, watchKey]);

  return {
    notice,
    pulse,
    dismiss: () => {
      setNotice(null);
      writeNotice(today, null);
    },
  };
}
