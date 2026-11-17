import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { signSession, verifySession } from "../src/edge/auth.ts";
import { json, makeEnv, SECRET, stubFetch, type TestEnv } from "./helpers/edgeEnv.ts";

/** The Express `signSession`, byte for byte, so an existing cookie keeps working after the move. */
function legacyToken(payload: Record<string, unknown>, secret = SECRET) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const week = 7 * 24 * 60 * 60 * 1000;

describe("faculty session token", () => {
  it("accepts a token the Express server signed, including non-ASCII names", async () => {
    const token = legacyToken({ email: "teacher@itm.edu", faculty: "Dr. Āarti", canSeeAllFaculty: true, exp: Date.now() + week });
    const session = await verifySession(SECRET, token);
    assert.equal(session?.email, "teacher@itm.edu");
    assert.equal(session?.faculty, "Dr. Āarti");
    assert.equal(session?.canSeeAllFaculty, true);
  });

  it("signs the same format the Express server verifies", async () => {
    const token = await signSession(SECRET, { email: "teacher@itm.edu", faculty: "Teacher", canSeeAllFaculty: false });
    const [data, signature] = token.split(".");
    assert.equal(crypto.createHmac("sha256", SECRET).update(data!).digest("base64url"), signature);
    const payload = JSON.parse(Buffer.from(data!, "base64url").toString("utf8"));
    assert.deepEqual(Object.keys(payload), ["email", "faculty", "canSeeAllFaculty", "exp"]);
    assert.ok(payload.exp > Date.now() + week - 60_000);
  });

  it("rejects a bad signature, a short signature, another secret, an expired token, and junk", async () => {
    const token = legacyToken({ email: "t@itm.edu", faculty: "T", exp: Date.now() + week });
    const [data] = token.split(".");
    assert.equal(await verifySession(SECRET, `${data}.abc`), null);
    assert.equal(await verifySession(SECRET, `${data}.${"A".repeat(43)}`), null);
    assert.equal(await verifySession(SECRET, legacyToken({ email: "t@itm.edu", faculty: "T", exp: Date.now() + week }, "x".repeat(40))), null);
    assert.equal(await verifySession(SECRET, legacyToken({ email: "t@itm.edu", faculty: "T", exp: Date.now() - 1 })), null);
    assert.equal(await verifySession(SECRET, "not-a-token"), null);
    assert.equal(await verifySession(null, token), null);
  });
});

