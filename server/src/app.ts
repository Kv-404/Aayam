import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { calendarFile } from "../../shared/calendar.ts";
import { batchYear, cohortChoices, cohortLabel, DEFAULT_COHORT_CHOICES, lectureInCohort } from "../../shared/cohort.ts";
import { changeMatchesFaculty, DEFAULT_FACULTY_NAMES, lectureMatchesFaculty, listFacultyNames } from "../../shared/faculty.ts";
import type { BootstrapResponse, SheetLink } from "../../shared/types.ts";
import { sheetForScope, spreadsheetUrl, type AppConfig, type SheetSource } from "./config.ts";
import { readSyncState, type AppDatabase } from "./db.ts";
import { authenticateFacultyWithNeon, clearSessionCookie, getClientIp, getSessionFromRequest, loginRateLimiter, pinRateLimiter, setSessionCookie, signSession, verifyBatchPinWithNeon, verifyGoogleCredential } from "./auth.ts";
import { listChanges } from "./services/changeHistoryService.ts";
import { presentLecture } from "./services/presentLecture.ts";
import { persistCancelledRemovals } from "./services/persistCancelled.ts";
import { restoreRemovedLectures } from "./services/restoreRemoved.ts";
import { loadSnapshot } from "./services/timetableSnapshotService.ts";
import { runSync, type SyncContext } from "./services/syncScheduler.ts";
import { fetchSpreadsheet } from "./services/googleSheetsService.ts";
import { zonedParts } from "./time.ts";

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
    .sort((a, b) => {
      const date = (a.date ?? "").localeCompare(b.date ?? "");
      if (date !== 0) return date;
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      const division = a.division.localeCompare(b.division);
      if (division !== 0) return division;
      return a.subject.localeCompare(b.subject);
    });

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

  const parsedFaculties = listFacultyNames(allLectures.filter((lecture) => lecture.kind !== "break").map((lecture) => lecture.faculty));
  const seenFaculties = new Set(parsedFaculties.map((f) => f.toLowerCase()));
  const faculties = [
    ...parsedFaculties,
    ...DEFAULT_FACULTY_NAMES.filter((f) => !seenFaculties.has(f.toLowerCase())),
  ].sort((a, b) => a.localeCompare(b));

  let lectures = allLectures;
  let relevantChanges = changes;

  if (filter?.faculty) {
    const targetFaculty = filter.faculty;
    const facultyPool = allLectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, targetFaculty));
    lectures = facultyPool;
    const facultyIds = new Set(facultyPool.map((l) => l.id));
    relevantChanges = changes.filter((change) => changeMatchesFaculty(change, targetFaculty, facultyIds));
  } else if (filter?.division) {
    const targetDivision = filter.division;
    const choice = choices.find((item) => item.division === targetDivision);
    lectures = choice
      ? allLectures.filter((lecture) => lectureInCohort(lecture, choice))
      : allLectures.filter((lecture) => lecture.division === targetDivision);
    const watchedDivisions = new Set(choice ? [choice.division, ...choice.also] : [targetDivision]);
    relevantChanges = changes.filter((change) => !change.division || watchedDivisions.has(change.division));
  } else if (filter?.course || filter?.batch) {
    lectures = allLectures.filter((lecture) =>
      (!filter.course || lecture.course.toLowerCase() === filter.course.toLowerCase()) &&
      (!filter.batch || lecture.batch.toLowerCase() === filter.batch.toLowerCase())
    );
    relevantChanges = changes.filter((change) =>
      (!filter.course || change.course?.toLowerCase() === filter.course.toLowerCase())
    );
  }

  const dates = lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)).sort();
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

