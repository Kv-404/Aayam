import crypto from "node:crypto";
import type { Request, Response } from "express";
import { parseCookies, PinRateLimiter } from "../auth.ts";
import { ensureAdminSchema } from "./adminSchema.ts";
import { getSql } from "./postgres.ts";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const COOKIE = "aayam_admin";
const SESSION_SECONDS = 12 * 60 * 60;

export const adminLoginLimiter = new PinRateLimiter(5, 15 * 60 * 1000);

interface ScryptParts {
  params: { N: number; r: number; p: number };
  salt: Buffer;
  key: Buffer;
}

function scrypt(password: string, salt: Buffer, keylen: number, params: ScryptParts["params"]) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, params, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** One-way hash. The password itself is never stored. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

function parseHash(stored: string | null): ScryptParts | null {
  if (!stored) return null;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N < 16384 || N > 262144 || r < 8 || r > 16 || p < 1 || p > 2) return null;
  let salt: Buffer;
  let key: Buffer;
  try {
    salt = Buffer.from(parts[4] ?? "", "base64url");
    key = Buffer.from(parts[5] ?? "", "base64url");
  } catch {
    return null;
  }
  if (salt.length < 16 || key.length < 16) return null;
  return { params: { N, r, p }, salt, key };
}

let dummyHash: Promise<string> | null = null;

function dummyPasswordHash() {
  dummyHash ??= hashPassword(crypto.randomBytes(32).toString("hex"));
  return dummyHash;
}

/**
 * Checks a password against a stored hash.
 * A missing or broken hash still runs scrypt, so the failure is not faster.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parsed = parseHash(stored);
  const target = parsed ?? parseHash(await dummyPasswordHash());
  if (!target) return false;
  let actual: Buffer;
  try {
    actual = await scrypt(password, target.salt, target.key.length, target.params);
  } catch {
    return false;
  }
  const same = actual.length === target.key.length && crypto.timingSafeEqual(actual, target.key);
  return Boolean(parsed) && same;
}

/** The only read of the admin password hash. Nothing else selects this column. */
export async function readAdminPasswordHash(): Promise<string | null> {
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM admin_password WHERE id = 1
  `;
  const value = rows[0]?.password_hash;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function setAdminPasswordHash(passwordHash: string) {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`
    INSERT INTO admin_password (id, password_hash, updated_at)
    VALUES (1, ${passwordHash}, now())
    ON CONFLICT (id) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, updated_at = now()
  `;
}

/** Hashes ADMIN_PASSWORD into the table once, when the table is still empty. */
export async function bootstrapAdminPasswordFromEnv() {
  const existing = await readAdminPasswordHash();
  if (existing) return;
  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (password.length < 12 || password.length > 200) return;
  await setAdminPasswordHash(await hashPassword(password));
}

export async function passwordMatches(password: string) {
  if (password.length < 1 || password.length > 200) return false;
  const stored = await readAdminPasswordHash();
  return verifyPassword(password, stored);
}

export async function createAdminSession() {
  await ensureAdminSchema();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const sql = getSql();
  await sql`
    INSERT INTO admin_sessions (token_hash, expires_at)
    VALUES (${tokenHash}, now() + interval '12 hours')
  `;
  return token;
}

export async function adminSessionValid(token: string) {
  if (!token || token.length < 20 || token.length > 200) return false;
  await ensureAdminSchema();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const sql = getSql();
  const rows = await sql<{ expires_at: Date | string }[]>`
    SELECT expires_at FROM admin_sessions WHERE token_hash = ${tokenHash}
  `;
  const expires = rows[0]?.expires_at;
  if (!expires) return false;
  if (new Date(expires).getTime() <= Date.now()) {
    await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
    return false;
  }
  return true;
}

export async function deleteAdminSession(token: string) {
  if (!token) return;
  await ensureAdminSchema();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const sql = getSql();
  await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
}

export async function deleteAdminSessions() {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`DELETE FROM admin_sessions`;
}

function secureSuffix() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
}

export function setAdminCookie(res: Response, token: string) {
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toUTCString();
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_SECONDS}; Expires=${expires}; HttpOnly; SameSite=Strict${secureSuffix()}`,
  );
}

export function clearAdminCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict${secureSuffix()}`,
  );
}

export function adminTokenFromRequest(req: Request) {
  return parseCookies(req.headers.cookie)[COOKIE] ?? "";
}

export function hasAdminHeader(req: Request) {
  return req.get("x-aayam-admin") === "1";
}
