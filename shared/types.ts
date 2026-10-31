import type { CohortChoice } from "./cohort.ts";

export type DisplayStatus = "scheduled" | "cancelled" | "changed" | "rescheduled";

export type LectureKind = "lecture" | "break" | "off";

export type ExplicitMark = "cancelled" | "rescheduled" | "changed" | null;

export interface PreviousValues {
  subject?: string;
  faculty?: string;
  room?: string;
  startLabel?: string;
  endLabel?: string;
  status?: string;
}

export interface PublicLecture {
  id: string;
  slotKey: string;
  tabName: string;
  course: string;
  semester: string;
  batch: string;
  division: string;
  date: string | null;
  weekday: string;
  startMinutes: number;
  endMinutes: number;
  startLabel: string;
  endLabel: string;
  subject: string;
  faculty: string;
  room: string;
  kind: LectureKind;
  sourceStatus: "scheduled" | "cancelled";
  displayStatus: DisplayStatus;
  reason: string | null;
  previous: PreviousValues | null;
  changeDetectedAt: string | null;
  changeSummary: string | null;
  explicitMark: ExplicitMark;
  recurring: boolean;
}

export interface ChangeEvent {
  id: number;
  detectedAt: string;
  type: string;
  lectureId: string | null;
  division: string | null;
  course: string | null;
  semester: string | null;
  tabName: string | null;
  date: string | null;
  weekday: string | null;
  summary: string;
  previous: PreviousValues | null;
  next: PreviousValues | null;
  fields: string[];
}

export interface ParseIssue {
  tabName: string;
  row?: number;
  message: string;
  severity: "warning" | "error";
  snippet?: string;
}

export interface SheetLink {
  spreadsheetId: string;
  spreadsheetUrl: string;
  course: string;
  batch: string;
}

export interface SyncInfo {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  stale: boolean;
  bootstrapped: boolean;
  intervalSeconds: number;
  highlightHours: number;
  tabNames: string[];
  contentHash: string | null;
  source: "google-sheets-xlsx-export";
}

/** A previous published week kept after the live sheet moved on. `lectures` is already scoped the same way as `BootstrapResponse.lectures`. */
export interface SavedWeek {
  id: string;
  course: string;
  batch: string;
  start: string;
  end: string;
  lectures: PublicLecture[];
  /** Updates recorded while this week was the live sheet. */
  changes: ChangeEvent[];
}

export interface BootstrapResponse {
  collegeName: string;
  schoolName: string;
  courseName: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  sheets: SheetLink[];
  timezone: string;
  today: string;
  now: string;
  weekStart: string | null;
  weekEnd: string | null;
  /** Past weeks for the current scope. Empty when nothing has been replaced yet. The live week stays in `lectures`. */
  savedWeeks?: SavedWeek[];
  sync: SyncInfo;
  parseIssues: ParseIssue[];
  choices?: CohortChoice[];
  faculties?: string[];
  lectures: PublicLecture[];
  changes: ChangeEvent[];
}
