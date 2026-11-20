import { acceptSpreadsheetId, COHORT_TEMPLATES, cohortTemplate, spreadsheetExportUrl, spreadsheetUrl, type SheetLinkRow } from "../config.ts";
import type { SqlDb } from "../d1/sql.ts";
import { base64UrlToBytes, bytesToBase64Url, hmacSha256, randomBytes, sha256Hex, timingSafeEqual, utf8 } from "./crypto.ts";
import { authSecret, type Ctx, type Env } from "./env.ts";
import { clearedCookie, clientIp, cookie, errorJson, field, HttpError, json, parseCookies, readJson } from "./http.ts";
import { checkRate, clearRate, recordFailure } from "./rateLimit.ts";
import { requestSync } from "./sync.ts";

/** Admin dashboard and web-push routes. Response shapes are what `client/src/lib/admin.ts` expects. */

const ADMIN_COOKIE = "aayam_admin";
const SESSION_SECONDS = 12 * 60 * 60;
const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const HASH_PREFIX = "hmac-sha256";

// ---------------------------------------------------------------------------
// Password. scrypt does not fit in 10 ms of CPU, so the hash is an HMAC keyed by AUTH_SECRET:
// `hmac-sha256:<salt b64url>:<digest b64url>`, digest = HMAC-SHA256(AUTH_SECRET, salt || password).
// ---------------------------------------------------------------------------

async function passwordDigest(secret: string, salt: Uint8Array, password: string) {
  const pass = utf8(password);
  const data = new Uint8Array(salt.length + pass.length);
  data.set(salt, 0);
  data.set(pass, salt.length);
  return hmacSha256(secret, data);
}

export async function hashPassword(secret: string, password: string) {
  const salt = randomBytes(16);
  return `${HASH_PREFIX}:${bytesToBase64Url(salt)}:${bytesToBase64Url(await passwordDigest(secret, salt, password))}`;
}

function parseHash(stored: string | null) {
  const parts = (stored ?? "").split(":");
  if (parts.length !== 3 || parts[0] !== HASH_PREFIX) return null;
  const salt = base64UrlToBytes(parts[1] ?? "");
  const digest = base64UrlToBytes(parts[2] ?? "");
  if (!salt || !digest || salt.length < 16 || digest.length !== 32) return null;
  return { salt, digest };
}

const DUMMY = { salt: new Uint8Array(16), digest: new Uint8Array(32) };

/** A missing or broken hash still computes a digest, so the failure is not faster. */
export async function verifyPassword(secret: string, password: string, stored: string | null) {
  const parsed = parseHash(stored);
  const target = parsed ?? DUMMY;
  const actual = await passwordDigest(secret, target.salt, password);
  return timingSafeEqual(actual, target.digest) && Boolean(parsed);
}

