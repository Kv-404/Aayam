import type { SqlDb } from "../d1/sql.ts";
import { database, type Env } from "./env.ts";

export type SyncReason = "cron" | "manual" | "sheet" | "push" | "stale";

/** GitHub is asked at most once per minute, whatever asks. */
export const DISPATCH_GAP_MS = 60 * 1000;
/** `refreshing` stays true this long after a request the job has not answered. */
export const REFRESH_WINDOW_MS = 5 * 60 * 1000;
/** A read older than this asks for a sync. */
export const STALE_MS = 12 * 60 * 1000;

export interface JobState {
  requested_at: string | null;
  dispatched_at: string | null;
  finished_at: string | null;
}

const time = (value: string | null | undefined) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

/** A sync was asked for after the job last finished, and recently enough to still be coming. */
export function isRefreshing(state: JobState | null | undefined, now = Date.now()) {
  if (!state) return false;
  const requested = time(state.requested_at);
  return requested > time(state.finished_at) && now - requested < REFRESH_WINDOW_MS;
}

/** The job has not finished, and the sync snapshot has not moved, for 12 minutes. */
export function isStale(state: JobState | null | undefined, syncUpdatedAt: string | null | undefined, now = Date.now()) {
  return now - Math.max(time(state?.finished_at), time(syncUpdatedAt)) > STALE_MS;
}

/** Somebody dispatched within the last minute, so a stale read does not need to ask again. */
export function recentlyDispatched(state: JobState | null | undefined, now = Date.now()) {
  return now - time(state?.dispatched_at) < DISPATCH_GAP_MS;
}

/**
 * Ask for a sync. A user request (POST /api/sync, admin sheet, admin notice) records `requested_at`,
 * which makes `sync.refreshing` true until the job finishes. Cron and stale reads do not, or every
 * client would see "refreshing" for part of every five minutes. With a GitHub token, and nobody
 * having dispatched in the last minute, the sync workflow runs. The claim on `dispatched_at` is one
 * statement, so two isolates cannot both dispatch. Never throws.
 */
export async function requestSync(
  env: Env,
  reason: SyncReason,
  options: { user?: boolean; db?: SqlDb } = {},
): Promise<{ dispatched: boolean }> {
  const db = options.db ?? database(env);
  const user = Boolean(options.user);
  const now = new Date();
  const nowIso = now.toISOString();
  const token = env.GITHUB_TOKEN?.trim() ?? "";
  if (!token && !user) return { dispatched: false };
  try {
    if (user) {
      await db.run([
        { sql: "UPDATE job_state SET requested_at = ?, request_reason = ? WHERE id = 1", params: [nowIso, reason] },
      ]);
    }
    if (!token) return { dispatched: false };
    // A row comes back only for the request that moved dispatched_at.
    const claimed = await db.all(
      "UPDATE job_state SET dispatched_at = ? WHERE id = 1 AND (dispatched_at IS NULL OR dispatched_at < ?) RETURNING id",
      [nowIso, new Date(now.getTime() - DISPATCH_GAP_MS).toISOString()],
    );
    if (claimed.length === 0) return { dispatched: false };
    const response = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "timetable-worker",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main", inputs: { reason } }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      console.error("[sync] workflow dispatch failed", response.status);
      return { dispatched: false };
    }
    return { dispatched: true };
  } catch (error) {
    console.error("[sync] request failed", error instanceof Error ? error.message : error);
    return { dispatched: false };
  }
}
