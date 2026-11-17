import { findCoordinator } from "../../../shared/coordinators.ts";
import type { SqlDb, SqlStatement } from "../d1/sql.ts";
import type { FacultyRow } from "./auth.ts";
import { base64UrlToBytes, bytesToBase64Url, fromUtf8, hmacSha256, randomToken, sha256Hex, timingSafeEqualStr, utf8 } from "./crypto.ts";

/**
 * OAuth 2.1 state for the MCP endpoint, in D1 (`migrations/0002_mcp_oauth.sql`). Only hashes of codes,
 * refresh tokens, transaction ids, and client secrets are stored. Access tokens are stateless HMAC tokens
 * signed with a key derived from AUTH_SECRET, so a faculty web session can never pass as one.
 */

export const MCP_SCOPES = ["timetable:read", "faculty:self", "coordinator:read", "faculty:all", "faculty:directory"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export interface McpFacultyIdentity {
  id: number;
  email: string;
  facultyName: string;
  canSeeAllFaculty: boolean;
  coordinatorCohorts: string[];
}

export interface McpOAuthClient {
  clientId: string;
  clientName: string;
  clientUri?: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none" | "client_secret_post" | "client_secret_basic";
  clientSecretHash?: string;
  isCimd: boolean;
  createdAt: number;
}

export interface McpAuth {
  token: string;
  clientId: string;
  scopes: McpScope[];
  expiresAt: number;
  resource: string;
  identity: McpFacultyIdentity;
  jti: string;
  familyId?: string;
}

const CLIENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const CIMD_TTL_SECONDS = 10 * 60;
const TX_TTL_SECONDS = 10 * 60;
const CODE_TTL_SECONDS = 90;
const USED_REFRESH_TTL_SECONDS = 5 * 60;
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
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scopes: McpScope[];
  resource: string;
  faculty: McpFacultyIdentity;
}

export interface StoredRefreshToken {
  familyId: string;
  clientId: string;
  scopes: McpScope[];
  resource: string;
  faculty: McpFacultyIdentity;
  used: boolean;
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

const iso = (ms: number) => new Date(ms).toISOString();
const later = (seconds: number, now = Date.now()) => iso(now + seconds * 1000);

function parse<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Delete expired rows of every OAuth table. Cheap with the `expires_at` indexes; runs alongside writes. */
export function pruneStatements(now = Date.now()): SqlStatement[] {
  const at = iso(now);
  return ["mcp_oauth_clients", "mcp_oauth_transactions", "mcp_oauth_codes", "mcp_oauth_refresh_tokens", "mcp_oauth_revocations"].map((table) => ({
    sql: `DELETE FROM ${table} WHERE expires_at <= ?`,
    params: [at],
  }));
}

export function toFacultyIdentity(row: FacultyRow): McpFacultyIdentity {
  const coordinator = findCoordinator(row.email, row.faculty_name);
  return {
    id: row.id,
    email: row.email,
    facultyName: row.faculty_name,
    canSeeAllFaculty: Boolean(row.can_see_all_faculty),
    coordinatorCohorts: coordinator?.cohorts ?? [],
  };
}

export function allowedScopesForIdentity(faculty: McpFacultyIdentity): McpScope[] {
  const allowed: McpScope[] = ["timetable:read", "faculty:self"];
  if (faculty.canSeeAllFaculty || faculty.coordinatorCohorts.length > 0) allowed.push("coordinator:read");
  if (faculty.canSeeAllFaculty) allowed.push("faculty:all", "faculty:directory");
  return allowed;
}

export function resolveGrantedScopes(requestedScope: string, faculty: McpFacultyIdentity): McpScope[] {
  const allowed = allowedScopesForIdentity(faculty);
  const allowedSet = new Set<string>(allowed);
  const tokens = requestedScope
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter((scope): scope is McpScope => (MCP_SCOPES as readonly string[]).includes(scope));
  if (tokens.length === 0) return allowed;
  const intersection = [...new Set(tokens.filter((scope) => allowedSet.has(scope)))];
  return intersection.length > 0 ? intersection : ["timetable:read", "faculty:self"];
}

// --- Client URLs -------------------------------------------------------------------------------------------

/** Private, loopback, link-local, CGNAT, multicast, and reserved addresses. Anything unparsable counts as private. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (cleaned.startsWith("::ffff:")) return isPrivateOrReservedIp(cleaned.slice(7));
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleaned)) {
    const parts = cleaned.split(".").map((n) => Number.parseInt(n, 10));
    if (parts.some((n) => Number.isNaN(n) || n > 255)) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (cleaned.includes(":")) {
    if (cleaned === "::" || cleaned === "::1") return true;
    if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(cleaned)) return true;
    if (cleaned.startsWith("ff")) return true;
    return false;
  }
  return true;
}

const isIpLiteral = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":");

/**
 * A client ID metadata document URL the Worker may fetch. Workers cannot resolve DNS, and Cloudflare's
 * fetch never reaches a private network, so hostnames are checked by name and IP literals by range.
 */
export function assertSafePublicHttpsUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid client_id URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("CIMD client_id URL must use HTTPS.");
  if (parsed.username || parsed.password) throw new Error("CIMD client_id URL must not contain credentials.");
  if (parsed.port && parsed.port !== "443") throw new Error("CIMD client_id URL must use standard HTTPS port 443.");
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("CIMD client_id hostname is not allowed.");
  }
  if (isIpLiteral(host) && isPrivateOrReservedIp(host)) throw new Error("CIMD client_id IP address is private or reserved.");
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
  const parsed = assertSafePublicHttpsUrl(url);
  const response = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json", "User-Agent": "aayam-mcp-oauth" },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Failed to fetch client metadata document (${response.status}).`);
  }
  const text = await response.text();
  if (utf8(text).length > 64 * 1024) throw new Error("Client metadata document exceeds 64KB limit.");
  return JSON.parse(text);
}

