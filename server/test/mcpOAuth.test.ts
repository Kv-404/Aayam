import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import { signSession } from "../src/auth.ts";
import { getConfig } from "../src/config.ts";
import { openDatabase } from "../src/db.ts";
import { assertSafePublicHttpsUrl, isPrivateOrReservedIp, sha256Base64Url } from "../src/mcp/oauthStore.ts";
import { MemoryRedisStore, resetRedisForTests, setRedisForTests } from "../src/services/redis.ts";

async function withServer(
  app: ReturnType<typeof createApp>,
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("MCP OAuth 2.1 Authorization Server", () => {
  afterEach(() => {
    resetRedisForTests();
  });

  it("blocks private, loopback, and link-local SSRF targets for CIMD client_ids", async () => {
    assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("10.0.0.5"), true);
    assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
    assert.equal(isPrivateOrReservedIp("192.168.1.10"), true);
    assert.equal(isPrivateOrReservedIp("::1"), true);
    assert.equal(isPrivateOrReservedIp("1.1.1.1"), false);

    await assert.rejects(() => assertSafePublicHttpsUrl("http://claude.ai/client.json"), /HTTPS/);
    await assert.rejects(() => assertSafePublicHttpsUrl("https://localhost/client.json"), /not allowed/);
    await assert.rejects(() => assertSafePublicHttpsUrl("https://169.254.169.254/latest/meta-data"), /private/);
    await assert.rejects(() => assertSafePublicHttpsUrl("https://127.0.0.1/client.json"), /private/);
  });

  it("serves RFC 9728 and RFC 8414 metadata advertising CIMD and DCR", async () => {
    setRedisForTests(new MemoryRedisStore());
    const app = createApp(openDatabase(":memory:"), getConfig(), async () => ({ buffer: Buffer.alloc(0) }));

    await withServer(app, async (baseUrl) => {
      const prmRes = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
      assert.equal(prmRes.status, 200);
      assert.equal(prmRes.headers.get("access-control-allow-origin"), "*");
      const prm = (await prmRes.json()) as {
        resource: string;
        authorization_servers: string[];
        scopes_supported: string[];
      };
      assert.equal(prm.resource, `${baseUrl}/mcp`);
      assert.deepEqual(prm.authorization_servers, [baseUrl]);
      assert.ok(prm.scopes_supported.includes("faculty:directory"));

      const asRes = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
      assert.equal(asRes.status, 200);
      const as = (await asRes.json()) as {
        issuer: string;
        authorization_endpoint: string;
        token_endpoint: string;
        registration_endpoint: string;
        client_id_metadata_document_supported: boolean;
        code_challenge_methods_supported: string[];
      };
      assert.equal(as.issuer, baseUrl);
      assert.equal(as.client_id_metadata_document_supported, true);
      assert.equal(as.registration_endpoint, `${baseUrl}/oauth/register`);
      assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
    });
  });

  it("validates DCR registration redirect URIs cleanly", async () => {
    setRedisForTests(new MemoryRedisStore());
    const app = createApp(openDatabase(":memory:"), getConfig(), async () => ({ buffer: Buffer.alloc(0) }));

    await withServer(app, async (baseUrl) => {
      const bad = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirect_uris: ["http://evil.example.com/callback"] }),
      });
      assert.equal(bad.status, 400);

      const good = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Claude Code Test",
          redirect_uris: ["http://127.0.0.1:43210/callback"],
          token_endpoint_auth_method: "none",
        }),
      });
      assert.equal(good.status, 201);
      const client = (await good.json()) as { client_id: string; redirect_uris: string[] };
      assert.ok(client.client_id.startsWith("mcp_"));
      assert.deepEqual(client.redirect_uris, ["http://127.0.0.1:43210/callback"]);
    });
  });

  it("executes full OAuth 2.1 PKCE + Google + consent + refresh rotation + reuse revocation", async () => {
    setRedisForTests(new MemoryRedisStore());
    const db = openDatabase(":memory:");
    const config = getConfig();
    const app = createApp(db, config, async () => ({ buffer: Buffer.alloc(0) }), {
      mcpOAuth: {
        exchangeGoogleCode: async ({ code }) => ({ idToken: `fake-id-${code}` }),
        verifyGoogleIdToken: async () => ({ email: "test-faculty@itm.edu", name: "Dr. Aarti Pardesi" }),
        resolveFaculty: async (email) => ({
          id: 1,
          email,
          faculty_name: "Dr. Aarti Pardesi",
          can_see_all_faculty: true,
        }),
      },
    });

    await withServer(app, async (baseUrl) => {
      // 1. Register DCR client
      const regRes = await fetch(`${baseUrl}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Claude Desktop",
          redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
          token_endpoint_auth_method: "none",
        }),
      });
      const { client_id: clientId } = (await regRes.json()) as { client_id: string };

      const codeVerifier = "verifier_abcdefghijklmnopqrstuvwxyz0123456789_ABCDEFGHIJK";
      const codeChallenge = sha256Base64Url(codeVerifier);
      const resource = `${baseUrl}/mcp`;

      // 2. Plain PKCE or wrong audience must fail
      const plainChallengeRes = await fetch(
        `${baseUrl}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("https://claude.ai/api/mcp/auth_callback")}&code_challenge=${encodeURIComponent(codeVerifier)}&code_challenge_method=plain&state=s1&resource=${encodeURIComponent(resource)}`,
        { redirect: "manual" },
      );
      assert.equal(plainChallengeRes.status, 302);
      assert.match(plainChallengeRes.headers.get("location") ?? "", /error=invalid_request/);

      const wrongTargetRes = await fetch(
        `${baseUrl}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("https://claude.ai/api/mcp/auth_callback")}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&state=s1&resource=${encodeURIComponent("https://other.example.com/mcp")}`,
        { redirect: "manual" },
      );
      assert.equal(wrongTargetRes.status, 302);
      assert.match(wrongTargetRes.headers.get("location") ?? "", /error=invalid_target/);

      // 3. Valid /oauth/authorize redirects to Google
      const authRes = await fetch(
        `${baseUrl}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("https://claude.ai/api/mcp/auth_callback")}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&state=xyz123&resource=${encodeURIComponent(resource)}`,
        { redirect: "manual" },
      );
      assert.equal(authRes.status, 302);
      const googleUrl = new URL(authRes.headers.get("location")!);
      assert.equal(googleUrl.origin, "https://accounts.google.com");
      const txId = googleUrl.searchParams.get("state")!;
      assert.ok(txId);

      // 4. Google callback renders consent screen with CSRF token
      const cbRes = await fetch(`${baseUrl}/oauth/callback?state=${encodeURIComponent(txId)}&code=google-auth-code`);
      assert.equal(cbRes.status, 200);
      const html = await cbRes.text();
      assert.match(html, /Dr\. Aarti Pardesi/);
      assert.match(html, /All-Access Faculty/);
      const csrfMatch = html.match(/name="csrfToken"\s+value="([^"]+)"/);
      assert.ok(csrfMatch?.[1]);

      // 5. Consent approval issues single-use authorization code
      const consentRes = await fetch(`${baseUrl}/oauth/consent`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          txId,
          csrfToken: csrfMatch[1],
          decision: "approve",
        }),
      });
      assert.equal(consentRes.status, 302);
      const redirectBack = new URL(consentRes.headers.get("location")!);
      assert.equal(redirectBack.origin, "https://claude.ai");
      assert.equal(redirectBack.searchParams.get("state"), "xyz123");
      const authCode = redirectBack.searchParams.get("code")!;
      assert.ok(authCode);

      // 6. Wrong code_verifier fails PKCE
      const badPkce = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code: authCode,
          redirect_uri: "https://claude.ai/api/mcp/auth_callback",
          code_verifier: "wrong_verifier_abcdefghijklmnopqrstuvwxyz0123456789",
          resource,
        }),
      });
      assert.equal(badPkce.status, 400);
      // Note: authCode is single-use and already consumed on attempt!
      const replayRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code: authCode,
          redirect_uri: "https://claude.ai/api/mcp/auth_callback",
          code_verifier: codeVerifier,
          resource,
        }),
      });
      assert.equal(replayRes.status, 400);

      // Obtain a fresh code via CIMD client to complete token + rotation + revocation test
      const cimdId = "https://claude.ai/oauth/client-metadata.json";
      const appWithCimd = createApp(db, config, async () => ({ buffer: Buffer.alloc(0) }), {
        mcpOAuth: {
          cimdFetcher: async (url) => ({
            client_id: url,
            client_name: "Claude Web",
            redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
            token_endpoint_auth_method: "none",
          }),
          exchangeGoogleCode: async ({ code }) => ({ idToken: `fake-id-${code}` }),
          verifyGoogleIdToken: async () => ({ email: "test-faculty@itm.edu", name: "Dr. Aarti Pardesi" }),
          resolveFaculty: async (email) => ({
            id: 1,
            email,
            faculty_name: "Dr. Aarti Pardesi",
            can_see_all_faculty: true,
          }),
        },
      });

      await withServer(appWithCimd, async (cimdBaseUrl) => {
        const cimdResource = `${cimdBaseUrl}/mcp`;
        const a1 = await fetch(
          `${cimdBaseUrl}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(cimdId)}&redirect_uri=${encodeURIComponent("https://claude.ai/api/mcp/auth_callback")}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&state=st2&resource=${encodeURIComponent(cimdResource)}`,
          { redirect: "manual" },
        );
        const tx2 = new URL(a1.headers.get("location")!).searchParams.get("state")!;
        const cb2 = await fetch(`${cimdBaseUrl}/oauth/callback?state=${encodeURIComponent(tx2)}&code=gcode2`);
        const csrf2 = (await cb2.text()).match(/name="csrfToken"\s+value="([^"]+)"/)![1]!;
        const con2 = await fetch(`${cimdBaseUrl}/oauth/consent`, {
          method: "POST",
          redirect: "manual",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ txId: tx2, csrfToken: csrf2, decision: "approve" }),
        });
        const code2 = new URL(con2.headers.get("location")!).searchParams.get("code")!;

        const tokRes = await fetch(`${cimdBaseUrl}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: cimdId,
            code: code2,
            redirect_uri: "https://claude.ai/api/mcp/auth_callback",
            code_verifier: codeVerifier,
            resource: cimdResource,
          }),
        });
        assert.equal(tokRes.status, 200);
        const tokens = (await tokRes.json()) as {
          access_token: string;
          refresh_token: string;
          token_type: string;
          scope: string;
        };
        assert.equal(tokens.token_type, "Bearer");
        assert.ok(tokens.scope.includes("faculty:directory"));

        // Web session token must NEVER work as MCP bearer token (no token passthrough/confusion)
        const webToken = signSession({ email: "test-faculty@itm.edu", faculty: "Dr. Aarti Pardesi", canSeeAllFaculty: true });
        const confusedRes = await fetch(`${cimdBaseUrl}/mcp`, {
          method: "POST",
          headers: { Authorization: `Bearer ${webToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
        });
        assert.equal(confusedRes.status, 401);

        // Refresh rotation succeeds once, then replaying old refresh token revokes the entire family!
        const refRes1 = await fetch(`${cimdBaseUrl}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: cimdId,
            refresh_token: tokens.refresh_token,
            resource: cimdResource,
          }),
        });
        assert.equal(refRes1.status, 200);
        const rotated = (await refRes1.json()) as { access_token: string; refresh_token: string };
        assert.notEqual(rotated.refresh_token, tokens.refresh_token);

        const replayOldRt = await fetch(`${cimdBaseUrl}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: cimdId,
            refresh_token: tokens.refresh_token,
            resource: cimdResource,
          }),
        });
        assert.equal(replayOldRt.status, 400);

        // Now even the rotated access token and refresh token are revoked due to family revocation!
        const revokedMcpCall = await fetch(`${cimdBaseUrl}/mcp`, {
          method: "POST",
          headers: { Authorization: `Bearer ${rotated.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
        });
        assert.equal(revokedMcpCall.status, 401);
      });
    });
  });
});
