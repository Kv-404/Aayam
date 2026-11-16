import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { calendarFile } from "../../shared/calendar.ts";
import { batchYear, cohortChoices, cohortLabel, DEFAULT_COHORT_CHOICES, lectureInCohort, type CohortChoice } from "../../shared/cohort.ts";
import { changeMatchesFaculty, DEFAULT_FACULTY_NAMES, lectureMatchesFaculty, listFacultyNames } from "../../shared/faculty.ts";
import type { BootstrapResponse, ChangeEvent, PublicLecture, SavedWeek, SheetLink } from "../../shared/types.ts";
import { registerAdminRoutes } from "./adminRoutes.ts";
import { sheetForScope, spreadsheetUrl, type AppConfig, type SheetSource } from "./config.ts";
import { readSyncState, readWeekBackupsByIds, readWeekSummaries, type AppDatabase, type WeekBackupRecord } from "./db.ts";
import { authenticateFacultyWithNeon, clearSessionCookie, getClientIp, getSessionFromRequest, loginRateLimiter, pinRateLimiter, setSessionCookie, signSession, verifyBatchPinWithNeon, verifyGoogleCredential } from "./auth.ts";
import { listChanges } from "./services/changeHistoryService.ts";
import { presentLecture } from "./services/presentLecture.ts";
import { preferOneWeekCopies } from "./services/weekBackup.ts";
import { persistCancelledRemovals } from "./services/persistCancelled.ts";
import { restoreRemovedLectures } from "./services/restoreRemoved.ts";
import { loadSnapshot } from "./services/timetableSnapshotService.ts";
import { hydrateArchive } from "./services/durableState.ts";
import { runSync, syncInFlight, type SyncContext } from "./services/syncScheduler.ts";
import { fetchSpreadsheet } from "./services/googleSheetsService.ts";
import { noticesForScope } from "./services/notices.ts";
import { clearSheetSourceCache, resolveSheetSources } from "./services/sheetOverrides.ts";
import { zonedParts } from "./time.ts";

