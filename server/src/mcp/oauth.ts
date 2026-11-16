import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  createDistributedRateLimiter,
  getAllowedDomains,
  getClientIp,
  getGoogleClientId,
  getGoogleClientSecret,
  lookupFacultyByEmail,
  PinRateLimiter,
} from "../auth.ts";
import { findCoordinator } from "../../../shared/coordinators.ts";
import { databaseUrl } from "../services/postgres.ts";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  allowedScopesForIdentity,
  consumeAuthorizationCode,
  consumeAuthTransaction,
  getAuthTransaction,
  isAccessTokenRevoked,
  issueAuthorizationCode,
  issueRefreshToken,
  parseAndVerifyAccessTokenSignature,
  randomToken,
  registerDcrClient,
  resolveGrantedScopes,
  resolveOAuthClient,
  revokeToken,
  rotateRefreshToken,
  saveAuthTransaction,
  sha256Base64Url,
  sha256Hex,
  signMcpAccessToken,
  timingSafeEqualStr,
  type CimdFetcher,
} from "./oauthStore.ts";
import { MCP_SCOPES, type McpAuthContext, type McpFacultyIdentity, type McpOAuthClient, type McpScope } from "./types.ts";

export interface McpOAuthDependencies {
  cimdFetcher?: CimdFetcher;
  exchangeGoogleCode?: (opts: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }) => Promise<{ idToken: string }>;
  verifyGoogleIdToken?: (
    idToken: string,
    expectedNonce?: string,
  ) => Promise<{ email: string; name: string }>;
  resolveFaculty?: (email: string) => Promise<{
    id: number;
    email: string;
    faculty_name: string;
    can_see_all_faculty: boolean;
  }>;
}

const dcrRateLimiterFallback = new PinRateLimiter(12, 10 * 60 * 1000);
const dcrRateLimiter = createDistributedRateLimiter("oauth_dcr", dcrRateLimiterFallback, 12, 10 * 60);
const tokenRateLimiterFallback = new PinRateLimiter(60, 5 * 60 * 1000);
const tokenRateLimiter = createDistributedRateLimiter("oauth_token", tokenRateLimiterFallback, 60, 5 * 60);

function firstHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.split(",")[0]?.trim() || "";
  if (typeof value === "string") return value.split(",")[0]?.trim() || "";
  return "";
}

export function canonicalOrigin(req: Request): string {
  const configured = process.env.MCP_PUBLIC_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to request headers.
    }
  }
  const trustProxy = Boolean(process.env.VERCEL) || process.env.TRUST_PROXY === "1";
  const forwardedProto = trustProxy ? firstHeader(req.headers["x-forwarded-proto"]) : "";
  const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : req.protocol || "http";
  const forwardedHost = trustProxy ? firstHeader(req.headers["x-forwarded-host"]) : "";
  const host = forwardedHost || req.get("host") || "localhost:8787";
  return `${proto}://${host}`;
}

export function canonicalResourceUrl(req: Request): string {
  return `${canonicalOrigin(req)}/mcp`;
}

export function normalizeResourceUri(raw: string): string {
  try {
    const parsed = new URL(raw.trim());
    const pathname = parsed.pathname.replace(/\/+$/, "") || "";
    return `${parsed.origin}${pathname}`;
  } catch {
    return raw.trim().replace(/\/+$/, "");
  }
}

