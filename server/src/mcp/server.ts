import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { listFacultyDirectoryWithCache, type FacultyDirectoryRecord } from "../auth.ts";
import { cohortChoices, cohortLabel, lectureInCohort } from "../../../shared/cohort.ts";
import { divisionMatchesAssigned } from "../../../shared/coordinators.ts";
import { changeMatchesFaculty, lectureMatchesFaculty, personMatch } from "../../../shared/faculty.ts";
import type { PublicLecture } from "../../../shared/types.ts";
import type { AppConfig } from "../config.ts";
import { readSyncState, readWeekBackupsByIds, readWeekSummaries, type AppDatabase } from "../db.ts";
import { listChanges } from "../services/changeHistoryService.ts";
import { ensureWeeksHydrated, hydrateArchive } from "../services/durableState.ts";
import { presentLecture } from "../services/presentLecture.ts";
import { getRedis } from "../services/redis.ts";
import { restoreRemovedLectures } from "../services/restoreRemoved.ts";
import type { SyncOutcome } from "../services/syncScheduler.ts";
import { loadSnapshot } from "../services/timetableSnapshotService.ts";
import { parseTimeToken, zonedParts } from "../time.ts";
import { canonicalOrigin, createRequireMcpAuth, type McpOAuthDependencies } from "./oauth.ts";
import type { McpAuthContext } from "./types.ts";

export interface McpRouterDeps {
  db: AppDatabase;
  config: AppConfig;
  triggerSync: () => Promise<SyncOutcome>;
  oauth?: McpOAuthDependencies;
  listDirectory?: () => Promise<FacultyDirectoryRecord[]>;
}

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

function sortLectures(a: PublicLecture, b: PublicLecture) {
  const date = (a.date ?? "").localeCompare(b.date ?? "");
  if (date !== 0) return date;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.division.localeCompare(b.division) || a.subject.localeCompare(b.subject);
}

function latestWeekWindow(lectures: PublicLecture[]) {
  const dated = lectures.map((l) => l.date).filter((d): d is string => Boolean(d)).sort();
  const latest = dated[dated.length - 1];
  if (!latest) return { start: null as string | null, end: null as string | null, lectures };
  const weekStart = mondayOf(latest);
  const weekEnd = plusDays(weekStart, 6);
  const filtered = lectures.filter((l) => l.date && l.date >= weekStart && l.date <= weekEnd);
  const filteredDates = filtered.map((l) => l.date).filter((d): d is string => Boolean(d)).sort();
  return {
    start: filteredDates[0] ?? weekStart,
    end: filteredDates[filteredDates.length - 1] ?? weekEnd,
    lectures: filtered,
  };
}

function filterByDateOrWeekday(lectures: PublicLecture[], date?: string, weekday?: string) {
  let out = lectures;
  if (date) {
    const clean = date.trim();
    out = out.filter((l) => l.date === clean);
  }
  if (weekday) {
    const clean = weekday.trim().toLowerCase();
    out = out.filter((l) => l.weekday.toLowerCase().startsWith(clean));
  }
  return out;
}

function compactLectureView(lecture: PublicLecture) {
  return {
    id: lecture.id,
    date: lecture.date,
    weekday: lecture.weekday,
    startLabel: lecture.startLabel,
    endLabel: lecture.endLabel,
    startMinutes: lecture.startMinutes,
    endMinutes: lecture.endMinutes,
    subject: lecture.subject,
    faculty: lecture.faculty,
    room: lecture.room,
    course: lecture.course,
    batch: lecture.batch,
    semester: lecture.semester,
    division: lecture.division,
    kind: lecture.kind,
    displayStatus: lecture.displayStatus,
    reason: lecture.reason,
    changeSummary: lecture.changeSummary,
  };
}

function jsonToolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

function getAuthFromExtra(extra: { authInfo?: unknown }): McpAuthContext | null {
  const auth = extra.authInfo as McpAuthContext | undefined;
  return auth?.extra?.email ? auth : null;
}