function mondayOf(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function plusDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function summaryInScope(
  week: { course: string; batch: string },
  filter: { division?: string; faculty?: string; course?: string; batch?: string } | undefined,
  choices: CohortChoice[],
) {
  if (!filter || filter.faculty) return true;
  if (filter.division) {
    const choice = choices.find((item) => item.division === filter.division);
    if (!choice) return true;
    return week.course === choice.course && week.batch === choice.batch;
  }
  if (filter.course && week.course.toLowerCase() !== filter.course.toLowerCase()) return false;
  if (filter.batch && week.batch.toLowerCase() !== filter.batch.toLowerCase()) return false;
  return true;
}

function dominantSheetId(weeks: WeekBackupRecord[]) {
  const counts = new Map<string, number>();
  for (const week of weeks) {
    for (const lecture of week.lectures) {
      if (!lecture.spreadsheetId) continue;
      counts.set(lecture.spreadsheetId, (counts.get(lecture.spreadsheetId) ?? 0) + 1);
    }
  }
  let best = "";
  let count = 0;
  for (const [id, n] of counts) {
    if (n > count) {
      best = id;
      count = n;
    }
  }
  return best;
}

/** A cancelled card of a class that is still on that day is the same lecture twice. */
function withoutRepeatedCancels<T extends { displayStatus: string; kind: string; date: string | null; division: string; subject: string }>(lectures: T[]) {
  const kept = new Set<string>();
  for (const lecture of lectures) {
    if (lecture.kind !== "lecture" || lecture.displayStatus === "cancelled") continue;
    kept.add(`${lecture.date ?? ""}\0${lecture.division}\0${lecture.subject.trim().toLowerCase()}`);
  }
  return lectures.filter((lecture) => {
    if (lecture.kind !== "lecture" || lecture.displayStatus !== "cancelled") return true;
    return !kept.has(`${lecture.date ?? ""}\0${lecture.division}\0${lecture.subject.trim().toLowerCase()}`);
  });
}

function presentBackup(week: WeekBackupRecord, now: Date, highlightHours: number, restoredIds: Set<string>): SavedWeek {
  const lectures = withoutRepeatedCancels(week.lectures.map((lecture) => presentLecture(lecture, now, highlightHours))).sort(byLecture);
  const lectureIds = new Set(lectures.map((lecture) => lecture.id));
  const divisions = new Set(lectures.map((lecture) => lecture.division));
  const changes = (week.changes ?? [])
    .filter((change) => {
      if (lectures.length === 0) return false;
      if (change.lectureId && lectureIds.has(change.lectureId)) return true;
      if (change.division) return divisions.has(change.division);
      return true;
    })
    .map((change): ChangeEvent => {
      const cancelled = Boolean(change.lectureId && restoredIds.has(change.lectureId) && change.type === "removed");
      const subject = change.previous?.subject || "A lecture";
      return {
        id: change.id,
        detectedAt: change.detectedAt,
        type: cancelled ? "cancelled" : change.type,
        lectureId: change.lectureId,
        division: change.division,
        course: change.course,
        semester: change.semester,
        tabName: change.tabName,
        date: change.date,
        weekday: change.weekday,
        summary: cancelled ? `${subject} lecture cancelled.` : change.summary,
        previous: change.previous,
        next: change.next,
        fields: change.fields ?? [],
      };
    });
  return { id: week.id, course: week.course, batch: week.batch, start: week.start, end: week.end, lectures, changes };
}

function programLinkKey(course: string, batch: string) {
  return `${course.trim().toLowerCase()}\0${batch.trim().toLowerCase()}`;
}

/** One edit link per course and batch. Lecture ids win; configured workbooks fill the rest. */
function sheetLinks(
  lectures: Array<{ spreadsheetId?: string; course: string; batch: string }>,
  sources: SheetSource[],
): SheetLink[] {
  const seen = new Map<string, SheetLink>();
  const put = (course: string, batch: string, id: string) => {
    const cleanCourse = course.trim();
    const cleanBatch = batch.trim();
    const cleanId = id.trim();
    if (!cleanCourse || !cleanBatch || !cleanId) return;
    const key = programLinkKey(cleanCourse, cleanBatch);
    if (seen.has(key)) return;
    seen.set(key, {
      spreadsheetId: cleanId,
      spreadsheetUrl: spreadsheetUrl(cleanId),
      course: cleanCourse,
      batch: cleanBatch,
    });
  };

  for (const lecture of lectures) {
    if (lecture.spreadsheetId) put(lecture.course, lecture.batch, lecture.spreadsheetId);
  }
  for (const source of sources) {
    if (source.batch) put(source.course, source.batch, source.id);
  }
  return [...seen.values()];
}

function byLecture(a: PublicLecture, b: PublicLecture) {
  const date = (a.date ?? "").localeCompare(b.date ?? "");
  if (date !== 0) return date;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  const division = a.division.localeCompare(b.division);
  if (division !== 0) return division;
  return a.subject.localeCompare(b.subject);
}

function buildBootstrap(
  db: AppDatabase,
  config: AppConfig,
  now = new Date(),
  filter?: { division?: string; faculty?: string; course?: string; batch?: string },
): BootstrapResponse {
  const state = readSyncState(db);
  const zone = zonedParts(now, config.timezone);
  persistCancelledRemovals(db);
  const changes = listChanges(db, 80);
  const restored = restoreRemovedLectures(loadSnapshot(db), changes);
  const allLectures = restored.lectures
    .map((lecture) => presentLecture(lecture, now, config.highlightHours))
    .sort(byLecture);

  const parsedChoices = cohortChoices(allLectures);
  const seenDivisions = new Set(parsedChoices.map((c) => c.division));
  const choices = [
    ...parsedChoices,
    ...DEFAULT_COHORT_CHOICES.filter((c) => !seenDivisions.has(c.division)),
  ].sort((a, b) => {
    const course = a.course.localeCompare(b.course);
    if (course !== 0) return course;
    const year = batchYear(b.batch) - batchYear(a.batch);
    if (year !== 0) return year;
    const batch = b.batch.localeCompare(a.batch);
    if (batch !== 0) return batch;
    return cohortLabel(a.division).localeCompare(cohortLabel(b.division));
  });

  const faculties = listFacultyNames([
    ...allLectures.filter((lecture) => lecture.kind !== "break").map((lecture) => lecture.faculty),
    ...DEFAULT_FACULTY_NAMES,
  ]);

  const scopeOf = (rows: PublicLecture[]) => {
    if (filter?.faculty) {
      const faculty = filter.faculty;
      return rows.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, faculty));
    }
    if (filter?.division) {
      const division = filter.division;
      const choice = choices.find((item) => item.division === division);
      return choice
        ? rows.filter((lecture) => lectureInCohort(lecture, choice))
        : rows.filter((lecture) => lecture.division === division);
    }
    if (filter?.course || filter?.batch) {
      return rows.filter((lecture) =>
        (!filter.course || lecture.course.toLowerCase() === filter.course.toLowerCase()) &&
        (!filter.batch || lecture.batch.toLowerCase() === filter.batch.toLowerCase()),
      );
    }
    return rows;
  };

  let lectures = allLectures;
  let relevantChanges = changes;

  if (filter?.faculty) {
    const targetFaculty = filter.faculty;
    const facultyPool = scopeOf(allLectures);
    lectures = facultyPool;
    const facultyIds = new Set(facultyPool.map((l) => l.id));
    relevantChanges = changes.filter((change) => changeMatchesFaculty(change, targetFaculty, facultyIds));
  } else if (filter?.division) {
    const targetDivision = filter.division;
    const choice = choices.find((item) => item.division === targetDivision);
    lectures = scopeOf(allLectures);
    const watchedDivisions = new Set(choice ? [choice.division, ...choice.also] : [targetDivision]);
    relevantChanges = changes.filter((change) => !change.division || watchedDivisions.has(change.division));
  } else if (filter?.course || filter?.batch) {
    lectures = scopeOf(allLectures);
    relevantChanges = changes.filter((change) =>
      (!filter.course || change.course?.toLowerCase() === filter.course.toLowerCase())
    );
  }

  const dated = lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)).sort();
  const latest = dated[dated.length - 1];
  if (latest) {
    const weekStartDate = mondayOf(latest);
    const weekEndDate = plusDays(weekStartDate, 6);
    lectures = lectures.filter((lecture) => lecture.date && lecture.date >= weekStartDate && lecture.date <= weekEndDate);
    relevantChanges = relevantChanges.filter((change) => !change.date || (change.date >= weekStartDate && change.date <= weekEndDate));
  }

  const dates = lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)).sort();
  const liveKeys = new Set<string>();
  const liveDates = new Map<string, string[]>();
  for (const lecture of allLectures) {
    if (!lecture.date) continue;
    const key = `${lecture.course}\0${lecture.batch}`;
    const list = liveDates.get(key) ?? [];
    list.push(lecture.date);
    liveDates.set(key, list);
  }
  for (const [key, list] of liveDates) {
    list.sort();
    liveKeys.add(`${key}\0${list[0]}\0${list[list.length - 1]}`);
  }
  const savedWeeks: SavedWeek[] = readWeekSummaries(db)
    .filter((week) => !liveKeys.has(`${week.course}\0${week.batch}\0${week.start}\0${week.end}`))
    .filter((week) => summaryInScope(week, filter, choices))
    .map((week) => ({
      id: week.id,
      course: week.course,
      batch: week.batch,
      start: week.start,
      end: week.end,
      lectures: [],
      changes: [],
    }))
    .sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
  return {
    collegeName: config.collegeName,
    schoolName: config.schoolName,
    courseName: config.courseName,
    spreadsheetId: config.spreadsheetId,
    spreadsheetTitle: state.spreadsheetTitle || config.spreadsheetTitle,
    spreadsheetUrl: spreadsheetUrl(config.spreadsheetId),
    sheets: sheetLinks(restored.lectures, config.spreadsheets),
    timezone: config.timezone,
    today: zone.iso,
    now: now.toISOString(),
    weekStart: dates[0] ?? null,
    weekEnd: dates[dates.length - 1] ?? null,
    savedWeeks,
    sync: {
      lastSuccessAt: state.lastSuccessAt,
      lastAttemptAt: state.lastAttemptAt,
      lastError: state.lastError,
      stale: Boolean(state.lastError) || !state.lastSuccessAt,
      bootstrapped: state.bootstrapped,
      intervalSeconds: config.syncIntervalSeconds,
      highlightHours: config.highlightHours,
      tabNames: state.tabNames,
      contentHash: state.contentHash,
      source: "google-sheets-xlsx-export",
    },
    parseIssues: state.parseIssues,
    choices,
    faculties,
    lectures,
    changes: relevantChanges.map((change) => {
      if (!change.lectureId || !restored.restoredIds.has(change.lectureId) || change.type !== "removed") return change;
      const subject = change.previous?.subject || "A lecture";
      return { ...change, type: "cancelled", summary: `${subject} lecture cancelled.` };
    }),
  };
}