export function acceptedResourceAudiences(req: Request): Set<string> {
  const origin = canonicalOrigin(req);
  const set = new Set([`${origin}/mcp`, `${origin}/api/mcp`]);
  const configured = process.env.MCP_PUBLIC_URL?.trim();
  if (configured) {
    try {
      const configuredOrigin = new URL(configured).origin;
      set.add(`${configuredOrigin}/mcp`);
      set.add(`${configuredOrigin}/api/mcp`);
    } catch {
      // Ignore malformed env.
    }
  }
  return set;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtmlPage(title: string, body: string, status = 200, res?: Response) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Aayam Timetable</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }
    .eyebrow {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      margin: 0 0 8px;
    }
    h1 { font-size: 20px; margin: 0 0 8px; line-height: 1.3; }
    p { font-size: 14px; line-height: 1.5; color: #475569; margin: 0 0 16px; }
    .identity {
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      margin-bottom: 16px;
    }
    .identity-name { font-weight: 600; font-size: 14px; color: #0f172a; }
    .identity-email { font-size: 12px; color: #64748b; margin-top: 2px; }
    .badge {
      display: inline-block;
      margin-top: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(16, 185, 129, 0.12);
      color: #047857;
    }
    .badge-elevated {
      background: rgba(245, 158, 11, 0.15);
      color: #b45309;
    }
    ul.scopes {
      list-style: none;
      padding: 0;
      margin: 0 0 20px;
      border-top: 1px solid #e2e8f0;
    }
    ul.scopes li {
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    ul.scopes strong { display: block; color: #0f172a; font-size: 13px; }
    ul.scopes span { color: #64748b; font-size: 12px; }
    .actions { display: flex; gap: 10px; }
    button {
      flex: 1;
      padding: 10px 14px;
      border-radius: 9px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn-primary { background: #0f172a; color: #ffffff; }
    .btn-secondary { background: #ffffff; color: #334155; border-color: #cbd5e1; }
    .meta { margin-top: 14px; font-size: 11px; color: #94a3b8; font-family: ui-monospace, monospace; }
    @media (prefers-color-scheme: dark) {
      body { background: #09090b; color: #f4f4f5; }
      .card { background: #18181b; border-color: #27272a; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4); }
      p { color: #a1a1aa; }
      .identity { background: #09090b; border-color: #27272a; }
      .identity-name, ul.scopes strong { color: #f4f4f5; }
      .identity-email, ul.scopes span, .eyebrow { color: #a1a1aa; }
      ul.scopes, ul.scopes li { border-color: #27272a; }
      .btn-primary { background: #f4f4f5; color: #09090b; }
      .btn-secondary { background: #18181b; color: #e4e4e7; border-color: #3f3f46; }
      .badge { color: #34d399; }
      .badge-elevated { color: #fbbf24; }
    }
  </style>
</head>
<body>
  <main class="card">${body}</main>
</body>
</html>`;
  if (res) {
    res.status(status);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
    );
    res.send(html);
  }
  return html;
}

const SCOPE_LABELS: Record<McpScope, { title: string; detail: string }> = {
  "timetable:read": {
    title: "Read published timetables & room availability",
    detail: "Cohort schedules, weekly updates, cancellations, and free classrooms.",
  },
  "faculty:self": {
    title: "Read your personal teaching schedule",
    detail: "Your upcoming classes, room assignments, and calendar feed URL.",
  },
  "coordinator:read": {
    title: "Read your coordinated cohort schedules",
    detail: "Schedules and updates across the cohorts assigned to you.",
  },
  "faculty:all": {
    title: "Read all faculty teaching schedules",
    detail: "Elevated access to look up any faculty member's teaching schedule.",
  },
  "faculty:directory": {
    title: "Read confidential faculty directory",
    detail: "Staff emails, active status, and access permission flags.",
  },
};

function renderConsentPage(
  res: Response,
  params: {
    txId: string;
    csrfToken: string;
    clientName: string;
    redirectHost: string;
    faculty: McpFacultyIdentity;
    scopes: McpScope[];
  },
) {
  const roleLabel = params.faculty.canSeeAllFaculty
    ? "All-Access Faculty"
    : params.faculty.coordinatorCohorts.length > 0
      ? "Class Coordinator"
      : "Faculty";
  const badgeClass = params.faculty.canSeeAllFaculty ? "badge badge-elevated" : "badge";
  const scopeList = params.scopes
    .map((scope) => {
      const info = SCOPE_LABELS[scope];
      return `<li><strong>${escapeHtml(info.title)}</strong><span>${escapeHtml(info.detail)} (${escapeHtml(scope)})</span></li>`;
    })
    .join("");

  const body = `
    <p class="eyebrow">Aayam MCP Authorization</p>
    <h1>Connect ${escapeHtml(params.clientName)}</h1>
    <p><strong>${escapeHtml(params.clientName)}</strong> is requesting permission to access your Aayam timetable account.</p>
    <div class="identity">
      <div class="identity-name">${escapeHtml(params.faculty.facultyName)}</div>
      <div class="identity-email">${escapeHtml(params.faculty.email)}</div>
      <span class="${badgeClass}">${escapeHtml(roleLabel)}</span>
    </div>
    <ul class="scopes">${scopeList}</ul>
    <form method="POST" action="/oauth/consent">
      <input type="hidden" name="txId" value="${escapeHtml(params.txId)}" />
      <input type="hidden" name="csrfToken" value="${escapeHtml(params.csrfToken)}" />
      <div class="actions">
        <button class="btn-secondary" type="submit" name="decision" value="deny">Deny</button>
        <button class="btn-primary" type="submit" name="decision" value="approve">Authorize Access</button>
      </div>
    </form>
    <div class="meta">Redirect target: ${escapeHtml(params.redirectHost)}</div>
  `;
  renderHtmlPage("Authorize MCP Client", body, 200, res);
}

function redirectWithError(res: Response, redirectUri: string, error: string, description: string, state?: string) {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  target.searchParams.set("error_description", description);
  if (state) target.searchParams.set("state", state);
  res.redirect(302, target.toString());
}

async function defaultExchangeGoogleCode(opts: { code: string; redirectUri: string; codeVerifier: string }) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.");
  }
  const body = new URLSearchParams({
    code: opts.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
    code_verifier: opts.codeVerifier,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || typeof data?.id_token !== "string") {
    throw new Error("Failed to exchange Google authorization code.");
  }
  return { idToken: data.id_token };
}

async function defaultVerifyGoogleIdToken(idToken: string, expectedNonce?: string) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error("Invalid Google ID token.");
  }
  const data = (await response.json()) as Record<string, unknown>;
  const email = (typeof data.email === "string" ? data.email : "").toLowerCase().trim();
  const emailVerified = data.email_verified === "true" || data.email_verified === true;
  const name = typeof data.name === "string" ? data.name : "";
  const aud = typeof data.aud === "string" ? data.aud : "";
  const iss = typeof data.iss === "string" ? data.iss : "";
  const nonce = typeof data.nonce === "string" ? data.nonce : "";

  if (!email || !emailVerified) {
    throw new Error("Google account email is not verified.");
  }
  const expectedClientId = getGoogleClientId();
  if (!expectedClientId || aud !== expectedClientId) {
    throw new Error("Google token was not issued for this application.");
  }
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw new Error("Google token issuer was not accepted.");
  }
  if (expectedNonce && nonce && !timingSafeEqualStr(nonce, expectedNonce)) {
    throw new Error("Google OAuth nonce mismatch.");
  }
  const allowedDomains = getAllowedDomains();
  if (!allowedDomains.some((d) => email.endsWith(`@${d}`))) {
    throw new Error(`Only accounts from [${allowedDomains.join(", ")}] are allowed.`);
  }
  return { email, name };
}

function toFacultyIdentity(row: {
  id: number;
  email: string;
  faculty_name: string;
  can_see_all_faculty: boolean;
}): McpFacultyIdentity {
  const coordinator = findCoordinator(row.email, row.faculty_name);
  return {
    id: row.id,
    email: row.email,
    facultyName: row.faculty_name,
    canSeeAllFaculty: Boolean(row.can_see_all_faculty),
    coordinatorCohorts: coordinator?.cohorts ?? [],
  };
}

function parseClientCredentials(req: Request): { clientId: string; clientSecret?: string } {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && /^Basic\s+/i.test(auth)) {
    try {
      const decoded = Buffer.from(auth.replace(/^Basic\s+/i, "").trim(), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      if (sep > 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, sep)),
          clientSecret: decodeURIComponent(decoded.slice(sep + 1)),
        };
      }
    } catch {
      // Fall through to body fields.
    }
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    clientId: typeof body.client_id === "string" ? body.client_id.trim() : "",
    clientSecret: typeof body.client_secret === "string" ? body.client_secret : undefined,
  };
}

function authenticateClient(client: McpOAuthClient, presentedSecret?: string): boolean {
  if (client.tokenEndpointAuthMethod === "none") return true;
  if (!client.clientSecretHash || !presentedSecret) return false;
  return timingSafeEqualStr(sha256Hex(presentedSecret), client.clientSecretHash);
}

function setOAuthCors(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

export function createMcpAuthRouter(deps: McpOAuthDependencies = {}) {
  const router = express.Router();
  const cimdFetcher = deps.cimdFetcher;
  const exchangeGoogleCode = deps.exchangeGoogleCode ?? defaultExchangeGoogleCode;
  const verifyGoogleIdToken = deps.verifyGoogleIdToken ?? defaultVerifyGoogleIdToken;
  const resolveFaculty = deps.resolveFaculty ?? ((email: string) => lookupFacultyByEmail(email, { touchLastLogin: true }));

  router.use("/.well-known", setOAuthCors);
  router.use(["/oauth/register", "/oauth/token", "/oauth/revoke"], setOAuthCors);
  router.use("/oauth", express.json({ limit: "32kb" }), express.urlencoded({ extended: false, limit: "32kb" }));

  const protectedResourceMetadata = (req: Request, res: Response) => {
    const origin = canonicalOrigin(req);
    const resource = req.path.endsWith("/api/mcp") ? `${origin}/api/mcp` : `${origin}/mcp`;
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      resource,
      authorization_servers: [origin],
      scopes_supported: [...MCP_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "Aayam Timetable MCP Server",
    });
  };

  router.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
  router.get("/.well-known/oauth-protected-resource/mcp", protectedResourceMetadata);
  router.get("/.well-known/oauth-protected-resource/api/mcp", protectedResourceMetadata);

  const authServerMetadata = (req: Request, res: Response) => {
    const origin = canonicalOrigin(req);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      revocation_endpoint: `${origin}/oauth/revoke`,
      scopes_supported: [...MCP_SCOPES],
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true,
    });
  };

  router.get("/.well-known/oauth-authorization-server", authServerMetadata);
  router.get("/.well-known/openid-configuration", authServerMetadata);

  router.post("/oauth/register", async (req, res) => {
    const ip = getClientIp(req);
    const rate = await dcrRateLimiter.check(ip);
    if (rate.limited) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      res.status(429).json({ error: "too_many_requests", error_description: "Dynamic client registration rate limit exceeded." });
      return;
    }
    await dcrRateLimiter.recordFailure(ip);

    try {
      const { client, clientSecret } = await registerDcrClient(req.body ?? {});
      res.status(201).json({
        client_id: client.clientId,
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(client.createdAt / 1000),
        client_name: client.clientName,
        ...(client.clientUri ? { client_uri: client.clientUri } : {}),
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid client registration payload.";
      res.status(400).json({ error: "invalid_client_metadata", error_description: message });
    }
  });

  router.get("/oauth/authorize", async (req, res) => {
    const responseType = typeof req.query.response_type === "string" ? req.query.response_type.trim() : "";
    const clientId = typeof req.query.client_id === "string" ? req.query.client_id.trim() : "";
    const redirectUri = typeof req.query.redirect_uri === "string" ? req.query.redirect_uri.trim() : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const codeChallenge = typeof req.query.code_challenge === "string" ? req.query.code_challenge.trim() : "";
    const codeChallengeMethod =
      typeof req.query.code_challenge_method === "string" ? req.query.code_challenge_method.trim() : "";
    const requestedScope = typeof req.query.scope === "string" ? req.query.scope.trim() : "";
    const rawResource = typeof req.query.resource === "string" ? req.query.resource.trim() : "";

    let client: McpOAuthClient | null = null;
    try {
      client = await resolveOAuthClient(clientId, cimdFetcher);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify client metadata.";
      renderHtmlPage("Invalid Client", `<p class="eyebrow">OAuth Error</p><h1>Client verification failed</h1><p>${escapeHtml(message)}</p>`, 400, res);
      return;
    }

    if (!client) {
      renderHtmlPage("Unknown Client", `<p class="eyebrow">OAuth Error</p><h1>Unknown MCP client</h1><p>The requested client_id is not registered or valid.</p>`, 400, res);
      return;
    }

    if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
      renderHtmlPage("Invalid Redirect URI", `<p class="eyebrow">OAuth Error</p><h1>Redirect URI mismatch</h1><p>The redirect_uri does not match this client's registered redirect URIs.</p>`, 400, res);
      return;
    }

    if (responseType !== "code") {
      redirectWithError(res, redirectUri, "unsupported_response_type", "Only response_type=code is supported.", state);
      return;
    }
    if (!codeChallenge || codeChallenge.length < 43 || codeChallenge.length > 128 || codeChallengeMethod !== "S256") {
      redirectWithError(res, redirectUri, "invalid_request", "PKCE with code_challenge_method=S256 is required.", state);
      return;
    }

    const acceptedAudiences = acceptedResourceAudiences(req);
    const resource = rawResource ? normalizeResourceUri(rawResource) : canonicalResourceUrl(req);
    if (!acceptedAudiences.has(resource)) {
      redirectWithError(res, redirectUri, "invalid_target", "Requested resource does not match this MCP server.", state);
      return;
    }

    const googleClientId = getGoogleClientId();
    if (!googleClientId && !deps.exchangeGoogleCode) {
      redirectWithError(res, redirectUri, "server_error", "Google OAuth is not configured on this server.", state);
      return;
    }

    const txId = randomToken(24);
    const googleNonce = randomToken(18);
    const googleCodeVerifier = randomToken(32);
    const csrfToken = randomToken(24);

    await saveAuthTransaction({
      txId,
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod: "S256",
      requestedScope,
      resource,
      googleNonce,
      googleCodeVerifier,
      csrfToken,
      createdAt: Date.now(),
    });

    const origin = canonicalOrigin(req);
    const callbackUri = `${origin}/oauth/callback`;
    const googleAuth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuth.searchParams.set("client_id", googleClientId || "dev-google-client");
    googleAuth.searchParams.set("redirect_uri", callbackUri);
    googleAuth.searchParams.set("response_type", "code");
    googleAuth.searchParams.set("scope", "openid email profile");
    googleAuth.searchParams.set("state", txId);
    googleAuth.searchParams.set("nonce", googleNonce);
    googleAuth.searchParams.set("code_challenge", sha256Base64Url(googleCodeVerifier));
    googleAuth.searchParams.set("code_challenge_method", "S256");
    googleAuth.searchParams.set("prompt", "select_account");

    res.redirect(302, googleAuth.toString());
  });

  router.get("/oauth/callback", async (req, res) => {
    const txId = typeof req.query.state === "string" ? req.query.state.trim() : "";
    const googleError = typeof req.query.error === "string" ? req.query.error.trim() : "";
    const googleCode = typeof req.query.code === "string" ? req.query.code.trim() : "";

    const tx = await getAuthTransaction(txId);
    if (!tx) {
      renderHtmlPage("Session Expired", `<p class="eyebrow">OAuth Error</p><h1>Authorization session expired</h1><p>Please restart the connection from your AI assistant.</p>`, 400, res);
      return;
    }

    if (googleError) {
      await consumeAuthTransaction(txId);
      redirectWithError(res, tx.redirectUri, "access_denied", "Google sign-in was cancelled.", tx.state);
      return;
    }

    if (!googleCode) {
      await consumeAuthTransaction(txId);
      redirectWithError(res, tx.redirectUri, "access_denied", "Missing authorization code from Google.", tx.state);
      return;
    }

    try {
      const origin = canonicalOrigin(req);
      const { idToken } = await exchangeGoogleCode({
        code: googleCode,
        redirectUri: `${origin}/oauth/callback`,
        codeVerifier: tx.googleCodeVerifier,
      });
      const verified = await verifyGoogleIdToken(idToken, tx.googleNonce);
      const directoryRow = await resolveFaculty(verified.email);
      const faculty = toFacultyIdentity(directoryRow);
      const scopes = resolveGrantedScopes(tx.requestedScope, faculty);

      await saveAuthTransaction({
        ...tx,
        authenticatedFaculty: faculty,
      });

      renderConsentPage(res, {
        txId: tx.txId,
        csrfToken: tx.csrfToken,
        clientName: tx.clientName,
        redirectHost: new URL(tx.redirectUri).host,
        faculty,
        scopes,
      });
    } catch (err) {
      await consumeAuthTransaction(txId);
      const message = err instanceof Error ? err.message : "Authentication failed.";
      renderHtmlPage(
        "Access Denied",
        `<p class="eyebrow">Faculty Verification</p><h1>Sign-in was refused</h1><p>${escapeHtml(message)}</p><p>Ask your timetable administrator to verify your account in the active faculty directory.</p>`,
        403,
        res,
      );
    }
  });

  router.post("/oauth/consent", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const txId = typeof body.txId === "string" ? body.txId.trim() : "";
    const csrfToken = typeof body.csrfToken === "string" ? body.csrfToken.trim() : "";
    const decision = typeof body.decision === "string" ? body.decision.trim() : "";

    const tx = await consumeAuthTransaction(txId);
    if (!tx || !tx.authenticatedFaculty || !csrfToken || !timingSafeEqualStr(csrfToken, tx.csrfToken)) {
      renderHtmlPage("Invalid Consent", `<p class="eyebrow">OAuth Error</p><h1>Authorization request expired</h1><p>Please restart the connection from your MCP client.</p>`, 400, res);
      return;
    }

    if (decision !== "approve") {
      redirectWithError(res, tx.redirectUri, "access_denied", "The user denied the authorization request.", tx.state);
      return;
    }

    const scopes = resolveGrantedScopes(tx.requestedScope, tx.authenticatedFaculty);
    const code = await issueAuthorizationCode({
      clientId: tx.clientId,
      redirectUri: tx.redirectUri,
      codeChallenge: tx.codeChallenge,
      codeChallengeMethod: tx.codeChallengeMethod,
      scopes,
      resource: tx.resource,
      faculty: tx.authenticatedFaculty,
    });

    const target = new URL(tx.redirectUri);
    target.searchParams.set("code", code);
    if (tx.state) target.searchParams.set("state", tx.state);
    res.redirect(302, target.toString());
  });

  router.post("/oauth/token", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");

    const ip = getClientIp(req);
    const rate = await tokenRateLimiter.check(ip);
    if (rate.limited) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      res.status(429).json({ error: "too_many_requests", error_description: "Too many token requests." });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const grantType = typeof body.grant_type === "string" ? body.grant_type.trim() : "";
    const creds = parseClientCredentials(req);

    if (!creds.clientId) {
      await tokenRateLimiter.recordFailure(ip);
      res.status(400).json({ error: "invalid_request", error_description: "Missing client_id." });
      return;
    }

    let client: McpOAuthClient | null = null;
    try {
      client = await resolveOAuthClient(creds.clientId, cimdFetcher);
    } catch {
      client = null;
    }
    if (!client || !authenticateClient(client, creds.clientSecret)) {
      await tokenRateLimiter.recordFailure(ip);
      res.status(401).json({ error: "invalid_client", error_description: "Client authentication failed." });
      return;
    }

    const origin = canonicalOrigin(req);

    if (grantType === "authorization_code") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : "";
      const codeVerifier = typeof body.code_verifier === "string" ? body.code_verifier.trim() : "";
      const rawResource = typeof body.resource === "string" ? body.resource.trim() : "";

      if (!code || !redirectUri || !codeVerifier) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_request", error_description: "Missing code, redirect_uri, or code_verifier." });
        return;
      }

      const record = await consumeAuthorizationCode(code);
      if (!record) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_grant", error_description: "Authorization code is invalid, expired, or already used." });
        return;
      }
      if (record.clientId !== client.clientId || record.redirectUri !== redirectUri) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_grant", error_description: "Client or redirect_uri mismatch." });
        return;
      }
      if (!timingSafeEqualStr(sha256Base64Url(codeVerifier), record.codeChallenge)) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_grant", error_description: "PKCE code_verifier verification failed." });
        return;
      }
      if (rawResource && normalizeResourceUri(rawResource) !== record.resource) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_target", error_description: "Resource audience mismatch." });
        return;
      }

      const { refreshToken, familyId } = await issueRefreshToken({
        clientId: client.clientId,
        scopes: record.scopes,
        resource: record.resource,
        faculty: record.faculty,
      });
      const { token } = signMcpAccessToken({
        iss: origin,
        aud: record.resource,
        faculty: record.faculty,
        scopes: record.scopes,
        clientId: client.clientId,
        familyId,
      });
      await tokenRateLimiter.reset(ip);
      res.json({
        access_token: token,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: refreshToken,
        scope: record.scopes.join(" "),
      });
      return;
    }

    if (grantType === "refresh_token") {
      const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : "";
      const rawResource = typeof body.resource === "string" ? body.resource.trim() : "";
      const rotated = await rotateRefreshToken(refreshToken, client.clientId);
      if (!rotated.ok) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_grant", error_description: rotated.reason });
        return;
      }
      const { record } = rotated;
      if (rawResource && normalizeResourceUri(rawResource) !== record.resource) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_target", error_description: "Resource audience mismatch." });
        return;
      }

      let liveFaculty = record.faculty;
      if (databaseUrl() || deps.resolveFaculty) {
        try {
          const row = await resolveFaculty(record.faculty.email);
          liveFaculty = toFacultyIdentity(row);
        } catch {
          await tokenRateLimiter.recordFailure(ip);
          res.status(400).json({ error: "invalid_grant", error_description: "Faculty account is no longer active." });
          return;
        }
      }

      const liveAllowed = new Set(allowedScopesForIdentity(liveFaculty));
      const refreshedScopes = record.scopes.filter((s) => liveAllowed.has(s));
      const nextScopes: McpScope[] = refreshedScopes.length > 0 ? refreshedScopes : ["timetable:read", "faculty:self"];

      const nextRt = await issueRefreshToken({
        familyId: record.familyId,
        clientId: client.clientId,
        scopes: nextScopes,
        resource: record.resource,
        faculty: liveFaculty,
      });
      const { token } = signMcpAccessToken({
        iss: origin,
        aud: record.resource,
        faculty: liveFaculty,
        scopes: nextScopes,
        clientId: client.clientId,
        familyId: record.familyId,
      });
      await tokenRateLimiter.reset(ip);
      res.json({
        access_token: token,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: nextRt.refreshToken,
        scope: nextScopes.join(" "),
      });
      return;
    }

    await tokenRateLimiter.recordFailure(ip);
    res.status(400).json({ error: "unsupported_grant_type", error_description: "Use authorization_code or refresh_token." });
  });

  router.post("/oauth/revoke", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token) {
      await revokeToken(token);
    }
    res.status(200).json({ ok: true });
  });

  return router;
}

export function createRequireMcpAuth(deps: Pick<McpOAuthDependencies, "resolveFaculty"> = {}) {
  const resolveFaculty =
    deps.resolveFaculty ?? ((email: string) => lookupFacultyByEmail(email, { touchLastLogin: false }));

  return async function requireMcpAuth(req: Request, res: Response, next: NextFunction) {
    const origin = canonicalOrigin(req);
    const challenge = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="timetable:read faculty:self"`;
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== "string" || !/^Bearer\s+/i.test(authHeader)) {
      res.setHeader("WWW-Authenticate", challenge);
      res.status(401).json({ error: "unauthorized", error_description: "Bearer token required." });
      return;
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload = parseAndVerifyAccessTokenSignature(token);
    if (!payload) {
      res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
      res.status(401).json({ error: "invalid_token", error_description: "Access token is invalid or expired." });
      return;
    }

    const acceptedAudiences = acceptedResourceAudiences(req);
    if (!acceptedAudiences.has(normalizeResourceUri(payload.aud))) {
      res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
      res.status(401).json({ error: "invalid_token", error_description: "Access token audience mismatch." });
      return;
    }

    if (await isAccessTokenRevoked(payload)) {
      res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
      res.status(401).json({ error: "invalid_token", error_description: "Access token has been revoked." });
      return;
    }

    let liveIdentity: McpFacultyIdentity = {
      id: 0,
      email: payload.sub,
      facultyName: payload.faculty,
      canSeeAllFaculty: payload.canSeeAllFaculty,
      coordinatorCohorts: payload.coordinatorCohorts ?? [],
    };
    if (databaseUrl() || deps.resolveFaculty) {
      try {
        const row = await resolveFaculty(payload.sub);
        liveIdentity = toFacultyIdentity(row);
      } catch {
        res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
        res.status(401).json({ error: "invalid_token", error_description: "Faculty account is inactive or unauthorized." });
        return;
      }
    } else if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
      res.status(401).json({ error: "invalid_token", error_description: "Faculty directory is unavailable." });
      return;
    }

    const liveAllowed = new Set(allowedScopesForIdentity(liveIdentity));
    const effectiveScopes = payload.scopes.filter((scope) => liveAllowed.has(scope));

    const authContext: McpAuthContext = {
      token,
      clientId: payload.client_id,
      scopes: effectiveScopes,
      expiresAt: payload.exp,
      resource: new URL(payload.aud),
      extra: {
        email: liveIdentity.email,
        facultyName: liveIdentity.facultyName,
        canSeeAllFaculty: liveIdentity.canSeeAllFaculty,
        coordinatorCohorts: liveIdentity.coordinatorCohorts,
        jti: payload.jti,
        familyId: payload.familyId,
      },
    };
    (req as Request & { auth?: McpAuthContext }).auth = authContext;
    next();
  };
}
