import { FACULTY_COOKIE, lookupFaculty, verifyGoogleCredential, verifySession, type FacultyRow } from "./auth.ts";
import { sha256Base64Url, sha256Hex, randomToken, timingSafeEqualStr } from "./crypto.ts";
import { authSecret, type Ctx, type Env } from "./env.ts";
import { clientIp, HttpError, json, parseCookies } from "./http.ts";
import { checkRate, clearRate, recordFailure } from "./rateLimit.ts";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  accessTokenStatus,
  allowedScopesForIdentity,
  consumeAuthorizationCode,
  consumeAuthTransaction,
  getAuthTransaction,
  issueAuthorizationCode,
  issueRefreshToken,
  MCP_SCOPES,
  pruneStatements,
  registerDcrClient,
  resolveGrantedScopes,
  resolveOAuthClient,
  revokeToken,
  rotateRefreshToken,
  saveAuthTransaction,
  signMcpAccessToken,
  toFacultyIdentity,
  verifyMcpAccessToken,
  type CimdFetcher,
  type McpAuth,
  type McpFacultyIdentity,
  type McpOAuthClient,
  type McpScope,
} from "./oauthStore.ts";

/**
 * OAuth 2.1 authorization server for `/mcp`: RFC 9728 and RFC 8414 metadata, dynamic client registration,
 * client ID metadata documents, PKCE S256, RFC 8707 resource binding, rotating refresh tokens.
 *
 * Sign-in: a faculty member already signed in on this origin (cookie `timetable_faculty_session`) goes
 * straight to consent. Otherwise, with GOOGLE_CLIENT_SECRET set, the Google authorization code flow runs
 * (redirect URI `<origin>/oauth/callback`). Without the secret, the page asks them to sign in on the site
 * first. Every path checks `faculty_directory`.
 */

const DCR_LIMIT = { max: 12, windowMs: 10 * 60 * 1000 };
const TOKEN_LIMIT = { max: 60, windowMs: 5 * 60 * 1000 };
const MAX_FORM_BYTES = 32 * 1024;

/** Test seams. Production uses Google and fetch. */
export interface OAuthDeps {
  cimdFetcher?: CimdFetcher;
}
let deps: OAuthDeps = {};
export function setOAuthDepsForTests(next: OAuthDeps) {
  deps = next;
}

export function canonicalOrigin(env: Env, url: URL): string {
  const configured = env.MCP_PUBLIC_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall back to the request.
    }
  }
  return url.origin;
}

export function canonicalResourceUrl(env: Env, url: URL) {
  return `${canonicalOrigin(env, url)}/mcp`;
}

export function normalizeResourceUri(raw: string): string {
  try {
    const parsed = new URL(raw.trim());
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return raw.trim().replace(/\/+$/, "");
  }
}

export function acceptedResourceAudiences(env: Env, url: URL): Set<string> {
  const origin = canonicalOrigin(env, url);
  return new Set([`${origin}/mcp`, `${origin}/api/mcp`]);
}

