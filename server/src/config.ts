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
  fallbackId: string;
  envKeys: string[];
}

export const COHORT_TEMPLATES: CohortSheetTemplate[] = [
  {
    key: "btech-2026-30",
    course: "BTech",
    batch: "2026-30",
    divisions: ["Andrew NG", "Jerry Sanders", "Tim Cook"],
    fallbackId: "1cG7UflUTUPVpVL3BliSYFqDkOs-QzsGyo3azE1qd3js",
    envKeys: [
      "SPREADSHEET_BTECH_2026_30",
      "SPREADSHEET_ID_BTECH_2026_30",
      "SPREADSHEET_URL_BTECH_2026_30",
      "SPREADSHEET_YEAR_1",
      "SPREADSHEET_ID_YEAR_1",
      "SPREADSHEET_Y1",
      "SPREADSHEET_ID_Y1",
    ],
  },
  {
    key: "btech-2025-29",
    course: "BTech",
    batch: "2025-29",
    divisions: ["Demis Hassabis 2025", "Jeff Bezos 2025", "Larry Page 2025", "Sam Altman 2025"],
    fallbackId: "1qInzB5I0deY7jAKgFFFgBsd4fkSFLGqg-Fyh7Q3nXUM",
    envKeys: [
      "SPREADSHEET_BTECH_2025_29",
      "SPREADSHEET_ID_BTECH_2025_29",
      "SPREADSHEET_URL_BTECH_2025_29",
      "SPREADSHEET_YEAR_2",
      "SPREADSHEET_ID_YEAR_2",
      "SPREADSHEET_Y2",
      "SPREADSHEET_ID_Y2",
    ],
  },
  {
    key: "btech-2024-28",
    course: "BTech",
    batch: "2024-28",
    divisions: ["Elon Musk 2024", "Jensen Huang 2024", "Mark Zuckerberg"],
    fallbackId: "1Z8WWsv0yhiMmfZQqzzYBYrYgxq-FcDd_kbQeGcF5eDI",
    envKeys: [
      "SPREADSHEET_BTECH_2024_28",
      "SPREADSHEET_ID_BTECH_2024_28",
      "SPREADSHEET_URL_BTECH_2024_28",
      "SPREADSHEET_YEAR_3",
      "SPREADSHEET_ID_YEAR_3",
      "SPREADSHEET_Y3",
      "SPREADSHEET_ID_Y3",
    ],
  },
  {
    key: "btech-2023-27",
    course: "BTech",
    batch: "2023-27",
    divisions: ["Steve Jobs (AI/DS)", "Steve Jobs (Cyber-Sec)", "Steve Jobs"],
    fallbackId: "1nbdHdLvtlcrhClzfcKA7bBuNXQI1q61qs-sg2RK0ra4",
    envKeys: [
      "SPREADSHEET_BTECH_2023_27",
      "SPREADSHEET_ID_BTECH_2023_27",
      "SPREADSHEET_URL_BTECH_2023_27",
      "SPREADSHEET_YEAR_4",
      "SPREADSHEET_ID_YEAR_4",
      "SPREADSHEET_Y4",
      "SPREADSHEET_ID_Y4",
    ],
  },
  {
    key: "mca-2026-28",
    course: "MCA",
    batch: "2026-28",
    divisions: ["Geoffrey Hinton"],
    fallbackId: "15mPKkE6CWnHRTEH2RCg1HDAwL0cTgC9AqECpv_GRt1o",
    envKeys: [
      "SPREADSHEET_MCA_2026_28",
      "SPREADSHEET_ID_MCA_2026_28",
      "SPREADSHEET_URL_MCA_2026_28",
      "SPREADSHEET_MCA",
      "SPREADSHEET_ID_MCA",
    ],
  },
];

/** Baseline public workbooks, one per program and batch. */
export const WEEK_SHEETS: SheetSource[] = COHORT_TEMPLATES.map((tmpl) => ({
  id: tmpl.fallbackId,
  course: tmpl.course,
  batch: tmpl.batch,
  divisions: tmpl.divisions,
}));

export const PRIMARY_SHEET = "1qInzB5I0deY7jAKgFFFgBsd4fkSFLGqg-Fyh7Q3nXUM";

