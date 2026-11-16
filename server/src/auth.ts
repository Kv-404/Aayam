import crypto from "node:crypto";
import type { Request, Response } from "express";
import { databaseUrl, getSql } from "./services/postgres.ts";
import { getRedis } from "./services/redis.ts";

export interface FacultySessionPayload {
  email: string;
  faculty: string;
  canSeeAllFaculty?: boolean;
  exp: number;
}

const COOKIE_NAME = "timetable_faculty_session";

const DEV_AUTH_SECRET = "timetable-insecure-dev-secret-replace-in-production";

function isProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

export function getAuthSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim() || "";
  if (secret.length >= 32) return secret;
  if (isProduction()) return null;
  return DEV_AUTH_SECRET;
}

function getDatabaseUrl(): string {
  return databaseUrl();
}

export function getAllowedDomains(): string[] {
  const raw = `${process.env.ALLOWED_EMAIL_DOMAINS || ""} ${process.env.ALLOWED_EMAIL_DOMAIN || ""} itm.edu isu.ac.in`;
  const set = new Set<string>();
  for (const part of raw.split(/[,\s]+/)) {
    const clean = part.toLowerCase().trim().replace(/^@/, "");
    if (clean) set.add(clean);
  }
  return [...set];
}

export function getGoogleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
}

export function getGoogleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || "").trim();
}

export function signSession(payload: Omit<FacultySessionPayload, "exp">, expiresInDays = 7): string {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }
  const fullPayload: FacultySessionPayload = {
    ...payload,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifySession(token: string): FacultySessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const secret = getAuthSecret();
  if (!secret) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expectedSignature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }
  try {
    const payload: FacultySessionPayload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const item of cookieHeader.split(";")) {
    const parts = item.trim().split("=");
    if (parts.length >= 2) {
      cookies[parts[0]!.trim()] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  }
  return cookies;
}

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (typeof header !== "string") return "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? "";
}

export function getSessionFromRequest(req: Request): FacultySessionPayload | null {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[COOKIE_NAME];
  if (cookieToken) {
    const session = verifySession(cookieToken);
    if (session) return session;
  }
  const headerToken = bearerToken(req);
  if (!headerToken) return null;
  return verifySession(headerToken);
}

export async function verifyGoogleCredential(credential: string): Promise<{ email: string; name: string }> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Invalid Google token or token expired.");
  }
  const data = await response.json();
  const email = (typeof data.email === "string" ? data.email : "").toLowerCase().trim();
  const emailVerified = data.email_verified === "true" || data.email_verified === true;
  const name = typeof data.name === "string" ? data.name : "";
  const aud = typeof data.aud === "string" ? data.aud : "";

  if (!email || !emailVerified) {
    throw new Error("Google account email is not verified.");
  }

  const expectedClientId = getGoogleClientId();
  if (!expectedClientId) {
    if (isProduction()) throw new Error("Google sign-in is not configured.");
  } else if (aud !== expectedClientId) {
    throw new Error("Google token was not issued for this application.");
  }
  const issuer = typeof data.iss === "string" ? data.iss : "";
  if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") {
    throw new Error("Google token issuer was not accepted.");
  }

  const allowedDomains = getAllowedDomains();
  const domainMatches = allowedDomains.some((d) => email.endsWith(`@${d}`));
  if (!domainMatches) {
    throw new Error(`Only accounts from [${allowedDomains.join(", ")}] are allowed.`);
  }

  return { email, name };
}

