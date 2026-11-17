import { cohortLabel, lectureInCohort, type CohortChoice } from "../../../shared/cohort.ts";
import { divisionMatchesAssigned } from "../../../shared/coordinators.ts";
import { changeMatchesFaculty, lectureMatchesFaculty, personMatch } from "../../../shared/faculty.ts";
import { matchChoice, scopeKey, snapshotKeys, type SnapshotIndex } from "../../../shared/scope.ts";
import type { BootstrapResponse, ChangeEvent, PublicLecture } from "../../../shared/types.ts";
import type { SqlDb } from "../d1/sql.ts";
import { allowedOrigins, json } from "./http.ts";
import type { Ctx } from "./env.ts";
import { canonicalOrigin, requireMcpAuth } from "./oauth.ts";
import type { McpAuth } from "./oauthStore.ts";
import { readSnapshots, todayIn } from "./read.ts";
import { requestSync } from "./sync.ts";

/**
 * Remote MCP server, stateless Streamable HTTP with JSON responses (no SSE, no sessions), at `POST /mcp`
 * and `POST /api/mcp`. Tools read prebuilt snapshots: a scoped `boot:` or `week:` row (≤ ~50 KB) is
 * parsed; anything that needs every cohort (`find_free_rooms_or_slots`, `list_cohorts_and_weeks`) asks
 * D1 for just the fields it needs with SQLite JSON functions, so `boot:all` is never parsed here.
 */

export const SERVER_INFO = { name: "aayam-timetable", version: "1.0.0" };
const INSTRUCTIONS =
  "Aayam College Timetable MCP server. Call get_my_profile first to inspect the signed-in faculty member's permissions, get_my_schedule for their own classes, and list_cohorts_and_weeks before querying a specific cohort.";
export const LATEST_PROTOCOL_VERSION = "2025-11-25";
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"];
const MAX_MCP_BODY_BYTES = 128 * 1024;

// --- Tool input schemas ------------------------------------------------------------------------------------

interface Prop {
  type: "string" | "boolean" | "integer";
  description: string;
  pattern?: string;
  minLength?: number;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: string | number | boolean;
}

interface ToolDef {
  name: string;
  title: string;
  description: string;
  properties: Record<string, Prop>;
  required?: string[];
  readOnly?: boolean;
  openWorld?: boolean;
  run: (args: Record<string, any>, call: ToolCall) => Promise<ToolResult>;
}

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const ISO_DATE = "^\\d{4}-\\d{2}-\\d{2}$";
const dateProp = (description: string): Prop => ({ type: "string", pattern: ISO_DATE, description });

function inputSchema(tool: ToolDef) {
  return {
    type: "object",
    properties: tool.properties,
    ...(tool.required && tool.required.length > 0 ? { required: tool.required } : {}),
    $schema: "http://json-schema.org/draft-07/schema#",
  };
}

/** The subset of JSON Schema the tools use. Unknown keys are dropped, defaults filled, like the zod schemas were. */
function validateArgs(tool: ToolDef, raw: unknown): { ok: true; args: Record<string, unknown> } | { ok: false; message: string } {
  const input = raw === undefined || raw === null ? {} : raw;
  if (typeof input !== "object" || Array.isArray(input)) return { ok: false, message: "Expected an object of arguments." };
  const source = input as Record<string, unknown>;
  const args: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [key, prop] of Object.entries(tool.properties)) {
    const value = source[key];
    if (value === undefined) {
      if (prop.default !== undefined) args[key] = prop.default;
      else if (tool.required?.includes(key)) problems.push(`${key}: Required`);
      continue;
    }
    if (prop.type === "string") {
      if (typeof value !== "string") problems.push(`${key}: Expected string, received ${typeof value}`);
      else if (prop.minLength !== undefined && value.length < prop.minLength) problems.push(`${key}: Too small: expected string to have >=${prop.minLength} characters`);
      else if (prop.pattern && !new RegExp(prop.pattern).test(value)) problems.push(`${key}: Invalid string: must match pattern ${prop.pattern}`);
      else if (prop.enum && !prop.enum.includes(value)) problems.push(`${key}: Invalid option: expected one of ${prop.enum.map((item) => `"${item}"`).join("|")}`);
      else args[key] = value;
    } else if (prop.type === "boolean") {
      if (typeof value !== "boolean") problems.push(`${key}: Expected boolean, received ${typeof value}`);
      else args[key] = value;
    } else {
      if (typeof value !== "number" || !Number.isInteger(value)) problems.push(`${key}: Expected int, received ${typeof value}`);
      else if (prop.minimum !== undefined && value < prop.minimum) problems.push(`${key}: Too small: expected number to be >=${prop.minimum}`);
      else if (prop.maximum !== undefined && value > prop.maximum) problems.push(`${key}: Too big: expected number to be <=${prop.maximum}`);
      else args[key] = value;
    }
  }
  return problems.length > 0 ? { ok: false, message: problems.join("; ") } : { ok: true, args };
}

