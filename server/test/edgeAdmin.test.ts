import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { COHORT_TEMPLATES } from "../src/config.ts";
import { acceptSpreadsheetId, hashPassword, verifyPassword } from "../src/edge/admin.ts";
import { json, makeEnv, SECRET, stubFetch, type TestEnv } from "./helpers/edgeEnv.ts";

const PASSWORD = "correct horse battery";
const SHEET = "1AdminOverrideSheetIdForTests00000000001";
const admin = { "X-Aayam-Admin": "1" };

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

function cookieFrom(response: Response) {
  const match = /aayam_admin=([^;]*)/.exec(response.headers.get("Set-Cookie") ?? "");
  return match ? `aayam_admin=${match[1]}` : "";
}

async function login(t: TestEnv, password = PASSWORD, ip = "198.51.100.7") {
  return t.call("/api/admin/login", json({ password }, { "CF-Connecting-IP": ip }));
}

async function signedIn(t: TestEnv) {
  const response = await login(t);
  assert.equal(response.status, 200);
  return cookieFrom(response);
}

describe("admin password hash", () => {
  it("stores an HMAC that does not contain the password", async () => {
    const hash = await hashPassword(SECRET, PASSWORD);
    assert.match(hash, /^hmac-sha256:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}$/);
    assert.equal(hash.includes(PASSWORD), false);
    assert.notEqual(await hashPassword(SECRET, PASSWORD), hash);
    assert.equal(await verifyPassword(SECRET, PASSWORD, hash), true);
    assert.equal(await verifyPassword(SECRET, "wrong horse battery", hash), false);
    assert.equal(await verifyPassword("another-secret-another-secret-12345", PASSWORD, hash), false);
    assert.equal(await verifyPassword(SECRET, PASSWORD, null), false);
    assert.equal(await verifyPassword(SECRET, PASSWORD, "scrypt$16384$8$1$aa$bb"), false);
    assert.equal(await verifyPassword(SECRET, PASSWORD, "hmac-sha256:short:short"), false);
  });

  it("reads the password hash in one Worker file and nowhere else in the Worker", () => {
    const root = path.resolve(import.meta.dirname, "../src/edge");
    const hits = sourceFiles(root).filter((file) => /SELECT\s+password_hash/i.test(fs.readFileSync(file, "utf8")));
    assert.deepEqual(hits.map((file) => path.basename(file)), ["admin.ts"]);
  });

  it("keeps the Worker free of node: imports", () => {
    const root = path.resolve(import.meta.dirname, "../src/edge");
    for (const file of sourceFiles(root)) {
      assert.doesNotMatch(fs.readFileSync(file, "utf8"), /from\s+["']node:/, file);
    }
  });
});

describe("edge admin login", () => {
  it("seeds from ADMIN_PASSWORD, signs in, and sets a strict HttpOnly cookie", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    const response = await login(t);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    assert.match(setCookie, /^aayam_admin=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=43200; Expires=.+; HttpOnly; SameSite=Strict; Secure$/);
    const stored = t.raw.prepare("SELECT password_hash FROM admin_password").get() as { password_hash: string };
    assert.match(stored.password_hash, /^hmac-sha256:/);
    assert.equal(stored.password_hash.includes(PASSWORD), false);
    const sessions = t.raw.prepare("SELECT token_hash, expires_at FROM admin_sessions").all() as Array<{ token_hash: string; expires_at: string }>;
    assert.equal(sessions.length, 1);
    assert.match(sessions[0]!.token_hash, /^[0-9a-f]{64}$/);
    assert.equal(setCookie.includes(sessions[0]!.token_hash), false);
    const hours = (Date.parse(sessions[0]!.expires_at) - Date.now()) / 3600_000;
    assert.ok(hours > 11.9 && hours <= 12);
  });

  it("refuses a wrong password, and nothing when no password is set", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    const wrong = await login(t, "nope nope nope");
    assert.equal(wrong.status, 401);
    assert.deepEqual(await wrong.json(), { ok: false, error: "That password is not right." });
    assert.equal(wrong.headers.get("Set-Cookie"), null);
    const unset = makeEnv();
    assert.equal((await login(unset, PASSWORD)).status, 401);
    const short = makeEnv({ ADMIN_PASSWORD: "too short" });
    assert.equal((await login(short, "too short")).status, 401);
  });

  it("replaces an old scrypt hash from ADMIN_PASSWORD", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    t.raw.prepare("INSERT INTO admin_password (id, password_hash, updated_at) VALUES (1, ?, ?)").run("scrypt$16384$8$1$abc$def", new Date().toISOString());
    assert.equal((await login(t)).status, 200);
  });

  it("blocks an IP after 5 failures for 15 minutes, even with the right password", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    for (let i = 0; i < 5; i++) assert.equal((await login(t, "wrong wrong wrong", "203.0.113.50")).status, 401);
    const blocked = await login(t, PASSWORD, "203.0.113.50");
    assert.equal(blocked.status, 429);
    const retry = Number(blocked.headers.get("Retry-After"));
    assert.ok(retry > 880 && retry <= 900, String(retry));
    assert.match(((await blocked.json()) as { error: string }).error, /^Too many tries\. Wait \d+ seconds\.$/);
    assert.equal((await login(t, PASSWORD, "203.0.113.51")).status, 200);
    // An expired window starts over.
    t.raw.prepare("UPDATE rate_limits SET reset_at = ?").run(Date.now() - 1);
    assert.equal((await login(t, PASSWORD, "203.0.113.50")).status, 200);
  });

  it("clears the failure count on success", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    for (let i = 0; i < 4; i++) await login(t, "wrong wrong wrong", "203.0.113.60");
    assert.equal((await login(t, PASSWORD, "203.0.113.60")).status, 200);
    for (let i = 0; i < 4; i++) await login(t, "wrong wrong wrong", "203.0.113.60");
    assert.equal((await login(t, PASSWORD, "203.0.113.60")).status, 200);
  });

  it("is unavailable without AUTH_SECRET", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD, AUTH_SECRET: "" });
    assert.equal((await login(t)).status, 503);
  });
});

