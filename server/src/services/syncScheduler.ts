import type { ParseIssue } from "../../../shared/types.ts";
import type { AppConfig } from "../config.ts";
import type { AppDatabase, SyncState } from "../db.ts";
import { readAllChanges, readSyncState, replaceChangeRows, writeSyncState } from "../db.ts";
import type { ChangeDraft, NormalizedLecture, StoredLecture } from "../model.ts";
import { compareSnapshots, initialSnapshot } from "./changeDetectionService.ts";
import { recordChanges } from "./changeHistoryService.ts";
import { programKey } from "../program.ts";
import { contentFingerprint, normalizeWorkbook } from "./timetableNormalizer.ts";
import { parseTimetableSource } from "./timetableParser.ts";
import { hydrateArchive, publishArchive } from "./durableState.ts";
import { persistCancelledRemovals } from "./persistCancelled.ts";
import { loadSnapshot, saveSnapshot, toNormalized } from "./timetableSnapshotService.ts";

export interface WorkbookFile {
  buffer: Buffer;
  course: string;
  spreadsheetId: string;
}

export interface SyncContext {
  db: AppDatabase;
  config: Pick<AppConfig, "courseName" | "dateOrder" | "spreadsheetTitle" | "syncIntervalSeconds"> & { spreadsheetId?: string };
  load: () => Promise<{ buffer: Buffer }>;
  loadAll?: () => Promise<WorkbookFile[]>;
  now?: Date;
}

export interface SyncOutcome {
  ok: boolean;
  unchanged: boolean;
  changeCount: number;
  error: string | null;
}

const inflight = new WeakMap<AppDatabase, Promise<SyncOutcome>>();

function dropChangesFromOtherWeeks(db: AppDatabase, lectures: NormalizedLecture[]) {
  const dates = new Set(lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)));
  if (dates.size === 0) return;
  const changes = readAllChanges(db);
  const kept = changes.filter((change) => !change.date || dates.has(change.date));
  if (kept.length === changes.length) return;
  replaceChangeRows(db, kept);
}

/** A program that was not in the previous snapshot is a baseline, not a pile of added lectures. */
export function dropFreshProgramAdditions<T extends { id: string; course: string; batch: string }>(
  previous: Array<{ course: string; batch: string }>,
  lectures: T[],
  events: ChangeDraft[],
) {
  const known = new Set(previous.map((lecture) => programKey(lecture.course, lecture.batch)));
  if (known.size === 0) return events;
  const fresh = new Set(lectures.filter((lecture) => !known.has(programKey(lecture.course, lecture.batch))).map((lecture) => lecture.id));
  if (fresh.size === 0) return events;
  return events.filter((event) => event.type !== "added" || !event.lectureId || !fresh.has(event.lectureId));
}

/** A new weekly sheet has a different set of dates. That is a new baseline, not an edit of last week. */
function replacesPublishedWeek(previous: StoredLecture[], next: NormalizedLecture[]) {
  const previousDates = new Set(previous.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)));
  const nextDates = new Set(next.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)));
  if (previousDates.size === 0 || nextDates.size === 0) return false;
  for (const date of nextDates) {
    if (previousDates.has(date)) return false;
  }
  return true;
}

function withCarriedTabs(previous: ReturnType<typeof loadSnapshot>, lectures: NormalizedLecture[], issues: ParseIssue[]) {
  const counts = new Map<string, number>();
  for (const lecture of lectures) counts.set(lecture.tabName, (counts.get(lecture.tabName) ?? 0) + 1);
  const fatalTabs = new Set(issues.filter((issue) => issue.severity === "error").map((issue) => issue.tabName));
  const carried = [...lectures];
  const notes: ParseIssue[] = [];
  for (const tabName of fatalTabs) {
    if ((counts.get(tabName) ?? 0) > 0) continue;
    const prior = previous.filter((lecture) => lecture.tabName === tabName);
    if (prior.length === 0) continue;
    carried.push(...prior.map(toNormalized));
    notes.push({
      tabName,
      severity: "warning",
      message: "Showing the last good copy of this tab because the latest version could not be parsed.",
    });
  }
  return { lectures: carried, issues: [...issues, ...notes] };
}