describe("edge /api/auth/me and config", () => {
  it("reads the session from the cookie or a Bearer header", async () => {
    const t = makeEnv();
    const token = legacyToken({ email: "teacher@itm.edu", faculty: "Teacher", canSeeAllFaculty: true, exp: Date.now() + week });
    const expected = { authenticated: true, email: "teacher@itm.edu", faculty: "Teacher", canSeeAllFaculty: true };
    const byCookie = await t.call("/api/auth/me", { headers: { Cookie: `other=1; timetable_faculty_session=${encodeURIComponent(token)}` } });
    assert.deepEqual(await byCookie.json(), expected);
    const byHeader = await t.call("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    assert.deepEqual(await byHeader.json(), expected);
    // A stale cookie does not hide a good header.
    const both = await t.call("/api/auth/me", { headers: { Cookie: "timetable_faculty_session=junk", Authorization: `Bearer ${token}` } });
    assert.deepEqual(await both.json(), expected);
    assert.deepEqual(await (await t.call("/api/auth/me", { headers: { Authorization: "Bearer nope" } })).json(), { authenticated: false });
    assert.deepEqual(await (await t.call("/api/auth/me")).json(), { authenticated: false });
  });

  it("does not trust anything when AUTH_SECRET is too short", async () => {
    const t = makeEnv({ AUTH_SECRET: "short" });
    const token = legacyToken({ email: "t@itm.edu", faculty: "T", exp: Date.now() + week }, "short");
    assert.deepEqual(await (await t.call("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })).json(), { authenticated: false });
  });

  it("returns the Google client id", async () => {
    const t = makeEnv();
    assert.deepEqual(await (await t.call("/api/auth/config")).json(), { clientId: "client-123.apps.googleusercontent.com" });
  });

  it("clears the cookie on logout", async () => {
    const t = makeEnv();
    const response = await t.call("/api/auth/logout", { method: "POST" });
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(
      response.headers.get("Set-Cookie"),
      "timetable_faculty_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure",
    );
  });
});

describe("edge /api/auth/google", () => {
  let stub: ReturnType<typeof stubFetch> | undefined;
  afterEach(() => stub?.restore());

  function google(claims: Record<string, unknown>) {
    stub = stubFetch((url) => {
      assert.match(url, /^https:\/\/oauth2\.googleapis\.com\/tokeninfo\?id_token=/);
      if (url.includes("id_token=expired")) return new Response("{}", { status: 400 });
      return Response.json({
        email_verified: "true",
        aud: "client-123.apps.googleusercontent.com",
        iss: "https://accounts.google.com",
        ...claims,
      });
    });
  }

  function addFaculty(t: TestEnv, email: string, name: string, active = 1, all = 0) {
    t.raw.prepare("INSERT INTO faculty_directory (email, faculty_name, is_active, can_see_all_faculty) VALUES (?, ?, ?, ?)").run(email, name, active, all);
  }

  const signIn = (t: TestEnv, credential = "good", ip = "198.51.100.1") =>
    t.call("/api/auth/google", json({ credential }, { "CF-Connecting-IP": ip }));

  it("signs in a directory member, case-insensitively, and sets the session cookie", async () => {
    google({ email: "Teacher@ITM.edu" });
    const t = makeEnv();
    addFaculty(t, "teacher@itm.edu", "Dr. Aarti Pardesi", 1, 1);
    const response = await signIn(t);
    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.ok, true);
    assert.equal(body.email, "teacher@itm.edu");
    assert.equal(body.faculty, "Dr. Aarti Pardesi");
    assert.equal(body.canSeeAllFaculty, true);
    const session = await verifySession(SECRET, String(body.token));
    assert.equal(session?.faculty, "Dr. Aarti Pardesi");
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    assert.match(setCookie, new RegExp(`^timetable_faculty_session=${encodeURIComponent(String(body.token)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}; Path=/; Max-Age=604800; Expires=`));
    assert.match(setCookie, /; HttpOnly; SameSite=Lax; Secure$/);
    const row = t.raw.prepare("SELECT last_login_at FROM faculty_directory").get() as { last_login_at: string | null };
    assert.ok(row.last_login_at);
    const me = await t.call("/api/auth/me", { headers: { Authorization: `Bearer ${body.token}` } });
    assert.equal(((await me.json()) as { faculty: string }).faculty, "Dr. Aarti Pardesi");
  });

  it("refuses an unknown email, an inactive member, another domain, another audience, and a bad token", async () => {
    const t = makeEnv();
    addFaculty(t, "gone@itm.edu", "Gone", 0);
    addFaculty(t, "teacher@gmail.com", "Outsider");
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ email: "stranger@itm.edu" }, "good"],
      [{ email: "gone@itm.edu" }, "good"],
      [{ email: "teacher@gmail.com" }, "good"],
      [{ email: "teacher@itm.edu", aud: "someone-else" }, "good"],
      [{ email: "teacher@itm.edu", iss: "evil.example" }, "good"],
      [{ email: "teacher@itm.edu", email_verified: "false" }, "good"],
      [{ email: "teacher@itm.edu" }, "expired"],
    ];
    addFaculty(t, "teacher@itm.edu", "Teacher");
    for (const [claims, credential] of cases) {
      google(claims);
      const response = await signIn(t, credential, `203.0.113.${cases.findIndex((c) => c[0] === claims)}`);
      stub!.restore();
      assert.equal(response.status, 403, JSON.stringify(claims));
      assert.deepEqual(await response.json(), { ok: false, error: "Sign-in was refused. Use an authorized faculty account." });
    }
  });

  it("allows the default isu.ac.in domain and extra ALLOWED_EMAIL_DOMAINS", async () => {
    const t = makeEnv({ ALLOWED_EMAIL_DOMAINS: "@college.example, other.example" });
    addFaculty(t, "a@isu.ac.in", "A");
    addFaculty(t, "b@college.example", "B");
    google({ email: "a@isu.ac.in" });
    assert.equal((await signIn(t, "good", "192.0.2.1")).status, 200);
    stub!.restore();
    google({ email: "b@college.example" });
    assert.equal((await signIn(t, "good", "192.0.2.2")).status, 200);
  });

  it("needs a credential", async () => {
    const t = makeEnv();
    const response = await t.call("/api/auth/google", json({}));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: "Missing credential." });
  });

  it("allows 8 attempts per IP in 10 minutes, and a sign-in clears the count", async () => {
    google({ email: "stranger@itm.edu" });
    const t = makeEnv();
    for (let i = 0; i < 8; i++) assert.equal((await signIn(t, "good", "203.0.113.9")).status, 403);
    const blocked = await signIn(t, "good", "203.0.113.9");
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
    assert.match(((await blocked.json()) as { error: string }).error, /^Too many sign-in attempts\. Try again in \d+ seconds\.$/);
    assert.equal((await signIn(t, "good", "203.0.113.10")).status, 403);

    stub!.restore();
    google({ email: "teacher@itm.edu" });
    addFaculty(t, "teacher@itm.edu", "Teacher");
    for (let i = 0; i < 3; i++) await signIn(t, "expired", "203.0.113.11");
    assert.equal((await signIn(t, "good", "203.0.113.11")).status, 200);
    const left = t.raw.prepare("SELECT count(*) AS n FROM rate_limits WHERE key = 'google:203.0.113.11'").get() as { n: number };
    assert.equal(left.n, 0);
  });
});