// --- Data access -------------------------------------------------------------------------------------------

export interface DirectoryRecord {
  id: number;
  email: string;
  faculty_name: string;
  can_see_all_faculty: boolean;
  is_active: boolean;
  last_login_at: string | null;
}

/** Everything a tool reads or does. `edgeIo` is D1; the CPU bench passes an in-memory one. */
export interface McpIo {
  snapshots(keysFor: (index: SnapshotIndex) => string[], fixedKeys?: string[]): Promise<{ index: SnapshotIndex | null; bodies: Map<string, string> }>;
  /**
   * `weekStart`, `weekEnd`, `savedWeeks` (JSON text), and the distinct lecture divisions (JSON text) of
   * `boot:all`, extracted by D1, plus the `sync` body.
   */
  weekSummary(): Promise<{ weekStart: string | null; weekEnd: string | null; savedWeeks: string | null; divisions: string | null; sync: string | null }>;
  /** Distinct classroom names of `boot:all`, and the rooms busy on a date and/or weekday prefix. */
  roomUse(date: string | null, weekday: string | null): Promise<{ rooms: string[]; busy: Array<{ room: string; start: number; end: number }> }>;
  directory(): Promise<DirectoryRecord[]>;
  requestSync(): Promise<{ dispatched: boolean }>;
}

export function edgeIo(ctx: Ctx): McpIo {
  const db: SqlDb = ctx.db;
  const all = snapshotKeys.bootstrap("all");
  return {
    snapshots: (keysFor, fixedKeys = []) => readSnapshots(db, keysFor, fixedKeys),
    async weekSummary() {
      const rows = await db.all<{ key: string; body: string | null; ws: string | null; we: string | null; saved: string | null; divisions: string | null }>(
        `SELECT key,
          CASE WHEN key = ? THEN body END AS body,
          CASE WHEN key = ? THEN json_extract(body, '$.weekStart') END AS ws,
          CASE WHEN key = ? THEN json_extract(body, '$.weekEnd') END AS we,
          CASE WHEN key = ? THEN json_extract(body, '$.savedWeeks') END AS saved,
          CASE WHEN key = ? THEN (SELECT json_group_array(DISTINCT json_extract(l.value, '$.division')) FROM json_each(snapshots.body, '$.lectures') AS l) END AS divisions
        FROM snapshots WHERE key IN (?, ?)`,
        [snapshotKeys.sync, all, all, all, all, snapshotKeys.sync, all],
      );
      const boot = rows.find((row) => row.key === all);
      return {
        weekStart: boot?.ws ?? null,
        weekEnd: boot?.we ?? null,
        savedWeeks: boot?.saved ?? null,
        divisions: boot?.divisions ?? null,
        sync: rows.find((row) => row.key === snapshotKeys.sync)?.body ?? null,
      };
    },
    async roomUse(date, weekday) {
      const rows = await db.all<{ kind: string; room: string | null; s: number | null; e: number | null }>(
        `SELECT 'r' AS kind, room, NULL AS s, NULL AS e FROM (
          SELECT DISTINCT trim(json_extract(l.value, '$.room')) AS room
          FROM snapshots, json_each(snapshots.body, '$.lectures') AS l
          WHERE snapshots.key = ? AND json_extract(l.value, '$.kind') = 'lecture'
        ) WHERE room <> '' AND lower(room) NOT LIKE 'http://%' AND lower(room) NOT LIKE 'https://%'
        UNION ALL
        SELECT 'b', trim(json_extract(l.value, '$.room')), json_extract(l.value, '$.startMinutes'), json_extract(l.value, '$.endMinutes')
        FROM snapshots, json_each(snapshots.body, '$.lectures') AS l
        WHERE snapshots.key = ? AND json_extract(l.value, '$.kind') = 'lecture'
          AND coalesce(json_extract(l.value, '$.displayStatus'), '') <> 'cancelled'
          AND (? IS NULL OR json_extract(l.value, '$.date') = ?)
          AND (? IS NULL OR substr(lower(json_extract(l.value, '$.weekday')), 1, length(?)) = ?)`,
        [all, all, date, date, weekday, weekday, weekday],
      );
      return {
        rooms: rows.filter((row) => row.kind === "r" && row.room).map((row) => row.room!),
        busy: rows.filter((row) => row.kind === "b").map((row) => ({ room: row.room ?? "", start: Number(row.s), end: Number(row.e) })),
      };
    },
    async directory() {
      const rows = await db.all<{ id: number; email: string; faculty_name: string; can_see_all_faculty: number; is_active: number; last_login_at: string | null }>(
        "SELECT id, email, faculty_name, can_see_all_faculty, is_active, last_login_at FROM faculty_directory ORDER BY faculty_name ASC, id ASC",
      );
      return rows.map((row) => ({
        id: Number(row.id),
        email: String(row.email),
        faculty_name: String(row.faculty_name),
        can_see_all_faculty: Boolean(row.can_see_all_faculty),
        is_active: Boolean(row.is_active),
        last_login_at: row.last_login_at ? String(row.last_login_at) : null,
      }));
    },
    requestSync: () => requestSync(ctx.env, "manual", { user: true, db }),
  };
}

