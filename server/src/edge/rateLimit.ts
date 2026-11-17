import type { SqlDb } from "../d1/sql.ts";

/** Fixed-window failure counters in D1 `rate_limits`, keyed like `admin:<ip>`. */

export interface RateRule {
  max: number;
  windowMs: number;
}

export interface RateStatus {
  limited: boolean;
  retryAfterSeconds: number;
}

export async function checkRate(db: SqlDb, key: string, rule: RateRule, now = Date.now()): Promise<RateStatus> {
  const rows = await db.all<{ count: number; reset_at: number }>("SELECT count, reset_at FROM rate_limits WHERE key = ?", [key]);
  const row = rows[0];
  if (!row || Number(row.reset_at) <= now || Number(row.count) < rule.max) return { limited: false, retryAfterSeconds: 0 };
  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((Number(row.reset_at) - now) / 1000)) };
}

/** One more failure. A window that ran out starts again at 1. Old windows are pruned in the same batch. */
export async function recordFailure(db: SqlDb, key: string, rule: RateRule, now = Date.now()) {
  await db.run([
    { sql: "DELETE FROM rate_limits WHERE reset_at <= ? AND key <> ?", params: [now, key] },
    {
      sql: `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
          reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END`,
      params: [key, now + rule.windowMs, now, now],
    },
  ]);
}

export async function clearRate(db: SqlDb, key: string) {
  await db.run([{ sql: "DELETE FROM rate_limits WHERE key = ?", params: [key] }]);
}