export function createApp(db: AppDatabase, config: AppConfig, load: SyncContext["load"], options?: { syncOnRead?: boolean; loadAll?: SyncContext["loadAll"] }) {
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

  async function syncIfStale(filter?: { division?: string; faculty?: string; course?: string; batch?: string }) {
    if (!options?.syncOnRead) return;
    const now = Date.now();
    const intervalMs = config.syncIntervalSeconds * 1000;

    // Faculty needs all sheets
    if (filter?.faculty) {
      const state = readSyncState(db);
      const age = state.lastSuccessAt ? now - new Date(state.lastSuccessAt).getTime() : Number.POSITIVE_INFINITY;
      if (age > intervalMs) {
        await runSync({ db, config, load, loadAll: options?.loadAll });
        for (const sheet of config.spreadsheets) lastSyncBySheet.set(sheet.id, now);
      }
      return;
    }

    // Student scope or single-sheet scope: find target sheet
    const target = sheetForScope(filter ?? {}, config.spreadsheets);
    if (target) {
      const last = lastSyncBySheet.get(target.id) ?? 0;
      const snapshot = loadSnapshot(db);
      const hasLectures = snapshot.some(
        (l) => l.spreadsheetId === target.id || (target.batch && l.batch === target.batch),
      );
      if (hasLectures && now - last < intervalMs) {
        return;
      }
      await runSync({
        db,
        config: { ...config, spreadsheetId: target.id },
        load: () => fetchSpreadsheet({ spreadsheetId: target.id }),
        loadAll: async () => [
          {
            ...(await fetchSpreadsheet({ spreadsheetId: target.id })),
            course: target.course,
            spreadsheetId: target.id,
          },
        ],
      });
      lastSyncBySheet.set(target.id, now);
      return;
    }

    // Default fallback: sync primary sheet if no cohort chosen yet
    const primary = config.spreadsheets.find((s) => s.id === config.spreadsheetId) ?? config.spreadsheets[0];
    if (primary) {
      const last = lastSyncBySheet.get(primary.id) ?? 0;
      const snapshot = loadSnapshot(db);
      const hasLectures = snapshot.some((l) => l.spreadsheetId === primary.id);
      if (hasLectures && now - last < intervalMs) {
        return;
      }
      await runSync({
        db,
        config: { ...config, spreadsheetId: primary.id },
        load: () => fetchSpreadsheet({ spreadsheetId: primary.id }),
        loadAll: async () => [
          {
            ...(await fetchSpreadsheet({ spreadsheetId: primary.id })),
            course: primary.course,
            spreadsheetId: primary.id,
          },
        ],
      });
      lastSyncBySheet.set(primary.id, now);
      return;
    }

    const state = readSyncState(db);
    const age = state.lastSuccessAt ? now - new Date(state.lastSuccessAt).getTime() : Number.POSITIVE_INFINITY;
    if (age > intervalMs) {
      await runSync({ db, config, load, loadAll: options?.loadAll });
    }
  }

  app.get("/api/health", (_req, res) => {
    const state = readSyncState(db);
    res.status(state.lastSuccessAt ? 200 : 503).json({
      ok: Boolean(state.lastSuccessAt),
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
    });
  });
  app.get("/api/bootstrap", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    await syncIfStale({ division, faculty, course, batch });
    res.json(buildBootstrap(db, config, new Date(), { division, faculty, course, batch }));
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
    const target = !faculty ? sheetForScope({ division, course, batch }, config.spreadsheets) : undefined;
    const minGapMs = Math.min(config.syncIntervalSeconds, 15) * 1000;
    if (Date.now() - lastForcedSync < minGapMs) {
      res.setHeader("Retry-After", String(Math.ceil(minGapMs / 1000)));
      res.json(buildBootstrap(db, config, new Date(), { division, faculty, course, batch }));
      return;
    }
    lastForcedSync = Date.now();
    if (target) {
      await runSync({
        db,
        config: { ...config, spreadsheetId: target.id },
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
    } else {
      await runSync({ db, config, load, loadAll: options?.loadAll });
      for (const s of config.spreadsheets) lastSyncBySheet.set(s.id, Date.now());
    }
    res.json(buildBootstrap(db, config, new Date(), { division, faculty, course, batch }));
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
