import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { getAuthSecret } from "../auth.ts";
import { getRedis } from "../services/redis.ts";
import { MCP_SCOPES, type McpFacultyIdentity, type McpOAuthClient, type McpScope } from "./types.ts";

const CLIENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const CIMD_TTL_SECONDS = 10 * 60;
const TX_TTL_SECONDS = 10 * 60;
const CODE_TTL_SECONDS = 90;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface PendingOAuthTransaction {
  txId: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  requestedScope: string;
  resource: string;
  googleNonce: string;
  googleCodeVerifier: string;
  csrfToken: string;
  authenticatedFaculty?: McpFacultyIdentity;
  createdAt: number;
}

export interface StoredAuthCode {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scopes: McpScope[];
  resource: string;
  faculty: McpFacultyIdentity;
  createdAt: number;
}

export interface StoredRefreshToken {
  tokenHash: string;
  familyId: string;
  clientId: string;
  scopes: McpScope[];
  resource: string;
  faculty: McpFacultyIdentity;
  used: boolean;
  createdAt: number;
}

export interface McpAccessTokenPayload {
  typ: "mcp_at";
  jti: string;
  familyId?: string;
  iss: string;
  aud: string;
  sub: string;
  faculty: string;
  canSeeAllFaculty: boolean;
  coordinatorCohorts: string[];
  scopes: McpScope[];
  client_id: string;
  iat: number;
  exp: number;
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256Base64Url(value: string): string {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getMcpSigningKey(): Buffer {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured for MCP OAuth.");
  }
  return crypto.createHmac("sha256", secret).update("aayam-mcp-oauth-v1").digest();
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (cleaned.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(cleaned.slice(7));
  }
  const version = net.isIP(cleaned);
  if (version === 4) {
    const parts = cleaned.split(".").map((n) => Number.parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }
  if (version === 6) {
    if (cleaned === "::" || cleaned === "::1") return true;
    if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) return true; // ULA
    if (cleaned.startsWith("fe8") || cleaned.startsWith("fe9") || cleaned.startsWith("fea") || cleaned.startsWith("feb")) return true; // Link-local
    if (cleaned.startsWith("ff")) return true; // Multicast
    return false;
  }
  return true;
}

export async function assertSafePublicHttpsUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid client_id URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("CIMD client_id URL must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("CIMD client_id URL must not contain credentials.");
  }
  if (parsed.port && parsed.port !== "443") {
    throw new Error("CIMD client_id URL must use standard HTTPS port 443.");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("CIMD client_id hostname is not allowed.");
  }
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error("CIMD client_id IP address is private or reserved.");
    }
    return parsed;
  }
  const records = await dns.lookup(host, { all: true }).catch(() => []);
  if (records.length === 0) {
    throw new Error("CIMD client_id hostname could not be resolved.");
  }
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error("CIMD client_id resolves to a private or reserved network address.");
    }
  }
  return parsed;
}

export function isValidRedirectUri(rawUri: string): boolean {
  try {
    const parsed = new URL(rawUri);
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol === "http:") {
      const host = parsed.hostname.toLowerCase();
      return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
    }
    return false;
  } catch {
    return false;
  }
}

export type CimdFetcher = (url: string) => Promise<unknown>;

async function defaultCimdFetch(url: string): Promise<unknown> {
  const parsed = await assertSafePublicHttpsUrl(url);
  const response = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json", "User-Agent": "aayam-mcp-oauth" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch client metadata document (${response.status}).`);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > 64 * 1024) {
    throw new Error("Client metadata document exceeds 64KB limit.");
  }
  return JSON.parse(text);
}

