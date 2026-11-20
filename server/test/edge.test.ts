import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import worker from "../src/edge/index.ts";
import { clearIndexCache } from "../src/edge/read.ts";
import { makeEnv, stubFetch, type TestEnv } from "./helpers/edgeEnv.ts";

const choices = [
  { division: "Sam Altman 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Elon Musk 2024", course: "BTech", batch: "2024-28", semester: "5", also: [] },
  { division: "Geoffrey Hinton", course: "MCA", batch: "2026-28", semester: "1", also: [] },
];
const index = {
  choices,
  faculties: ["Dr. Aarti Pardesi", "Ms. Kashmira", "Prof. Harshal"],
  batches: ["btech|2025-29", "btech|2024-28", "mca|2026-28"],
  timezone: "Asia/Kolkata",
};
const syncBody = JSON.stringify({
  lastSuccessAt: "2026-11-18T05:00:00.000Z",
  lastAttemptAt: "2026-11-18T05:00:00.000Z",
  lastError: null,
  stale: false,
  bootstrapped: true,
  intervalSeconds: 300,
  highlightHours: 72,
  tabNames: ["Monday"],
  contentHash: "abc",
  source: "google-sheets-xlsx-export",
});

const boot = (scope: string) => JSON.stringify({ collegeName: "College", scope, lectures: [{ id: `${scope}-1`, subject: "Networks" }], changes: [] });

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

function seed(t: TestEnv) {
  t.put("index", JSON.stringify(index));
  t.put("sync", syncBody);
  for (const scope of [
    "all",
    "none",
    "d:sam altman 2025",
    "d:elon musk 2024",
    "d:geoffrey hinton",
    "f:dr. aarti pardesi",
    "f:ms. kashmira",
    "f:prof. harshal",
    "b:btech|2025-29",
    "b:btech|",
  ]) {
    t.put(`boot:${scope}`, boot(scope));
  }
  t.raw.prepare("UPDATE job_state SET finished_at = ? WHERE id = 1").run(minutesAgo(1));
}