function isAllowedOrigin(origin: string, req: Request, config: AppConfig): boolean {
  try {
    const parsed = new URL(origin);
    const reqOrigin = canonicalOrigin(req);
    if (parsed.origin === reqOrigin) return true;
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol === "https:" &&
      (host === "claude.ai" ||
        host.endsWith(".claude.ai") ||
        host === "chatgpt.com" ||
        host.endsWith(".chatgpt.com") ||
        host === "platform.openai.com")
    ) {
      return true;
    }
    const configured = (config.clientOrigin || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (configured.includes(parsed.origin)) return true;

    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      const reqHost = (req.get("host") || "").toLowerCase();
      const runningLocally = reqHost.startsWith("localhost") || reqHost.startsWith("127.0.0.1");
      if (runningLocally || parsed.port === "6274") return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function loadTimetableContext(db: AppDatabase, config: AppConfig, monday?: string) {
  await hydrateArchive(db).catch(() => false);
  const now = new Date();
  const snapshot = loadSnapshot(db);
  const changes = listChanges(db, 100);
  const restored = restoreRemovedLectures(snapshot, changes);
  const liveLectures = restored.lectures.map((l) => presentLecture(l, now, config.highlightHours)).sort(sortLectures);

  if (monday) {
    const cleanMonday = monday.trim();
    const ids = readWeekSummaries(db)
      .filter((w) => mondayOf(w.start) === cleanMonday)
      .map((w) => w.id);
    if (ids.length > 0) {
      await ensureWeeksHydrated(db, ids);
      const weeks = readWeekBackupsByIds(db, ids);
      const weekLectures = weeks
        .flatMap((w) => w.lectures)
        .map((l) => presentLecture(l, now, config.highlightHours))
        .sort(sortLectures);
      const weekChanges = weeks.flatMap((w) => w.changes ?? []);
      return {
        now,
        liveLectures,
        lectures: weekLectures,
        changes: weekChanges,
        weekStart: cleanMonday,
        weekEnd: plusDays(cleanMonday, 6),
        isPastWeek: true,
      };
    }
  }

  const latest = latestWeekWindow(liveLectures);
  return {
    now,
    liveLectures,
    lectures: latest.lectures,
    changes,
    weekStart: latest.start,
    weekEnd: latest.end,
    isPastWeek: false,
  };
}

function buildMcpServer(deps: McpRouterDeps, origin: string): McpServer {
  const { db, config } = deps;
  const listDirectory = deps.listDirectory ?? listFacultyDirectoryWithCache;

  const server = new McpServer(
    { name: "aayam-timetable", version: "1.0.0" },
    {
      instructions:
        "Aayam College Timetable MCP server. Call get_my_profile first to inspect the signed-in faculty member's permissions, get_my_schedule for their own classes, and list_cohorts_and_weeks before querying a specific cohort.",
    },
  );

  server.registerTool(
    "get_my_profile",
    {
      title: "Get My Faculty Profile",
      description:
        "Return the OAuth-authenticated faculty member's name, verified email, role tier (faculty, coordinator, or all-access), assigned coordinator cohorts, and granted MCP scopes.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (_args, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      return jsonToolResult({
        email: auth.extra.email,
        facultyName: auth.extra.facultyName,
        canSeeAllFaculty: auth.extra.canSeeAllFaculty,
        coordinatorCohorts: auth.extra.coordinatorCohorts,
        scopes: auth.scopes,
      });
    },
  );

  server.registerTool(
    "get_my_schedule",
    {
      title: "Get My Teaching Schedule",
      description:
        "Return the authenticated faculty member's own classes for the current week or an optional date/weekday/past week. Does not return other faculty members' schedules — use get_faculty_schedule for that.",
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional ISO date filter (YYYY-MM-DD)."),
        weekday: z.string().optional().describe("Optional weekday filter such as Monday, Tue, Wednesday."),
        monday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional past week Monday (YYYY-MM-DD) from list_cohorts_and_weeks."),
        includeCancelled: z.boolean().default(true).describe("Include cancelled lectures (default true)."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ date, weekday, monday, includeCancelled }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      const ctx = await loadTimetableContext(db, config, monday);
      let lectures = ctx.lectures.filter(
        (l) => l.kind !== "break" && lectureMatchesFaculty(l.faculty, auth.extra.facultyName),
      );
      if (!includeCancelled) {
        lectures = lectures.filter((l) => l.displayStatus !== "cancelled");
      }
      lectures = filterByDateOrWeekday(lectures, date, weekday);
      return jsonToolResult({
        facultyName: auth.extra.facultyName,
        weekStart: ctx.weekStart,
        weekEnd: ctx.weekEnd,
        totalClasses: lectures.length,
        lectures: lectures.map(compactLectureView),
      });
    },
  );

  server.registerTool(
    "get_cohort_timetable",
    {
      title: "Get Cohort Timetable",
      description:
        "Return the published timetable for a specific student cohort/division (e.g. 'Sam Altman 2025' or 'Andrew NG'). Call list_cohorts_and_weeks if you need valid cohort names.",
      inputSchema: {
        division: z.string().min(1).describe("Cohort or division name (e.g. 'Sam Altman 2025' or 'Andrew NG')."),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional ISO date filter (YYYY-MM-DD)."),
        weekday: z.string().optional().describe("Optional weekday filter (e.g. Monday)."),
        monday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional past week Monday (YYYY-MM-DD)."),
        includeBreaks: z.boolean().default(false).describe("Include lunch/short breaks (default false)."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ division, date, weekday, monday, includeBreaks }) => {
      const ctx = await loadTimetableContext(db, config, monday);
      const choices = cohortChoices(ctx.liveLectures);
      const target = division.trim().toLowerCase();
      const matched = choices.find(
        (c) =>
          c.division.toLowerCase() === target ||
          cohortLabel(c.division).toLowerCase() === target ||
          c.division.toLowerCase().startsWith(target),
      );
      let lectures = matched
        ? ctx.lectures.filter((l) => lectureInCohort(l, matched))
        : ctx.lectures.filter((l) => l.division.toLowerCase() === target);
      if (!includeBreaks) {
        lectures = lectures.filter((l) => l.kind !== "break");
      }
      lectures = filterByDateOrWeekday(lectures, date, weekday);
      if (lectures.length === 0 && !matched) {
        return toolError(`Cohort "${division}" was not found. Call list_cohorts_and_weeks to see available divisions.`);
      }
      return jsonToolResult({
        division: matched?.division ?? division,
        course: matched?.course ?? lectures[0]?.course ?? null,
        batch: matched?.batch ?? lectures[0]?.batch ?? null,
        weekStart: ctx.weekStart,
        weekEnd: ctx.weekEnd,
        totalSlots: lectures.length,
        lectures: lectures.map(compactLectureView),
      });
    },
  );

  server.registerTool(
    "list_cohorts_and_weeks",
    {
      title: "List Cohorts and Saved Weeks",
      description:
        "List active student cohorts (grouped by course and batch), the current published week range, and archived past weeks available for historical queries.",
      inputSchema: {
        course: z.string().optional().describe("Optional course filter (e.g. BTech, MCA)."),
        batch: z.string().optional().describe("Optional batch filter (e.g. 2025-29)."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ course, batch }) => {
      await hydrateArchive(db).catch(() => false);
      const now = new Date();
      const snapshot = loadSnapshot(db);
      const live = snapshot.map((l) => presentLecture(l, now, config.highlightHours));
      const latest = latestWeekWindow(live);
      let choices = cohortChoices(live);
      if (course) {
        choices = choices.filter((c) => c.course.toLowerCase() === course.trim().toLowerCase());
      }
      if (batch) {
        choices = choices.filter((c) => c.batch.toLowerCase() === batch.trim().toLowerCase());
      }
      const savedWeeks = readWeekSummaries(db)
        .filter((w) => (!course || w.course.toLowerCase() === course.trim().toLowerCase()) && (!batch || w.batch.toLowerCase() === batch.trim().toLowerCase()))
        .map((w) => ({
          id: w.id,
          course: w.course,
          batch: w.batch,
          start: w.start,
          end: w.end,
          monday: mondayOf(w.start),
        }));
      const state = readSyncState(db);
      return jsonToolResult({
        today: zonedParts(now, config.timezone).iso,
        timezone: config.timezone,
        currentWeek: { start: latest.start, end: latest.end },
        lastSyncedAt: state.lastSuccessAt,
        cohorts: choices.map((c) => ({
          division: c.division,
          label: cohortLabel(c.division),
          course: c.course,
          batch: c.batch,
          semester: c.semester,
        })),
        savedWeeks,
      });
    },
  );

  server.registerTool(
    "get_timetable_changes",
    {
      title: "Get Timetable Changes",
      description:
        "List recent timetable updates (cancellations, room changes, reschedules). Use scope='mine' for your own classes, 'cohort' for a division, or 'all' (requires coordinator or all-faculty access).",
      inputSchema: {
        scope: z.enum(["mine", "cohort", "all"]).default("mine").describe("Which updates to return."),
        division: z.string().optional().describe("Required when scope='cohort'."),
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum change events to return (1-100)."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ scope, division, limit }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      await hydrateArchive(db).catch(() => false);
      const snapshot = loadSnapshot(db);
      const changes = listChanges(db, 100);

      if (scope === "mine") {
        const myIds = new Set(
          snapshot
            .filter((l) => l.kind !== "break" && lectureMatchesFaculty(l.faculty, auth.extra.facultyName))
            .map((l) => l.id),
        );
        const filtered = changes.filter((c) => changeMatchesFaculty(c, auth.extra.facultyName, myIds)).slice(0, limit);
        return jsonToolResult({ scope, count: filtered.length, changes: filtered });
      }

      if (scope === "cohort") {
        if (!division?.trim()) {
          return toolError("Parameter 'division' is required when scope='cohort'.");
        }
        const target = division.trim().toLowerCase();
        const filtered = changes.filter((c) => c.division?.toLowerCase() === target).slice(0, limit);
        return jsonToolResult({ scope, division, count: filtered.length, changes: filtered });
      }

      if (auth.extra.canSeeAllFaculty && auth.scopes.includes("faculty:all")) {
        const filtered = changes.slice(0, limit);
        return jsonToolResult({ scope: "all", count: filtered.length, changes: filtered });
      }
      if (auth.extra.coordinatorCohorts.length > 0 && auth.scopes.includes("coordinator:read")) {
        const filtered = changes
          .filter((c) => c.division && auth.extra.coordinatorCohorts.some((assigned) => divisionMatchesAssigned(c.division!, assigned)))
          .slice(0, limit);
        return jsonToolResult({ scope: "coordinator", cohorts: auth.extra.coordinatorCohorts, count: filtered.length, changes: filtered });
      }
      return toolError("Access denied: viewing all changes across every cohort requires coordinator or all-faculty privileges. Use scope='mine' or scope='cohort'.");
    },
  );

  server.registerTool(
    "find_free_rooms_or_slots",
    {
      title: "Find Free Classrooms",
      description:
        "Find classrooms that are unoccupied on a given date/weekday and optional time range across all published cohorts.",
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("ISO date (YYYY-MM-DD). Defaults to today if neither date nor weekday is supplied."),
        weekday: z.string().optional().describe("Weekday name (e.g. Monday, Tuesday)."),
        startTime: z.string().optional().describe("Start time (e.g. '14:00' or '2:00 PM')."),
        endTime: z.string().optional().describe("End time (e.g. '15:00' or '3:00 PM')."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ date, weekday, startTime, endTime }) => {
      const ctx = await loadTimetableContext(db, config);
      const targetDate = date || (!weekday ? zonedParts(ctx.now, config.timezone).iso : undefined);
      const dayLectures = filterByDateOrWeekday(
        ctx.lectures.filter((l) => l.kind === "lecture" && l.displayStatus !== "cancelled"),
        targetDate,
        weekday,
      );

      const allRooms = [
        ...new Set(
          ctx.liveLectures
            .filter((l) => l.kind === "lecture" && l.room && !/^https?:\/\//i.test(l.room))
            .map((l) => l.room.trim()),
        ),
      ].sort();

      const startMin = startTime ? parseTimeToken(startTime) : null;
      const endMin = endTime ? parseTimeToken(endTime) : startMin !== null ? startMin + 60 : null;
      if (startTime && startMin === null) {
        return toolError(`Could not parse startTime "${startTime}". Use formats like "14:00" or "2:00 PM".`);
      }

      const relevant =
        startMin !== null && endMin !== null
          ? dayLectures.filter((l) => l.startMinutes >= 0 && l.startMinutes < endMin && l.endMinutes > startMin)
          : dayLectures;

      const occupiedRooms = new Set(relevant.map((l) => l.room.trim()).filter(Boolean));
      const freeRooms = allRooms.filter((r) => !occupiedRooms.has(r));

      return jsonToolResult({
        date: targetDate ?? null,
        weekday: weekday ?? null,
        window: startTime ? { startTime, endTime: endTime ?? null } : null,
        freeRooms,
        occupiedRooms: [...occupiedRooms].sort(),
        totalKnownRooms: allRooms.length,
      });
    },
  );

  server.registerTool(
    "get_faculty_schedule",
    {
      title: "Get Another Faculty Member's Schedule",
      description:
        "Confidential/privileged tool: look up a specific faculty member's teaching schedule. Regular faculty can only view their own schedule (prefer get_my_schedule); viewing other teachers requires can_see_all_faculty or coordinator scope.",
      inputSchema: {
        faculty: z.string().min(1).describe("Faculty member name (e.g. 'Dr. Aarti P')."),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional ISO date filter (YYYY-MM-DD)."),
        weekday: z.string().optional().describe("Optional weekday filter."),
        monday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional past week Monday (YYYY-MM-DD)."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ faculty, date, weekday, monday }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      const isSelf = personMatch(faculty, auth.extra.facultyName);
      const isAllAccess = auth.extra.canSeeAllFaculty && auth.scopes.includes("faculty:all");
      const isCoordinator = auth.extra.coordinatorCohorts.length > 0 && auth.scopes.includes("coordinator:read");

      if (!isSelf && !isAllAccess && !isCoordinator) {
        return toolError(
          "Access denied: viewing another faculty member's schedule requires can_see_all_faculty permission or coordinator ownership. Use get_my_schedule to view your own classes.",
        );
      }

      const ctx = await loadTimetableContext(db, config, monday);
      let lectures = ctx.lectures.filter((l) => l.kind !== "break" && lectureMatchesFaculty(l.faculty, faculty));
      if (!isSelf && !isAllAccess && isCoordinator) {
        lectures = lectures.filter((l) =>
          auth.extra.coordinatorCohorts.some((assigned) => divisionMatchesAssigned(l.division, assigned)),
        );
      }
      lectures = filterByDateOrWeekday(lectures, date, weekday);

      return jsonToolResult({
        facultyQuery: faculty,
        scopeApplied: isSelf ? "self" : isAllAccess ? "all_faculty" : "coordinator_cohorts",
        weekStart: ctx.weekStart,
        weekEnd: ctx.weekEnd,
        totalClasses: lectures.length,
        lectures: lectures.map(compactLectureView),
      });
    },
  );

  server.registerTool(
    "list_faculty_directory",
    {
      title: "List Confidential Faculty Directory",
      description:
        "Confidential tool: list registered faculty accounts from faculty_directory including emails, permission flags (can_see_all_faculty), active status, and last login timestamp. Strictly requires can_see_all_faculty permission.",
      inputSchema: {
        search: z.string().optional().describe("Optional name or email substring filter."),
        activeOnly: z.boolean().default(true).describe("Only return active directory accounts (default true)."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ search, activeOnly }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      if (!auth.extra.canSeeAllFaculty || !auth.scopes.includes("faculty:directory")) {
        return toolError(
          "Access denied: the faculty directory contains confidential staff emails and permission flags and strictly requires can_see_all_faculty privileges.",
        );
      }
      let rows = await listDirectory();
      if (activeOnly) rows = rows.filter((r) => r.is_active);
      if (search?.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter((r) => r.faculty_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
      }
      return jsonToolResult({
        total: rows.length,
        directory: rows,
      });
    },
  );

  server.registerTool(
    "get_calendar_subscription_info",
    {
      title: "Get Calendar Subscription URL",
      description:
        "Generate an iCalendar (.ics) subscription URL for the authenticated faculty member or a specific student cohort.",
      inputSchema: {
        target: z.enum(["me", "cohort"]).default("me").describe("Whether to return your faculty feed or a cohort feed."),
        division: z.string().optional().describe("Required when target='cohort'."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ target, division }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      if (target === "cohort") {
        if (!division?.trim()) {
          return toolError("Parameter 'division' is required when target='cohort'.");
        }
        const q = encodeURIComponent(division.trim());
        return jsonToolResult({
          target: "cohort",
          division: division.trim(),
          feedUrl: `${origin}/api/calendar.ics?division=${q}`,
          downloadUrl: `${origin}/api/calendar.ics?division=${q}&download=1`,
        });
      }
      const q = encodeURIComponent(auth.extra.facultyName);
      return jsonToolResult({
        target: "faculty",
        facultyName: auth.extra.facultyName,
        feedUrl: `${origin}/api/calendar.ics?faculty=${q}`,
        downloadUrl: `${origin}/api/calendar.ics?faculty=${q}&download=1`,
      });
    },
  );

  server.registerTool(
    "refresh_timetable_sync",
    {
      title: "Refresh Timetable Sync",
      description:
        "Privileged action: trigger an immediate sync from Google Sheets (rate-limited by Redis cooldown). Requires coordinator or all-faculty privileges.",
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (_args, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      if (!auth.extra.canSeeAllFaculty && auth.extra.coordinatorCohorts.length === 0) {
        return toolError("Access denied: triggering manual timetable sync requires coordinator or all-faculty access.");
      }
      const cooldownSec = Math.min(config.syncIntervalSeconds, 15);
      const allowed = await getRedis().setNx("sync:manual:mcp-cooldown", "1", cooldownSec).catch(() => true);
      if (!allowed) {
        return jsonToolResult({
          ok: true,
          skipped: true,
          reason: `Sync recently ran. Try again after ${cooldownSec} seconds.`,
        });
      }
      const outcome = await deps.triggerSync();
      return jsonToolResult({
        ok: outcome.ok,
        unchanged: outcome.unchanged,
        changeCount: outcome.changeCount,
        error: outcome.error,
      });
    },
  );

  return server;
}

export function createMcpRouter(deps: McpRouterDeps) {
  const router = express.Router();
  const requireAuth = createRequireMcpAuth(deps.oauth);

  const mcpOriginAndCors = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      if (!isAllowedOrigin(origin, req, deps.config)) {
        res.status(403).json({ error: "forbidden_origin", error_description: "Origin is not permitted for MCP requests." });
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
    );
    res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };

  const handleMcpPost = async (req: Request, res: Response) => {
    // Normalize Accept header if a strict JSON client omitted text/event-stream so StreamableHTTP accepts it cleanly.
    const accept = typeof req.headers.accept === "string" ? req.headers.accept : "";
    if (!accept.includes("text/event-stream")) {
      req.headers.accept = accept ? `${accept}, text/event-stream` : "application/json, text/event-stream";
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = buildMcpServer(deps, canonicalOrigin(req));
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[mcp] request error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal MCP server error." },
          id: null,
        });
      }
    }
  };

  const handleMcpMethodNotAllowed = (_req: Request, res: Response) => {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for stateless Streamable HTTP MCP requests." },
      id: null,
    });
  };

  for (const mountPath of ["/mcp", "/api/mcp"]) {
    router.use(mountPath, express.json({ limit: "128kb" }), mcpOriginAndCors);
    router.post(mountPath, requireAuth, handleMcpPost);
    router.get(mountPath, requireAuth, handleMcpMethodNotAllowed);
    router.delete(mountPath, requireAuth, handleMcpMethodNotAllowed);
  }

  return router;
}