function securityHeaders(_req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  next();
}

function allowedOrigins(config: AppConfig) {
  const fromEnv = (config.clientOrigin || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) return [];
  return ["http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173"];
}

export function createApp(db: AppDatabase, config: AppConfig, load: SyncContext["load"], options?: { syncOnRead?: boolean; loadAll?: SyncContext["loadAll"]; runInBackground?: (work: Promise<unknown>) => void }) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.VERCEL || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }
  const origins = allowedOrigins(config);
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use(securityHeaders);
  app.use(express.json({ limit: "16kb" }));
  // The catch-all function sometimes receives /bootstrap instead of /api/bootstrap.
  if (process.env.VERCEL) {
    app.use((req, _res, next) => {
      const url = req.url || "/";
      if (url === "/api" || url.startsWith("/api/") || url.startsWith("/api?")) {
        next();
        return;
      }
      req.url = url.startsWith("/") ? `/api${url}` : `/api/${url}`;
      next();
    });
  }

  const lastSyncBySheet = new Map<string, number>();

  type ReadScope = { division?: string; faculty?: string; course?: string; batch?: string; all?: boolean };

  async function liveConfig(): Promise<AppConfig> {
    const spreadsheets = await resolveSheetSources(config.spreadsheets);
    const spreadsheetId =
      spreadsheets.find((sheet) => sheet.batch === "2025-29")?.id ?? spreadsheets[0]?.id ?? config.spreadsheetId;
    return { ...config, spreadsheets, spreadsheetId };
  }

  /** Faculty and all-access read every sheet. A student reads the one sheet for their batch. */
  function syncPlan(filter: ReadScope, live: AppConfig): { sheets: SheetSource[]; everything: boolean; ctx: SyncContext } | null {
    // Marked when the download starts, so joining another request's sync does not count as this one.
    const mark = (sheets: SheetSource[]) => {
      const startedAt = Date.now();
      for (const sheet of sheets) lastSyncBySheet.set(sheet.id, startedAt);
    };
    if (filter.faculty || filter.all) {
      const sheets = live.spreadsheets;
      if (sheets.length === 0) return null;
      const loadAll = options?.loadAll;
      return {
        sheets,
        everything: true,
        ctx: {
          db,
          config: live,
          load: () => {
            mark(sheets);
            return load();
          },
          loadAll: loadAll
            ? () => {
                mark(sheets);
                return loadAll();
              }
            : undefined,
        },
      };
    }
    // A named batch or section reads that sheet only. It does not fall through to the other years.
    const named = Boolean(filter.division || filter.batch || filter.course);
    const sheet = sheetForScope(filter, live.spreadsheets) ?? (named
      ? undefined
      : live.spreadsheets.find((source) => source.id === live.spreadsheetId) ?? live.spreadsheets[0]);
    if (!sheet) return null;
    return {
      sheets: [sheet],
      everything: false,
      ctx: {
        db,
        config: { ...live, spreadsheetId: sheet.id },
        load: () => {
          mark([sheet]);
          return fetchSpreadsheet({ spreadsheetId: sheet.id });
        },
        loadAll: async () => {
          mark([sheet]);
          return [
            {
              ...(await fetchSpreadsheet({ spreadsheetId: sheet.id })),
              course: sheet.course,
              spreadsheetId: sheet.id,
            },
          ];
        },
      },
    };
  }

  /** A stored batch still counts when it has no workbook id. A different workbook id is last week. */
  function storedSheetIsCurrent(sheet: SheetSource, lectures: Array<{ spreadsheetId?: string; course: string; batch: string }>) {
    const rows = lectures.filter((lecture) =>
      sheet.batch
        ? lecture.course === sheet.course && lecture.batch === sheet.batch
        : lecture.spreadsheetId === sheet.id,
    );
    if (rows.length === 0) return true;
    const ids = [...new Set(rows.map((lecture) => lecture.spreadsheetId).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return true;
    return ids.includes(sheet.id);
  }

  /** Answers from the saved timetable when there is one, and refreshes the sheets in the background. */
  async function syncIfStale(filter: ReadScope = {}) {
    if (!options?.syncOnRead) return;
    // A cold start has an empty local database. The saved copy in Neon is what makes an instant answer possible.
    await hydrateArchive(db).catch(() => false);
    const live = await liveConfig();
    const plan = syncPlan(filter, live);
    if (!plan) {
      if (filter.faculty || filter.all) {
        const state = readSyncState(db);
        const age = state.lastSuccessAt ? Date.now() - new Date(state.lastSuccessAt).getTime() : Number.POSITIVE_INFINITY;
        if (age > live.syncIntervalSeconds * 1000) await runSync({ db, config: live, load, loadAll: options.loadAll });
      }
      return;
    }
    const isFresh = () => plan.sheets.every((sheet) => Date.now() - (lastSyncBySheet.get(sheet.id) ?? 0) < config.syncIntervalSeconds * 1000);
    const snapshot = loadSnapshot(db);
    // A saved copy of an older workbook is not this week. Wait for the configured sheets.
    const currentSheets = plan.sheets.every((sheet) => storedSheetIsCurrent(sheet, snapshot));
    const saved = plan.everything
      ? readSyncState(db).bootstrapped && snapshot.length > 0 && currentSheets
      : snapshot.some((lecture) => plan.sheets.some((sheet) => lecture.spreadsheetId === sheet.id || (sheet.batch && lecture.course === sheet.course && lecture.batch === sheet.batch))) && currentSheets;
    if (isFresh() && (saved || plan.everything)) return;
    if (saved) {
      const running = runSync(plan.ctx);
      options.runInBackground?.(running);
      return;
    }
    // Nothing to show yet, so this request has to wait for the sheet.
    await runSync(plan.ctx);
    if (!isFresh()) await runSync(plan.ctx);
  }

  app.get("/api/health", (_req, res) => {
    const state = readSyncState(db);
    res.status(state.lastSuccessAt ? 200 : 503).json({
      ok: Boolean(state.lastSuccessAt),
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
    });
  });
  app.get("/api/week", async (req, res) => {
    const monday = typeof req.query.monday === "string" ? req.query.monday.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(monday)) {
      res.status(400).json({ error: "Missing week." });
      return;
    }
    await hydrateArchive(db).catch(() => false);
    const division = (typeof req.query.division === "string" ? req.query.division : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    const filter = { division, faculty, course, batch };
    const choices = cohortChoices(loadSnapshot(db).map((lecture) => presentLecture(lecture, new Date(), config.highlightHours)));
    const ids = preferOneWeekCopies(readWeekSummaries(db))
      .filter((week) => mondayOf(week.start) === monday)
      .filter((week) => summaryInScope(week, filter, choices))
      .map((week) => week.id);
    const now = new Date();
    const changes = listChanges(db, 80);
    const restoredIds = restoreRemovedLectures(loadSnapshot(db), changes).restoredIds;
    const records = preferOneWeekCopies(readWeekBackupsByIds(db, ids));
    const opened = records.map((week) => presentBackup(week, now, config.highlightHours, restoredIds));
    const lectures = opened.flatMap((week) => week.lectures);
    const weekChanges = opened.flatMap((week) => week.changes);
    const sheetId = dominantSheetId(records);
    const scopedLectures = faculty
      ? lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, faculty))
      : division
        ? lectures.filter((lecture) => {
            const choice = choices.find((item) => item.division === division);
            return choice ? lectureInCohort(lecture, choice) : lecture.division === division;
          })
        : lectures;
    res.json({ lectures: scopedLectures, changes: weekChanges, spreadsheetUrl: sheetId ? spreadsheetUrl(sheetId) : null });
  });
  app.get("/api/bootstrap", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    const scope = { division, faculty, course, batch, all: req.query.all === "1" };
    await syncIfStale(scope);
    const live = await liveConfig();
    const payload = buildBootstrap(db, live, new Date(), { division, faculty, course, batch });
    const notices = await noticesForScope({ division, faculty, course, batch }, payload.choices ?? []);
    res.json({ ...payload, notices, sync: { ...payload.sync, refreshing: syncInFlight(db) } });
  });
  app.get("/api/calendar.ics", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    await syncIfStale({ division, faculty });
    const snapshot = buildBootstrap(db, config);
    const choice = division ? cohortChoices(snapshot.lectures).find((item) => item.division === division) : undefined;
    const lectures = faculty
      ? snapshot.lectures.filter((lecture) => lectureMatchesFaculty(lecture.faculty, faculty))
      : choice
        ? snapshot.lectures.filter((lecture) => lectureInCohort(lecture, choice))
        : division
          ? snapshot.lectures.filter((lecture) => lecture.division === division)
          : [];
    if ((!faculty && !division) || lectures.length === 0) {
      res.status(404).type("text/plain").send(faculty ? "No lectures for that faculty." : "Unknown cohort.");
      return;
    }
    const name = faculty || cohortLabel(division);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (req.query.download === "1") {
      const file = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "timetable"}.ics`;
      res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    }
    res.send(calendarFile(lectures, config.timezone, name, { includeCohort: Boolean(faculty) }));
  });
  app.get("/api/changes", (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 80));
    res.json({ changes: listChanges(db, limit) });
  });
  let lastForcedSync = 0;

  app.post("/api/sync", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    const everySheet = Boolean(faculty) || req.query.all === "1";
    const live = await liveConfig();
    const target = everySheet ? undefined : sheetForScope({ division, course, batch }, live.spreadsheets);
    const minGapMs = Math.min(config.syncIntervalSeconds, 15) * 1000;
    if (Date.now() - lastForcedSync < minGapMs) {
      res.setHeader("Retry-After", String(Math.ceil(minGapMs / 1000)));
      const early = buildBootstrap(db, live, new Date(), { division, faculty, course, batch });
      const earlyNotices = await noticesForScope({ division, faculty, course, batch }, early.choices ?? []);
      res.json({ ...early, notices: earlyNotices });
      return;
    }
    lastForcedSync = Date.now();
    if (target) {
      await runSync({
        db,
        config: { ...live, spreadsheetId: target.id },
        load: () => fetchSpreadsheet({ spreadsheetId: target.id }),
        loadAll: async () => [
          {
            ...(await fetchSpreadsheet({ spreadsheetId: target.id })),
            course: target.course,
            spreadsheetId: target.id,
          },
        ],
      });
      lastSyncBySheet.set(target.id, Date.now());
    } else if (everySheet) {
      await runSync({ db, config: live, load, loadAll: options?.loadAll });
      for (const s of live.spreadsheets) lastSyncBySheet.set(s.id, Date.now());
    }
    const synced = buildBootstrap(db, live, new Date(), { division, faculty, course, batch });
    const syncedNotices = await noticesForScope({ division, faculty, course, batch }, synced.choices ?? []);
    res.json({ ...synced, notices: syncedNotices });
  });

  app.get("/api/auth/config", (_req, res) => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    res.json({ clientId });
  });

  app.get("/api/auth/me", (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      email: session.email,
      faculty: session.faculty,
      canSeeAllFaculty: Boolean(session.canSeeAllFaculty),
    });
  });

  app.post("/api/auth/google", async (req, res) => {
    const ip = getClientIp(req);
    const rateCheck = loginRateLimiter.check(ip);
    if (rateCheck.limited) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
      res.status(429).json({ ok: false, error: `Too many sign-in attempts. Try again in ${rateCheck.retryAfterSeconds} seconds.` });
      return;
    }
    loginRateLimiter.recordFailure(ip);
    const credential = typeof req.body?.credential === "string" ? req.body.credential.trim() : "";
    if (!credential) {
      console.warn("[auth] Google login rejected: Missing credential payload.");
      res.status(400).json({ ok: false, error: "Missing credential." });
      return;
    }
    try {
      const { email } = await verifyGoogleCredential(credential);
      console.log(`[auth] Verified Google token for ${email}`);
      const faculty = await authenticateFacultyWithNeon(email);
      console.log(`[auth] Authenticated faculty ${faculty.faculty_name} (${faculty.email}) with all-access: ${faculty.can_see_all_faculty}`);
      const token = signSession({
        email: faculty.email,
        faculty: faculty.faculty_name,
        canSeeAllFaculty: faculty.can_see_all_faculty,
      });
      loginRateLimiter.reset(ip);
      setSessionCookie(res, token);
      res.json({
        ok: true,
        email: faculty.email,
        faculty: faculty.faculty_name,
        canSeeAllFaculty: faculty.can_see_all_faculty,
        token,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      console.error("[auth] Google auth failure:", message);
      res.status(403).json({ ok: false, error: "Sign-in was refused. Use an authorized faculty account." });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/auth/pin-verify", async (req, res) => {
    const ip = getClientIp(req);
    const rateCheck = pinRateLimiter.check(ip);

    if (rateCheck.limited) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
      res.status(429).json({
        ok: false,
        error: `Too many failed attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const rawPin = typeof req.body?.pin === "number" ? String(req.body.pin) : typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
    if (!rawPin) {
      res.status(400).json({ ok: false, error: "Missing PIN." });
      return;
    }

    // Only accept digits and validate length (must be exactly 6 digits)
    if (!/^\d{6}$/.test(rawPin)) {
      pinRateLimiter.recordFailure(ip);
      res.status(400).json({ ok: false, error: "Invalid PIN format. PIN must be exactly 6 digits." });
      return;
    }

    try {
      const result = await verifyBatchPinWithNeon(rawPin);
      if (result && result.ok) {
        pinRateLimiter.reset(ip);
        res.json({ ok: true, course: result.course, batch: result.batch });
      } else {
        pinRateLimiter.recordFailure(ip);
        res.status(401).json({ ok: false, error: "Invalid PIN. Please check with your class representative." });
      }
    } catch (err) {
      console.error("[pin-verify] Unexpected verification failure:", err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred while verifying PIN. Please try again." });
    }
  });

  app.post("/api/auth/batch-verify", (req, res) => {
    const ip = getClientIp(req);
    const rateCheck = pinRateLimiter.check(ip);

    if (rateCheck.limited) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
      res.status(429).json({
        ok: false,
        error: `Too many failed attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      });
      return;
    }

    const course = typeof req.body?.course === "string" ? req.body.course.trim() : "";
    const batch = typeof req.body?.batch === "string" ? req.body.batch.trim() : "";
    const rawCode = typeof req.body?.code === "number" ? String(req.body.code) : typeof req.body?.code === "string" ? req.body.code.trim() : "";

    if (!course || !batch || !rawCode) {
      res.status(400).json({ ok: false, error: "Missing course, batch, or code." });
      return;
    }

    if (!/^\d{6}$/.test(rawCode)) {
      pinRateLimiter.recordFailure(ip);
      res.status(400).json({ ok: false, error: "Invalid access code format. Must be exactly 6 digits." });
      return;
    }

    try {
      const envKey = `BATCH_CODE_${course.toUpperCase().replace(/\W+/g, "_")}_${batch.toUpperCase().replace(/\W+/g, "_")}`;
      const fallbackEnvKey = `BATCH_CODE_${batch.toUpperCase().replace(/\W+/g, "_")}`;
      const expected = (process.env[envKey] || process.env[fallbackEnvKey] || "").trim();
      if (!/^\d{6}$/.test(expected)) {
        res.status(403).json({ ok: false, error: "This batch has no access code configured." });
        return;
      }

      if (rawCode === expected) {
        pinRateLimiter.reset(ip);
        res.json({ ok: true, course, batch });
      } else {
        pinRateLimiter.recordFailure(ip);
        res.status(401).json({ ok: false, error: `Invalid access code for ${course} ${batch}.` });
      }
    } catch (err) {
      console.error("[batch-verify] Unexpected verification failure:", err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred while verifying access code." });
    }
  });

  registerAdminRoutes(app, {
    fallbackSheets: config.spreadsheets,
    syncSheet: async (source) => {
      clearSheetSourceCache();
      let file: { buffer: Buffer };
      try {
        file = await fetchSpreadsheet({ spreadsheetId: source.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "That sheet could not be read.";
        return { ok: false, error: message };
      }
      const outcome = await runSync({
        db,
        config: { ...config, spreadsheetId: source.id, courseName: source.course },
        load: async () => file,
        loadAll: async () => [{ ...file, course: source.course, spreadsheetId: source.id }],
        replaceProgram: source.batch ? { course: source.course, batch: source.batch } : undefined,
      });
      if (outcome.ok) lastSyncBySheet.set(source.id, Date.now());
      return { ok: outcome.ok, error: outcome.error };
    },
  });

  if (!process.env.VERCEL) {
    const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(clientDist, "index.html"));
      });
    }
  }
  return app;
}