// --- Responses ---------------------------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const PAGE_STYLE = `:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; background: #f8fafc; color: #0f172a; }
.card { width: 100%; max-width: 440px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); }
.eyebrow { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin: 0 0 8px; }
h1 { font-size: 20px; margin: 0 0 8px; line-height: 1.3; }
p { font-size: 14px; line-height: 1.5; color: #475569; margin: 0 0 16px; }
a { color: inherit; }
.identity { padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; margin-bottom: 16px; }
.identity-name { font-weight: 600; font-size: 14px; color: #0f172a; }
.identity-email { font-size: 12px; color: #64748b; margin-top: 2px; }
.badge { display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(16, 185, 129, 0.12); color: #047857; }
.badge-elevated { background: rgba(245, 158, 11, 0.15); color: #b45309; }
ul.scopes { list-style: none; padding: 0; margin: 0 0 20px; border-top: 1px solid #e2e8f0; }
ul.scopes li { padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
ul.scopes strong { display: block; color: #0f172a; font-size: 13px; }
ul.scopes span { color: #64748b; font-size: 12px; }
.actions { display: flex; gap: 10px; }
button, .button { flex: 1; padding: 10px 14px; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid transparent; text-align: center; text-decoration: none; }
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
}`;

function htmlPage(title: string, body: string, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Aayam Timetable</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <main class="card">${body}</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
    },
  });
}

const errorPage = (title: string, heading: string, message: string, status = 400) =>
  htmlPage(title, `<p class="eyebrow">OAuth Error</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(message)}</p>`, status);

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

function consentPage(params: {
  txId: string;
  csrfToken: string;
  clientName: string;
  redirectHost: string;
  faculty: McpFacultyIdentity;
  scopes: McpScope[];
  switchAccountUrl?: string;
}) {
  const roleLabel = params.faculty.canSeeAllFaculty ? "All-Access Faculty" : params.faculty.coordinatorCohorts.length > 0 ? "Class Coordinator" : "Faculty";
  const badgeClass = params.faculty.canSeeAllFaculty ? "badge badge-elevated" : "badge";
  const scopeList = params.scopes
    .map((scope) => {
      const info = SCOPE_LABELS[scope];
      return `<li><strong>${escapeHtml(info.title)}</strong><span>${escapeHtml(info.detail)} (${escapeHtml(scope)})</span></li>`;
    })
    .join("");
  const switchAccount = params.switchAccountUrl
    ? `<p class="meta"><a href="${escapeHtml(params.switchAccountUrl)}">Use a different Google account</a></p>`
    : "";
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
    ${switchAccount}
  `;
  return htmlPage("Authorize MCP Client", body);
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

function redirectWithError(redirectUri: string, error: string, description: string, state?: string) {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  target.searchParams.set("error_description", description);
  if (state) target.searchParams.set("state", state);
  return redirect(target.toString());
}

function oauthJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return json(body, status, { "Cache-Control": "no-store", Pragma: "no-cache", ...headers });
}

/** CORS for discovery and the machine endpoints: any origin, no credentials. */
export function withOAuthCors(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

/** A form or JSON body, at most 32 KB. */
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_FORM_BYTES) throw new HttpError(413, "Request body is too large.");
  if (!request.body) return {};
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_FORM_BYTES) throw new HttpError(413, "Request body is too large.");
  const type = (request.headers.get("Content-Type") ?? "").toLowerCase();
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  if (!type.includes("json") || !raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// --- Discovery ---------------------------------------------------------------------------------------------

function protectedResourceMetadata(ctx: Ctx) {
  const origin = canonicalOrigin(ctx.env, ctx.url);
  const resource = ctx.url.pathname.replace(/\/+$/, "").endsWith("/api/mcp") ? `${origin}/api/mcp` : `${origin}/mcp`;
  return json(
    {
      resource,
      authorization_servers: [origin],
      scopes_supported: [...MCP_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "Aayam Timetable MCP Server",
    },
    200,
    { "Cache-Control": "public, max-age=300" },
  );
}

function authorizationServerMetadata(ctx: Ctx) {
  const origin = canonicalOrigin(ctx.env, ctx.url);
  return json(
    {
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
    },
    200,
    { "Cache-Control": "public, max-age=300" },
  );
}

// --- Registration ------------------------------------------------------------------------------------------

async function register(ctx: Ctx) {
  const rateKey = `oauth_dcr:${clientIp(ctx.request)}`;
  const rate = await checkRate(ctx.db, rateKey, DCR_LIMIT);
  if (rate.limited) {
    return oauthJson({ error: "too_many_requests", error_description: "Dynamic client registration rate limit exceeded." }, 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }
  // Every registration counts, as before: a client registers once.
  await recordFailure(ctx.db, rateKey, DCR_LIMIT);
  try {
    const { client, clientSecret } = await registerDcrClient(ctx.db, await readBody(ctx.request));
    return oauthJson(
      {
        client_id: client.clientId,
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(client.createdAt / 1000),
        client_name: client.clientName,
        ...(client.clientUri ? { client_uri: client.clientUri } : {}),
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      },
      201,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const message = error instanceof Error ? error.message : "Invalid client registration payload.";
    return oauthJson({ error: "invalid_client_metadata", error_description: message }, 400);
  }
}

// --- Authorization -----------------------------------------------------------------------------------------

/** The faculty member signed in on this origin, from the cookie only (never a header an AI client could send). */
async function siteFaculty(ctx: Ctx): Promise<McpFacultyIdentity | null> {
  const token = parseCookies(ctx.request.headers.get("Cookie"))[FACULTY_COOKIE];
  if (!token) return null;
  const session = await verifySession(authSecret(ctx.env), token);
  if (!session?.email) return null;
  try {
    return toFacultyIdentity(await lookupFaculty(ctx.db, session.email, { touchLastLogin: false }));
  } catch {
    return null;
  }
}

async function authorize(ctx: Ctx) {
  const query = ctx.url.searchParams;
  const param = (name: string) => query.get(name)?.trim() ?? "";
  const clientId = param("client_id");
  const redirectUri = param("redirect_uri");
  const state = query.get("state") ?? "";
  const codeChallenge = param("code_challenge");
  const rawResource = param("resource");

  let client: McpOAuthClient | null = null;
  try {
    client = await resolveOAuthClient(ctx.db, clientId, deps.cimdFetcher);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify client metadata.";
    return errorPage("Invalid Client", "Client verification failed", message);
  }
  if (!client) return errorPage("Unknown Client", "Unknown MCP client", "The requested client_id is not registered or valid.");
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return errorPage("Invalid Redirect URI", "Redirect URI mismatch", "The redirect_uri does not match this client's registered redirect URIs.");
  }
  if (param("response_type") !== "code") return redirectWithError(redirectUri, "unsupported_response_type", "Only response_type=code is supported.", state);
  if (!codeChallenge || codeChallenge.length < 43 || codeChallenge.length > 128 || param("code_challenge_method") !== "S256") {
    return redirectWithError(redirectUri, "invalid_request", "PKCE with code_challenge_method=S256 is required.", state);
  }
  const resource = rawResource ? normalizeResourceUri(rawResource) : canonicalResourceUrl(ctx.env, ctx.url);
  if (!acceptedResourceAudiences(ctx.env, ctx.url).has(resource)) {
    return redirectWithError(redirectUri, "invalid_target", "Requested resource does not match this MCP server.", state);
  }
  if (!authSecret(ctx.env)) return redirectWithError(redirectUri, "server_error", "OAuth is not configured on this server.", state);

  const origin = canonicalOrigin(ctx.env, ctx.url);
  const googleReady = Boolean(ctx.env.GOOGLE_CLIENT_ID?.trim() && ctx.env.GOOGLE_CLIENT_SECRET?.trim());
  const fresh = query.get("fresh") === "1";
  const signedIn = fresh ? null : await siteFaculty(ctx);
  const tx = {
    txId: randomToken(24),
    clientId: client.clientId,
    clientName: client.clientName,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod: "S256" as const,
    requestedScope: param("scope"),
    resource,
    googleNonce: randomToken(18),
    googleCodeVerifier: randomToken(32),
    csrfToken: randomToken(24),
    createdAt: Date.now(),
    ...(signedIn ? { authenticatedFaculty: signedIn } : {}),
  };

  if (signedIn) {
    await saveAuthTransaction(ctx.db, tx, pruneStatements());
    const switchUrl = new URL(ctx.url.toString());
    switchUrl.searchParams.set("fresh", "1");
    return consentPage({
      txId: tx.txId,
      csrfToken: tx.csrfToken,
      clientName: tx.clientName,
      redirectHost: new URL(redirectUri).host,
      faculty: signedIn,
      scopes: resolveGrantedScopes(tx.requestedScope, signedIn),
      switchAccountUrl: googleReady ? `${switchUrl.pathname}${switchUrl.search}` : undefined,
    });
  }

  if (!googleReady) {
    // No Google code exchange on this deployment: sign in on the site (Google Identity Services), then retry.
    const retry = new URL(ctx.url.toString());
    retry.searchParams.delete("fresh");
    return htmlPage(
      "Sign in first",
      `<p class="eyebrow">Aayam MCP Authorization</p>
      <h1>Sign in on Aayam first</h1>
      <p><strong>${escapeHtml(client.clientName)}</strong> wants to connect to your timetable. Open Aayam in another tab, choose Faculty, and sign in with your college Google account. Then come back and continue.</p>
      <div class="actions">
        <a class="button btn-secondary" href="${escapeHtml(origin)}/" target="_blank" rel="noopener">Open Aayam</a>
        <a class="button btn-primary" href="${escapeHtml(`${retry.pathname}${retry.search}`)}">Continue</a>
      </div>`,
    );
  }

  await saveAuthTransaction(ctx.db, tx, pruneStatements());
  const googleAuth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuth.searchParams.set("client_id", ctx.env.GOOGLE_CLIENT_ID.trim());
  googleAuth.searchParams.set("redirect_uri", `${origin}/oauth/callback`);
  googleAuth.searchParams.set("response_type", "code");
  googleAuth.searchParams.set("scope", "openid email profile");
  googleAuth.searchParams.set("state", tx.txId);
  googleAuth.searchParams.set("nonce", tx.googleNonce);
  googleAuth.searchParams.set("code_challenge", await sha256Base64Url(tx.googleCodeVerifier));
  googleAuth.searchParams.set("code_challenge_method", "S256");
  googleAuth.searchParams.set("prompt", "select_account");
  return redirect(googleAuth.toString());
}

async function exchangeGoogleCode(env: Env, options: { code: string; redirectUri: string; codeVerifier: string }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: env.GOOGLE_CLIENT_ID.trim(),
      client_secret: env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
      code_verifier: options.codeVerifier,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || typeof data?.id_token !== "string") throw new Error("Failed to exchange Google authorization code.");
  return data.id_token;
}

async function callback(ctx: Ctx) {
  const txId = ctx.url.searchParams.get("state")?.trim() ?? "";
  const googleError = ctx.url.searchParams.get("error")?.trim() ?? "";
  const googleCode = ctx.url.searchParams.get("code")?.trim() ?? "";
  const tx = await getAuthTransaction(ctx.db, txId);
  if (!tx) return errorPage("Session Expired", "Authorization session expired", "Please restart the connection from your AI assistant.");
  if (googleError) {
    await consumeAuthTransaction(ctx.db, txId);
    return redirectWithError(tx.redirectUri, "access_denied", "Google sign-in was cancelled.", tx.state);
  }
  if (!googleCode) {
    await consumeAuthTransaction(ctx.db, txId);
    return redirectWithError(tx.redirectUri, "access_denied", "Missing authorization code from Google.", tx.state);
  }
  try {
    const origin = canonicalOrigin(ctx.env, ctx.url);
    const idToken = await exchangeGoogleCode(ctx.env, { code: googleCode, redirectUri: `${origin}/oauth/callback`, codeVerifier: tx.googleCodeVerifier });
    const verified = await verifyGoogleCredential(ctx.env, idToken);
    if (!verified.nonce || !timingSafeEqualStr(verified.nonce, tx.googleNonce)) throw new Error("Google OAuth nonce mismatch.");
    const row: FacultyRow = await lookupFaculty(ctx.db, verified.email, { touchLastLogin: true });
    const faculty = toFacultyIdentity(row);
    await saveAuthTransaction(ctx.db, { ...tx, authenticatedFaculty: faculty });
    return consentPage({
      txId: tx.txId,
      csrfToken: tx.csrfToken,
      clientName: tx.clientName,
      redirectHost: new URL(tx.redirectUri).host,
      faculty,
      scopes: resolveGrantedScopes(tx.requestedScope, faculty),
    });
  } catch (error) {
    await consumeAuthTransaction(ctx.db, txId);
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return htmlPage(
      "Access Denied",
      `<p class="eyebrow">Faculty Verification</p><h1>Sign-in was refused</h1><p>${escapeHtml(message)}</p><p>Ask your timetable administrator to verify your account in the active faculty directory.</p>`,
      403,
    );
  }
}

async function consent(ctx: Ctx) {
  const body = await readBody(ctx.request);
  const txId = str(body.txId);
  const csrfToken = str(body.csrfToken);
  const decision = str(body.decision);
  const tx = await consumeAuthTransaction(ctx.db, txId);
  if (!tx || !tx.authenticatedFaculty || !csrfToken || !timingSafeEqualStr(csrfToken, tx.csrfToken)) {
    return errorPage("Invalid Consent", "Authorization request expired", "Please restart the connection from your MCP client.");
  }
  if (decision !== "approve") return redirectWithError(tx.redirectUri, "access_denied", "The user denied the authorization request.", tx.state);
  const code = await issueAuthorizationCode(ctx.db, {
    clientId: tx.clientId,
    redirectUri: tx.redirectUri,
    codeChallenge: tx.codeChallenge,
    codeChallengeMethod: tx.codeChallengeMethod,
    scopes: resolveGrantedScopes(tx.requestedScope, tx.authenticatedFaculty),
    resource: tx.resource,
    faculty: tx.authenticatedFaculty,
  });
  const target = new URL(tx.redirectUri);
  target.searchParams.set("code", code);
  if (tx.state) target.searchParams.set("state", tx.state);
  return redirect(target.toString());
}

// --- Token -------------------------------------------------------------------------------------------------

function clientCredentials(request: Request, body: Record<string, unknown>): { clientId: string; clientSecret?: string } {
  const header = request.headers.get("Authorization") ?? "";
  if (/^Basic\s+/i.test(header)) {
    try {
      const decoded = atob(header.replace(/^Basic\s+/i, "").trim());
      const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
      const text = new TextDecoder().decode(bytes);
      const separator = text.indexOf(":");
      if (separator > 0) {
        return { clientId: decodeURIComponent(text.slice(0, separator)), clientSecret: decodeURIComponent(text.slice(separator + 1)) };
      }
    } catch {
      // Fall through to body fields.
    }
  }
  return { clientId: str(body.client_id), clientSecret: typeof body.client_secret === "string" ? body.client_secret : undefined };
}

async function authenticateClient(client: McpOAuthClient, presentedSecret?: string) {
  if (client.tokenEndpointAuthMethod === "none") return true;
  if (!client.clientSecretHash || !presentedSecret) return false;
  return timingSafeEqualStr(await sha256Hex(presentedSecret), client.clientSecretHash);
}

async function token(ctx: Ctx) {
  const rateKey = `oauth_token:${clientIp(ctx.request)}`;
  const rate = await checkRate(ctx.db, rateKey, TOKEN_LIMIT);
  if (rate.limited) {
    return oauthJson({ error: "too_many_requests", error_description: "Too many token requests." }, 429, { "Retry-After": String(rate.retryAfterSeconds) });
  }
  const fail = async (status: number, error: string, description: string) => {
    await recordFailure(ctx.db, rateKey, TOKEN_LIMIT);
    return oauthJson({ error, error_description: description }, status);
  };

  const body = await readBody(ctx.request);
  const grantType = str(body.grant_type);
  const creds = clientCredentials(ctx.request, body);
  if (!creds.clientId) return fail(400, "invalid_request", "Missing client_id.");
  let client: McpOAuthClient | null = null;
  try {
    client = await resolveOAuthClient(ctx.db, creds.clientId, deps.cimdFetcher);
  } catch {
    client = null;
  }
  if (!client || !(await authenticateClient(client, creds.clientSecret))) return fail(401, "invalid_client", "Client authentication failed.");
  const secret = authSecret(ctx.env);
  if (!secret) return oauthJson({ error: "server_error", error_description: "OAuth is not configured on this server." }, 500);
  const origin = canonicalOrigin(ctx.env, ctx.url);
  const rawResource = str(body.resource);

  if (grantType === "authorization_code") {
    const code = str(body.code);
    const redirectUri = str(body.redirect_uri);
    const codeVerifier = str(body.code_verifier);
    if (!code || !redirectUri || !codeVerifier) return fail(400, "invalid_request", "Missing code, redirect_uri, or code_verifier.");
    const record = await consumeAuthorizationCode(ctx.db, code);
    if (!record) return fail(400, "invalid_grant", "Authorization code is invalid, expired, or already used.");
    if (record.clientId !== client.clientId || record.redirectUri !== redirectUri) return fail(400, "invalid_grant", "Client or redirect_uri mismatch.");
    if (!timingSafeEqualStr(await sha256Base64Url(codeVerifier), record.codeChallenge)) return fail(400, "invalid_grant", "PKCE code_verifier verification failed.");
    if (rawResource && normalizeResourceUri(rawResource) !== record.resource) return fail(400, "invalid_target", "Resource audience mismatch.");

    const { refreshToken, familyId } = await issueRefreshToken(
      ctx.db,
      { clientId: client.clientId, scopes: record.scopes, resource: record.resource, faculty: record.faculty },
      pruneStatements(),
    );
    const { token: accessToken } = await signMcpAccessToken(secret, {
      iss: origin,
      aud: record.resource,
      faculty: record.faculty,
      scopes: record.scopes,
      clientId: client.clientId,
      familyId,
    });
    await clearRate(ctx.db, rateKey);
    return oauthJson({ access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_SECONDS, refresh_token: refreshToken, scope: record.scopes.join(" ") });
  }

  if (grantType === "refresh_token") {
    const rotated = await rotateRefreshToken(ctx.db, str(body.refresh_token), client.clientId);
    if (!rotated.ok) return fail(400, "invalid_grant", rotated.reason);
    const { record } = rotated;
    if (rawResource && normalizeResourceUri(rawResource) !== record.resource) return fail(400, "invalid_target", "Resource audience mismatch.");
    let liveFaculty: McpFacultyIdentity;
    try {
      liveFaculty = toFacultyIdentity(await lookupFaculty(ctx.db, record.faculty.email, { touchLastLogin: false }));
    } catch {
      return fail(400, "invalid_grant", "Faculty account is no longer active.");
    }
    const liveAllowed = new Set(allowedScopesForIdentity(liveFaculty));
    const kept = record.scopes.filter((scope) => liveAllowed.has(scope));
    const nextScopes: McpScope[] = kept.length > 0 ? kept : ["timetable:read", "faculty:self"];
    const next = await issueRefreshToken(ctx.db, {
      familyId: record.familyId,
      clientId: client.clientId,
      scopes: nextScopes,
      resource: record.resource,
      faculty: liveFaculty,
    });
    const { token: accessToken } = await signMcpAccessToken(secret, {
      iss: origin,
      aud: record.resource,
      faculty: liveFaculty,
      scopes: nextScopes,
      clientId: client.clientId,
      familyId: record.familyId,
    });
    await clearRate(ctx.db, rateKey);
    return oauthJson({ access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_SECONDS, refresh_token: next.refreshToken, scope: nextScopes.join(" ") });
  }

  return fail(400, "unsupported_grant_type", "Use authorization_code or refresh_token.");
}

async function revoke(ctx: Ctx) {
  const body = await readBody(ctx.request);
  const value = str(body.token);
  if (value) await revokeToken(ctx.db, authSecret(ctx.env), value);
  return oauthJson({ ok: true });
}

// --- Resource server ---------------------------------------------------------------------------------------

/** Verify the Bearer access token for `/mcp`. Returns the auth context or the 401 to send. */
export async function requireMcpAuth(ctx: Ctx): Promise<McpAuth | Response> {
  const origin = canonicalOrigin(ctx.env, ctx.url);
  const challenge = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="timetable:read faculty:self"`;
  const deny = (error: string, description: string, invalid = true) =>
    json({ error, error_description: description }, 401, { "WWW-Authenticate": invalid ? `${challenge}, error="invalid_token"` : challenge });

  const header = ctx.request.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+/i.test(header)) return deny("unauthorized", "Bearer token required.", false);
  const tokenValue = header.replace(/^Bearer\s+/i, "").trim();
  const payload = await verifyMcpAccessToken(authSecret(ctx.env), tokenValue);
  if (!payload) return deny("invalid_token", "Access token is invalid or expired.");
  if (!acceptedResourceAudiences(ctx.env, ctx.url).has(normalizeResourceUri(payload.aud))) return deny("invalid_token", "Access token audience mismatch.");
  const status = await accessTokenStatus(ctx.db, payload);
  if (status.revoked) return deny("invalid_token", "Access token has been revoked.");
  if (!status.faculty) return deny("invalid_token", "Faculty account is inactive or unauthorized.");
  const liveAllowed = new Set(allowedScopesForIdentity(status.faculty));
  return {
    token: tokenValue,
    clientId: payload.client_id,
    scopes: payload.scopes.filter((scope) => liveAllowed.has(scope)),
    expiresAt: payload.exp,
    resource: payload.aud,
    identity: status.faculty,
    jti: payload.jti,
    familyId: payload.familyId,
  };
}

// --- Routing -----------------------------------------------------------------------------------------------

type Handler = (ctx: Ctx) => Response | Promise<Response>;

const routes: Record<string, { handler: Handler; cors: boolean }> = {
  "GET /.well-known/oauth-protected-resource": { handler: protectedResourceMetadata, cors: true },
  "GET /.well-known/oauth-protected-resource/mcp": { handler: protectedResourceMetadata, cors: true },
  "GET /.well-known/oauth-protected-resource/api/mcp": { handler: protectedResourceMetadata, cors: true },
  "GET /.well-known/oauth-authorization-server": { handler: authorizationServerMetadata, cors: true },
  "GET /.well-known/openid-configuration": { handler: authorizationServerMetadata, cors: true },
  "POST /oauth/register": { handler: register, cors: true },
  "GET /oauth/authorize": { handler: authorize, cors: false },
  "GET /oauth/callback": { handler: callback, cors: false },
  "POST /oauth/consent": { handler: consent, cors: false },
  "POST /oauth/token": { handler: token, cors: true },
  "POST /oauth/revoke": { handler: revoke, cors: true },
};

const corsPaths = new Set(["/oauth/register", "/oauth/token", "/oauth/revoke"]);

/** `/.well-known/*` and `/oauth/*`. Null means not an OAuth route (an unknown `/.well-known` file goes to assets). */
export async function handleOAuth(ctx: Ctx, path: string): Promise<Response | null> {
  const method = ctx.request.method === "HEAD" ? "GET" : ctx.request.method;
  const wellKnown = path.startsWith("/.well-known/");
  if (method === "OPTIONS" && (wellKnown || corsPaths.has(path))) return withOAuthCors(new Response(null, { status: 204 }));
  const route = routes[`${method} ${path}`];
  if (!route) {
    if (wellKnown) return null;
    return json({ error: "not_found", error_description: "Not found." }, 404);
  }
  const response = await route.handler(ctx);
  const out = ctx.request.method === "HEAD" ? new Response(null, response) : response;
  return route.cors || wellKnown ? withOAuthCors(out) : out;
}
