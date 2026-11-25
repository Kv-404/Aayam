import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sqliteDb } from "../src/d1/sqlite.ts";
import { signSession } from "../src/edge/auth.ts";
import { sendAppPushes, type ExpoMessage, type ExpoSend } from "../src/job/appPushes.ts";
import { makeEnv, SECRET } from "./helpers/edgeEnv.ts";

const T0 = new Date("2026-11-20T08:00:00.000Z");
const later = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

function fakeSend(dead: string[] = []) {
  const sent: ExpoMessage[][] = [];
  const send: ExpoSend = async (messages) => {
    sent.push(messages);
    return messages.map((message) => (dead.includes(message.to) ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" }));
  };
  return { send, sent, all: () => sent.flat() };
}

function addDevice(sql: ReturnType<typeof sqliteDb>, token: string, values: { role?: string; course?: string; batch?: string; division?: string; faculty?: string }) {
  sql.raw
    .prepare("INSERT INTO app_push_devices (token, role, course, batch, division, faculty, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(token, values.role ?? "student", values.course ?? null, values.batch ?? null, values.division ?? null, values.faculty ?? null, T0.toISOString(), T0.toISOString());
}

let changeId = 0;
function addChange(sql: ReturnType<typeof sqliteDb>, at: Date, values: { type?: string; division?: string; summary?: string; previous?: object; next?: object }) {
  changeId += 1;
  sql.raw
    .prepare("INSERT INTO timetable_changes (id, week_id, dedupe_key, detected_at, type, division, summary, previous, next) VALUES (?, 'live', ?, ?, ?, ?, ?, ?, ?)")
    .run(
      changeId,
      `k${changeId}`,
      at.toISOString(),
      values.type ?? "cancelled",
      values.division ?? "Larry Page 2025",
      values.summary ?? "Maths cancelled",
      values.previous ? JSON.stringify(values.previous) : null,
      values.next ? JSON.stringify(values.next) : null,
    );
}

describe("phone app pushes", () => {
  it("baselines on the first run instead of replaying the change log", async () => {
    const sql = sqliteDb();
    addDevice(sql, "ExponentPushToken[aaaaaaaaaa]", { division: "Larry Page 2025" });
    addChange(sql, later(-30), {});
    const fake = fakeSend();
    const result = await sendAppPushes(sql, T0, [], fake.send);
    assert.equal(fake.all().length, 0);
    assert.equal(result.changes, 0);
    const state = await sql.all<{ changes_after: string }>("SELECT changes_after FROM app_push_state");
    assert.equal(state[0]?.changes_after, T0.toISOString());
  });

  it("sends a new change to that cohort only, once, and folds several into one message", async () => {
    const sql = sqliteDb();
    addDevice(sql, "ExponentPushToken[larry12345]", { division: "Larry Page 2025" });
    addDevice(sql, "ExponentPushToken[sam1234567]", { division: "Sam Altman 2025" });
    await sendAppPushes(sql, T0, [], fakeSend().send);

    addChange(sql, later(1), { summary: "Maths cancelled" });
    addChange(sql, later(2), { type: "room_change", summary: "Physics moved to Cr 5" });
    addChange(sql, later(2), { type: "unknown_bookkeeping", summary: "ignored" });
    const fake = fakeSend();
    await sendAppPushes(sql, later(3), [], fake.send);
    const messages = fake.all();
    assert.equal(messages.length, 1);
    assert.equal(messages[0]!.to, "ExponentPushToken[larry12345]");
    assert.equal(messages[0]!.body, "2 updates. Physics moved to Cr 5");
    assert.equal(messages[0]!.channelId, "changes");

    const again = fakeSend();
    await sendAppPushes(sql, later(4), [], again.send);
    assert.equal(again.all().length, 0, "a change is pushed once");
  });

  it("matches faculty through the shared faculty rule and names the cohort", async () => {
    const sql = sqliteDb();
    addDevice(sql, "ExponentPushToken[aarti12345]", { role: "faculty", faculty: "Dr. Aarti Pardesi" });
    addDevice(sql, "ExponentPushToken[other12345]", { role: "faculty", faculty: "Prof. Vinaya" });
    await sendAppPushes(sql, T0, [], fakeSend().send);
    addChange(sql, later(1), { type: "faculty_change", summary: "AI Tools now with Dr. Aarti", previous: { faculty: "Mr. Lovesh" }, next: { faculty: "Dr. Aarti P & Ms. Kashmira" } });
    const fake = fakeSend();
    await sendAppPushes(sql, later(2), [], fake.send);
    const messages = fake.all();
    assert.deepEqual(
      messages.map((message) => message.to),
      ["ExponentPushToken[aarti12345]"],
    );
    assert.equal(messages[0]!.title, "Larry Page");
  });

  it("skips changes the job found too late and deletes tokens Expo no longer knows", async () => {
    const sql = sqliteDb();
    addDevice(sql, "ExponentPushToken[gone123456]", { division: "Larry Page 2025" });
    await sendAppPushes(sql, T0, [], fakeSend().send);
    addChange(sql, later(1), {});
    const dead = fakeSend(["ExponentPushToken[gone123456]"]);
    const result = await sendAppPushes(sql, later(2), [], dead.send);
    assert.equal(result.removed, 1);
    assert.equal((await sql.all("SELECT token FROM app_push_devices")).length, 0);

    addDevice(sql, "ExponentPushToken[late123456]", { division: "Larry Page 2025" });
    addChange(sql, later(3), {});
    const late = fakeSend();
    await sendAppPushes(sql, later(3 + 7 * 60), [], late.send);
    assert.equal(late.all().length, 0, "seven hours late is old news");
  });

  it("sends notices to students of that course and batch, not to faculty", async () => {
    const sql = sqliteDb();
    addDevice(sql, "ExponentPushToken[btech25xxx]", { course: "BTech", batch: "2025-29", division: "Larry Page 2025" });
    addDevice(sql, "ExponentPushToken[mca25xxxxx]", { course: "MCA", batch: "2025-27", division: "Ada 2025" });
    addDevice(sql, "ExponentPushToken[teacherxxx]", { role: "faculty", faculty: "Prof. Vinaya" });
    const fake = fakeSend();
    const result = await sendAppPushes(sql, T0, [{ id: "n1", title: "Exam on Monday", body: "Hall 2", course: "BTech", batch: "2025-29" }], fake.send);
    assert.deepEqual(
      fake.all().map((message) => [message.to, message.channelId]),
      [["ExponentPushToken[btech25xxx]", "notices"]],
    );
    assert.equal(result.notices, 1);
  });
});

describe("app push routes", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) => ({
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  it("stores a student device and refuses a token that is not Expo's", async () => {
    const t = makeEnv();
    const ok = await t.call("/api/push/app-register", post({ token: "ExponentPushToken[abcdef123456]", role: "student", course: "BTech", batch: "2025-29", division: "Larry Page 2025" }));
    assert.equal(ok.status, 200);
    const rows = t.raw.prepare("SELECT role, division FROM app_push_devices").all() as Array<{ role: string; division: string }>;
    assert.deepEqual(rows.map((row) => [row.role, row.division]), [["student", "Larry Page 2025"]]);
    const bad = await t.call("/api/push/app-register", post({ token: "https://evil.example/push", division: "X" }));
    assert.equal(bad.status, 400);
  });

  it("takes a faculty name from the session, never the body", async () => {
    const t = makeEnv();
    const noSession = await t.call("/api/push/app-register", post({ token: "ExponentPushToken[facultyxxxx1]", role: "faculty", faculty: "Prof. Vinaya" }));
    assert.equal(noSession.status, 401);
    const token = await signSession(SECRET, { email: "aarti@itm.edu", faculty: "Dr. Aarti Pardesi", canSeeAllFaculty: false });
    const ok = await t.call("/api/push/app-register", post({ token: "ExponentPushToken[facultyxxxx1]", role: "faculty", faculty: "Prof. Vinaya" }, { Authorization: `Bearer ${token}` }));
    assert.equal(ok.status, 200);
    const row = t.raw.prepare("SELECT faculty FROM app_push_devices").get() as { faculty: string };
    assert.equal(row.faculty, "Dr. Aarti Pardesi");
    const off = await t.call("/api/push/app-unregister", post({ token: "ExponentPushToken[facultyxxxx1]" }));
    assert.equal(off.status, 200);
    assert.equal(t.raw.prepare("SELECT COUNT(*) AS n FROM app_push_devices").get()!.n, 0);
  });
});