async function performSync(ctx: SyncContext): Promise<SyncOutcome> {
  const now = ctx.now ?? new Date();
  const attemptAt = now.toISOString();
  try {
    await hydrateArchive(ctx.db);
    const current = readSyncState(ctx.db);
    const files = ctx.loadAll
      ? await ctx.loadAll()
      : [{ ...(await ctx.load()), course: ctx.config.courseName, spreadsheetId: ctx.config.spreadsheetId ?? "" }];
    const groups = [];
    for (const file of files) {
      const parsed = await parseTimetableSource(file.buffer, { dateOrder: ctx.config.dateOrder });
      const normalized = normalizeWorkbook(parsed, { courseFallback: file.course, spreadsheetId: file.spreadsheetId || undefined });
      groups.push({ file, parsed, normalized });
    }
    persistCancelledRemovals(ctx.db);
    const previous = loadSnapshot(ctx.db);
    const retainedLectures: NormalizedLecture[] = [];
    const retainedIssues: ParseIssue[] = [];
    const tabNames: string[] = [];
    for (const group of groups) {
      const course = group.normalized.lectures[0]?.course || group.file.course;
      const batch = group.normalized.batch || group.normalized.lectures.find((lecture) => lecture.batch)?.batch || "";
      const key = programKey(course, batch);
      const prior = previous.filter((lecture) =>
        group.file.spreadsheetId
          ? lecture.spreadsheetId === group.file.spreadsheetId || (!lecture.spreadsheetId && programKey(lecture.course, lecture.batch) === key)
          : programKey(lecture.course, lecture.batch) === key,
      );
      const carried = withCarriedTabs(prior, group.normalized.lectures, group.normalized.issues);
      const label = [course, batch].filter(Boolean).join(" ");
      retainedLectures.push(...carried.lectures);
      retainedIssues.push(
        ...carried.issues.map((issue) => (files.length > 1 && label ? { ...issue, message: `${label}: ${issue.message}` } : issue)),
      );
      for (const tab of group.parsed.tabs) {
        if (!tabNames.includes(tab.name)) tabNames.push(tab.name);
      }
    }
    const syncedSheetIds = new Set(files.map((file) => file.spreadsheetId).filter(Boolean));
    const syncedKeys = new Set(
      groups.map((group) => {
        const course = group.normalized.lectures[0]?.course || group.file.course;
        const batch = group.normalized.batch || group.normalized.lectures.find((l) => l.batch)?.batch || "";
        return programKey(course, batch);
      }),
    );
    const untouched = previous.filter((lecture) => {
      if (lecture.spreadsheetId && syncedSheetIds.has(lecture.spreadsheetId)) return false;
      if (syncedKeys.has(programKey(lecture.course, lecture.batch))) return false;
      return true;
    });
    for (const lecture of untouched) {
      retainedLectures.push(toNormalized(lecture));
      if (!tabNames.includes(lecture.tabName)) tabNames.push(lecture.tabName);
    }
    const retained = { lectures: retainedLectures, issues: retainedIssues };
    const contentHash = contentFingerprint(retained.lectures, tabNames, retained.issues);
    dropChangesFromOtherWeeks(ctx.db, retained.lectures);

    if (current.bootstrapped && current.contentHash === contentHash) {
      writeSyncState(ctx.db, successState(current, attemptAt, contentHash, tabNames, retained.issues, ctx.config.spreadsheetTitle));
      await publishArchive(ctx.db);
      return { ok: true, unchanged: true, changeCount: 0, error: null };
    }

    const freshWeek = current.bootstrapped && replacesPublishedWeek(previous, retained.lectures);
    const stored = current.bootstrapped && !freshWeek
      ? compareSnapshots(previous, retained.lectures, {
          now,
          previousTabs: current.tabNames,
          nextTabs: tabNames,
          bootstrapped: true,
        })
      : { lectures: initialSnapshot(retained.lectures), events: [] };
    const events = dropFreshProgramAdditions(previous, stored.lectures, stored.events);

    ctx.db.exec("BEGIN");
    try {
      if (freshWeek) replaceChangeRows(ctx.db, []);
      saveSnapshot(ctx.db, stored.lectures);
      recordChanges(ctx.db, events);
      writeSyncState(ctx.db, {
        ...successState(current, attemptAt, contentHash, tabNames, retained.issues, ctx.config.spreadsheetTitle),
        bootstrapped: true,
      });
      ctx.db.exec("COMMIT");
    } catch (error) {
      ctx.db.exec("ROLLBACK");
      throw error;
    }
    await publishArchive(ctx.db);
    return { ok: true, unchanged: false, changeCount: events.length, error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The spreadsheet could not be read.";
    console.error("[sync]", detail);
    const message = "The timetable could not be refreshed. The last copy is still shown.";
    writeSyncState(ctx.db, {
      ...readSyncState(ctx.db),
      lastAttemptAt: attemptAt,
      lastError: message,
    });
    return { ok: false, unchanged: false, changeCount: 0, error: message };
  }
}

function successState(current: SyncState, attemptAt: string, contentHash: string, tabNames: string[], parseIssues: ParseIssue[], title: string): SyncState {
  return {
    ...current,
    lastAttemptAt: attemptAt,
    lastSuccessAt: attemptAt,
    lastError: null,
    contentHash,
    tabNames,
    parseIssues,
    spreadsheetTitle: title,
  };
}

export function runSync(ctx: SyncContext) {
  const existing = inflight.get(ctx.db);
  if (existing) return existing;
  const pending = performSync(ctx).finally(() => {
    inflight.delete(ctx.db);
  });
  inflight.set(ctx.db, pending);
  return pending;
}

export function startScheduler(ctx: SyncContext) {
  void runSync(ctx).then((result) => {
    if (result.ok) {
      console.log(`[sync] timetable updated (${result.unchanged ? "no changes" : `${result.changeCount} changes`})`);
    } else {
      console.error(`[sync] ${result.error}`);
    }
  });
  const timer = setInterval(() => {
    void runSync(ctx).then((result) => {
      if (!result.ok) console.error(`[sync] ${result.error}`);
      else if (!result.unchanged) console.log(`[sync] ${result.changeCount} timetable changes detected`);
    });
  }, ctx.config.syncIntervalSeconds * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
