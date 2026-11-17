import { base64UrlToBytes, bytesToBase64Url, fromUtf8, hmacSha256, timingSafeEqual, utf8 } from "./crypto.ts";
import type { SqlDb } from "../d1/sql.ts";
import { authSecret, type Ctx, type Env } from "./env.ts";
import { bearerToken, clearedCookie, clientIp, cookie, errorJson, json, parseCookies, readJson } from "./http.ts";
import { checkRate, clearRate, recordFailure } from "./rateLimit.ts";

/** Faculty sign-in. Same token format and cookie as the previous server, so existing sessions carry over. */

export interface FacultySessionPayload {
  email: string;
  faculty: string;
  canSeeAllFaculty?: boolean;
  exp: number;
}

export const FACULTY_COOKIE = "timetable_faculty_session";
const SESSION_DAYS = 7;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;
const GOOGLE_LIMIT = { max: 8, windowMs: 10 * 60 * 1000 };

/** `<base64url payload>.<base64url HMAC-SHA256(payload)>` */
export async function signSession(secret: string, payload: Omit<FacultySessionPayload, "exp">, expiresInDays = SESSION_DAYS) {
  const full: FacultySessionPayload = { ...payload, exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000 };
  const data = bytesToBase64Url(utf8(JSON.stringify(full)));
  const signature = bytesToBase64Url(await hmacSha256(secret, utf8(data)));
  return `${data}.${signature}`;
}

export async function verifySession(secret: string | null, token: string): Promise<FacultySessionPayload | null> {
  if (!secret || !token || !token.includes(".")) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = bytesToBase64Url(await hmacSha256(secret, utf8(data)));
  if (!timingSafeEqual(utf8(signature), utf8(expected))) return null;
  const bytes = base64UrlToBytes(data);
  if (!bytes) return null;
  try {
    const payload = JSON.parse(fromUtf8(bytes)) as FacultySessionPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Cookie first, then `Authorization: Bearer`. */
export async function sessionFromRequest(env: Env, request: Request) {
  const secret = authSecret(env);
  const fromCookie = parseCookies(request.headers.get("Cookie"))[FACULTY_COOKIE];
  if (fromCookie) {
    const session = await verifySession(secret, fromCookie);
    if (session) return session;
  }
  const header = bearerToken(request);
  return header ? verifySession(secret, header) : null;
}

export function allowedDomains(env: Env) {
  const set = new Set<string>();
  for (const part of `${env.ALLOWED_EMAIL_DOMAINS ?? ""} itm.edu isu.ac.in`.split(/[,\s]+/)) {
    const clean = part.toLowerCase().trim().replace(/^@/, "");
    if (clean) set.add(clean);
  }
  return [...set];
}

/** Google's tokeninfo endpoint checks the signature. This checks audience, issuer, and domain. */
export async function verifyGoogleCredential(env: Env, credential: string) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Invalid Google token or token expired.");
  }
  const data = (await response.json()) as Record<string, unknown>;
  const email = (typeof data.email === "string" ? data.email : "").toLowerCase().trim();
  const verified = data.email_verified === "true" || data.email_verified === true;
  if (!email || !verified) throw new Error("Google account email is not verified.");
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  if (!clientId) throw new Error("Google sign-in is not configured.");
  if (data.aud !== clientId) throw new Error("Google token was not issued for this application.");
  if (data.iss !== "accounts.google.com" && data.iss !== "https://accounts.google.com") {
    throw new Error("Google token issuer was not accepted.");
  }
  const domains = allowedDomains(env);
  if (!domains.some((domain) => email.endsWith(`@${domain}`))) {
    throw new Error(`Only accounts from [${domains.join(", ")}] are allowed.`);
  }
  return { email, nonce: typeof data.nonce === "string" ? data.nonce : "" };
}

export interface FacultyRow {
  id: number;
  email: string;
  faculty_name: string;
  can_see_all_faculty: boolean;
}

/** An active `faculty_directory` row for this email, case-insensitive. Sign-ins also stamp `last_login_at`. */
export async function lookupFaculty(db: SqlDb, email: string, options: { touchLastLogin?: boolean } = {}): Promise<FacultyRow> {
  const rows = await db.all<{ id: number; email: string; faculty_name: string; can_see_all_faculty: number }>(
    "SELECT id, email, faculty_name, can_see_all_faculty FROM faculty_directory WHERE email = ? COLLATE NOCASE AND is_active = 1 LIMIT 1",
    [email],
  );
  const row = rows[0];
  if (!row) throw new Error(`The account ${email} is not registered in the authorized faculty directory.`);
  if (options.touchLastLogin !== false) {
    try {
      await db.run([{ sql: "UPDATE faculty_directory SET last_login_at = ? WHERE id = ?", params: [new Date().toISOString(), row.id] }]);
    } catch (error) {
      console.error("[auth] last_login_at update failed", error instanceof Error ? error.message : error);
    }
  }
  return { id: Number(row.id), email: row.email, faculty_name: row.faculty_name, can_see_all_faculty: Boolean(row.can_see_all_faculty) };
}

async function facultyByEmail(ctx: Ctx, email: string) {
  const row = await lookupFaculty(ctx.db, email);
  return { email: row.email, faculty: row.faculty_name, canSeeAllFaculty: row.can_see_all_faculty };
}

export function authConfig(ctx: Ctx) {
  return json({ clientId: ctx.env.GOOGLE_CLIENT_ID?.trim() ?? "" });
}

export async function authMe(ctx: Ctx) {
  const session = await sessionFromRequest(ctx.env, ctx.request);
  if (!session) return json({ authenticated: false });
  return json({
    authenticated: true,
    email: session.email,
    faculty: session.faculty,
    canSeeAllFaculty: Boolean(session.canSeeAllFaculty),
  });
}

export async function authGoogle(ctx: Ctx) {
  const rateKey = `google:${clientIp(ctx.request)}`;
  const rate = await checkRate(ctx.db, rateKey, GOOGLE_LIMIT);
  if (rate.limited) {
    return errorJson(429, `Too many sign-in attempts. Try again in ${rate.retryAfterSeconds} seconds.`, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }
  // Counted before the check, as before: only a successful sign-in clears it.
  await recordFailure(ctx.db, rateKey, GOOGLE_LIMIT);
  const body = await readJson(ctx.request);
  const credential = typeof body.credential === "string" ? body.credential.trim() : "";
  if (!credential) return errorJson(400, "Missing credential.");
  const secret = authSecret(ctx.env);
  try {
    if (!secret) throw new Error("AUTH_SECRET is not configured.");
    const { email } = await verifyGoogleCredential(ctx.env, credential);
    const faculty = await facultyByEmail(ctx, email);
    const token = await signSession(secret, faculty);
    await clearRate(ctx.db, rateKey);
    return json(
      { ok: true, email: faculty.email, faculty: faculty.faculty, canSeeAllFaculty: faculty.canSeeAllFaculty, token },
      200,
      { "Set-Cookie": cookie(FACULTY_COOKIE, token, SESSION_SECONDS, "Lax", ctx.request) },
    );
  } catch (error) {
    console.error("[auth] Google auth failure:", error instanceof Error ? error.message : error);
    return errorJson(403, "Sign-in was refused. Use an authorized faculty account.");
  }
}

export function authLogout(ctx: Ctx) {
  return json({ ok: true }, 200, { "Set-Cookie": clearedCookie(FACULTY_COOKIE, "Lax", ctx.request) });
}