export async function resolveOAuthClient(
  clientId: string,
  cimdFetcher: CimdFetcher = defaultCimdFetch,
): Promise<McpOAuthClient | null> {
  const cleanId = clientId.trim();
  if (!cleanId) return null;
  const redis = getRedis();

  if (cleanId.startsWith("https://")) {
    const cacheKey = `oauth:cimd:${sha256Hex(cleanId)}`;
    const cached = await redis.getJson<McpOAuthClient>(cacheKey).catch(() => null);
    if (cached) return cached;

    const doc = (await cimdFetcher(cleanId)) as Record<string, unknown>;
    if (!doc || typeof doc !== "object") {
      throw new Error("Invalid client metadata document.");
    }
    if (doc.client_id !== cleanId) {
      throw new Error("CIMD client_id does not match document URL.");
    }
    if (!Array.isArray(doc.redirect_uris) || doc.redirect_uris.length === 0) {
      throw new Error("CIMD redirect_uris must be a non-empty array.");
    }
    const redirectUris = doc.redirect_uris.filter((u): u is string => typeof u === "string" && isValidRedirectUri(u));
    if (redirectUris.length !== doc.redirect_uris.length) {
      throw new Error("CIMD contains invalid redirect_uris.");
    }
    const authMethod =
      typeof doc.token_endpoint_auth_method === "string" ? doc.token_endpoint_auth_method : "none";
    if (authMethod !== "none") {
      throw new Error("CIMD clients must use token_endpoint_auth_method 'none'.");
    }

    const client: McpOAuthClient = {
      clientId: cleanId,
      clientName: typeof doc.client_name === "string" && doc.client_name.trim() ? doc.client_name.trim() : new URL(cleanId).hostname,
      clientUri: typeof doc.client_uri === "string" ? doc.client_uri : undefined,
      redirectUris,
      grantTypes: Array.isArray(doc.grant_types)
        ? doc.grant_types.filter((g): g is string => typeof g === "string")
        : ["authorization_code", "refresh_token"],
      responseTypes: Array.isArray(doc.response_types)
        ? doc.response_types.filter((r): r is string => typeof r === "string")
        : ["code"],
      tokenEndpointAuthMethod: "none",
      isCimd: true,
      createdAt: Date.now(),
    };
    await redis.setJson(cacheKey, client, CIMD_TTL_SECONDS).catch(() => {});
    return client;
  }

  return await redis.getJson<McpOAuthClient>(`oauth:client:${cleanId}`).catch(() => null);
}

export async function registerDcrClient(input: {
  client_name?: unknown;
  client_uri?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
}): Promise<{ client: McpOAuthClient; clientSecret?: string }> {
  if (!Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0 || input.redirect_uris.length > 10) {
    throw new Error("redirect_uris must be a non-empty array of at most 10 URIs.");
  }
  const redirectUris = input.redirect_uris.map((u) => (typeof u === "string" ? u.trim() : ""));
  if (redirectUris.some((u) => !isValidRedirectUri(u))) {
    throw new Error("Each redirect_uri must be HTTPS or http://localhost / http://127.0.0.1.");
  }

  const rawAuthMethod = typeof input.token_endpoint_auth_method === "string" ? input.token_endpoint_auth_method : "none";
  if (
    rawAuthMethod !== "none" &&
    rawAuthMethod !== "client_secret_post" &&
    rawAuthMethod !== "client_secret_basic"
  ) {
    throw new Error("Unsupported token_endpoint_auth_method.");
  }

  const grantTypes = Array.isArray(input.grant_types)
    ? input.grant_types.filter((g): g is string => typeof g === "string")
    : ["authorization_code", "refresh_token"];
  if (!grantTypes.includes("authorization_code")) {
    throw new Error("grant_types must include authorization_code.");
  }

  const responseTypes = Array.isArray(input.response_types)
    ? input.response_types.filter((r): r is string => typeof r === "string")
    : ["code"];
  if (!responseTypes.includes("code")) {
    throw new Error("response_types must include code.");
  }

  const clientId = `mcp_${randomToken(18)}`;
  const clientSecret = rawAuthMethod === "none" ? undefined : `mcs_${randomToken(24)}`;
  const client: McpOAuthClient = {
    clientId,
    clientName:
      typeof input.client_name === "string" && input.client_name.trim()
        ? input.client_name.trim().slice(0, 120)
        : "MCP Client",
    clientUri:
      typeof input.client_uri === "string" && isValidRedirectUri(input.client_uri)
        ? input.client_uri
        : undefined,
    redirectUris,
    grantTypes,
    responseTypes,
    tokenEndpointAuthMethod: rawAuthMethod,
    clientSecretHash: clientSecret ? sha256Hex(clientSecret) : undefined,
    isCimd: false,
    createdAt: Date.now(),
  };

  await getRedis().setJson(`oauth:client:${clientId}`, client, CLIENT_TTL_SECONDS);
  return { client, clientSecret };
}