// --- Clients -----------------------------------------------------------------------------------------------

interface ClientRow {
  client_id: string;
  client_name: string;
  client_uri: string | null;
  redirect_uris: string;
  grant_types: string;
  response_types: string;
  token_endpoint_auth_method: McpOAuthClient["tokenEndpointAuthMethod"];
  client_secret_hash: string | null;
  is_cimd: number;
  created_at: string;
}

function clientFromRow(row: ClientRow): McpOAuthClient {
  return {
    clientId: row.client_id,
    clientName: row.client_name,
    clientUri: row.client_uri ?? undefined,
    redirectUris: parse<string[]>(row.redirect_uris) ?? [],
    grantTypes: parse<string[]>(row.grant_types) ?? [],
    responseTypes: parse<string[]>(row.response_types) ?? [],
    tokenEndpointAuthMethod: row.token_endpoint_auth_method,
    clientSecretHash: row.client_secret_hash ?? undefined,
    isCimd: Boolean(row.is_cimd),
    createdAt: Date.parse(row.created_at) || Date.now(),
  };
}

function saveClient(client: McpOAuthClient, ttlSeconds: number): SqlStatement {
  return {
    sql: `INSERT INTO mcp_oauth_clients (client_id, client_name, client_uri, redirect_uris, grant_types, response_types, token_endpoint_auth_method, client_secret_hash, is_cimd, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (client_id) DO UPDATE SET client_name = excluded.client_name, client_uri = excluded.client_uri,
        redirect_uris = excluded.redirect_uris, grant_types = excluded.grant_types, response_types = excluded.response_types,
        token_endpoint_auth_method = excluded.token_endpoint_auth_method, client_secret_hash = excluded.client_secret_hash,
        is_cimd = excluded.is_cimd, created_at = excluded.created_at, expires_at = excluded.expires_at`,
    params: [
      client.clientId,
      client.clientName,
      client.clientUri ?? null,
      JSON.stringify(client.redirectUris),
      JSON.stringify(client.grantTypes),
      JSON.stringify(client.responseTypes),
      client.tokenEndpointAuthMethod,
      client.clientSecretHash ?? null,
      client.isCimd ? 1 : 0,
      iso(client.createdAt),
      later(ttlSeconds, client.createdAt),
    ],
  };
}

