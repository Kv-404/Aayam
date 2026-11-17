import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { signSession } from "../src/edge/auth.ts";
import { setOAuthDepsForTests } from "../src/edge/oauth.ts";
import { assertSafePublicHttpsUrl, isPrivateOrReservedIp } from "../src/edge/oauthStore.ts";
import { makeEnv, SECRET, stubFetch, type TestEnv } from "./helpers/edgeEnv.ts";

const BASE = "https://timetable.test";
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const sha256Base64Url = (value: string) => crypto.createHash("sha256").update(value).digest("base64url");
const form = (fields: Record<string, string>) => ({
  method: "POST",
  redirect: "manual" as const,
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields).toString(),
});

function addFaculty(t: TestEnv, email: string, name: string, all = false) {
  t.raw.prepare("INSERT INTO faculty_directory (email, faculty_name, can_see_all_faculty, is_active) VALUES (?, ?, ?, 1)").run(email, name, all ? 1 : 0);
}

/** Google's token endpoint and tokeninfo, answering for one account. The nonce comes from the authorize redirect. */
function stubGoogle(email: string, nonce: () => string) {
  return stubFetch((url) => {
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ id_token: "fake-id-token" });
    if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
      return Response.json({
        email,
        email_verified: "true",
        aud: "client-123.apps.googleusercontent.com",
        iss: "https://accounts.google.com",
        nonce: nonce(),
      });
    }
    return new Response("unexpected", { status: 500 });
  });
}

function authorizeUrl(fields: Record<string, string>) {
  return `/oauth/authorize?${new URLSearchParams({ response_type: "code", redirect_uri: CALLBACK, code_challenge_method: "S256", ...fields })}`;
}