export async function saveAuthTransaction(tx: PendingOAuthTransaction) {
  await getRedis().setJson(`oauth:tx:${tx.txId}`, tx, TX_TTL_SECONDS);
}

export async function getAuthTransaction(txId: string): Promise<PendingOAuthTransaction | null> {
  if (!txId) return null;
  return await getRedis().getJson<PendingOAuthTransaction>(`oauth:tx:${txId}`);
}

export async function consumeAuthTransaction(txId: string): Promise<PendingOAuthTransaction | null> {
  if (!txId) return null;
  const redis = getRedis();
  const tx = await redis.getJson<PendingOAuthTransaction>(`oauth:tx:${txId}`);
  if (!tx) return null;
  await redis.del(`oauth:tx:${txId}`);
  return tx;
}

export function allowedScopesForIdentity(faculty: McpFacultyIdentity): McpScope[] {
  const allowed: McpScope[] = ["timetable:read", "faculty:self"];
  if (faculty.canSeeAllFaculty || faculty.coordinatorCohorts.length > 0) {
    allowed.push("coordinator:read");
  }
  if (faculty.canSeeAllFaculty) {
    allowed.push("faculty:all", "faculty:directory");
  }
  return allowed;
}

export function resolveGrantedScopes(requestedScope: string, faculty: McpFacultyIdentity): McpScope[] {
  const allowed = allowedScopesForIdentity(faculty);
  const allowedSet = new Set<string>(allowed);
  const tokens = requestedScope
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s): s is McpScope => (MCP_SCOPES as readonly string[]).includes(s));
  if (tokens.length === 0) return allowed;
  const intersection = [...new Set(tokens.filter((s) => allowedSet.has(s)))];
  return intersection.length > 0 ? intersection : ["timetable:read", "faculty:self"];
}

export async function issueAuthorizationCode(
  input: Omit<StoredAuthCode, "codeHash" | "createdAt">,
): Promise<string> {
  const code = `mc_${randomToken(24)}`;
  const codeHash = sha256Hex(code);
  const record: StoredAuthCode = {
    ...input,
    codeHash,
    createdAt: Date.now(),
  };
  await getRedis().setJson(`oauth:code:${codeHash}`, record, CODE_TTL_SECONDS);
  return code;
}

export async function consumeAuthorizationCode(code: string): Promise<StoredAuthCode | null> {
  if (!code) return null;
  const codeHash = sha256Hex(code);
  const redis = getRedis();
  const key = `oauth:code:${codeHash}`;
  const usedKey = `oauth:code:used:${codeHash}`;
  const firstUse = await redis.setNx(usedKey, "1", CODE_TTL_SECONDS);
  if (!firstUse) return null;
  const record = await redis.getJson<StoredAuthCode>(key);
  if (record) await redis.del(key);
  return record;
}

export function signMcpAccessToken(input: {
  iss: string;
  aud: string;
  faculty: McpFacultyIdentity;
  scopes: McpScope[];
  clientId: string;
  familyId?: string;
  ttlSeconds?: number;
}): { token: string; payload: McpAccessTokenPayload } {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
  const payload: McpAccessTokenPayload = {
    typ: "mcp_at",
    jti: `jti_${randomToken(18)}`,
    familyId: input.familyId,
    iss: input.iss,
    aud: input.aud,
    sub: input.faculty.email,
    faculty: input.faculty.facultyName,
    canSeeAllFaculty: input.faculty.canSeeAllFaculty,
    coordinatorCohorts: input.faculty.coordinatorCohorts,
    scopes: input.scopes,
    client_id: input.clientId,
    iat: nowSec,
    exp: nowSec + ttl,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getMcpSigningKey()).update(encoded).digest("base64url");
  return { token: `${encoded}.${sig}`, payload };
}