function addNotice(t: TestEnv, id: string, course: string | null, batch: string | null, createdAt: string) {
  t.raw
    .prepare("INSERT INTO student_notices (id, title, body, course, batch, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, `Title ${id}`, `Body ${id}`, course, batch, createdAt);
}

async function bootstrapJson(t: TestEnv, query = "") {
  const response = await t.call(`/api/bootstrap${query}`);
  assert.equal(response.status, 200);
  return { response, body: (await response.json()) as Record<string, any> };
}

describe("edge bootstrap", () => {
  let t: TestEnv;
  beforeEach(() => {
    clearIndexCache();
    t = makeEnv();
    seed(t);
  });

  it("assembles valid JSON with now, today, sync, notices, and the boot fields", async () => {
    const { response, body } = await bootstrapJson(t);
    assert.equal(body.scope, "all");
    assert.equal(body.collegeName, "College");
    assert.equal(body.lectures.length, 1);
    assert.match(body.now, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(body.today, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(body.sync.lastSuccessAt, "2026-11-18T05:00:00.000Z");
    assert.equal(body.sync.refreshing, false);
    assert.deepEqual(body.notices, []);
    assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("Cache-Control"), "no-cache");
    assert.match(response.headers.get("ETag") ?? "", /^W\/"[0-9a-f]+\.[0-9a-f]+\.0\.\d{4}-\d{2}-\d{2}"$/);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    assert.equal(response.headers.get("Strict-Transport-Security"), "max-age=63072000; includeSubDomains");
  });

  it("matches today to the timetable time zone", async () => {
    const { body } = await bootstrapJson(t);
    const expected = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(body.now));
    assert.equal(body.today, expected);
  });

  it("resolves a division the same way the server always did", async () => {
    assert.equal((await bootstrapJson(t, "?division=Sam%20Altman%202025")).body.scope, "d:sam altman 2025");
    assert.equal((await bootstrapJson(t, "?division=sam%20altman")).body.scope, "d:sam altman 2025");
    assert.equal((await bootstrapJson(t, "?cohort=Elon%20Musk%202024")).body.scope, "d:elon musk 2024");
    assert.equal((await bootstrapJson(t, "?division=Nobody")).body.scope, "none");
  });

  it("resolves a faculty with the shared matcher, including a shared cell", async () => {
    assert.equal((await bootstrapJson(t, `?faculty=${encodeURIComponent("Dr. Aarti & Ms. Kashmira")}`)).body.scope, "f:dr. aarti pardesi");
    assert.equal((await bootstrapJson(t, "?faculty=Dr.%20Aarti%20P")).body.scope, "f:dr. aarti pardesi");
    assert.equal((await bootstrapJson(t, "?faculty=ms.%20kashmira")).body.scope, "f:ms. kashmira");
    // The first name must be written out.
    assert.equal((await bootstrapJson(t, "?faculty=Prof.%20H")).body.scope, "none");
    // Faculty wins over division.
    assert.equal((await bootstrapJson(t, "?faculty=Prof.%20Harshal&division=Sam%20Altman%202025")).body.scope, "f:prof. harshal");
  });

  it("resolves course and batch, and an unknown batch reads as nobody", async () => {
    assert.equal((await bootstrapJson(t, "?course=BTech&batch=2025-29")).body.scope, "b:btech|2025-29");
    assert.equal((await bootstrapJson(t, "?course=BTech")).body.scope, "b:btech|");
    assert.equal((await bootstrapJson(t, "?course=BTech&batch=1999-03")).body.scope, "none");
    assert.equal((await bootstrapJson(t, "?all=1")).body.scope, "all");
  });

  it("shows a cohort its own and everyone's notices from the last 14 days, newest first", async () => {
    addNotice(t, "mine", "BTech", "2025-29", minutesAgo(10));
    addNotice(t, "everyone", null, null, minutesAgo(5));
    addNotice(t, "course", "btech", null, minutesAgo(20));
    addNotice(t, "other", "MCA", "2026-28", minutesAgo(1));
    addNotice(t, "old", null, null, new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString());
    const division = await bootstrapJson(t, "?division=Sam%20Altman%202025");
    assert.deepEqual(division.body.notices.map((n: { id: string }) => n.id), ["everyone", "mine", "course"]);
    assert.deepEqual(Object.keys(division.body.notices[0]).sort(), ["body", "createdAt", "id", "title"]);
    assert.match(division.response.headers.get("ETag") ?? "", /\.everyone\./);
    const batch = await bootstrapJson(t, "?course=MCA&batch=2026-28");
    assert.deepEqual(batch.body.notices.map((n: { id: string }) => n.id), ["other", "everyone"]);
    assert.deepEqual((await bootstrapJson(t, `?faculty=Ms.%20Kashmira`)).body.notices, []);
    assert.deepEqual((await bootstrapJson(t)).body.notices, []);
  });

  it("answers 304 to a matching If-None-Match, and 200 once a notice arrives", async () => {
    const first = await t.call("/api/bootstrap?division=Sam%20Altman%202025");
    const etag = first.headers.get("ETag")!;
    const again = await t.call("/api/bootstrap?division=Sam%20Altman%202025", { headers: { "If-None-Match": etag } });
    assert.equal(again.status, 304);
    assert.equal(again.headers.get("ETag"), etag);
    assert.equal(await again.text(), "");
    addNotice(t, "fresh", null, null, new Date().toISOString());
    const changed = await t.call("/api/bootstrap?division=Sam%20Altman%202025", { headers: { "If-None-Match": etag } });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.headers.get("ETag"), etag);
  });

  it("picks up a new index without a restart", async () => {
    assert.equal((await bootstrapJson(t, "?faculty=Mr.%20Newton")).body.scope, "none");
    t.put("index", JSON.stringify({ ...index, faculties: [...index.faculties, "Mr. Newton"] }));
    t.put("boot:f:mr. newton", boot("f:mr. newton"));
    assert.equal((await bootstrapJson(t, "?faculty=Mr.%20Newton")).body.scope, "f:mr. newton");
    // Cached index, one query.
    const before = t.binding.queries;
    assert.equal((await bootstrapJson(t, "?faculty=Mr.%20Newton")).body.scope, "f:mr. newton");
    assert.equal(t.binding.queries - before, 1);
  });

  it("reports refreshing only while a user request is waiting on the job", async () => {
    t.raw.prepare("UPDATE job_state SET requested_at = ?, finished_at = ? WHERE id = 1").run(minutesAgo(1), minutesAgo(3));
    assert.equal((await bootstrapJson(t)).body.sync.refreshing, true);
    t.raw.prepare("UPDATE job_state SET finished_at = ? WHERE id = 1").run(new Date().toISOString());
    assert.equal((await bootstrapJson(t)).body.sync.refreshing, false);
    t.raw.prepare("UPDATE job_state SET requested_at = ?, finished_at = ? WHERE id = 1").run(minutesAgo(6), minutesAgo(20));
    assert.equal((await bootstrapJson(t)).body.sync.refreshing, false);
  });

  it("is 503 until the job has written a snapshot, and asks for a sync", async () => {
    clearIndexCache();
    const empty = makeEnv();
    const response = await empty.call("/api/bootstrap");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "30");
    assert.equal(((await response.json()) as { ok: boolean }).ok, false);
    assert.equal(empty.pending.length, 1);
    await empty.settle();
  });
});