interface ToolCall {
  auth: McpAuth;
  io: McpIo;
  origin: string;
  timezone: string;
  now: Date;
}

// --- Helpers -----------------------------------------------------------------------------------------------

function mondayOf(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function plusDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Same as `parseTimeToken` in `server/src/time.ts`: "14:00", "2 PM", "2:00 PM". */
export function parseTimeToken(token: string): number | null {
  const match = token.replace(/\s+/g, " ").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const suffix = match[3]?.toUpperCase();
  if (hour > 23 || minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "PM" && hour < 12) hour += 12;
    if (suffix === "AM" && hour === 12) hour = 0;
  }
  return hour * 60 + minute;
}

function filterByDateOrWeekday(lectures: PublicLecture[], date?: string, weekday?: string) {
  let out = lectures;
  if (date) {
    const clean = date.trim();
    out = out.filter((lecture) => lecture.date === clean);
  }
  if (weekday) {
    const clean = weekday.trim().toLowerCase();
    out = out.filter((lecture) => lecture.weekday.toLowerCase().startsWith(clean));
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

function jsonToolResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

const NOT_READY = "The timetable is not ready yet. Try again in a minute.";

type Boot = Pick<BootstrapResponse, "lectures" | "changes" | "weekStart" | "weekEnd">;

/**
 * Lectures for one scope: the saved week for `monday` when the job stored one for this scope, else the
 * live week. One D1 read (none extra when the index is cached in this isolate).
 */
async function scopedLectures(io: McpIo, scopeFor: (index: SnapshotIndex) => string, monday?: string, extraFixed: string[] = []) {
  const cleanMonday = monday?.trim() ?? "";
  const { index, bodies } = await io.snapshots((current) => {
    const scope = scopeFor(current);
    return cleanMonday ? [snapshotKeys.bootstrap(scope), snapshotKeys.week(cleanMonday, scope)] : [snapshotKeys.bootstrap(scope)];
  }, extraFixed);
  if (!index) return null;
  const scope = scopeFor(index);
  const weekBody = cleanMonday ? bodies.get(snapshotKeys.week(cleanMonday, scope)) : undefined;
  if (weekBody) {
    const week = JSON.parse(weekBody) as { lectures: PublicLecture[] };
    return { index, bodies, lectures: week.lectures ?? [], weekStart: cleanMonday, weekEnd: plusDays(cleanMonday, 6), boot: null as Boot | null };
  }
  // A scope the job wrote no row for (`none`, an unknown faculty) reads as no lectures.
  const bootBody = bodies.get(snapshotKeys.bootstrap(scope));
  const boot = bootBody ? (JSON.parse(bootBody) as Boot) : { lectures: [], changes: [], weekStart: null, weekEnd: null };
  return { index, bodies, lectures: boot.lectures ?? [], weekStart: boot.weekStart ?? null, weekEnd: boot.weekEnd ?? null, boot };
}

const facultyScope = (name: string) => (index: SnapshotIndex) => scopeKey({ faculty: name }, index);

/** Neel's cohort lookup (exact, label, prefix), then the server's `matchChoice`. */
function findCohort(division: string, choices: CohortChoice[]) {
  const target = division.trim().toLowerCase();
  return (
    choices.find(
      (choice) => choice.division.toLowerCase() === target || cohortLabel(choice.division).toLowerCase() === target || choice.division.toLowerCase().startsWith(target),
    ) ?? matchChoice(division, choices)
  );
}

async function recentChanges(io: McpIo, extraKeysFor: (index: SnapshotIndex) => string[] = () => []) {
  const { index, bodies } = await io.snapshots(extraKeysFor, [snapshotKeys.changes]);
  const body = bodies.get(snapshotKeys.changes);
  const parsed = body ? (JSON.parse(body) as { changes?: ChangeEvent[] }) : {};
  // The old server listed the newest 100.
  return { index, bodies, changes: (Array.isArray(parsed.changes) ? parsed.changes : []).slice(0, 100) };
}

// --- Tools -------------------------------------------------------------------------------------------------

export const TOOLS: ToolDef[] = [
  {
    name: "get_my_profile",
    title: "Get My Faculty Profile",
    description:
      "Return the OAuth-authenticated faculty member's name, verified email, role tier (faculty, coordinator, or all-access), assigned coordinator cohorts, and granted MCP scopes.",
    properties: {},
    async run(_args, { auth }) {
      return jsonToolResult({
        email: auth.identity.email,
        facultyName: auth.identity.facultyName,
        canSeeAllFaculty: auth.identity.canSeeAllFaculty,
        coordinatorCohorts: auth.identity.coordinatorCohorts,
        scopes: auth.scopes,
      });
    },
  },
  {
    name: "get_my_schedule",
    title: "Get My Teaching Schedule",
    description:
      "Return the authenticated faculty member's own classes for the current week or an optional date/weekday/past week. Does not return other faculty members' schedules — use get_faculty_schedule for that.",
    properties: {
      date: dateProp("Optional ISO date filter (YYYY-MM-DD)."),
      weekday: { type: "string", description: "Optional weekday filter such as Monday, Tue, Wednesday." },
      monday: dateProp("Optional past week Monday (YYYY-MM-DD) from list_cohorts_and_weeks."),
      includeCancelled: { type: "boolean", default: true, description: "Include cancelled lectures (default true)." },
    },
    async run({ date, weekday, monday, includeCancelled }, { auth, io }) {
      const name = auth.identity.facultyName;
      const ctx = await scopedLectures(io, facultyScope(name), monday);
      if (!ctx) return toolError(NOT_READY);
      let lectures = ctx.lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, name));
      if (!includeCancelled) lectures = lectures.filter((lecture) => lecture.displayStatus !== "cancelled");
      lectures = filterByDateOrWeekday(lectures, date, weekday);
      return jsonToolResult({ facultyName: name, weekStart: ctx.weekStart, weekEnd: ctx.weekEnd, totalClasses: lectures.length, lectures: lectures.map(compactLectureView) });
    },
  },
  {
    name: "get_cohort_timetable",
    title: "Get Cohort Timetable",
    description:
      "Return the published timetable for a specific student cohort/division (e.g. 'Sam Altman 2025' or 'Andrew NG'). Call list_cohorts_and_weeks if you need valid cohort names.",
    properties: {
      division: { type: "string", minLength: 1, description: "Cohort or division name (e.g. 'Sam Altman 2025' or 'Andrew NG')." },
      date: dateProp("Optional ISO date filter (YYYY-MM-DD)."),
      weekday: { type: "string", description: "Optional weekday filter (e.g. Monday)." },
      monday: dateProp("Optional past week Monday (YYYY-MM-DD)."),
      includeBreaks: { type: "boolean", default: false, description: "Include lunch/short breaks (default false)." },
    },
    required: ["division"],
    async run({ division, date, weekday, monday, includeBreaks }, { io }) {
      let matched: CohortChoice | undefined;
      const ctx = await scopedLectures(
        io,
        (index) => {
          matched = findCohort(division, index.choices);
          return matched ? scopeKey({ division: matched.division }, index) : "none";
        },
        monday,
      );
      if (!ctx) return toolError(NOT_READY);
      let lectures = matched ? ctx.lectures.filter((lecture) => lectureInCohort(lecture, matched!)) : [];
      if (!includeBreaks) lectures = lectures.filter((lecture) => lecture.kind !== "break");
      lectures = filterByDateOrWeekday(lectures, date, weekday);
      if (!matched) return toolError(`Cohort "${division}" was not found. Call list_cohorts_and_weeks to see available divisions.`);
      return jsonToolResult({
        division: matched.division,
        course: matched.course ?? lectures[0]?.course ?? null,
        batch: matched.batch ?? lectures[0]?.batch ?? null,
        weekStart: ctx.weekStart,
        weekEnd: ctx.weekEnd,
        totalSlots: lectures.length,
        lectures: lectures.map(compactLectureView),
      });
    },
  },
  {
    name: "list_cohorts_and_weeks",
    title: "List Cohorts and Saved Weeks",
    description:
      "List active student cohorts (grouped by course and batch), the current published week range, and archived past weeks available for historical queries.",
    properties: {
      course: { type: "string", description: "Optional course filter (e.g. BTech, MCA)." },
      batch: { type: "string", description: "Optional batch filter (e.g. 2025-29)." },
    },
    async run({ course, batch }, { io, now, timezone }) {
      const [{ index }, summary] = await Promise.all([io.snapshots(() => []), io.weekSummary()]);
      if (!index) return toolError(NOT_READY);
      const wantCourse = typeof course === "string" ? course.trim().toLowerCase() : "";
      const wantBatch = typeof batch === "string" ? batch.trim().toLowerCase() : "";
      // Only cohorts with published lectures, as before; the index also lists the default cohorts.
      const live = new Set<string>(summary.divisions ? (JSON.parse(summary.divisions) as string[]) : []);
      const choices = index.choices.filter(
        (choice) =>
          live.has(choice.division) && (!wantCourse || choice.course.toLowerCase() === wantCourse) && (!wantBatch || choice.batch.toLowerCase() === wantBatch),
      );
      let saved: Array<{ id: string; course: string; batch: string; start: string; end: string }> = [];
      try {
        const parsed = summary.savedWeeks ? (JSON.parse(summary.savedWeeks) as typeof saved) : [];
        saved = Array.isArray(parsed) ? parsed : [];
      } catch {
        saved = [];
      }
      const sync = summary.sync ? (JSON.parse(summary.sync) as { lastSuccessAt?: string | null }) : null;
      const zone = index.timezone || timezone;
      return jsonToolResult({
        today: todayIn(zone, now),
        timezone: zone,
        currentWeek: { start: summary.weekStart, end: summary.weekEnd },
        lastSyncedAt: sync?.lastSuccessAt ?? null,
        cohorts: choices.map((choice) => ({
          division: choice.division,
          label: cohortLabel(choice.division),
          course: choice.course,
          batch: choice.batch,
          semester: choice.semester,
        })),
        savedWeeks: saved
          .filter((week) => (!wantCourse || week.course.toLowerCase() === wantCourse) && (!wantBatch || week.batch.toLowerCase() === wantBatch))
          .map((week) => ({ id: week.id, course: week.course, batch: week.batch, start: week.start, end: week.end, monday: mondayOf(week.start) })),
      });
    },
  },
  {
    name: "get_timetable_changes",
    title: "Get Timetable Changes",
    description:
      "List recent timetable updates (cancellations, room changes, reschedules). Use scope='mine' for your own classes, 'cohort' for a division, or 'all' (requires coordinator or all-faculty access).",
    properties: {
      scope: { type: "string", enum: ["mine", "cohort", "all"], default: "mine", description: "Which updates to return." },
      division: { type: "string", description: "Required when scope='cohort'." },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 25, description: "Maximum change events to return (1-100)." },
    },
    async run({ scope, division, limit }, { auth, io }) {
      const name = auth.identity.facultyName;
      if (scope === "mine") {
        const bootKey = (index: SnapshotIndex) => [snapshotKeys.bootstrap(facultyScope(name)(index))];
        const { index, bodies, changes } = await recentChanges(io, bootKey);
        if (!index) return toolError(NOT_READY);
        const bootBody = bodies.get(bootKey(index)[0]!);
        const lectures = bootBody ? ((JSON.parse(bootBody) as Boot).lectures ?? []) : [];
        const myIds = new Set(lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, name)).map((lecture) => lecture.id));
        const filtered = changes.filter((change) => changeMatchesFaculty(change, name, myIds)).slice(0, limit);
        return jsonToolResult({ scope, count: filtered.length, changes: filtered });
      }
      if (scope === "cohort") {
        if (typeof division !== "string" || !division.trim()) return toolError("Parameter 'division' is required when scope='cohort'.");
        const { changes } = await recentChanges(io);
        const target = division.trim().toLowerCase();
        const filtered = changes.filter((change) => change.division?.toLowerCase() === target).slice(0, limit);
        return jsonToolResult({ scope, division, count: filtered.length, changes: filtered });
      }
      if (auth.identity.canSeeAllFaculty && auth.scopes.includes("faculty:all")) {
        const { changes } = await recentChanges(io);
        const filtered = changes.slice(0, limit);
        return jsonToolResult({ scope: "all", count: filtered.length, changes: filtered });
      }
      const cohorts = auth.identity.coordinatorCohorts;
      if (cohorts.length > 0 && auth.scopes.includes("coordinator:read")) {
        const { changes } = await recentChanges(io);
        const filtered = changes
          .filter((change) => change.division && cohorts.some((assigned) => divisionMatchesAssigned(change.division!, assigned)))
          .slice(0, limit);
        return jsonToolResult({ scope: "coordinator", cohorts, count: filtered.length, changes: filtered });
      }
      return toolError(
        "Access denied: viewing all changes across every cohort requires coordinator or all-faculty privileges. Use scope='mine' or scope='cohort'.",
      );
    },
  },
  {
    name: "find_free_rooms_or_slots",
    title: "Find Free Classrooms",
    description: "Find classrooms that are unoccupied on a given date/weekday and optional time range across all published cohorts.",
    properties: {
      date: dateProp("ISO date (YYYY-MM-DD). Defaults to today if neither date nor weekday is supplied."),
      weekday: { type: "string", description: "Weekday name (e.g. Monday, Tuesday)." },
      startTime: { type: "string", description: "Start time (e.g. '14:00' or '2:00 PM')." },
      endTime: { type: "string", description: "End time (e.g. '15:00' or '3:00 PM')." },
    },
    async run({ date, weekday, startTime, endTime }, { io, now, timezone }) {
      const startMin = startTime ? parseTimeToken(startTime) : null;
      const endMin = endTime ? parseTimeToken(endTime) : startMin !== null ? startMin + 60 : null;
      if (startTime && startMin === null) return toolError(`Could not parse startTime "${startTime}". Use formats like "14:00" or "2:00 PM".`);
      const targetDate: string | undefined = date || (!weekday ? todayIn(timezone, now) : undefined);
      const weekdayPrefix = weekday ? weekday.trim().toLowerCase() : "";
      const use = await io.roomUse(targetDate ?? null, weekdayPrefix || null);
      const allRooms = [...new Set(use.rooms)].sort();
      const relevant =
        startMin !== null && endMin !== null ? use.busy.filter((slot) => slot.start >= 0 && slot.start < endMin && slot.end > startMin) : use.busy;
      const occupied = new Set(relevant.map((slot) => slot.room.trim()).filter(Boolean));
      return jsonToolResult({
        date: targetDate ?? null,
        weekday: weekday ?? null,
        window: startTime ? { startTime, endTime: endTime ?? null } : null,
        freeRooms: allRooms.filter((room) => !occupied.has(room)),
        occupiedRooms: [...occupied].sort(),
        totalKnownRooms: allRooms.length,
      });
    },
  },
  {
    name: "get_faculty_schedule",
    title: "Get Another Faculty Member's Schedule",
    description:
      "Confidential/privileged tool: look up a specific faculty member's teaching schedule. Regular faculty can only view their own schedule (prefer get_my_schedule); viewing other teachers requires can_see_all_faculty or coordinator scope.",
    properties: {
      faculty: { type: "string", minLength: 1, description: "Faculty member name (e.g. 'Dr. Aarti P')." },
      date: dateProp("Optional ISO date filter (YYYY-MM-DD)."),
      weekday: { type: "string", description: "Optional weekday filter." },
      monday: dateProp("Optional past week Monday (YYYY-MM-DD)."),
    },
    required: ["faculty"],
    async run({ faculty, date, weekday, monday }, { auth, io }) {
      const isSelf = personMatch(faculty, auth.identity.facultyName);
      const isAllAccess = auth.identity.canSeeAllFaculty && auth.scopes.includes("faculty:all");
      const cohorts = auth.identity.coordinatorCohorts;
      const isCoordinator = cohorts.length > 0 && auth.scopes.includes("coordinator:read");
      if (!isSelf && !isAllAccess && !isCoordinator) {
        return toolError(
          "Access denied: viewing another faculty member's schedule requires can_see_all_faculty permission or coordinator ownership. Use get_my_schedule to view your own classes.",
        );
      }
      const ctx = await scopedLectures(io, facultyScope(faculty), monday);
      if (!ctx) return toolError(NOT_READY);
      let lectures = ctx.lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, faculty));
      if (!isSelf && !isAllAccess && isCoordinator) {
        lectures = lectures.filter((lecture) => cohorts.some((assigned) => divisionMatchesAssigned(lecture.division, assigned)));
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
  },
  {
    name: "list_faculty_directory",
    title: "List Confidential Faculty Directory",
    description:
      "Confidential tool: list registered faculty accounts from faculty_directory including emails, permission flags (can_see_all_faculty), active status, and last login timestamp. Strictly requires can_see_all_faculty permission.",
    properties: {
      search: { type: "string", description: "Optional name or email substring filter." },
      activeOnly: { type: "boolean", default: true, description: "Only return active directory accounts (default true)." },
    },
    async run({ search, activeOnly }, { auth, io }) {
      if (!auth.identity.canSeeAllFaculty || !auth.scopes.includes("faculty:directory")) {
        return toolError(
          "Access denied: the faculty directory contains confidential staff emails and permission flags and strictly requires can_see_all_faculty privileges.",
        );
      }
      let rows = await io.directory();
      if (activeOnly) rows = rows.filter((row) => row.is_active);
      if (typeof search === "string" && search.trim()) {
        const query = search.trim().toLowerCase();
        rows = rows.filter((row) => row.faculty_name.toLowerCase().includes(query) || row.email.toLowerCase().includes(query));
      }
      return jsonToolResult({ total: rows.length, directory: rows });
    },
  },
  {
    name: "get_calendar_subscription_info",
    title: "Get Calendar Subscription URL",
    description: "Generate an iCalendar (.ics) subscription URL for the authenticated faculty member or a specific student cohort.",
    properties: {
      target: { type: "string", enum: ["me", "cohort"], default: "me", description: "Whether to return your faculty feed or a cohort feed." },
      division: { type: "string", description: "Required when target='cohort'." },
    },
    async run({ target, division }, { auth, origin }) {
      if (target === "cohort") {
        if (typeof division !== "string" || !division.trim()) return toolError("Parameter 'division' is required when target='cohort'.");
        const query = encodeURIComponent(division.trim());
        return jsonToolResult({
          target: "cohort",
          division: division.trim(),
          feedUrl: `${origin}/api/calendar.ics?division=${query}`,
          downloadUrl: `${origin}/api/calendar.ics?division=${query}&download=1`,
        });
      }
      const query = encodeURIComponent(auth.identity.facultyName);
      return jsonToolResult({
        target: "faculty",
        facultyName: auth.identity.facultyName,
        feedUrl: `${origin}/api/calendar.ics?faculty=${query}`,
        downloadUrl: `${origin}/api/calendar.ics?faculty=${query}&download=1`,
      });
    },
  },
  {
    name: "refresh_timetable_sync",
    title: "Refresh Timetable Sync",
    description:
      "Privileged action: ask the sync job to re-read the Google Sheets now (it runs in about a minute; at most one dispatch per minute). Requires coordinator or all-faculty privileges.",
    properties: {},
    readOnly: false,
    openWorld: true,
    async run(_args, { auth, io }) {
      if (!auth.identity.canSeeAllFaculty && auth.identity.coordinatorCohorts.length === 0) {
        return toolError("Access denied: triggering manual timetable sync requires coordinator or all-faculty access.");
      }
      const { dispatched } = await io.requestSync();
      return jsonToolResult({
        ok: true,
        queued: true,
        dispatched,
        reason: dispatched
          ? "The sync job was started. New data appears in about a minute."
          : "A sync was already started in the last minute, or the job will pick this request up on its next scheduled run.",
      });
    },
  },
];