export function parseAndVerifyAccessTokenSignature(token: string): McpAccessTokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts as [string, string];
  if (!encoded || !sig) return null;
  try {
    const expectedSig = crypto.createHmac("sha256", getMcpSigningKey()).update(encoded).digest("base64url");
    if (!timingSafeEqualStr(sig, expectedSig)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as McpAccessTokenPayload;
    if (!payload || payload.typ !== "mcp_at" || !payload.jti || !payload.sub || !payload.aud) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || nowSec >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function issueRefreshToken(input: {
  familyId?: string;
  clientId: string;
  scopes: McpScope[];
  resource: string;
  faculty: McpFacultyIdentity;
}): Promise<{ refreshToken: string; familyId: string }> {
  const refreshToken = `rt_${randomToken(32)}`;
  const tokenHash = sha256Hex(refreshToken);
  const familyId = input.familyId || `fam_${randomToken(12)}`;
  const record: StoredRefreshToken = {
    tokenHash,
    familyId,
    clientId: input.clientId,
    scopes: input.scopes,
    resource: input.resource,
    faculty: input.faculty,
    used: false,
    createdAt: Date.now(),
  };
  await getRedis().setJson(`oauth:rt:${tokenHash}`, record, REFRESH_TOKEN_TTL_SECONDS);
  return { refreshToken, familyId };
}

export async function rotateRefreshToken(
  refreshToken: string,
  clientId: string,
): Promise<{ ok: true; record: StoredRefreshToken } | { ok: false; reason: string }> {
  if (!refreshToken) return { ok: false, reason: "Missing refresh token." };
  const tokenHash = sha256Hex(refreshToken);
  const redis = getRedis();
  const key = `oauth:rt:${tokenHash}`;
  const record = await redis.getJson<StoredRefreshToken>(key);
  if (!record) return { ok: false, reason: "Invalid or expired refresh token." };
  if (record.clientId !== clientId) return { ok: false, reason: "Refresh token client mismatch." };

  const familyRevoked = await redis.get(`oauth:rt-family-revoked:${record.familyId}`);
  if (familyRevoked) return { ok: false, reason: "Token family has been revoked." };

  if (record.used) {
    // Reuse detection: revoke entire token family immediately.
    await redis.set(`oauth:rt-family-revoked:${record.familyId}`, "1", REFRESH_TOKEN_TTL_SECONDS);
    await redis.del(key);
    return { ok: false, reason: "Refresh token reuse detected." };
  }

  // Mark used with short retention window so immediate replay triggers reuse detection.
  await redis.setJson(key, { ...record, used: true } satisfies StoredRefreshToken, 300);
  return { ok: true, record };
}

export async function revokeToken(token: string): Promise<void> {
  if (!token) return;
  const redis = getRedis();
  if (token.startsWith("rt_")) {
    const hash = sha256Hex(token);
    const record = await redis.getJson<StoredRefreshToken>(`oauth:rt:${hash}`);
    if (record) {
      await redis.set(`oauth:rt-family-revoked:${record.familyId}`, "1", REFRESH_TOKEN_TTL_SECONDS);
      await redis.del(`oauth:rt:${hash}`);
    }
    return;
  }
  const payload = parseAndVerifyAccessTokenSignature(token);
  if (payload) {
    const remaining = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
    await redis.set(`oauth:revoked:${payload.jti}`, "1", remaining);
  }
}

export async function isAccessTokenRevoked(payload: McpAccessTokenPayload): Promise<boolean> {
  const redis = getRedis();
  const revoked = await redis.get(`oauth:revoked:${payload.jti}`);
  if (revoked) return true;
  if (payload.familyId) {
    const familyRevoked = await redis.get(`oauth:rt-family-revoked:${payload.familyId}`);
    if (familyRevoked) return true;
  }
  return false;
}