describe("edge admin session", () => {
  it("reports sheets and notices to a signed-in admin only", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    assert.deepEqual(await (await t.call("/api/admin/session")).json(), { signedIn: false });
    const cookie = await signedIn(t);
    const body = (await (await t.call("/api/admin/session", { headers: { Cookie: cookie } })).json()) as {
      signedIn: boolean;
      sheets: Array<{ course: string; batch: string; spreadsheetUrl: string }>;
      notices: unknown[];
    };
    assert.equal(body.signedIn, true);
    assert.equal(body.sheets.length, COHORT_TEMPLATES.length);
    // The seed migration stores every batch's workbook in D1.
    assert.equal(body.sheets[0]!.spreadsheetUrl, "https://docs.google.com/spreadsheets/d/1o_sNayHt8v4WlyZUVcmPWhyjNQ6i8ONuX2zMo5czg0w/edit");
    t.raw.prepare("DELETE FROM timetable_sheet_links WHERE batch = ?").run(COHORT_TEMPLATES[0]!.batch);
    const after = (await (await t.call("/api/admin/session", { headers: { Cookie: cookie } })).json()) as typeof body;
    assert.equal(after.sheets[0]!.spreadsheetUrl, "");
    assert.deepEqual(body.notices, []);
  });

  it("expires sessions and logs out", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    const cookie = await signedIn(t);
    const logout = await t.call("/api/admin/logout", { method: "POST", headers: { Cookie: cookie } });
    assert.deepEqual(await logout.json(), { ok: true });
    assert.equal(logout.headers.get("Set-Cookie"), "aayam_admin=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict; Secure");
    assert.deepEqual(await (await t.call("/api/admin/session", { headers: { Cookie: cookie } })).json(), { signedIn: false });

    const again = await signedIn(t);
    t.raw.prepare("UPDATE admin_sessions SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    assert.deepEqual(await (await t.call("/api/admin/session", { headers: { Cookie: again } })).json(), { signedIn: false });
    assert.equal((t.raw.prepare("SELECT count(*) AS n FROM admin_sessions").get() as { n: number }).n, 0);
  });

  it("needs the admin header and a session for changes", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    const cookie = await signedIn(t);
    const noHeader = await t.call("/api/admin/notices", json({ title: "x", body: "y" }, { Cookie: cookie }));
    assert.equal(noHeader.status, 401);
    assert.deepEqual(await noHeader.json(), { ok: false, error: "Sign in again." });
    const noCookie = await t.call("/api/admin/notices", json({ title: "x", body: "y" }, admin));
    assert.equal(noCookie.status, 401);
  });
});

describe("edge admin password change", () => {
  it("checks the current password, rotates every session, and keeps working", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    const cookie = await signedIn(t);
    const other = await signedIn(t);
    const change = (body: Record<string, string>, c = cookie) => t.call("/api/admin/password", json(body, { ...admin, Cookie: c }));

    const short = await change({ current: PASSWORD, next: "short" });
    assert.equal(short.status, 400);
    assert.deepEqual(await short.json(), { ok: false, error: "Use at least 12 characters." });
    const wrong = await change({ current: "not the password", next: "a brand new password" });
    assert.equal(wrong.status, 401);

    const ok = await change({ current: PASSWORD, next: "a brand new password" });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { ok: true });
    const fresh = cookieFrom(ok);
    assert.ok(fresh && fresh !== cookie);
    assert.deepEqual(await (await t.call("/api/admin/session", { headers: { Cookie: other } })).json(), { signedIn: false });
    assert.equal(((await (await t.call("/api/admin/session", { headers: { Cookie: fresh } })).json()) as { signedIn: boolean }).signedIn, true);
    assert.equal((await login(t, PASSWORD)).status, 401);
    assert.equal((await login(t, "a brand new password")).status, 200);
  });
});