const toolsByName = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function toolList() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: inputSchema(tool),
    annotations: {
      readOnlyHint: tool.readOnly !== false,
      destructiveHint: false,
      idempotentHint: true,
      ...(tool.openWorld ? { openWorldHint: true } : {}),
    },
  }));
}

// --- JSON-RPC ----------------------------------------------------------------------------------------------

type JsonRpcId = string | number | null;

interface RpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

const rpcError = (id: JsonRpcId, code: number, message: string) => ({ jsonrpc: "2.0", error: { code, message }, id });

/** One JSON-RPC message. Null for notifications and responses, which get no reply. */
export async function handleRpc(message: unknown, call: ToolCall): Promise<object | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return rpcError(null, -32600, "Invalid Request");
  const msg = message as RpcMessage;
  const hasId = typeof msg.id === "string" || typeof msg.id === "number";
  if (msg.jsonrpc !== "2.0") return rpcError(hasId ? (msg.id as JsonRpcId) : null, -32600, "Invalid Request");
  if (typeof msg.method !== "string") return hasId || "result" in msg || "error" in msg ? null : rpcError(null, -32600, "Invalid Request");
  if (!hasId) return null;
  const id = msg.id as JsonRpcId;
  const params = msg.params && typeof msg.params === "object" ? (msg.params as Record<string, unknown>) : {};
  const result = (value: unknown) => ({ jsonrpc: "2.0", id, result: value });

  switch (msg.method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return result({
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: true } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result({});
    case "tools/list":
      return result({ tools: toolList() });
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const tool = toolsByName.get(name);
      if (!tool) return result(toolError(`MCP error -32602: Tool ${name} not found`));
      const checked = validateArgs(tool, params.arguments);
      if (!checked.ok) return result(toolError(`MCP error -32602: Input validation error: Invalid arguments for tool ${name}: ${checked.message}`));
      try {
        return result(await tool.run(checked.args, call));
      } catch (error) {
        console.error("[mcp] tool failed", name, error instanceof Error ? error.message : error);
        return result(toolError(error instanceof Error ? error.message : String(error)));
      }
    }
    default:
      return rpcError(id, -32601, "Method not found");
  }
}

