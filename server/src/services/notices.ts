import crypto from "node:crypto";
import type { StudentNotice } from "../../../shared/types.ts";
import { ensureAdminSchema } from "./adminSchema.ts";
import { databaseUrl, getSql } from "./postgres.ts";
import { getRedis } from "./redis.ts";

export interface NoticeAudience {
  course: string | null;
  batch: string | null;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  authKey: string;
  course: string | null;
  batch: string | null;
  division: string | null;
}

/** A subscription receives a notice when its course and batch agree, or the notice is for everyone. */
export function subscriptionMatches(
  sub: { course?: string | null; batch?: string | null },
  notice: { course?: string | null; batch?: string | null },
) {
  const wantCourse = notice.course?.trim().toLowerCase() ?? "";
  const wantBatch = notice.batch?.trim().toLowerCase() ?? "";
  const gotCourse = sub.course?.trim().toLowerCase() ?? "";
  const gotBatch = sub.batch?.trim().toLowerCase() ?? "";
  if (wantCourse && gotCourse !== wantCourse) return false;
  if (wantBatch && gotBatch !== wantBatch) return false;
  return true;
}

function stamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function listMatchingNotices(course: string, batch: string): Promise<StudentNotice[]> {
  if (!databaseUrl()) return [];
  const redis = getRedis();
  const ver = (await redis.get("notices:version").catch(() => null)) || "0";
  const cacheKey = `notices:list:${ver}:${course.trim().toLowerCase()}:${batch.trim().toLowerCase()}`;
  try {
    const cached = await redis.getJson<StudentNotice[]>(cacheKey);
    if (Array.isArray(cached)) return cached;
  } catch {
    // Fall through to Postgres.
  }
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql<{ id: string; title: string; body: string; created_at: Date | string }[]>`
    SELECT id, title, body, created_at
    FROM student_notices
    WHERE created_at > now() - interval '14 days'
      AND (course IS NULL OR lower(course) = lower(${course}))
      AND (batch IS NULL OR lower(batch) = lower(${batch}))
    ORDER BY created_at DESC
    LIMIT 5
  `;
  const result = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: stamp(row.created_at),
  }));
  await redis.setJson(cacheKey, result, 120).catch(() => {});
  return result;
}

export async function noticesForScope(
  scope: { faculty?: string; division?: string; course?: string; batch?: string },
  choices: Array<{ division: string; course: string; batch: string }>,
): Promise<StudentNotice[]> {
  if (scope.faculty) return [];
  let course = scope.course?.trim() ?? "";
  let batch = scope.batch?.trim() ?? "";
  if (scope.division) {
    const match = choices.find((choice) => choice.division === scope.division);
    if (match) {
      course = match.course;
      batch = match.batch;
    }
  }
  if (!course && !batch) return [];
  try {
    return await listMatchingNotices(course, batch);
  } catch {
    return [];
  }
}

export interface StoredNotice extends StudentNotice {
  course: string | null;
  batch: string | null;
}

export async function listRecentNotices(): Promise<StoredNotice[]> {
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql<{
    id: string;
    title: string;
    body: string;
    course: string | null;
    batch: string | null;
    created_at: Date | string;
  }[]>`
    SELECT id, title, body, course, batch, created_at
    FROM student_notices
    ORDER BY created_at DESC
    LIMIT 8
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    course: row.course,
    batch: row.batch,
    createdAt: stamp(row.created_at),
  }));
}

export async function insertNotice(title: string, body: string, audience: NoticeAudience) {
  await ensureAdminSchema();
  const sql = getSql();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO student_notices (id, title, body, course, batch)
    VALUES (${id}, ${title}, ${body}, ${audience.course}, ${audience.batch})
  `;
  await sql`DELETE FROM student_notices WHERE created_at < now() - interval '30 days'`;
  await getRedis().set("notices:version", `${Date.now().toString(36)}`, 24 * 60 * 60).catch(() => {});
  return id;
}

async function vapidPair(): Promise<{ publicKey: string; privateKey: string } | null> {
  if (!databaseUrl()) return null;
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql<{ public_key: string; private_key: string }[]>`
    SELECT public_key, private_key FROM push_vapid WHERE id = 1
  `;
  const existing = rows[0];
  if (existing?.public_key && existing.private_key) {
    return { publicKey: existing.public_key, privateKey: existing.private_key };
  }
  const webpush = await import("web-push");
  const keys = webpush.generateVAPIDKeys();
  await sql`
    INSERT INTO push_vapid (id, public_key, private_key)
    VALUES (1, ${keys.publicKey}, ${keys.privateKey})
    ON CONFLICT (id) DO NOTHING
  `;
  const again = await sql<{ public_key: string; private_key: string }[]>`
    SELECT public_key, private_key FROM push_vapid WHERE id = 1
  `;
  const saved = again[0];
  if (!saved?.public_key || !saved.private_key) return null;
  return { publicKey: saved.public_key, privateKey: saved.private_key };
}

/** Public half of the push key. The private half stays in the database. */
export async function pushPublicKey() {
  try {
    const pair = await vapidPair();
    return pair?.publicKey ?? null;
  } catch {
    return null;
  }
}

export async function savePushSubscription(row: PushSubscriptionRow) {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth_key, course, batch, division)
    VALUES (${row.endpoint}, ${row.p256dh}, ${row.authKey}, ${row.course}, ${row.batch}, ${row.division})
    ON CONFLICT (endpoint) DO UPDATE
      SET p256dh = EXCLUDED.p256dh,
          auth_key = EXCLUDED.auth_key,
          course = EXCLUDED.course,
          batch = EXCLUDED.batch,
          division = EXCLUDED.division
  `;
}

async function listSubscriptions(): Promise<PushSubscriptionRow[]> {
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql<{
    endpoint: string;
    p256dh: string;
    auth_key: string;
    course: string | null;
    batch: string | null;
  }[]>`
    SELECT endpoint, p256dh, auth_key, course, batch FROM push_subscriptions
  `;
  return rows.map((row) => ({
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    authKey: row.auth_key,
    course: row.course,
    batch: row.batch,
    division: null,
  }));
}

/** Sends a background notification. A closed phone still needs the student to have allowed alerts. */
export async function sendStudentPush(title: string, body: string, audience: NoticeAudience) {
  const pair = await vapidPair();
  if (!pair) return 0;
  const webpush = await import("web-push");
  webpush.setVapidDetails("https://aayam.kv404.dev", pair.publicKey, pair.privateKey);
  const subs = (await listSubscriptions()).filter((sub) => subscriptionMatches(sub, audience));
  let delivered = 0;
  const sql = getSql();
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
        JSON.stringify({ title, body, tag: "aayam-notice" }),
      );
      delivered += 1;
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 0;
      if (status === 404 || status === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
      }
    }
  }
  return delivered;
}