describe("edge admin sheets", () => {
  let stub: ReturnType<typeof stubFetch> | undefined;
  afterEach(() => stub?.restore());

  const save = (t: TestEnv, cookie: string, url: string, batch = "2025-29") =>
    t.call("/api/admin/sheets", json({ course: "BTech", batch, url }, { ...admin, Cookie: cookie }));

  it("accepts only Google Sheet links or ids", () => {
    assert.equal(acceptSpreadsheetId(`https://docs.google.com/spreadsheets/d/${SHEET}/edit#gid=0`), SHEET);
    assert.equal(acceptSpreadsheetId(SHEET), SHEET);
    assert.equal(acceptSpreadsheetId("javascript:alert(1)"), null);
    assert.equal(acceptSpreadsheetId("short"), null);
  });

  it("stores a readable sheet and asks the job to sync", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD, GITHUB_TOKEN: "gh-token" });
    const cookie = await signedIn(t);
    stub = stubFetch((url) => {
      if (url.startsWith("https://docs.google.com/")) {
        return new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), { status: 200 });
      }
      return new Response(null, { status: 204 });
    });
    const response = await save(t, cookie, `https://docs.google.com/spreadsheets/d/${SHEET}/edit`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; syncing: boolean; sheets: Array<{ batch: string; spreadsheetUrl: string }> };
    assert.equal(body.ok, true);
    assert.equal(body.syncing, true);
    assert.equal(body.sheets.find((sheet) => sheet.batch === "2025-29")?.spreadsheetUrl, `https://docs.google.com/spreadsheets/d/${SHEET}/edit`);
    assert.equal(stub.calls[0]!.url, `https://docs.google.com/spreadsheets/d/${SHEET}/export?format=xlsx`);
    const row = t.raw.prepare("SELECT course, batch, spreadsheet_id FROM timetable_sheet_links WHERE batch = '2025-29'").get() as Record<string, string>;
    assert.deepEqual({ ...row }, { course: "BTech", batch: "2025-29", spreadsheet_id: SHEET });
    const state = t.raw.prepare("SELECT requested_at, request_reason, dispatched_at FROM job_state").get() as Record<string, string | null>;
    assert.equal(state.request_reason, "sheet");
    assert.ok(state.requested_at && state.dispatched_at);
    const dispatch = stub.calls.find((call) => call.url.startsWith("https://api.github.com/"));
    assert.deepEqual(JSON.parse(String(dispatch?.init?.body)), { ref: "main", inputs: { reason: "sheet" } });
  });

  it("keeps nothing when the export is a sign-in page or an error", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    const cookie = await signedIn(t);
    stub = stubFetch(() => new Response("<!doctype html><html>Sign in</html>", { status: 200, headers: { "Content-Type": "text/html" } }));
    const html = await save(t, cookie, SHEET);
    assert.equal(html.status, 400);
    assert.deepEqual(await html.json(), {
      ok: false,
      error: "The spreadsheet export was not an Excel file. Share the sheet as “Anyone with the link can view”.",
    });
    stub.restore();
    stub = stubFetch(() => new Response("gone", { status: 404 }));
    const missing = await save(t, cookie, SHEET);
    assert.equal(missing.status, 400);
    assert.match(((await missing.json()) as { error: string }).error, /^Google Sheets export failed \(404\)/);
    assert.equal((t.raw.prepare("SELECT count(*) AS n FROM timetable_sheet_links WHERE spreadsheet_id = ?").get(SHEET) as { n: number }).n, 0);
    assert.equal((t.raw.prepare("SELECT requested_at FROM job_state").get() as { requested_at: string | null }).requested_at, null);
  });

  it("refuses an unknown batch or a link that is not a sheet", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    const cookie = await signedIn(t);
    stub = stubFetch(() => new Response(new Uint8Array([0x50, 0x4b])));
    for (const response of [await save(t, cookie, SHEET, "1999-03"), await save(t, cookie, "https://example.com/x")]) {
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: "Paste a Google Sheet link for one of the batches." });
    }
    assert.equal(stub.calls.length, 0);
  });
});