// --- HTTP --------------------------------------------------------------------------------------------------

/** The site itself, AI hosts that call MCP from a browser, CLIENT_ORIGIN, and localhost while developing. */
export function isAllowedOrigin(origin: string, ctx: Ctx): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.origin === canonicalOrigin(ctx.env, ctx.url) || parsed.origin === ctx.url.origin) return true;
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol === "https:" &&
      (host === "claude.ai" || host.endsWith(".claude.ai") || host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "platform.openai.com")
    ) {
      return true;
    }
    if (allowedOrigins(ctx.env.CLIENT_ORIGIN).includes(parsed.origin)) return true;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      const requestHost = ctx.url.hostname.toLowerCase();
      if (requestHost === "localhost" || requestHost === "127.0.0.1" || parsed.port === "6274") return true;
    }
    return false;
  } catch {
    return false;
  }
}

function withMcpCors(response: Response, origin: string | null) {
  const headers = response.headers;
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.append("Vary", "Origin");
  } else {
    headers.set("Access-Control-Allow-Origin", "*");
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version");
  headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version");
  headers.set("Access-Control-Max-Age", "86400");
  return response;
}

const rpcHttpError = (status: number, code: number, message: string, headers?: HeadersInit) => json(rpcError(null, code, message), status, headers);