/** A registered client, or an `https://` client_id resolved as a metadata document (cached 10 minutes). */
export async function resolveOAuthClient(db: SqlDb, clientId: string, cimdFetcher: CimdFetcher = defaultCimdFetch): Promise<McpOAuthClient | null> {
  const cleanId = clientId.trim();
  if (!cleanId || cleanId.length > 2048) return null;
  const rows = await db.all<ClientRow>(
    "SELECT client_id, client_name, client_uri, redirect_uris, grant_types, response_types, token_endpoint_auth_method, client_secret_hash, is_cimd, created_at FROM mcp_oauth_clients WHERE client_id = ? AND expires_at > ?",
    [cleanId, iso(Date.now())],
  );
  if (rows[0]) return clientFromRow(rows[0]);
  if (!cleanId.startsWith("https://")) return null;

  const doc = (await cimdFetcher(cleanId)) as Record<string, unknown>;
  if (!doc || typeof doc !== "object") throw new Error("Invalid client metadata document.");
  if (doc.client_id !== cleanId) throw new Error("CIMD client_id does not match document URL.");
  if (!Array.isArray(doc.redirect_uris) || doc.redirect_uris.length === 0) throw new Error("CIMD redirect_uris must be a non-empty array.");
  const redirectUris = doc.redirect_uris.filter((uri): uri is string => typeof uri === "string" && isValidRedirectUri(uri));
  if (redirectUris.length !== doc.redirect_uris.length) throw new Error("CIMD contains invalid redirect_uris.");
  const authMethod = typeof doc.token_endpoint_auth_method === "string" ? doc.token_endpoint_auth_method : "none";
  if (authMethod !== "none") throw new Error("CIMD clients must use token_endpoint_auth_method 'none'.");

  const client: McpOAuthClient = {
    clientId: cleanId,
    clientName: typeof doc.client_name === "string" && doc.client_name.trim() ? doc.client_name.trim().slice(0, 120) : new URL(cleanId).hostname,
    clientUri: typeof doc.client_uri === "string" ? doc.client_uri : undefined,
    redirectUris,
    grantTypes: Array.isArray(doc.grant_types) ? doc.grant_types.filter((g): g is string => typeof g === "string") : ["authorization_code", "refresh_token"],
    responseTypes: Array.isArray(doc.response_types) ? doc.response_types.filter((r): r is string => typeof r === "string") : ["code"],
    tokenEndpointAuthMethod: "none",
    isCimd: true,
    createdAt: Date.now(),
  };
  try {
    await db.run([saveClient(client, CIMD_TTL_SECONDS)]);
  } catch (error) {
    console.error("[oauth] CIMD cache write failed", error instanceof Error ? error.message : error);
  }
  return client;
}