describe("edge admin notices", () => {
  let stub: ReturnType<typeof stubFetch> | undefined;
  afterEach(() => stub?.restore());

  const send = (t: TestEnv, cookie: string, body: Record<string, string>) => t.call("/api/admin/notices", json(body, { ...admin, Cookie: cookie }));

  it("queues a notice for the job to push and asks for a sync", async () => {
    stub = stubFetch(() => new Response(null, { status: 204 }));
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD, GITHUB_TOKEN: "gh-token" });
    const cookie = await signedIn(t);
    const response = await send(t, cookie, { title: "Room change", body: "Lab  moved\nto 204", course: "BTech", batch: "2025-29" });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; delivered: number; queued: boolean; notices: Array<Record<string, unknown>> };
    assert.equal(body.ok, true);
    assert.equal(body.delivered, 0);
    assert.equal(body.queued, true);
    assert.equal(body.notices.length, 1);
    assert.deepEqual(Object.keys(body.notices[0]!).sort(), ["batch", "body", "course", "createdAt", "id", "title"]);
    assert.equal(body.notices[0]!.body, "Lab moved to 204");
    const row = t.raw.prepare("SELECT course, batch, pushed_at FROM student_notices").get() as Record<string, string | null>;
    assert.deepEqual({ ...row }, { course: "BTech", batch: "2025-29", pushed_at: null });
    assert.equal(stub.calls.length, 1);
    assert.deepEqual(JSON.parse(String(stub.calls[0]!.init?.body)), { ref: "main", inputs: { reason: "push" } });
    const state = t.raw.prepare("SELECT request_reason FROM job_state").get() as { request_reason: string };
    assert.equal(state.request_reason, "push");

    // Within the minute, a second notice is stored and recorded but GitHub is not asked again.
    assert.equal((await send(t, cookie, { title: "Everyone", body: "Hello" })).status, 200);
    assert.equal(stub.calls.length, 1);
    const all = (t.raw.prepare("SELECT course, batch FROM student_notices WHERE title = 'Everyone'").get()) as Record<string, string | null>;
    assert.deepEqual({ ...all }, { course: null, batch: null });
  });

  it("accepts a course-wide notice and refuses an unknown audience or an empty message", async () => {
    const t = makeEnv({ ADMIN_PASSWORD: PASSWORD });
    const cookie = await signedIn(t);
    assert.equal((await send(t, cookie, { title: "MCA", body: "All MCA", course: "MCA" })).status, 200);
    const bad: Array<Record<string, string>> = [
      { title: "x", body: "y", course: "BTech", batch: "1999-03" },
      { title: "x", body: "y", batch: "2025-29" },
      { title: "", body: "y" },
      { title: "x", body: "   " },
    ];
    for (const body of bad) {
      const response = await send(t, cookie, body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: "Write a title, a message, and who should see it." });
    }
  });
});

describe("edge web push", () => {
  it("makes one VAPID key pair and serves only the public half", async () => {
    const t = makeEnv();
    const first = (await (await t.call("/api/push/public-key")).json()) as { publicKey: string };
    assert.match(first.publicKey, /^[A-Za-z0-9_-]{87}$/);
    const second = (await (await t.call("/api/push/public-key")).json()) as { publicKey: string };
    assert.equal(second.publicKey, first.publicKey);
    const row = t.raw.prepare("SELECT private_key FROM push_vapid").get() as { private_key: string };
    assert.match(row.private_key, /^[A-Za-z0-9_-]{43}$/);
  });

  it("serves an existing key as is", async () => {
    const t = makeEnv();
    t.raw.prepare("INSERT INTO push_vapid (id, public_key, private_key) VALUES (1, 'pub', 'priv')").run();
    assert.deepEqual(await (await t.call("/api/push/public-key")).json(), { publicKey: "pub" });
  });

  it("saves and updates a subscription, and refuses a non-https endpoint", async () => {
    const t = makeEnv();
    const subscribe = (body: Record<string, unknown>) => t.call("/api/push/subscribe", json(body));
    const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" }, course: "BTech", batch: "2025-29", division: "Sam Altman 2025" };
    assert.deepEqual(await (await subscribe(sub)).json(), { ok: true });
    assert.deepEqual(await (await subscribe({ ...sub, batch: "2024-28" })).json(), { ok: true });
    const rows = t.raw.prepare("SELECT endpoint, batch FROM push_subscriptions").all() as Array<Record<string, string>>;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{ endpoint: "https://push.example/abc", batch: "2024-28" }]);
    const bad = await subscribe({ ...sub, endpoint: "http://push.example/abc" });
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { ok: false });
    assert.equal((await subscribe({ endpoint: "https://push.example/x" })).status, 400);
  });
});