/** `/mcp` and `/api/mcp`, every method. */
export async function mcpEndpoint(ctx: Ctx, io: McpIo = edgeIo(ctx)): Promise<Response> {
  const origin = ctx.request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin, ctx)) {
    return json({ error: "forbidden_origin", error_description: "Origin is not permitted for MCP requests." }, 403);
  }
  return withMcpCors(await mcpInner(ctx, io), origin);
}

async function mcpInner(ctx: Ctx, io: McpIo): Promise<Response> {
  const method = ctx.request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204 });
  if (method !== "POST" && method !== "GET" && method !== "HEAD" && method !== "DELETE") {
    return rpcHttpError(405, -32000, "Method not allowed.", { Allow: "POST, OPTIONS" });
  }
  const auth = await requireMcpAuth(ctx);
  if (auth instanceof Response) return auth;
  if (method !== "POST") {
    return rpcHttpError(405, -32000, "Method not allowed. Use POST for stateless Streamable HTTP MCP requests.", { Allow: "POST, OPTIONS" });
  }

  const accept = ctx.request.headers.get("Accept") ?? "";
  if (accept && !/application\/json|\*\/\*|application\/\*/i.test(accept) && !accept.includes("text/event-stream")) {
    return rpcHttpError(406, -32000, "Not Acceptable: Client must accept application/json");
  }
  if (!(ctx.request.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
    return rpcHttpError(415, -32000, "Unsupported Media Type: Content-Type must be application/json");
  }
  if (Number(ctx.request.headers.get("Content-Length") ?? "0") > MAX_MCP_BODY_BYTES) return rpcHttpError(413, -32000, "Request body is too large.");
  const raw = await ctx.request.text();
  if (raw.length > MAX_MCP_BODY_BYTES) return rpcHttpError(413, -32000, "Request body is too large.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return rpcHttpError(400, -32700, "Parse error");
  }
  const messages = Array.isArray(body) ? body : [body];
  if (messages.length === 0) return rpcHttpError(400, -32600, "Invalid Request");
  const isInit = messages.some((item) => item && typeof item === "object" && (item as RpcMessage).method === "initialize");
  const version = ctx.request.headers.get("MCP-Protocol-Version");
  if (!isInit && version && !SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
    return rpcHttpError(400, -32000, `Bad Request: Unsupported protocol version (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")})`);
  }

  const call: ToolCall = {
    auth,
    io,
    origin: canonicalOrigin(ctx.env, ctx.url),
    timezone: ctx.env.TIMEZONE || "Asia/Kolkata",
    now: new Date(),
  };
  const replies: object[] = [];
  for (const message of messages) {
    const reply = await handleRpc(message, call);
    if (reply) replies.push(reply);
  }
  if (replies.length === 0) return new Response(null, { status: 202 });
  return json(Array.isArray(body) ? replies : replies[0], 200, { "Cache-Control": "no-store" });
}