export function sheetForScope(
  scope: { division?: string; course?: string; batch?: string },
  sources: SheetSource[] = sheetSources(),
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

export function parseSheetEntry(entry: string): { id: string; course?: string; batch?: string } {
  const trimmed = entry.trim();
  const urlMatch = trimmed.match(/(https?:\/\/[^\s:]+)/);
  if (urlMatch) {
    const id = cleanSpreadsheetId(urlMatch[1]);
    const remainder = trimmed.replace(urlMatch[1], "").replace(/^:/, "").trim();
    const parts = remainder ? remainder.split(":").map((p) => p.trim()).filter(Boolean) : [];
    let course: string | undefined;
    let batch: string | undefined;
    for (const part of parts) {
      if (/\d{4}-\d{2,4}/.test(part)) batch = part;
      else course = part;
    }
    return { id, course, batch };
  }

  const parts = trimmed.split(":").map((p) => p.trim()).filter(Boolean);
  const id = cleanSpreadsheetId(parts[0] ?? "");
  let course: string | undefined;
  let batch: string | undefined;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    if (/\d{4}-\d{2,4}/.test(part)) batch = part;
    else course = part;
  }
  return { id, course, batch };
}

function envIdForDivision(division: string): string | undefined {
  const norm = division.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");
  const candidates = [
    `SPREADSHEET_${norm}`,
    `SPREADSHEET_ID_${norm}`,
    `SPREADSHEET_URL_${norm}`,
  ];
  for (const key of candidates) {
    const val = process.env[key]?.trim();
    if (val) return cleanSpreadsheetId(val);
  }
  return undefined;
}

export function sheetSources(): SheetSource[] {
  const listed = process.env.SPREADSHEET_IDS?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  if (listed.length > 0) {
    const fallback = process.env.COURSE_NAME?.trim() || "BTech";
    return listed.map((entry, index) => {
      const parsed = parseSheetEntry(entry);
      const matched =
        COHORT_TEMPLATES.find((t) => parsed.batch && t.batch === parsed.batch && (!parsed.course || t.course.toLowerCase() === parsed.course.toLowerCase())) ||
        (listed.length === COHORT_TEMPLATES.length ? COHORT_TEMPLATES[index] : undefined) ||
        COHORT_TEMPLATES.find((t) => parsed.course && t.course.toLowerCase() === parsed.course.toLowerCase());

      return {
        id: parsed.id,
        course: parsed.course || matched?.course || fallback,
        batch: parsed.batch || matched?.batch,
        divisions: matched?.divisions,
      };
    }).filter((source) => source.id);
  }

  const sources: SheetSource[] = COHORT_TEMPLATES.map((tmpl) => {
    let customId: string | undefined;
    for (const key of tmpl.envKeys) {
      const val = process.env[key]?.trim();
      if (val) {
        customId = cleanSpreadsheetId(val);
        break;
      }
    }
    if (!customId) {
      for (const div of tmpl.divisions) {
        const val = envIdForDivision(div);
        if (val) {
          customId = val;
          break;
        }
      }
    }

    return {
      id: customId || tmpl.fallbackId,
      course: tmpl.course,
      batch: tmpl.batch,
      divisions: tmpl.divisions,
    };
  });

  const single = process.env.SPREADSHEET_ID?.trim();
  if (single) {
    const cleanSingle = cleanSpreadsheetId(single);
    const anyCustomCohort = COHORT_TEMPLATES.some((t) =>
      t.envKeys.some((k) => process.env[k]?.trim()) ||
      t.divisions.some((d) => envIdForDivision(d)),
    );
    const isKnownFallback = COHORT_TEMPLATES.some((t) => t.fallbackId === cleanSingle);
    if (!anyCustomCohort && !isKnownFallback) {
      return [{ id: cleanSingle, course: process.env.COURSE_NAME?.trim() || "BTech" }];
    }
    const matched = sources.find((s) => s.id === cleanSingle || s.batch === "2025-29");
    if (matched) {
      matched.id = cleanSingle;
    }
  }

  return sources;
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
  const spreadsheets = sheetSources();
  return {
    // The sheet link falls back to the 2025-29 workbook. Sync reads every source.
    spreadsheets,
    spreadsheetId: process.env.SPREADSHEET_ID
      ? cleanSpreadsheetId(process.env.SPREADSHEET_ID)
      : (spreadsheets.find((sheet) => sheet.batch === "2025-29")?.id ?? spreadsheets[0]?.id ?? PRIMARY_SHEET),
    spreadsheetTitle:
      process.env.SPREADSHEET_TITLE?.trim() ||
      "BTech Cohort Planning weekly | 2nd Nov to 7th Nov 2026",
    collegeName: process.env.COLLEGE_NAME?.trim() || "ITM Skills University",
    schoolName: process.env.SCHOOL_NAME?.trim() || "School of FutureTech, Kharghar",
    courseName: process.env.COURSE_NAME?.trim() || "BTech",
    timezone: process.env.TIMEZONE?.trim() || "Asia/Kolkata",
    dateOrder,
    port: integer(process.env.PORT, 8787, 1, 65535),
    syncIntervalSeconds: integer(process.env.SYNC_INTERVAL_SECONDS, 45, 15, 3600),
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
