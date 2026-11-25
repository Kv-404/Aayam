import type { SqlDb } from "../d1/sql.ts";
import { subscriptionMatches } from "../services/pushAudience.ts";

/** A notice older than this when the job first sees it is marked sent without a push. */
const PUSH_WINDOW_MS = 24 * 60 * 60 * 1000;
const PARALLEL = 8;

interface PendingNotice {
  id: string;
  title: string;
  body: string;
  course: string | null;
  batch: string | null;
  created_at: string;
  updated_at: string | null;
  expires_at: string | null;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth_key: string;
  course: string | null;
  batch: string | null;
}

export interface PushResult {
  notices: number;
  delivered: number;
  removed: number;
  /** Notices claimed this run (pushed_at set), for the phone app sender. */
  claimed: Array<{ id: string; title: string; body: string; course: string | null; batch: string | null }>;
  /** Web push failed; the notices are still claimed and still go to phones. */
  error?: string;
}

/** The VAPID pair in `push_vapid`. Generated and stored on first use; a race keeps the first stored pair. */
export async function vapidPair(sql: SqlDb) {
  const read = async () => (await sql.all<{ public_key: string; private_key: string }>("SELECT public_key, private_key FROM push_vapid WHERE id = 1"))[0];
  const existing = await read();
  if (existing?.public_key && existing.private_key) return { publicKey: existing.public_key, privateKey: existing.private_key };
  const webpush = await import("web-push");
  const keys = webpush.generateVAPIDKeys();
  await sql.run([{ sql: "INSERT OR IGNORE INTO push_vapid (id, public_key, private_key) VALUES (1, ?, ?)", params: [keys.publicKey, keys.privateKey] }]);
  const saved = await read();
  if (!saved?.public_key || !saved.private_key) throw new Error("Could not store the push key.");
  return { publicKey: saved.public_key, privateKey: saved.private_key };
}

/**
 * Web push for every notice with `pushed_at IS NULL`. `pushed_at` is set before sending, so a crash
 * mid-run loses a push rather than sending it twice. Subscriptions that answer 404 or 410 are deleted.
 */
export async function sendPendingPushes(sql: SqlDb, now = new Date()): Promise<PushResult> {
  const pending = await sql.all<PendingNotice>(
    "SELECT id, title, body, course, batch, created_at, updated_at, expires_at FROM student_notices WHERE pushed_at IS NULL ORDER BY created_at",
  );
  if (pending.length === 0) return { notices: 0, delivered: 0, removed: 0, claimed: [] };
  await sql.run([
    {
      sql: "UPDATE student_notices SET pushed_at = ? WHERE pushed_at IS NULL AND id IN (SELECT value FROM json_each(?))",
      params: [now.toISOString(), JSON.stringify(pending.map((notice) => notice.id))],
    },
  ]);
  // Skip expired notices, and ones saved more than a day ago (an edit with "push again" counts as saved now).
  const fresh = pending.filter((notice) => {
    const expires = notice.expires_at ? Date.parse(notice.expires_at) : NaN;
    if (Number.isFinite(expires) && expires <= now.getTime()) return false;
    const saved = Date.parse(notice.updated_at ?? notice.created_at);
    return !Number.isFinite(saved) || now.getTime() - saved <= PUSH_WINDOW_MS;
  });
  if (fresh.length === 0) return { notices: 0, delivered: 0, removed: 0, claimed: [] };
  const claimed = fresh.map(({ id, title, body, course, batch }) => ({ id, title, body, course, batch }));
  try {
    return { ...(await sendWebPushes(sql, fresh)), claimed };
  } catch (error) {
    // Web push broke (keys, network): the app sender still gets the claimed notices.
    return { notices: fresh.length, delivered: 0, removed: 0, claimed, error: error instanceof Error ? error.message : String(error) };
  }
}

async function sendWebPushes(sql: SqlDb, fresh: PendingNotice[]): Promise<Omit<PushResult, "claimed" | "error">> {
  const pair = await vapidPair(sql);
  const webpush = await import("web-push");
  webpush.setVapidDetails("https://aayam.kv404.dev", pair.publicKey, pair.privateKey);
  const subs = await sql.all<SubscriptionRow>("SELECT endpoint, p256dh, auth_key, course, batch FROM push_subscriptions");
  const gone = new Set<string>();
  let delivered = 0;

  const jobs: Array<() => Promise<void>> = [];
  for (const notice of fresh) {
    const payload = JSON.stringify({ title: notice.title, body: notice.body, tag: "aayam-notice" });
    for (const sub of subs) {
      if (!subscriptionMatches(sub, notice)) continue;
      jobs.push(async () => {
        if (gone.has(sub.endpoint)) return;
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload);
          delivered += 1;
        } catch (error) {
          const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 0;
          if (status === 404 || status === 410) gone.add(sub.endpoint);
        }
      });
    }
  }
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, jobs.length) }, async () => {
      while (next < jobs.length) await jobs[next++]!();
    }),
  );
  if (gone.size > 0) {
    await sql.run([{ sql: "DELETE FROM push_subscriptions WHERE endpoint IN (SELECT value FROM json_each(?))", params: [JSON.stringify([...gone])] }]);
  }
  return { notices: fresh.length, delivered, removed: gone.size };
}