export async function registerDcrClient(
  db: SqlDb,
  input: Record<string, unknown>,
): Promise<{ client: McpOAuthClient; clientSecret?: string }> {
  if (!Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0 || input.redirect_uris.length > 10) {
    throw new Error("redirect_uris must be a non-empty array of at most 10 URIs.");
  }
  const redirectUris = input.redirect_uris.map((uri) => (typeof uri === "string" ? uri.trim() : ""));
  if (redirectUris.some((uri) => !isValidRedirectUri(uri) || uri.length > 2048)) {
    throw new Error("Each redirect_uri must be HTTPS or http://localhost / http://127.0.0.1.");
  }
  const rawAuthMethod = typeof input.token_endpoint_auth_method === "string" ? input.token_endpoint_auth_method : "none";
  if (rawAuthMethod !== "none" && rawAuthMethod !== "client_secret_post" && rawAuthMethod !== "client_secret_basic") {
    throw new Error("Unsupported token_endpoint_auth_method.");
  }
  const grantTypes = Array.isArray(input.grant_types)
    ? input.grant_types.filter((g): g is string => typeof g === "string")
    : ["authorization_code", "refresh_token"];
  if (!grantTypes.includes("authorization_code")) throw new Error("grant_types must include authorization_code.");
  const responseTypes = Array.isArray(input.response_types)
    ? input.response_types.filter((r): r is string => typeof r === "string")
    : ["code"];
  if (!responseTypes.includes("code")) throw new Error("response_types must include code.");

  const clientSecret = rawAuthMethod === "none" ? undefined : `mcs_${randomToken(24)}`;
  const client: McpOAuthClient = {
    clientId: `mcp_${randomToken(18)}`,
    clientName: typeof input.client_name === "string" && input.client_name.trim() ? input.client_name.trim().slice(0, 120) : "MCP Client",
    clientUri: typeof input.client_uri === "string" && isValidRedirectUri(input.client_uri) ? input.client_uri : undefined,
    redirectUris,
    grantTypes,
    responseTypes,
    tokenEndpointAuthMethod: rawAuthMethod,
    clientSecretHash: clientSecret ? await sha256Hex(clientSecret) : undefined,
    isCimd: false,
    createdAt: Date.now(),
  };
  await db.run([...pruneStatements(), saveClient(client, CLIENT_TTL_SECONDS)]);
  return { client, clientSecret };
}

// --- Authorization transactions ----------------------------------------------------------------------------

export async function saveAuthTransaction(db: SqlDb, tx: PendingOAuthTransaction, extra: SqlStatement[] = []) {
  await db.run([
    ...extra,
    {
      sql: `INSERT INTO mcp_oauth_transactions (tx_hash, data, expires_at) VALUES (?, ?, ?)
        ON CONFLICT (tx_hash) DO UPDATE SET data = excluded.data`,
      params: [await sha256Hex(tx.txId), JSON.stringify(tx), later(TX_TTL_SECONDS, tx.createdAt)],
    },
  ]);
}

export async function getAuthTransaction(db: SqlDb, txId: string): Promise<PendingOAuthTransaction | null> {
  if (!txId) return null;
  const rows = await db.all<{ data: string }>("SELECT data FROM mcp_oauth_transactions WHERE tx_hash = ? AND expires_at > ?", [
    await sha256Hex(txId),
    iso(Date.now()),
  ]);
  return parse<PendingOAuthTransaction>(rows[0]?.data);
}

/** Read and delete in one statement, so a transaction is used once. */
export async function consumeAuthTransaction(db: SqlDb, txId: string): Promise<PendingOAuthTransaction | null> {
  if (!txId) return null;
  const rows = await db.all<{ data: string; expires_at: string }>("DELETE FROM mcp_oauth_transactions WHERE tx_hash = ? RETURNING data, expires_at", [
    await sha256Hex(txId),
  ]);
  const row = rows[0];
  if (!row || row.expires_at <= iso(Date.now())) return null;
  return parse<PendingOAuthTransaction>(row.data);
}

// --- Codes -------------------------------------------------------------------------------------------------

export async function issueAuthorizationCode(db: SqlDb, input: StoredAuthCode): Promise<string> {
  const code = `mc_${randomToken(24)}`;
  await db.run([
    {
      sql: "INSERT INTO mcp_oauth_codes (code_hash, client_id, data, expires_at) VALUES (?, ?, ?, ?)",
      params: [await sha256Hex(code), input.clientId, JSON.stringify(input), later(CODE_TTL_SECONDS)],
    },
  ]);
  return code;
}

/** Single use: the row is deleted by the first attempt, whether or not the rest of the exchange succeeds. */
export async function consumeAuthorizationCode(db: SqlDb, code: string): Promise<StoredAuthCode | null> {
  if (!code) return null;
  const rows = await db.all<{ data: string; expires_at: string }>("DELETE FROM mcp_oauth_codes WHERE code_hash = ? RETURNING data, expires_at", [
    await sha256Hex(code),
  ]);
  const row = rows[0];
  if (!row || row.expires_at <= iso(Date.now())) return null;
  return parse<StoredAuthCode>(row.data);
}

