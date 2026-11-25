import type { BootstrapResponse, PublicLecture } from "@shared/types.ts";
import { cohortLabel, lectureInCohort } from "@shared/cohort.ts";
import { lectureMatchesFaculty } from "@shared/faculty.ts";
import { compactRoom, formatCompactRange, zonedNow } from "@web/time.ts";
import { fetchBootstrap, readSavedBootstrap } from "../api";
import { readLook, readWho, type Look, type Who } from "../prefs";
import { buildTheme, chipStyle, type Theme } from "../theme";

/** One lecture as a widget row: no faculty name on a teacher's own widget, the cohort instead. */
export interface WidgetLecture {
  id: string;
  subject: string;
  time: string;
  person: string;
  room: string;
  cancelled: boolean;
  live: boolean;
  chip: ReturnType<typeof chipStyle>;
}

export type WidgetState =
  | { kind: "setup"; theme: Theme }
  | { kind: "empty"; theme: Theme; message: string }
  | { kind: "ok"; theme: Theme; title: string; today: WidgetLecture[]; next: WidgetLecture | null; done: boolean };

const isOff = (lecture: PublicLecture) => lecture.kind === "off" || lecture.subject.trim().toUpperCase() === "OFF";

/** The person's own classes: a student's cohort, a teacher's own lectures (never All classes). */
function ownLectures(data: BootstrapResponse, who: Who) {
  if (who.role === "student") {
    const choice = data.choices?.find((item) => item.division === who.student.division && item.course === who.student.course && item.batch === who.student.batch);
    return data.lectures.filter((lecture) => lectureInCohort(lecture, choice ?? who.student));
  }
  return data.lectures.filter((lecture) => lectureMatchesFaculty(lecture.faculty, who.faculty.faculty));
}

/** Builds what both widgets show. Uses the phone clock, since the widget redraws long after the fetch. */
export function widgetState(data: BootstrapResponse | null, who: Who | null, look: Look): WidgetState {
  const theme = buildTheme(look);
  if (!who) return { kind: "setup", theme };
  if (!data) return { kind: "empty", theme, message: "Open Aayam to load your timetable" };
  const now = zonedNow(new Date(), data.timezone);
  const faculty = who.role === "faculty";
  const lectures = ownLectures(data, who)
    .filter((lecture) => lecture.kind === "lecture" && !isOff(lecture) && lecture.date === now.iso)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.division.localeCompare(b.division));
  const today = lectures.map<WidgetLecture>((lecture) => ({
    id: lecture.id,
    subject: lecture.subject,
    time: formatCompactRange(lecture.startLabel, lecture.endLabel),
    // Students see the faculty; a teacher sees the cohort, never their own name.
    person: faculty ? cohortLabel(lecture.division) : lecture.faculty,
    room: lecture.room ? compactRoom(lecture.room) : "",
    cancelled: lecture.displayStatus === "cancelled",
    live: lecture.startMinutes <= now.minutes && now.minutes < lecture.endMinutes,
    chip: chipStyle(theme, lecture.subject, lecture.displayStatus),
  }));
  const upcoming = lectures.findIndex((lecture) => lecture.endMinutes > now.minutes);
  const title = faculty ? "My classes" : cohortLabel(who.student.division);
  return { kind: "ok", theme, title, today, next: upcoming >= 0 ? today[upcoming]! : null, done: lectures.length > 0 && upcoming < 0 };
}

let inflight: { at: number; promise: Promise<BootstrapResponse | null> } | null = null;

/**
 * Timetable for a widget redraw. `refresh` asks the API (a 304 when unchanged); otherwise, or offline,
 * the copy the app saved last. Both widgets update together, so one request serves them for a minute.
 */
export async function loadWidgetState(refresh: boolean): Promise<WidgetState> {
  const [who, look] = await Promise.all([readWho(), readLook()]);
  if (!who) return widgetState(null, null, look);
  if (!inflight || Date.now() - inflight.at > 60_000) {
    const promise = (refresh ? fetchBootstrap(who) : Promise.reject(new Error("cache"))).catch(() => readSavedBootstrap(who));
    inflight = { at: Date.now(), promise };
  }
  return widgetState(await inflight.promise, who, look);
}