describe("edge stale self-heal", () => {
  let stub: ReturnType<typeof stubFetch>;
  afterEach(() => stub?.restore());

  it("dispatches the workflow from a stale read without showing refreshing, once a minute", async () => {
    clearIndexCache();
    stub = stubFetch(() => new Response(null, { status: 204 }));
    const t = makeEnv({ GITHUB_TOKEN: "gh-token" });
    seed(t);
    t.put("sync", syncBody, minutesAgo(30));
    t.raw.prepare("UPDATE job_state SET finished_at = ? WHERE id = 1").run(minutesAgo(30));
    const { body } = await bootstrapJson(t);
    assert.equal(body.sync.refreshing, false);
    await t.settle();
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0]!.url, "https://api.github.com/repos/owner/repo/actions/workflows/sync.yml/dispatches");
    assert.deepEqual(JSON.parse(String(stub.calls[0]!.init?.body)), { ref: "main", inputs: { reason: "stale" } });
    const state = t.raw.prepare("SELECT requested_at, dispatched_at FROM job_state").get() as Record<string, string | null>;
    assert.equal(state.requested_at, null);
    assert.ok(state.dispatched_at);
    await bootstrapJson(t);
    await t.settle();
    assert.equal(stub.calls.length, 1);
  });

  it("does not ask while the job is fresh", async () => {
    clearIndexCache();
    stub = stubFetch(() => new Response(null, { status: 204 }));
    const t = makeEnv({ GITHUB_TOKEN: "gh-token" });
    seed(t);
    await bootstrapJson(t);
    await t.settle();
    assert.equal(stub.calls.length, 0);
  });
});

describe("edge sync requests", () => {
  let stub: ReturnType<typeof stubFetch>;
  afterEach(() => stub?.restore());

  it("POST /api/sync records the request and returns the bootstrap with refreshing", async () => {
    clearIndexCache();
    const t = makeEnv();
    seed(t);
    const response = await t.call("/api/sync?division=Sam%20Altman%202025", { method: "POST" });
    assert.equal(response.status, 200);
    const body = (await response.json()) as Record<string, any>;
    assert.equal(body.scope, "d:sam altman 2025");
    assert.equal(body.sync.refreshing, true);
    const state = t.raw.prepare("SELECT requested_at, request_reason, dispatched_at FROM job_state").get() as Record<string, string | null>;
    assert.ok(state.requested_at);
    assert.equal(state.request_reason, "manual");
    assert.equal(state.dispatched_at, null);
    // The next read still shows it until the job finishes.
    assert.equal((await bootstrapJson(t)).body.sync.refreshing, true);
  });

  it("dispatches the workflow at most once a minute", async () => {
    clearIndexCache();
    stub = stubFetch(() => new Response(null, { status: 204 }));
    const t = makeEnv({ GITHUB_TOKEN: "gh-token" });
    seed(t);
    await t.call("/api/sync", { method: "POST" });
    await t.call("/api/sync", { method: "POST" });
    assert.equal(stub.calls.length, 1);
    const call = stub.calls[0]!;
    const headers = new Headers(call.init?.headers);
    assert.equal(call.init?.method, "POST");
    assert.equal(headers.get("Authorization"), "Bearer gh-token");
    assert.equal(headers.get("Accept"), "application/vnd.github+json");
    assert.equal(headers.get("X-GitHub-Api-Version"), "2022-11-28");
    assert.ok(headers.get("User-Agent"));
    assert.deepEqual(JSON.parse(String(call.init?.body)), { ref: "main", inputs: { reason: "manual" } });
    t.raw.prepare("UPDATE job_state SET dispatched_at = ?").run(minutesAgo(2));
    await t.call("/api/sync", { method: "POST" });
    assert.equal(stub.calls.length, 2);
  });

  it("cron dispatches without marking a user request", async () => {
    stub = stubFetch(() => new Response(null, { status: 204 }));
    const t = makeEnv({ GITHUB_TOKEN: "gh-token" });
    const pending: Promise<unknown>[] = [];
    await worker.scheduled({}, t.env, { waitUntil: (p) => void pending.push(p) });
    await Promise.all(pending);
    assert.equal(stub.calls.length, 1);
    assert.deepEqual(JSON.parse(String(stub.calls[0]!.init?.body)).inputs, { reason: "cron" });
    const state = t.raw.prepare("SELECT requested_at, dispatched_at FROM job_state").get() as Record<string, string | null>;
    assert.equal(state.requested_at, null);
    assert.ok(state.dispatched_at);
  });

  it("cron without a token does nothing", async () => {
    stub = stubFetch(() => new Response(null, { status: 204 }));
    const t = makeEnv();
    const pending: Promise<unknown>[] = [];
    await worker.scheduled({}, t.env, { waitUntil: (p) => void pending.push(p) });
    await Promise.all(pending);
    assert.equal(stub.calls.length, 0);
  });
});