// --- Access tokens -----------------------------------------------------------------------------------------

const signingKeys = new Map<string, Promise<string>>();

/** HMAC(AUTH_SECRET, "aayam-mcp-oauth-v1"): a separate key, so a web session token never verifies as an access token. */
function mcpSigningKey(secret: string) {
  let key = signingKeys.get(secret);
  if (!key) {
    key = hmacSha256(secret, utf8("aayam-mcp-oauth-v1")).then(bytesToBase64Url);
    signingKeys.set(secret, key);
  }
  return key;
}

export async function signMcpAccessToken(
  secret: string,
  input: { iss: string; aud: string; faculty: McpFacultyIdentity; scopes: McpScope[]; clientId: string; familyId?: string; ttlSeconds?: number },
): Promise<{ token: string; payload: McpAccessTokenPayload }> {
  const nowSec = Math.floor(Date.now() / 1000);
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
    exp: nowSec + (input.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS),
  };
  const encoded = bytesToBase64Url(utf8(JSON.stringify(payload)));
  const signature = bytesToBase64Url(await hmacSha256(await mcpSigningKey(secret), utf8(encoded)));
  return { token: `${encoded}.${signature}`, payload };
}

export async function verifyMcpAccessToken(secret: string | null, token: string): Promise<McpAccessTokenPayload | null> {
  if (!secret || !token || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts as [string, string];
  if (!encoded || !signature) return null;
  const expected = bytesToBase64Url(await hmacSha256(await mcpSigningKey(secret), utf8(encoded)));
  if (!timingSafeEqualStr(signature, expected)) return null;
  const bytes = base64UrlToBytes(encoded);
  const payload = bytes ? parse<McpAccessTokenPayload>(fromUtf8(bytes)) : null;
  if (!payload || payload.typ !== "mcp_at" || !payload.jti || !payload.sub || !payload.aud) return null;
  if (typeof payload.exp !== "number" || Math.floor(Date.now() / 1000) >= payload.exp) return null;
  return payload;
}

/**
 * The live directory row for a token's subject and whether the token or its family was revoked, in one
 * read. `faculty` is null when the account is gone or inactive.
 */
export async function accessTokenStatus(db: SqlDb, payload: McpAccessTokenPayload) {
  const revocationIds = [`jti:${payload.jti}`, payload.familyId ? `family:${payload.familyId}` : `jti:${payload.jti}`];
  const rows = await db.all<{ kind: string; id: number | null; email: string | null; name: string | null; flag: number | null }>(
    `SELECT 'f' AS kind, id, email, faculty_name AS name, can_see_all_faculty AS flag FROM faculty_directory WHERE email = ? COLLATE NOCASE AND is_active = 1
    UNION ALL
    SELECT 'r', NULL, NULL, id, NULL FROM mcp_oauth_revocations WHERE id IN (?, ?) AND expires_at > ?`,
    [payload.sub, ...revocationIds, iso(Date.now())],
  );
  const row = rows.find((item) => item.kind === "f");
  const faculty = row
    ? toFacultyIdentity({ id: Number(row.id), email: row.email ?? payload.sub, faculty_name: row.name ?? payload.faculty, can_see_all_faculty: Boolean(row.flag) })
    : null;
  return { revoked: rows.some((item) => item.kind === "r"), faculty };
}

// --- Refresh tokens ----------------------------------------------------------------------------------------

export async function issueRefreshToken(
  db: SqlDb,
  input: { familyId?: string; clientId: string; scopes: McpScope[]; resource: string; faculty: McpFacultyIdentity },
  extra: SqlStatement[] = [],
): Promise<{ refreshToken: string; familyId: string }> {
  const refreshToken = `rt_${randomToken(32)}`;
  const familyId = input.familyId || `fam_${randomToken(12)}`;
  const record: StoredRefreshToken = { familyId, clientId: input.clientId, scopes: input.scopes, resource: input.resource, faculty: input.faculty, used: false };
  const now = Date.now();
  await db.run([
    ...extra,
    {
      sql: "INSERT INTO mcp_oauth_refresh_tokens (token_hash, family_id, client_id, data, used_at, created_at, expires_at) VALUES (?, ?, ?, ?, NULL, ?, ?)",
      params: [await sha256Hex(refreshToken), familyId, input.clientId, JSON.stringify(record), iso(now), later(REFRESH_TOKEN_TTL_SECONDS, now)],
    },
  ]);
  return { refreshToken, familyId };
}

function revokeFamily(familyId: string, now = Date.now()): SqlStatement[] {
  return [
    {
      sql: `INSERT INTO mcp_oauth_revocations (id, expires_at) VALUES (?, ?)
        ON CONFLICT (id) DO UPDATE SET expires_at = excluded.expires_at`,
      params: [`family:${familyId}`, later(REFRESH_TOKEN_TTL_SECONDS, now)],
    },
    { sql: "DELETE FROM mcp_oauth_refresh_tokens WHERE family_id = ?", params: [familyId] },
  ];
}

/**
 * Mark a refresh token used. The claim is one UPDATE, so two concurrent refreshes cannot both win. A token
 * presented again after use revokes its whole family, including access tokens already issued from it.
 */
export async function rotateRefreshToken(
  db: SqlDb,
  refreshToken: string,
  clientId: string,
): Promise<{ ok: true; record: StoredRefreshToken } | { ok: false; reason: string }> {
  if (!refreshToken) return { ok: false, reason: "Missing refresh token." };
  const hash = await sha256Hex(refreshToken);
  const now = Date.now();
  const rows = await db.all<{ family_id: string; client_id: string; data: string; used_at: string | null; revoked: number }>(
    `SELECT family_id, client_id, data, used_at,
      EXISTS (SELECT 1 FROM mcp_oauth_revocations WHERE id = 'family:' || family_id AND expires_at > ?) AS revoked
    FROM mcp_oauth_refresh_tokens WHERE token_hash = ? AND expires_at > ?`,
    [iso(now), hash, iso(now)],
  );
  const row = rows[0];
  const record = parse<StoredRefreshToken>(row?.data);
  if (!row || !record) return { ok: false, reason: "Invalid or expired refresh token." };
  if (row.client_id !== clientId) return { ok: false, reason: "Refresh token client mismatch." };
  if (row.revoked) return { ok: false, reason: "Token family has been revoked." };
  if (row.used_at) {
    await db.run(revokeFamily(row.family_id, now));
    return { ok: false, reason: "Refresh token reuse detected." };
  }
  const claimed = await db.all(
    "UPDATE mcp_oauth_refresh_tokens SET used_at = ?, expires_at = ? WHERE token_hash = ? AND used_at IS NULL RETURNING token_hash",
    [iso(now), later(USED_REFRESH_TTL_SECONDS, now), hash],
  );
  if (claimed.length === 0) {
    await db.run(revokeFamily(row.family_id, now));
    return { ok: false, reason: "Refresh token reuse detected." };
  }
  return { ok: true, record: { ...record, familyId: row.family_id } };
}

/** RFC 7009: a refresh token revokes its family; an access token is revoked until it would have expired. */
export async function revokeToken(db: SqlDb, secret: string | null, token: string): Promise<void> {
  if (!token) return;
  if (token.startsWith("rt_")) {
    const rows = await db.all<{ family_id: string }>("SELECT family_id FROM mcp_oauth_refresh_tokens WHERE token_hash = ?", [await sha256Hex(token)]);
    if (rows[0]) await db.run(revokeFamily(rows[0].family_id));
    return;
  }
  const payload = await verifyMcpAccessToken(secret, token);
  if (!payload) return;
  await db.run([
    ...pruneStatements(),
    {
      sql: "INSERT INTO mcp_oauth_revocations (id, expires_at) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
      params: [`jti:${payload.jti}`, iso(Math.max(payload.exp * 1000, Date.now() + 1000))],
    },
  ]);
}