describe("MCP OAuth 2.1 Authorization Server", () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
    setOAuthDepsForTests({});
  });

  it("blocks private, loopback, and link-local SSRF targets for CIMD client_ids", () => {
    assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("10.0.0.5"), true);
    assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
    assert.equal(isPrivateOrReservedIp("192.168.1.10"), true);
    assert.equal(isPrivateOrReservedIp("::1"), true);
    assert.equal(isPrivateOrReservedIp("1.1.1.1"), false);

    assert.throws(() => assertSafePublicHttpsUrl("http://claude.ai/client.json"), /HTTPS/);
    assert.throws(() => assertSafePublicHttpsUrl("https://localhost/client.json"), /not allowed/);
    assert.throws(() => assertSafePublicHttpsUrl("https://169.254.169.254/latest/meta-data"), /private/);
    assert.throws(() => assertSafePublicHttpsUrl("https://127.0.0.1/client.json"), /private/);
    assert.equal(assertSafePublicHttpsUrl("https://claude.ai/oauth/client-metadata.json").hostname, "claude.ai");
  });

  it("serves RFC 9728 and RFC 8414 metadata advertising CIMD and DCR", async () => {
    const t = makeEnv();
    const prmRes = await t.call("/.well-known/oauth-protected-resource");
    assert.equal(prmRes.status, 200);
    assert.equal(prmRes.headers.get("access-control-allow-origin"), "*");
    const prm = (await prmRes.json()) as { resource: string; authorization_servers: string[]; scopes_supported: string[] };
    assert.equal(prm.resource, `${BASE}/mcp`);
    assert.deepEqual(prm.authorization_servers, [BASE]);
    assert.ok(prm.scopes_supported.includes("faculty:directory"));
    const apiPrm = (await (await t.call("/.well-known/oauth-protected-resource/api/mcp")).json()) as { resource: string };
    assert.equal(apiPrm.resource, `${BASE}/api/mcp`);

    const asRes = await t.call("/.well-known/oauth-authorization-server");
    assert.equal(asRes.status, 200);
    const as = (await asRes.json()) as Record<string, any>;
    assert.equal(as.issuer, BASE);
    assert.equal(as.client_id_metadata_document_supported, true);
    assert.equal(as.registration_endpoint, `${BASE}/oauth/register`);
    assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
    assert.deepEqual(await (await t.call("/.well-known/openid-configuration")).json(), as);

    // The origin is the request's, unless MCP_PUBLIC_URL overrides it.
    const other = await t.call("/.well-known/oauth-authorization-server", { base: "https://timetable.kv404.workers.dev" });
    assert.equal(((await other.json()) as any).issuer, "https://timetable.kv404.workers.dev");
    const pinned = makeEnv({ MCP_PUBLIC_URL: "https://aayam.kv404.dev/" });
    const pinnedMeta = (await (await pinned.call("/.well-known/oauth-protected-resource")).json()) as { resource: string };
    assert.equal(pinnedMeta.resource, "https://aayam.kv404.dev/mcp");

    const preflight = await t.call("/oauth/token", { method: "OPTIONS" });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
    // An unknown /.well-known file is a static asset.
    assert.equal(await (await t.call("/.well-known/security.txt")).text(), "asset");
  });

  it("validates DCR registration redirect URIs cleanly", async () => {
    const t = makeEnv();
    const bad = await t.call("/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["http://evil.example.com/callback"] }),
    });
    assert.equal(bad.status, 400);
    assert.equal(((await bad.json()) as any).error, "invalid_client_metadata");

    const good = await t.call("/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Claude Code Test", redirect_uris: ["http://127.0.0.1:43210/callback"], token_endpoint_auth_method: "none" }),
    });
    assert.equal(good.status, 201);
    const client = (await good.json()) as { client_id: string; redirect_uris: string[] };
    assert.ok(client.client_id.startsWith("mcp_"));
    assert.deepEqual(client.redirect_uris, ["http://127.0.0.1:43210/callback"]);

    const confidential = (await (
      await t.call("/oauth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirect_uris: ["https://example.com/cb"], token_endpoint_auth_method: "client_secret_post" }),
      })
    ).json()) as { client_id: string; client_secret: string };
    assert.ok(confidential.client_secret.startsWith("mcs_"));
    const stored = t.raw.prepare("SELECT client_secret_hash FROM mcp_oauth_clients WHERE client_id = ?").get(confidential.client_id) as { client_secret_hash: string };
    assert.equal(stored.client_secret_hash, crypto.createHash("sha256").update(confidential.client_secret).digest("hex"));
  });

  it("executes full OAuth 2.1 PKCE + Google + consent + refresh rotation + reuse revocation", async () => {
    const t = makeEnv({ GOOGLE_CLIENT_SECRET: "google-secret" });
    addFaculty(t, "test-faculty@itm.edu", "Dr. Aarti Pardesi", true);
    let nonce = "";
    const google = stubGoogle("test-faculty@itm.edu", () => nonce);
    restore = google.restore;

    // 1. Register a DCR client.
    const regRes = await t.call("/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Claude Desktop", redirect_uris: [CALLBACK], token_endpoint_auth_method: "none" }),
    });
    const { client_id: clientId } = (await regRes.json()) as { client_id: string };

    const codeVerifier = "verifier_abcdefghijklmnopqrstuvwxyz0123456789_ABCDEFGHIJK";
    const codeChallenge = sha256Base64Url(codeVerifier);
    const resource = `${BASE}/mcp`;

    // 2. Plain PKCE or a wrong audience fails.
    const plain = await t.call(authorizeUrl({ client_id: clientId, code_challenge: codeVerifier, code_challenge_method: "plain", state: "s1", resource }), { redirect: "manual" });
    assert.equal(plain.status, 302);
    assert.match(plain.headers.get("location") ?? "", /error=invalid_request/);
    const wrongTarget = await t.call(authorizeUrl({ client_id: clientId, code_challenge: codeChallenge, state: "s1", resource: "https://other.example.com/mcp" }), { redirect: "manual" });
    assert.equal(wrongTarget.status, 302);
    assert.match(wrongTarget.headers.get("location") ?? "", /error=invalid_target/);
    const unknown = await t.call(authorizeUrl({ client_id: "mcp_nope", code_challenge: codeChallenge, resource }), { redirect: "manual" });
    assert.equal(unknown.status, 400);
    assert.match(await unknown.text(), /Unknown MCP client/);

    // 3. A valid authorize redirects to Google with PKCE and a nonce.
    const authRes = await t.call(authorizeUrl({ client_id: clientId, code_challenge: codeChallenge, state: "xyz123", resource }), { redirect: "manual" });
    assert.equal(authRes.status, 302);
    const googleUrl = new URL(authRes.headers.get("location")!);
    assert.equal(googleUrl.origin, "https://accounts.google.com");
    assert.equal(googleUrl.searchParams.get("redirect_uri"), `${BASE}/oauth/callback`);
    assert.equal(googleUrl.searchParams.get("code_challenge_method"), "S256");
    const txId = googleUrl.searchParams.get("state")!;
    nonce = googleUrl.searchParams.get("nonce")!;
    assert.ok(txId && nonce);
    // Only a hash of the transaction id is stored.
    assert.equal((t.raw.prepare("SELECT count(*) AS n FROM mcp_oauth_transactions WHERE tx_hash = ?").get(crypto.createHash("sha256").update(txId).digest("hex")) as { n: number }).n, 1);

    // 4. The Google callback renders consent with a CSRF token.
    const cbRes = await t.call(`/oauth/callback?state=${encodeURIComponent(txId)}&code=google-auth-code`);
    assert.equal(cbRes.status, 200);
    assert.match(cbRes.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    const html = await cbRes.text();
    assert.match(html, /Dr\. Aarti Pardesi/);
    assert.match(html, /All-Access Faculty/);
    const csrf = html.match(/name="csrfToken"\s+value="([^"]+)"/)?.[1];
    assert.ok(csrf);
    // The Google code exchange sends the secret, the callback URI, and the PKCE verifier.
    const exchangeBody = new URLSearchParams(String(google.calls.find((call) => call.url === "https://oauth2.googleapis.com/token")?.init?.body));
    assert.equal(exchangeBody.get("client_secret"), "google-secret");
    assert.equal(exchangeBody.get("code"), "google-auth-code");
    assert.equal(exchangeBody.get("redirect_uri"), `${BASE}/oauth/callback`);
    assert.equal(sha256Base64Url(exchangeBody.get("code_verifier")!), googleUrl.searchParams.get("code_challenge"));

    // A wrong CSRF token burns the transaction.
    const forged = await t.call("/oauth/consent", form({ txId, csrfToken: "forged", decision: "approve" }));
    assert.equal(forged.status, 400);

    // Start again and approve.
    const again = await t.call(authorizeUrl({ client_id: clientId, code_challenge: codeChallenge, state: "xyz123", resource }), { redirect: "manual" });
    const google2 = new URL(again.headers.get("location")!);
    const tx2 = google2.searchParams.get("state")!;
    nonce = google2.searchParams.get("nonce")!;
    const csrf2 = (await (await t.call(`/oauth/callback?state=${encodeURIComponent(tx2)}&code=gcode`)).text()).match(/name="csrfToken"\s+value="([^"]+)"/)![1]!;

    // 5. Consent issues a single-use code.
    const consentRes = await t.call("/oauth/consent", form({ txId: tx2, csrfToken: csrf2, decision: "approve" }));
    assert.equal(consentRes.status, 302);
    const back = new URL(consentRes.headers.get("location")!);
    assert.equal(back.origin, "https://claude.ai");
    assert.equal(back.searchParams.get("state"), "xyz123");
    const authCode = back.searchParams.get("code")!;
    assert.ok(authCode.startsWith("mc_"));

    // 6. A wrong verifier fails PKCE, and the code is gone after that one attempt.
    const exchange = (code: string, verifier: string) =>
      t.call("/oauth/token", form({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: CALLBACK, code_verifier: verifier, resource }));
    assert.equal((await exchange(authCode, "wrong_verifier_abcdefghijklmnopqrstuvwxyz0123456789")).status, 400);
    assert.equal((await exchange(authCode, codeVerifier)).status, 400);

    // A CIMD client completes the flow: token, rotation, and reuse revocation.
    const cimdId = "https://claude.ai/oauth/client-metadata.json";
    setOAuthDepsForTests({
      cimdFetcher: async (url) => ({ client_id: url, client_name: "Claude Web", redirect_uris: [CALLBACK], token_endpoint_auth_method: "none" }),
    });
    const a1 = await t.call(authorizeUrl({ client_id: cimdId, code_challenge: codeChallenge, state: "st2", resource }), { redirect: "manual" });
    const g3 = new URL(a1.headers.get("location")!);
    nonce = g3.searchParams.get("nonce")!;
    const tx3 = g3.searchParams.get("state")!;
    const csrf3 = (await (await t.call(`/oauth/callback?state=${encodeURIComponent(tx3)}&code=gcode2`)).text()).match(/name="csrfToken"\s+value="([^"]+)"/)![1]!;
    const con3 = await t.call("/oauth/consent", form({ txId: tx3, csrfToken: csrf3, decision: "approve" }));
    const code3 = new URL(con3.headers.get("location")!).searchParams.get("code")!;

    const tokRes = await t.call(
      "/oauth/token",
      form({ grant_type: "authorization_code", client_id: cimdId, code: code3, redirect_uri: CALLBACK, code_verifier: codeVerifier, resource }),
    );
    assert.equal(tokRes.status, 200);
    assert.equal(tokRes.headers.get("cache-control"), "no-store");
    const tokens = (await tokRes.json()) as { access_token: string; refresh_token: string; token_type: string; scope: string; expires_in: number };
    assert.equal(tokens.token_type, "Bearer");
    assert.equal(tokens.expires_in, 3600);
    assert.ok(tokens.scope.includes("faculty:directory"));
    // Only hashes are stored.
    const stored = t.raw.prepare("SELECT token_hash FROM mcp_oauth_refresh_tokens").all() as Array<{ token_hash: string }>;
    assert.ok(stored.every((row) => row.token_hash !== tokens.refresh_token && /^[0-9a-f]{64}$/.test(row.token_hash)));

    const mcp = (token: string) =>
      t.call("/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }),
      });
    const ok = await mcp(tokens.access_token);
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as any).result.protocolVersion, "2025-06-18");

    // A web session token never works as an MCP bearer token.
    const webToken = await signSession(SECRET, { email: "test-faculty@itm.edu", faculty: "Dr. Aarti Pardesi", canSeeAllFaculty: true });
    assert.equal((await mcp(webToken)).status, 401);

    // Refresh rotates once; replaying the old refresh token revokes the whole family.
    const refresh = (value: string) => t.call("/oauth/token", form({ grant_type: "refresh_token", client_id: cimdId, refresh_token: value, resource }));
    const refRes1 = await refresh(tokens.refresh_token);
    assert.equal(refRes1.status, 200);
    const rotated = (await refRes1.json()) as { access_token: string; refresh_token: string };
    assert.notEqual(rotated.refresh_token, tokens.refresh_token);
    assert.equal((await mcp(rotated.access_token)).status, 200);

    assert.equal((await refresh(tokens.refresh_token)).status, 400);
    assert.equal((await mcp(rotated.access_token)).status, 401);
    assert.equal((await mcp(tokens.access_token)).status, 401);
    assert.equal((await refresh(rotated.refresh_token)).status, 400);
  });

  it("reuses the site's faculty session instead of a second Google sign-in", async () => {
    const t = makeEnv();
    addFaculty(t, "teacher@itm.edu", "Prof. Karan");
    const regRes = await t.call("/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Cursor", redirect_uris: ["http://127.0.0.1:5555/cb"] }),
    });
    const { client_id: clientId } = (await regRes.json()) as { client_id: string };
    const verifier = "v".repeat(50);
    const query = `/oauth/authorize?${new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "http://127.0.0.1:5555/cb",
      code_challenge: sha256Base64Url(verifier),
      code_challenge_method: "S256",
      scope: "timetable:read faculty:all",
      state: "abc",
    })}`;

    // No session and no GOOGLE_CLIENT_SECRET: a page that sends them to sign in on the site first.
    const signIn = await t.call(query);
    assert.equal(signIn.status, 200);
    assert.match(await signIn.text(), /Sign in on Aayam first/);

    const session = await signSession(SECRET, { email: "teacher@itm.edu", faculty: "Prof. Karan", canSeeAllFaculty: false });
    const consentPage = await t.call(query, { headers: { Cookie: `timetable_faculty_session=${encodeURIComponent(session)}` } });
    assert.equal(consentPage.status, 200);
    const html = await consentPage.text();
    assert.match(html, /Prof\. Karan/);
    // faculty:all was asked for but this account cannot have it.
    assert.doesNotMatch(html, /faculty:all/);
    const txId = html.match(/name="txId"\s+value="([^"]+)"/)![1]!;
    const csrf = html.match(/name="csrfToken"\s+value="([^"]+)"/)![1]!;

    const denied = await t.call("/oauth/consent", form({ txId, csrfToken: csrf, decision: "deny" }));
    assert.match(denied.headers.get("location") ?? "", /error=access_denied/);

    const second = await (await t.call(query, { headers: { Cookie: `timetable_faculty_session=${encodeURIComponent(session)}` } })).text();
    const approve = await t.call(
      "/oauth/consent",
      form({ txId: second.match(/name="txId"\s+value="([^"]+)"/)![1]!, csrfToken: second.match(/name="csrfToken"\s+value="([^"]+)"/)![1]!, decision: "approve" }),
    );
    const code = new URL(approve.headers.get("location")!).searchParams.get("code")!;
    const tokens = (await (
      await t.call("/oauth/token", form({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: "http://127.0.0.1:5555/cb", code_verifier: verifier }))
    ).json()) as { access_token: string; refresh_token: string; scope: string };
    assert.equal(tokens.scope, "timetable:read");

    // Revoking the access token stops it at once.
    const call = () =>
      t.call("/mcp", { method: "POST", headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' });
    assert.equal((await call()).status, 200);
    assert.equal((await t.call("/oauth/revoke", form({ token: tokens.access_token }))).status, 200);
    assert.equal((await call()).status, 401);
  });

  it("prunes expired rows and rate limits registration", async () => {
    const t = makeEnv();
    t.raw.prepare("INSERT INTO mcp_oauth_codes (code_hash, client_id, data, expires_at) VALUES ('old', 'c', '{}', '2000-01-01T00:00:00.000Z')").run();
    let last = 0;
    for (let i = 0; i < 13; i++) {
      last = (
        await t.call("/oauth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
          body: JSON.stringify({ redirect_uris: ["https://example.com/cb"] }),
        })
      ).status;
    }
    assert.equal(last, 429);
    assert.equal((t.raw.prepare("SELECT count(*) AS n FROM mcp_oauth_codes").get() as { n: number }).n, 0);
  });
});