describe("edge calendar, changes", () => {
  let t: TestEnv;
  beforeEach(() => {
    clearIndexCache();
    t = makeEnv();
    seed(t);
  });

  it("serves a calendar file with the old headers and 404 text", async () => {
    t.put("ics:d:sam altman 2025", "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
    t.put("ics:f:dr. aarti pardesi", "BEGIN:VCALENDAR\r\nX-WR-CALNAME:Aarti\r\nEND:VCALENDAR\r\n");
    const division = await t.call("/api/calendar.ics?division=Sam%20Altman%202025&download=1");
    assert.equal(division.status, 200);
    assert.equal(division.headers.get("Content-Type"), "text/calendar; charset=utf-8");
    assert.equal(division.headers.get("Cache-Control"), "no-store");
    assert.equal(division.headers.get("Content-Disposition"), 'attachment; filename="sam-altman.ics"');
    assert.match(await division.text(), /^BEGIN:VCALENDAR/);
    const faculty = await t.call(`/api/calendar.ics?faculty=${encodeURIComponent("Dr. Aarti & Ms. Kashmira")}&download=1`);
    assert.equal(faculty.status, 200);
    assert.equal(faculty.headers.get("Content-Disposition"), 'attachment; filename="dr-aarti-ms-kashmira.ics"');
    const plain = await t.call("/api/calendar.ics?division=Sam%20Altman%202025");
    assert.equal(plain.headers.get("Content-Disposition"), null);

    const nobody = await t.call("/api/calendar.ics?faculty=Prof.%20Nobody");
    assert.equal(nobody.status, 404);
    assert.equal(nobody.headers.get("Content-Type"), "text/plain; charset=utf-8");
    assert.equal(await nobody.text(), "No lectures for that faculty.");
    const noLectures = await t.call("/api/calendar.ics?faculty=Ms.%20Kashmira");
    assert.equal(await noLectures.text(), "No lectures for that faculty.");
    const unknown = await t.call("/api/calendar.ics?division=Nowhere");
    assert.equal(unknown.status, 404);
    assert.equal(await unknown.text(), "Unknown cohort.");
    assert.equal((await t.call("/api/calendar.ics")).status, 404);
  });

  it("limits changes to 80 by default and 200 at most", async () => {
    assert.deepEqual(await (await t.call("/api/changes")).json(), { changes: [] });
    const changes = Array.from({ length: 120 }, (_, i) => ({ id: 120 - i, summary: `change ${i}` }));
    t.put("changes", JSON.stringify({ changes }));
    const byDefault = (await (await t.call("/api/changes")).json()) as { changes: Array<{ id: number }> };
    assert.equal(byDefault.changes.length, 80);
    assert.equal(byDefault.changes[0]!.id, 120);
    assert.equal(((await (await t.call("/api/changes?limit=5")).json()) as { changes: unknown[] }).changes.length, 5);
    assert.equal(((await (await t.call("/api/changes?limit=900")).json()) as { changes: unknown[] }).changes.length, 120);
    assert.equal(((await (await t.call("/api/changes?limit=0")).json()) as { changes: unknown[] }).changes.length, 80);
  });
});

describe("edge health and database status", () => {
  beforeEach(() => clearIndexCache());

  it("is 503 before a successful sync and 200 after", async () => {
    const t = makeEnv();
    const before = await t.call("/api/health");
    assert.equal(before.status, 503);
    assert.deepEqual(await before.json(), { ok: false, lastSuccessAt: null, lastError: null });
    t.put("sync", JSON.stringify({ lastSuccessAt: null, lastError: "Google Sheets export failed (404)." }));
    const failed = await t.call("/api/health");
    assert.equal(failed.status, 503);
    assert.equal(((await failed.json()) as { lastError: string }).lastError, "Google Sheets export failed (404).");
    t.put("sync", syncBody);
    const after = await t.call("/api/health");
    assert.equal(after.status, 200);
    assert.deepEqual(await after.json(), { ok: true, lastSuccessAt: "2026-11-18T05:00:00.000Z", lastError: null });
  });

  it("adds a D1 ping on ?db=1", async () => {
    const t = makeEnv();
    t.put("sync", syncBody);
    const body = (await (await t.call("/api/health?db=1")).json()) as { db: { connected: boolean; latencyMs: number } };
    assert.equal(body.db.connected, true);
    assert.equal(typeof body.db.latencyMs, "number");
  });

  it("serves /api/db-status as connected with latency, and 503 when D1 fails", async () => {
    const t = makeEnv();
    const ok = await t.call("/api/db-status");
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { connected: boolean; latencyMs: number };
    assert.equal(body.connected, true);
    assert.equal(typeof body.latencyMs, "number");

    const broken = makeEnv();
    broken.env.DB = {
      prepare() {
        throw new Error("D1 is down");
      },
      async batch() {
        throw new Error("D1 is down");
      },
    };
    const down = await broken.call("/api/db-status");
    assert.equal(down.status, 503);
    assert.deepEqual(await down.json(), { connected: false, error: "D1 is down" });
  });
});

describe("edge routing", () => {
  it("serves assets outside /api and JSON 404 inside it", async () => {
    const t = makeEnv();
    assert.equal(await (await t.call("/faculty")).text(), "asset");
    const missing = await t.call("/api/nope");
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { ok: false, error: "Not found." });
  });

  it("no longer has the PIN routes", async () => {
    const t = makeEnv();
    assert.equal((await t.call("/api/auth/pin-verify", { method: "POST" })).status, 404);
    assert.equal((await t.call("/api/auth/batch-verify", { method: "POST" })).status, 404);
  });

  it("allows CLIENT_ORIGIN with credentials and nobody else", async () => {
    const t = makeEnv({ CLIENT_ORIGIN: "https://app.example, https://other.example" });
    const allowed = await t.call("/api/auth/config", { headers: { Origin: "https://app.example" } });
    assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://app.example");
    assert.equal(allowed.headers.get("Access-Control-Allow-Credentials"), "true");
    const refused = await t.call("/api/auth/config", { headers: { Origin: "https://evil.example" } });
    assert.equal(refused.headers.get("Access-Control-Allow-Origin"), null);
    const pre = await t.call("/api/admin/login", {
      method: "OPTIONS",
      headers: { Origin: "https://app.example", "Access-Control-Request-Headers": "content-type,x-aayam-admin" },
    });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("Access-Control-Allow-Origin"), "https://app.example");
    assert.equal(pre.headers.get("Access-Control-Allow-Headers"), "content-type,x-aayam-admin");
  });

  it("refuses a body over 16 KB and malformed JSON", async () => {
    const t = makeEnv();
    const big = await t.call("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "x".repeat(17 * 1024) }),
    });
    assert.equal(big.status, 413);
    assert.equal(((await big.json()) as { ok: boolean }).ok, false);
    const bad = await t.call("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(bad.status, 400);
  });

  it("answers HEAD like GET without a body", async () => {
    const t = makeEnv();
    const head = await t.call("/api/auth/config", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  });
});