/** The only read of the admin password hash. Nothing else selects this column. */
async function readAdminPasswordHash(db: SqlDb) {
  const rows = await db.all<{ password_hash: string }>("SELECT password_hash FROM admin_password WHERE id = 1");
  const value = rows[0]?.password_hash;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function writeHashStatement(hash: string) {
  return {
    sql: `INSERT INTO admin_password (id, password_hash, updated_at) VALUES (1, ?, ?)
      ON CONFLICT (id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
    params: [hash, new Date().toISOString()],
  };
}

/**
 * The stored hash. When the table is empty, or still holds a hash this Worker cannot check (an old
 * scrypt row), ADMIN_PASSWORD is hashed into it first.
 */
async function storedHash(env: Env, db: SqlDb, secret: string) {
  const existing = await readAdminPasswordHash(db);
  if (existing && parseHash(existing)) return existing;
  const password = env.ADMIN_PASSWORD?.trim() ?? "";
  if (password.length < 12 || password.length > 200) return existing;
  const hash = await hashPassword(secret, password);
  await db.run([writeHashStatement(hash)]);
  return hash;
}

async function passwordMatches(env: Env, db: SqlDb, secret: string, password: string) {
  if (password.length < 1 || password.length > 200) return false;
  return verifyPassword(secret, password, await storedHash(env, db, secret));
}

// ---------------------------------------------------------------------------
// Sessions: a random token in the cookie, its sha256 in `admin_sessions`.
// ---------------------------------------------------------------------------

async function createAdminSession(db: SqlDb, extra: Array<{ sql: string; params?: unknown[] }> = []) {
  const token = bytesToBase64Url(randomBytes(32));
  const now = Date.now();
  await db.run([
    ...extra,
    { sql: "DELETE FROM admin_sessions WHERE expires_at <= ?", params: [new Date(now).toISOString()] },
    {
      sql: "INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)",
      params: [await sha256Hex(token), new Date(now + SESSION_SECONDS * 1000).toISOString()],
    },
  ]);
  return token;
}

async function adminSessionValid(db: SqlDb, token: string) {
  if (!token || token.length < 20 || token.length > 200) return false;
  const tokenHash = await sha256Hex(token);
  const rows = await db.all<{ expires_at: string }>("SELECT expires_at FROM admin_sessions WHERE token_hash = ?", [tokenHash]);
  const expires = rows[0]?.expires_at;
  if (!expires) return false;
  if (new Date(expires).getTime() <= Date.now()) {
    await db.run([{ sql: "DELETE FROM admin_sessions WHERE token_hash = ?", params: [tokenHash] }]);
    return false;
  }
  return true;
}

const adminToken = (request: Request) => parseCookies(request.headers.get("Cookie"))[ADMIN_COOKIE] ?? "";
const adminCookie = (token: string, request: Request) => cookie(ADMIN_COOKIE, token, SESSION_SECONDS, "Strict", request);

/** A signed-in admin, sent by the dashboard (which always adds `X-Aayam-Admin: 1`). Otherwise the error response. */
async function requireAdmin(ctx: Ctx): Promise<Response | null> {
  if (ctx.request.headers.get("X-Aayam-Admin") !== "1") return errorJson(401, "Sign in again.");
  try {
    return (await adminSessionValid(ctx.db, adminToken(ctx.request))) ? null : errorJson(401, "Sign in again.");
  } catch {
    return errorJson(503, "Admin sign-in is unavailable.");
  }
}

// ---------------------------------------------------------------------------
// Sheet links and notices.
// ---------------------------------------------------------------------------

export { acceptSpreadsheetId };

/** One row per batch with the link stored in D1 `timetable_sheet_links` (empty when none is stored). */
async function sheetRows(db: SqlDb) {
  const stored = await db.all<SheetLinkRow>("SELECT course, batch, spreadsheet_id FROM timetable_sheet_links");
  return COHORT_TEMPLATES.map((template) => {
    const id = stored
      .filter((row) => cohortTemplate(row.course ?? "", row.batch ?? "") === template)
      .map((row) => acceptSpreadsheetId(row.spreadsheet_id))
      .find(Boolean);
    return { course: template.course, batch: template.batch, spreadsheetUrl: id ? spreadsheetUrl(id) : "" };
  });
}

function stamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function listRecentNotices(db: SqlDb) {
  const rows = await db.all<{ id: string; title: string; body: string; course: string | null; batch: string | null; created_at: string; updated_at: string | null; expires_at: string | null; pushed_at: string | null }>(
    "SELECT id, title, body, course, batch, created_at, updated_at, expires_at, pushed_at FROM student_notices ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 12",
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    course: row.course,
    batch: row.batch,
    createdAt: stamp(row.created_at),
    updatedAt: stamp(row.updated_at ?? row.created_at),
    expiresAt: row.expires_at ? stamp(row.expires_at) : null,
    pushedAt: row.pushed_at ? stamp(row.pushed_at) : null,
  }));
}

async function readExamMode(db: SqlDb) {
  const [row] = await db.all<{ value: string }>("SELECT value FROM app_settings WHERE key = 'exam_mode'");
  return row?.value === "1";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days a notice stays up: 1 to 30, 3 when not given. */
function expiryDays(value: unknown) {
  const days = Math.round(Number(value));
  return Number.isFinite(days) && days >= 1 ? Math.min(days, 30) : 3;
}

function audienceFrom(body: Record<string, unknown>) {
  const course = field(body.course, 40);
  const batch = field(body.batch, 40);
  if (!course && !batch) return { course: null, batch: null };
  if (!course || !batch) {
    const courseOnly = COHORT_TEMPLATES.some((item) => item.course.toLowerCase() === course.toLowerCase());
    if (course && !batch && courseOnly) return { course, batch: null };
    return null;
  }
  if (!cohortTemplate(course, batch)) return null;
  return { course, batch };
}

/** Reads only the first chunk of the public xlsx export. An xlsx is a zip, so it starts with `PK`. */
export async function checkSheetReadable(id: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(spreadsheetExportUrl(id), { redirect: "follow" });
  } catch {
    return "That sheet could not be read.";
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return `Google Sheets export failed (${response.status}). The sheet may be private or temporarily unavailable.`;
  }
  const reader = response.body?.getReader();
  let first: Uint8Array | undefined;
  try {
    first = (await reader?.read())?.value;
  } catch {
    first = undefined;
  } finally {
    await reader?.cancel().catch(() => undefined);
  }
  if (!first || first.length < 2 || first[0] !== 0x50 || first[1] !== 0x4b) {
    return "The spreadsheet export was not an Excel file. Share the sheet as “Anyone with the link can view”.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Routes.
// ---------------------------------------------------------------------------

export async function adminSession(ctx: Ctx) {
  try {
    if (!(await adminSessionValid(ctx.db, adminToken(ctx.request)))) return json({ signedIn: false });
    const [sheets, notices, examMode] = await Promise.all([sheetRows(ctx.db), listRecentNotices(ctx.db), readExamMode(ctx.db)]);
    return json({ signedIn: true, sheets, notices, examMode });
  } catch {
    return json({ signedIn: false });
  }
}

export async function adminLogin(ctx: Ctx) {
  const rateKey = `admin:${clientIp(ctx.request)}`;
  try {
    const rate = await checkRate(ctx.db, rateKey, LOGIN_LIMIT);
    if (rate.limited) {
      return errorJson(429, `Too many tries. Wait ${rate.retryAfterSeconds} seconds.`, { "Retry-After": String(rate.retryAfterSeconds) });
    }
    const body = await readJson(ctx.request);
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || password.length > 200) {
      await recordFailure(ctx.db, rateKey, LOGIN_LIMIT);
      return errorJson(401, "That password is not right.");
    }
    const secret = authSecret(ctx.env);
    if (!secret) return errorJson(503, "Admin sign-in is unavailable.");
    if (!(await passwordMatches(ctx.env, ctx.db, secret, password))) {
      await recordFailure(ctx.db, rateKey, LOGIN_LIMIT);
      return errorJson(401, "That password is not right.");
    }
    await clearRate(ctx.db, rateKey);
    const token = await createAdminSession(ctx.db);
    return json({ ok: true }, 200, { "Set-Cookie": adminCookie(token, ctx.request) });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return errorJson(503, "Admin sign-in is unavailable.");
  }
}

export async function adminLogout(ctx: Ctx) {
  const token = adminToken(ctx.request);
  try {
    if (token) await ctx.db.run([{ sql: "DELETE FROM admin_sessions WHERE token_hash = ?", params: [await sha256Hex(token)] }]);
  } catch {
    // The cookie is still cleared.
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearedCookie(ADMIN_COOKIE, "Strict", ctx.request) });
}

export async function adminPassword(ctx: Ctx) {
  const denied = await requireAdmin(ctx);
  if (denied) return denied;
  const body = await readJson(ctx.request);
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  if (next.length < 12 || next.length > 200) return errorJson(400, "Use at least 12 characters.");
  try {
    const secret = authSecret(ctx.env);
    if (!secret) throw new Error("AUTH_SECRET is not configured.");
    if (!(await passwordMatches(ctx.env, ctx.db, secret, current))) return errorJson(401, "That password is not right.");
    // New hash, every old session gone, and a fresh session for this browser, in one batch.
    const token = await createAdminSession(ctx.db, [
      writeHashStatement(await hashPassword(secret, next)),
      { sql: "DELETE FROM admin_sessions" },
    ]);
    return json({ ok: true }, 200, { "Set-Cookie": adminCookie(token, ctx.request) });
  } catch {
    return errorJson(503, "The password could not be changed.");
  }
}

/** Store a batch's sheet link once the public export reads as xlsx, then ask the job to sync. */
export async function adminSheets(ctx: Ctx) {
  const denied = await requireAdmin(ctx);
  if (denied) return denied;
  const body = await readJson(ctx.request);
  const template = cohortTemplate(field(body.course, 40), field(body.batch, 40));
  const spreadsheetId = acceptSpreadsheetId(field(body.url, 300));
  if (!template || !spreadsheetId) return errorJson(400, "Paste a Google Sheet link for one of the batches.");
  const problem = await checkSheetReadable(spreadsheetId);
  if (problem) return errorJson(400, problem);
  try {
    await ctx.db.run([
      {
        sql: `INSERT INTO timetable_sheet_links (course, batch, spreadsheet_id, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (course, batch) DO UPDATE SET spreadsheet_id = excluded.spreadsheet_id, updated_at = excluded.updated_at`,
        params: [template.course, template.batch, spreadsheetId, new Date().toISOString()],
      },
    ]);
    await requestSync(ctx.env, "sheet", { user: true, db: ctx.db });
    return json({ ok: true, sheets: await sheetRows(ctx.db), syncing: true });
  } catch {
    return errorJson(503, "The sheet link could not be saved.");
  }
}

/**
 * Create, edit, or delete a notice. `id` edits one; `delete: true` removes it. A new notice, or an edit
 * with `push: true`, gets `pushed_at = NULL` and the sync job sends the web push. Each notice expires
 * after `expiresInDays` (1–30, default 3) and then leaves the timetable.
 */
export async function adminNotices(ctx: Ctx) {
  const denied = await requireAdmin(ctx);
  if (denied) return denied;
  const body = await readJson(ctx.request);
  const id = field(body.id, 64);
  const now = new Date();
  try {
    if (id && body.delete === true) {
      await ctx.db.run([{ sql: "DELETE FROM student_notices WHERE id = ?", params: [id] }]);
      return json({ ok: true, queued: false, notices: await listRecentNotices(ctx.db) });
    }
    const title = field(body.title, 80);
    const message = field(body.body, 280).replace(/\s+/g, " ");
    const audience = audienceFrom(body);
    if (!title || !message || !audience) return errorJson(400, "Write a title, a message, and who should see it.");
    const expiresAt = new Date(now.getTime() + expiryDays(body.expiresInDays) * DAY_MS).toISOString();
    const push = id ? body.push === true : true;
    const write = id
      ? {
          sql: `UPDATE student_notices SET title = ?, body = ?, course = ?, batch = ?, expires_at = ?, updated_at = ?${push ? ", pushed_at = NULL" : ""} WHERE id = ?`,
          params: [title, message, audience.course, audience.batch, expiresAt, now.toISOString(), id],
        }
      : {
          sql: "INSERT INTO student_notices (id, title, body, course, batch, created_at, updated_at, expires_at, pushed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)",
          params: [crypto.randomUUID(), title, message, audience.course, audience.batch, now.toISOString(), now.toISOString(), expiresAt],
        };
    await ctx.db.run([
      write,
      // Old rows: expired a month ago, or older than a month with no expiry.
      { sql: "DELETE FROM student_notices WHERE COALESCE(expires_at, created_at) < ?", params: [new Date(now.getTime() - 30 * DAY_MS).toISOString()] },
    ]);
    // The job runs only when there is a push to send.
    if (push) await requestSync(ctx.env, "push", { user: true, db: ctx.db });
    return json({ ok: true, delivered: 0, queued: push, notices: await listRecentNotices(ctx.db) });
  } catch {
    return errorJson(503, "The message could not be saved.");
  }
}

/** `POST /api/admin/settings` `{ examMode }`. Read live by the bootstrap query; no sync needed. */
export async function adminSettings(ctx: Ctx) {
  const denied = await requireAdmin(ctx);
  if (denied) return denied;
  const body = await readJson(ctx.request);
  if (typeof body.examMode !== "boolean") return errorJson(400, "Nothing to change.");
  try {
    await ctx.db.run([
      {
        sql: "INSERT INTO app_settings (key, value, updated_at) VALUES ('exam_mode', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params: [body.examMode ? "1" : "0", new Date().toISOString()],
      },
    ]);
    return json({ ok: true, examMode: body.examMode });
  } catch {
    return errorJson(503, "The setting could not be saved.");
  }
}

// ---------------------------------------------------------------------------
// Web push.
// ---------------------------------------------------------------------------

/** A P-256 pair in web-push's format: raw public point and the private scalar, both base64url. */
async function generateVapidPair() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey, privateKey: jwk.d ?? "" };
}

/** Public half of the push key. Made once, when the table is empty. The private half stays in D1. */
export async function pushPublicKey(ctx: Ctx) {
  try {
    const read = () => ctx.db.all<{ public_key: string }>("SELECT public_key FROM push_vapid WHERE id = 1");
    let rows = await read();
    if (!rows[0]?.public_key) {
      const keys = await generateVapidPair();
      if (!keys.privateKey) throw new Error("No private key.");
      await ctx.db.run([
        { sql: "INSERT OR IGNORE INTO push_vapid (id, public_key, private_key) VALUES (1, ?, ?)", params: [keys.publicKey, keys.privateKey] },
      ]);
      rows = await read();
    }
    return json({ publicKey: rows[0]?.public_key ?? null });
  } catch {
    return json({ publicKey: null });
  }
}

export async function pushSubscribe(ctx: Ctx) {
  const body = await readJson(ctx.request);
  const keys = body.keys && typeof body.keys === "object" ? (body.keys as Record<string, unknown>) : {};
  const endpoint = field(body.endpoint, 2000);
  const p256dh = field(keys.p256dh, 200);
  const authKey = field(keys.auth, 200);
  const course = field(body.course, 40);
  const batch = field(body.batch, 40);
  const division = field(body.division, 80);
  const local = endpoint.startsWith("http://localhost") || endpoint.startsWith("http://127.0.0.1");
  if ((!endpoint.startsWith("https://") && !local) || !p256dh || !authKey) return json({ ok: false }, 400);
  try {
    await ctx.db.run([
      {
        sql: `INSERT INTO push_subscriptions (endpoint, p256dh, auth_key, course, batch, division, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (endpoint) DO UPDATE SET
            p256dh = excluded.p256dh, auth_key = excluded.auth_key,
            course = excluded.course, batch = excluded.batch, division = excluded.division`,
        params: [endpoint, p256dh, authKey, course || null, batch || null, division || null, new Date().toISOString()],
      },
    ]);
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 503);
  }
}
