export interface SheetSource {
  id: string;
  /** Used when the batch line does not name a program. */
  course: string;
  batch?: string;
  divisions?: string[];
}

export function cleanSpreadsheetId(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  const match = trimmed.match(/\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return trimmed;
}

export interface CohortSheetTemplate {
  key: string;
  course: string;
  batch: string;
  divisions: string[];
}

export const COHORT_TEMPLATES: CohortSheetTemplate[] = [
  {
    key: "btech-2026-30",
    course: "BTech",
    batch: "2026-30",
    divisions: ["Andrew NG", "Jerry Sanders", "Tim Cook"],
  },
  {
    key: "btech-2025-29",
    course: "BTech",
    batch: "2025-29",
    divisions: ["Demis Hassabis 2025", "Jeff Bezos 2025", "Larry Page 2025", "Sam Altman 2025"],
  },
  {
    key: "btech-2024-28",
    course: "BTech",
    batch: "2024-28",
    divisions: ["Elon Musk 2024", "Jensen Huang 2024", "Mark Zuckerberg"],
  },
  {
    key: "btech-2023-27",
    course: "BTech",
    batch: "2023-27",
    divisions: ["Steve Jobs (AI/DS)", "Steve Jobs (Cyber-Sec)", "Steve Jobs"],
  },
  {
    key: "mca-2026-28",
    course: "MCA",
    batch: "2026-28",
    divisions: ["Geoffrey Hinton"],
  },
];

export function sheetForScope(
  scope: { division?: string; course?: string; batch?: string },
  sources: SheetSource[],
): SheetSource | undefined {
  const division = scope.division?.trim().toLowerCase();
  const batch = scope.batch?.trim().toLowerCase();
  const course = scope.course?.trim().toLowerCase();

  if (division) {
    for (const source of sources) {
      if (source.divisions?.some((d) => {
        const dl = d.toLowerCase();
        return (
          dl === division ||
          dl.startsWith(division) ||
          division.startsWith(dl) ||
          dl.replace(/\s+20\d{2}$/, "") === division.replace(/\s+20\d{2}$/, "")
        );
      })) {
        return source;
      }
    }
  }

  if (batch) {
    for (const source of sources) {
      if (source.batch && (source.batch.toLowerCase() === batch || source.batch.includes(batch))) {
        if (!course || source.course.toLowerCase() === course) return source;
      }
    }
  }

  if (course) {
    const matching = sources.filter((s) => s.course.toLowerCase() === course);
    if (matching.length === 1) return matching[0];
  }

  return undefined;
}

/** A stored D1 `timetable_sheet_links` row. */
export interface SheetLinkRow {
  course: string;
  batch: string;
  spreadsheet_id: string;
}

const SHEET_ID = /^[a-zA-Z0-9-_]{20,80}$/;

/** A Google Sheet link or a bare id. Anything else is refused. */
export function acceptSpreadsheetId(input: string): string | null {
  const id = cleanSpreadsheetId(input ?? "");
  if (!SHEET_ID.test(id)) return null;
  return id;
}

export function cohortTemplate(course: string, batch: string): CohortSheetTemplate | undefined {
  const c = course.trim().toLowerCase();
  const b = batch.trim().toLowerCase();
  return COHORT_TEMPLATES.find((item) => item.course.toLowerCase() === c && item.batch.toLowerCase() === b);
}

/**
 * The sheets to sync, from D1 `timetable_sheet_links` only, in `COHORT_TEMPLATES` order.
 * A batch with no valid row is left out (`missing` names it) and keeps its last synced copy.
 */
export function sheetSources(rows: SheetLinkRow[]): { sources: SheetSource[]; missing: CohortSheetTemplate[] } {
  const sources: SheetSource[] = [];
  const missing: CohortSheetTemplate[] = [];
  for (const template of COHORT_TEMPLATES) {
    let id: string | null = null;
    for (const row of rows) {
      if (row.course && row.batch && cohortTemplate(row.course, row.batch) === template) {
        id = acceptSpreadsheetId(row.spreadsheet_id);
        if (id) break;
      }
    }
    if (!id) {
      missing.push(template);
      continue;
    }
    sources.push({ id, course: template.course, batch: template.batch, divisions: template.divisions });
  }
  return { sources, missing };
}

/** The workbook the bootstrap's top-level link points at: 2025-29 when it has one, else the first. */
export function primarySheetId(sources: SheetSource[]): string {
  return sources.find((sheet) => sheet.batch === "2025-29")?.id ?? sources[0]?.id ?? "";
}

export interface AppConfig {
  spreadsheetId: string;
  spreadsheets: SheetSource[];
  spreadsheetTitle: string;
  collegeName: string;
  schoolName: string;
  courseName: string;
  timezone: string;
  dateOrder: "DMY" | "MDY";
  port: number;
  syncIntervalSeconds: number;
  highlightHours: number;
  databasePath: string;
  clientOrigin: string | null;
}

function integer(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function getConfig(): AppConfig {
  const dateOrder = process.env.DATE_ORDER === "MDY" ? "MDY" : "DMY";
  return {
    // Sheets live only in D1 `timetable_sheet_links`; the job fills these in before it syncs.
    spreadsheets: [],
    spreadsheetId: "",
    spreadsheetTitle:
      process.env.SPREADSHEET_TITLE?.trim() ||
      "BTech Cohort Planning weekly | 16th Nov to 21st Nov 2026",
    collegeName: process.env.COLLEGE_NAME?.trim() || "ITM Skills University",
    schoolName: process.env.SCHOOL_NAME?.trim() || "School of FutureTech, Kharghar",
    courseName: process.env.COURSE_NAME?.trim() || "BTech",
    timezone: process.env.TIMEZONE?.trim() || "Asia/Kolkata",
    dateOrder,
    port: integer(process.env.PORT, 8787, 1, 65535),
    syncIntervalSeconds: integer(process.env.SYNC_INTERVAL_SECONDS, 300, 15, 3600),
    highlightHours: integer(process.env.HIGHLIGHT_HOURS, 72, 1, 24 * 30),
    databasePath: process.env.DATABASE_PATH?.trim() || "./data/timetable.sqlite",
    clientOrigin: process.env.CLIENT_ORIGIN?.trim() || null,
  };
}

export function spreadsheetUrl(id: string) {
  const clean = cleanSpreadsheetId(id);
  return `https://docs.google.com/spreadsheets/d/${clean}/edit`;
}

export function spreadsheetExportUrl(id: string) {
  const clean = cleanSpreadsheetId(id);
  return `https://docs.google.com/spreadsheets/d/${clean}/export?format=xlsx`;
}
