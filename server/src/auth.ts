import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { Request, Response } from "express";

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

function getAuthSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim() || "";
  if (secret.length >= 32) return secret;
  if (isProduction()) return null;
  return DEV_AUTH_SECRET;
}

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || "";
}

function getAllowedDomains(): string[] {
  const raw = `${process.env.ALLOWED_EMAIL_DOMAINS || ""} ${process.env.ALLOWED_EMAIL_DOMAIN || ""} itm.edu isu.ac.in`;
  const set = new Set<string>();
  for (const part of raw.split(/[,\s]+/)) {
    const clean = part.toLowerCase().trim().replace(/^@/, "");
    if (clean) set.add(clean);
  }
  return [...set];
}

function getGoogleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
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

export function getSessionFromRequest(req: Request): FacultySessionPayload | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
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

export async function authenticateFacultyWithNeon(email: string): Promise<{
  id: number;
  email: string;
  faculty_name: string;
  can_see_all_faculty: boolean;
}> {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  let rows: any[];
  try {
    const sql = neon(dbUrl);
    rows = await sql`
      SELECT id, email, faculty_name, can_see_all_faculty, is_active 
      FROM faculty_directory 
      WHERE LOWER(email) = ${email.toLowerCase()} AND is_active = true 
      LIMIT 1
    `;
  } catch (err) {
    console.error("[auth] Neon faculty lookup error:", err);
    throw new Error("Faculty directory service is temporarily unavailable.");
  }
  if (!rows || rows.length === 0) {
    throw new Error(`The account ${email} is not registered in the authorized faculty directory.`);
  }
  const faculty = rows[0] as { id: number; email: string; faculty_name: string; can_see_all_faculty?: boolean; is_active: boolean };

  // Update last login
  try {
    const sql = neon(dbUrl);
    await sql`UPDATE faculty_directory SET last_login_at = NOW() WHERE id = ${faculty.id}`;
  } catch (err) {
    console.error("Failed to update last_login_at:", err);
  }

  return {
    id: faculty.id,
    email: faculty.email,
    faculty_name: faculty.faculty_name,
    can_see_all_faculty: Boolean(faculty.can_see_all_faculty),
  };
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
    try {
      const sql = neon(dbUrl);
      const rows = await sql`
        SELECT course, batch, pin 
        FROM batch_access_codes 
        WHERE pin = ${cleanPin} 
        LIMIT 1
      `;
      if (rows && rows.length > 0 && rows[0]?.course && rows[0]?.batch) {
        return {
          ok: true,
          course: String(rows[0].course),
          batch: String(rows[0].batch),
        };
      }
      return null;
    } catch (err) {
      console.error("[pin] Neon verification error:", err);
      return null;
    }
  }

  if (isProduction()) return null;

  // Fallback defaults only when no database is configured, for local dev.
  const fallbackBatches = [
    { course: "BTech", batch: "2026-30", pin: "481920" },
    { course: "BTech", batch: "2025-29", pin: "739154" },
    { course: "BTech", batch: "2024-28", pin: "628401" },
    { course: "BTech", batch: "2023-27", pin: "315972" },
    { course: "MCA", batch: "2026-28", pin: "852039" },
  ];
  const found = fallbackBatches.find((b) => b.pin === cleanPin);
  if (found) {
    return { ok: true, course: found.course, batch: found.batch };
  }

  return null;
}

export function setSessionCookie(res: Response, token: string) {
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  const cookieString = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge / 1000}; HttpOnly; SameSite=Lax${
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