export interface FacultyDirectoryRecord {
  id: number;
  email: string;
  faculty_name: string;
  can_see_all_faculty: boolean;
  is_active: boolean;
  last_login_at: string | null;
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function lookupFacultyByEmail(
  email: string,
  options?: { touchLastLogin?: boolean },
): Promise<{
  id: number;
  email: string;
  faculty_name: string;
  can_see_all_faculty: boolean;
}> {
  const normalizedEmail = email.toLowerCase().trim();
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const redis = getRedis();
  const cacheKey = `auth:faculty:${sha256Hex(normalizedEmail)}`;
  let faculty: {
    id: number;
    email: string;
    faculty_name: string;
    can_see_all_faculty: boolean;
    is_active: boolean;
  } | null = null;

  try {
    const cached = await redis.getJson<{
      found: boolean;
      id?: number;
      email?: string;
      faculty_name?: string;
      can_see_all_faculty?: boolean;
      is_active?: boolean;
    }>(cacheKey);
    if (cached) {
      if (!cached.found) {
        throw new Error(`The account ${email} is not registered in the authorized faculty directory.`);
      }
      if (cached.id && cached.email && cached.faculty_name) {
        faculty = {
          id: cached.id,
          email: cached.email,
          faculty_name: cached.faculty_name,
          can_see_all_faculty: Boolean(cached.can_see_all_faculty),
          is_active: Boolean(cached.is_active),
        };
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("not registered in the authorized faculty directory")) {
      throw err;
    }
    // Fall through to Supabase on transient Redis error.
  }

  if (!faculty) {
    let rows: any[];
    try {
      const sql = getSql();
      rows = await sql`
        SELECT id, email, faculty_name, can_see_all_faculty, is_active
        FROM faculty_directory
        WHERE LOWER(email) = ${normalizedEmail} AND is_active = true
        LIMIT 1
      `;
    } catch (err) {
      console.error("[auth] Faculty lookup error:", err);
      throw new Error("Faculty directory service is temporarily unavailable.");
    }
    if (!rows || rows.length === 0) {
      try {
        await redis.setJson(cacheKey, { found: false }, 60);
      } catch {
        // Ignore Redis error.
      }
      throw new Error(`The account ${email} is not registered in the authorized faculty directory.`);
    }
    const row = rows[0] as {
      id: number;
      email: string;
      faculty_name: string;
      can_see_all_faculty?: boolean;
      is_active: boolean;
    };
    faculty = {
      id: Number(row.id),
      email: String(row.email),
      faculty_name: String(row.faculty_name),
      can_see_all_faculty: Boolean(row.can_see_all_faculty),
      is_active: Boolean(row.is_active),
    };
    try {
      await redis.setJson(cacheKey, { found: true, ...faculty }, 600);
    } catch {
      // Ignore Redis error.
    }
  }

  if (options?.touchLastLogin !== false) {
    try {
      const shouldTouch = await redis.setNx(`auth:login-touch:${faculty.id}`, "1", 3600);
      if (shouldTouch) {
        const sql = getSql();
        await sql`UPDATE faculty_directory SET last_login_at = NOW() WHERE id = ${faculty.id}`;
      }
    } catch (err) {
      console.error("Failed to update last_login_at:", err);
    }
  }

  return {
    id: faculty.id,
    email: faculty.email,
    faculty_name: faculty.faculty_name,
    can_see_all_faculty: Boolean(faculty.can_see_all_faculty),
  };
}

export async function authenticateFacultyWithNeon(email: string) {
  return lookupFacultyByEmail(email, { touchLastLogin: true });
}

export async function listFacultyDirectoryWithCache(): Promise<FacultyDirectoryRecord[]> {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) return [];
  const redis = getRedis();
  const cacheKey = "auth:faculty_directory:all";
  try {
    const cached = await redis.getJson<FacultyDirectoryRecord[]>(cacheKey);
    if (Array.isArray(cached)) return cached;
  } catch {
    // Fall through.
  }

  const sql = getSql();
  const rows = await sql`
    SELECT id, email, faculty_name, can_see_all_faculty, is_active, last_login_at::text AS last_login_at
    FROM faculty_directory
    ORDER BY faculty_name ASC, id ASC
  `;
  const records: FacultyDirectoryRecord[] = (rows as any[]).map((row) => ({
    id: Number(row.id),
    email: String(row.email),
    faculty_name: String(row.faculty_name),
    can_see_all_faculty: Boolean(row.can_see_all_faculty),
    is_active: Boolean(row.is_active),
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
  }));
  try {
    await redis.setJson(cacheKey, records, 300);
  } catch {
    // Ignore.
  }
  return records;
}

export interface PinRateLimitStatus {
  limited: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

export class PinRateLimiter {
  private attempts = new Map<string, number[]>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 5 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  public check(ip: string, now = Date.now()): PinRateLimitStatus {
    const rawTimestamps = this.attempts.get(ip) || [];
    const validTimestamps = rawTimestamps.filter((t) => now - t < this.windowMs);

    if (validTimestamps.length !== rawTimestamps.length) {
      if (validTimestamps.length === 0) {
        this.attempts.delete(ip);
      } else {
        this.attempts.set(ip, validTimestamps);
      }
    }
    this.prune(ip);

    if (validTimestamps.length >= this.maxAttempts) {
      const oldest = validTimestamps[0]!;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      return {
        limited: true,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }

    return {
      limited: false,
      remainingAttempts: this.maxAttempts - validTimestamps.length,
      retryAfterSeconds: 0,
    };
  }

  public recordFailure(ip: string, now = Date.now()): void {
    const rawTimestamps = this.attempts.get(ip) || [];
    const validTimestamps = rawTimestamps.filter((t) => now - t < this.windowMs);
    validTimestamps.push(now);
    this.attempts.set(ip, validTimestamps);
    this.prune(ip);
  }

  private prune(ip: string) {
    if (this.attempts.size <= 5000) return;
    if (this.attempts.has(ip)) {
      const first = this.attempts.keys().next().value;
      if (first && first !== ip) this.attempts.delete(first);
      return;
    }
    const oldest = this.attempts.keys().next().value;
    if (oldest) this.attempts.delete(oldest);
  }

  public reset(ip: string): void {
    this.attempts.delete(ip);
  }

  public clear(): void {
    this.attempts.clear();
  }
}

export const pinRateLimiter = new PinRateLimiter(5, 5 * 60 * 1000);
export const loginRateLimiter = new PinRateLimiter(8, 10 * 60 * 1000);

export interface DistributedRateLimiter {
  check(ip: string): Promise<PinRateLimitStatus>;
  recordFailure(ip: string): Promise<void>;
  reset(ip: string): Promise<void>;
}

export function createDistributedRateLimiter(
  namespace: string,
  fallback: PinRateLimiter,
  maxAttempts: number,
  windowSeconds: number,
): DistributedRateLimiter {
  const keyFor = (ip: string) => `ratelimit:${namespace}:${sha256Hex(ip)}`;
  return {
    async check(ip: string): Promise<PinRateLimitStatus> {
      const redis = getRedis();
      if (!redis.isShared) return fallback.check(ip);
      try {
        const raw = await redis.get(keyFor(ip));
        const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
        if (count >= maxAttempts) {
          return { limited: true, remainingAttempts: 0, retryAfterSeconds: windowSeconds };
        }
        return {
          limited: false,
          remainingAttempts: Math.max(0, maxAttempts - count),
          retryAfterSeconds: 0,
        };
      } catch {
        return fallback.check(ip);
      }
    },
    async recordFailure(ip: string): Promise<void> {
      fallback.recordFailure(ip);
      const redis = getRedis();
      if (!redis.isShared) return;
      try {
        await redis.incrWindow(keyFor(ip), windowSeconds);
      } catch {
        // Fallback already recorded in memory.
      }
    },
    async reset(ip: string): Promise<void> {
      fallback.reset(ip);
      const redis = getRedis();
      if (!redis.isShared) return;
      try {
        await redis.del(keyFor(ip));
      } catch {
        // Ignore transient Redis error.
      }
    },
  };
}

export const distributedPinRateLimiter = createDistributedRateLimiter("pin", pinRateLimiter, 5, 5 * 60);
export const distributedLoginRateLimiter = createDistributedRateLimiter("login", loginRateLimiter, 8, 10 * 60);

export function getClientIp(req: Request): string {
  const trustProxy = Boolean(process.env.VERCEL) || process.env.TRUST_PROXY === "1";
  if (trustProxy && req.ip) return req.ip;
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(",")[0]?.trim();
    if (first) return first;
  } else if (typeof forwarded === "string" && forwarded.trim()) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

export async function verifyBatchPinWithNeon(pin: string): Promise<{
  ok: boolean;
  course: string;
  batch: string;
} | null> {
  const cleanPin = typeof pin === "string" ? pin.trim() : "";
  // Strictly require exactly 6 numeric digits
  if (!/^\d{6}$/.test(cleanPin)) return null;

  const dbUrl = getDatabaseUrl();
  if (dbUrl) {
    const redis = getRedis();
    const cacheKey = `auth:pin:${sha256Hex(cleanPin)}`;
    try {
      const cached = await redis.getJson<{ ok: boolean; course?: string; batch?: string }>(cacheKey);
      if (cached) {
        return cached.ok && cached.course && cached.batch
          ? { ok: true, course: cached.course, batch: cached.batch }
          : null;
      }
    } catch {
      // Fall through to Supabase on Redis error.
    }

    try {
      const sql = getSql();
      const rows = await sql`
        SELECT course, batch, pin 
        FROM batch_access_codes 
        WHERE pin = ${cleanPin} 
        LIMIT 1
      `;
      if (rows && rows.length > 0 && rows[0]?.course && rows[0]?.batch) {
        const result = {
          ok: true,
          course: String(rows[0].course),
          batch: String(rows[0].batch),
        };
        try {
          await redis.setJson(cacheKey, result, 600);
        } catch {
          // Ignore Redis error.
        }
        return result;
      }
      try {
        await redis.setJson(cacheKey, { ok: false }, 60);
      } catch {
        // Ignore Redis error.
      }
      return null;
    } catch (err) {
      console.error("[pin] Verification error:", err);
      // A database failure says nothing about the PIN. The route reports it without counting a failed attempt.
      throw err;
    }
  }

  if (isProduction()) return null;

  // Local dev without a database reads DEV_BATCH_PINS, as course:batch:pin separated by commas.
  for (const entry of (process.env.DEV_BATCH_PINS ?? "").split(",")) {
    const [course, batch, code] = entry.split(":").map((part) => part.trim());
    if (course && batch && code === cleanPin) return { ok: true, course, batch };
  }

  return null;
}

export function setSessionCookie(res: Response, token: string) {
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const expires = new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();
  const cookieString = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; Expires=${expires}; HttpOnly; SameSite=Lax${
    isProduction() ? "; Secure" : ""
  }`;
  res.setHeader("Set-Cookie", cookieString);
}

export function clearSessionCookie(res: Response) {
  const cookieString = `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${
    isProduction() ? "; Secure" : ""
  }`;
  res.setHeader("Set-Cookie", cookieString);
}
