import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import ExcelJS from "exceljs";
import { getConfig, type AppConfig } from "../src/config.ts";
import { sqliteDb } from "../src/d1/sqlite.ts";
import { clearIndexCache } from "../src/edge/read.ts";
import { allowedScopesForIdentity, signMcpAccessToken, type McpFacultyIdentity } from "../src/edge/oauthStore.ts";
import { openWorkingDb, runJob } from "../src/job/pipeline.ts";
import { makeEnv, SECRET, stubFetch, type TestEnv } from "./helpers/edgeEnv.ts";

const BASE = "https://timetable.test";

async function makeMultiCohortWorkbook(aartiRoom = "Classroom - 18") {
  const wb = new ExcelJS.Workbook();
  const monday = wb.addWorksheet("Monday");
  monday.getCell("A1").value = "SEMESTER - 3";
  monday.getCell("A2").value = "16/11/2026 (Monday)";
  monday.getCell("A3").value = "Timing";
  monday.getCell("B3").value = "Sam Altman 2025";
  monday.getCell("C3").value = "Jeff Bezos 2025";

  monday.getCell("A4").value = "9:00 AM - 10:00 AM";
  monday.getCell("B4").value = "Data Structures";
  monday.getCell("C4").value = "Operating Systems";
  monday.getCell("A5").value = "Faculty";
  monday.getCell("B5").value = "Dr. Aarti P";
  monday.getCell("C5").value = "Prof. Karan";
  monday.getCell("A6").value = "Classroom No";
  monday.getCell("B6").value = aartiRoom;
  monday.getCell("C6").value = "Classroom - 22";

  monday.getCell("A8").value = "10:00 AM - 11:00 AM";
  monday.getCell("B8").value = "Machine Learning";
  monday.getCell("A9").value = "Faculty";
  monday.getCell("B9").value = "Prof. Karan";
  monday.getCell("A10").value = "Classroom No";
  monday.getCell("B10").value = "Classroom - 19";
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const DIRECTORY = [
  { id: 1, email: "test-faculty@itm.edu", faculty_name: "Dr. Aarti Pardesi", can_see_all_faculty: 0, last_login_at: "2026-11-16T08:00:00Z" },
  { id: 2, email: "test-coord@itm.edu", faculty_name: "Harshita Deshmukh", can_see_all_faculty: 0, last_login_at: "2026-11-16T09:00:00Z" },
  { id: 3, email: "test-dean@itm.edu", faculty_name: "Dr. Dipanjan", can_see_all_faculty: 1, last_login_at: "2026-11-16T10:00:00Z" },
];

/** The real sync job, writing snapshots into the Worker's D1, so the tools read what production reads. */
async function seedFromWorkbook(t: TestEnv, aartiRoom?: string) {
  const file = await makeMultiCohortWorkbook(aartiRoom);
  const config: AppConfig = {
    ...getConfig(),
    spreadsheets: [{ id: "sheet-mcp-test", course: "BTech", batch: "2025-29", divisions: ["Sam Altman 2025", "Jeff Bezos 2025"] }],
  };
  const result = await runJob({
    sql: sqliteDb(t.raw),
    databaseKey: "mcp-test",
    config,
    dataDir: null,
    workingDb: openWorkingDb(null),
    now: () => new Date("2026-11-16T06:00:00Z"),
    log: () => undefined,
    download: async () => file,
  });
  assert.equal(result.ok, true, result.error ?? "");
  const working = openWorkingDb(null);
  const rerun = async (room: string) => {
    const next = await makeMultiCohortWorkbook(room);
    const again = await runJob({ sql: sqliteDb(t.raw), databaseKey: "mcp-test", config, dataDir: null, workingDb: working, now: () => new Date("2026-11-16T07:00:00Z"), log: () => undefined, download: async () => next });
    assert.equal(again.ok, true, again.error ?? "");
    clearIndexCache();
  };
  for (const row of DIRECTORY) {
    t.raw
      .prepare("INSERT INTO faculty_directory (id, email, faculty_name, can_see_all_faculty, is_active, last_login_at) VALUES (?, ?, ?, ?, 1, ?)")
      .run(row.id, row.email, row.faculty_name, row.can_see_all_faculty, row.last_login_at);
  }
  return { rerun };
}

async function makeToken(identity: McpFacultyIdentity, base = BASE) {
  return (
    await signMcpAccessToken(SECRET, {
      iss: base,
      aud: `${base}/mcp`,
      faculty: identity,
      scopes: allowedScopesForIdentity(identity),
      clientId: "test-client",
    })
  ).token;
}

async function rpcCall(t: TestEnv, token: string, method: string, params: Record<string, unknown> = {}) {
  const res = await t.call("/mcp", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return { status: res.status, headers: res.headers, body: (await res.json()) as any };
}

const tool = async (t: TestEnv, token: string, name: string, args: Record<string, unknown> = {}) =>
  (await rpcCall(t, token, "tools/call", { name, arguments: args })).body.result as { isError?: boolean; content: Array<{ text: string }> };
const data = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0]!.text);

const regular: McpFacultyIdentity = { id: 1, email: "test-faculty@itm.edu", facultyName: "Dr. Aarti Pardesi", canSeeAllFaculty: false, coordinatorCohorts: [] };
const coordinator: McpFacultyIdentity = {
  id: 2,
  email: "test-coord@itm.edu",
  facultyName: "Harshita Deshmukh",
  canSeeAllFaculty: false,
  coordinatorCohorts: ["Andrew NG", "Sam Altman"],
};
const dean: McpFacultyIdentity = { id: 3, email: "test-dean@itm.edu", facultyName: "Dr. Dipanjan", canSeeAllFaculty: true, coordinatorCohorts: [] };

describe("Remote Streamable-HTTP MCP Server & Confidential RBAC", () => {
  beforeEach(() => clearIndexCache());

  it("enforces 401 discovery challenge, CORS, Origin checks, and method rules", async () => {
    const t = makeEnv();
    const unauth = await t.call("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://claude.ai" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    assert.equal(unauth.status, 401);
    assert.equal(unauth.headers.get("access-control-allow-origin"), "https://claude.ai");
    assert.match(unauth.headers.get("access-control-expose-headers") ?? "", /WWW-Authenticate/);
    assert.match(unauth.headers.get("www-authenticate") ?? "", /resource_metadata="https:\/\/timetable\.test\/\.well-known\/oauth-protected-resource"/);
    assert.equal(unauth.headers.get("cross-origin-resource-policy"), null);

    const preflight = await t.call("/mcp", { method: "OPTIONS", headers: { Origin: "https://claude.ai" } });
    assert.equal(preflight.status, 204);

    const evilOrigin = await t.call("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil-rebinding.example.com" },
      body: JSON.stringify({}),
    });
    assert.equal(evilOrigin.status, 403);

    // /api/mcp is the same endpoint.
    assert.equal((await t.call("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);

    await seedFromWorkbook(t);
    const token = await makeToken(regular);
    const get = await t.call("/mcp", { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(get.status, 405);
    assert.equal(get.headers.get("allow"), "POST, OPTIONS");
    const notJson = await t.call("/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" }, body: "{}" });
    assert.equal(notJson.status, 415);
    const garbage = await t.call("/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{" });
    assert.equal(garbage.status, 400);
    assert.equal(((await garbage.json()) as any).error.code, -32700);
    const notification = await t.call("/mcp", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    assert.equal(notification.status, 202);
    // A token for another audience is refused.
    const otherAudience = await makeToken(regular, "https://other.example.com");
    assert.equal((await rpcCall(t, otherAudience, "ping")).status, 401);
  });

  it("enforces faculty, coordinator, and all-access RBAC across MCP tools", async () => {
    const t = makeEnv();
    await seedFromWorkbook(t);
    const regularToken = await makeToken(regular);
    const coordinatorToken = await makeToken(coordinator);
    const allAccessToken = await makeToken(dean);

    const init = await rpcCall(t, regularToken, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    assert.equal(init.status, 200);
    assert.equal(init.body.result.serverInfo.name, "aayam-timetable");
    assert.equal(init.body.result.protocolVersion, "2025-11-25");
    assert.deepEqual(init.body.result.capabilities, { tools: { listChanged: true } });

    const toolsList = await rpcCall(t, regularToken, "tools/list");
    assert.equal(toolsList.status, 200);
    const tools = toolsList.body.result.tools as Array<{ name: string; inputSchema: any; annotations: any }>;
    assert.deepEqual(
      tools.map((item) => item.name),
      [
        "get_my_profile",
        "get_my_schedule",
        "get_cohort_timetable",
        "list_cohorts_and_weeks",
        "get_timetable_changes",
        "find_free_rooms_or_slots",
        "get_faculty_schedule",
        "list_faculty_directory",
        "get_calendar_subscription_info",
        "refresh_timetable_sync",
      ],
    );
    const cohortTool = tools.find((item) => item.name === "get_cohort_timetable")!;
    assert.deepEqual(cohortTool.inputSchema.required, ["division"]);
    assert.equal(cohortTool.inputSchema.properties.includeBreaks.default, false);
    assert.equal(tools.find((item) => item.name === "refresh_timetable_sync")!.annotations.readOnlyHint, false);

    const profile = data(await tool(t, regularToken, "get_my_profile"));
    assert.deepEqual(profile, { email: "test-faculty@itm.edu", facultyName: "Dr. Aarti Pardesi", canSeeAllFaculty: false, coordinatorCohorts: [], scopes: ["timetable:read", "faculty:self"] });

    // Regular faculty: own schedule, cohorts, free rooms. Not other faculty, the directory, or a sync.
    const mySched = await tool(t, regularToken, "get_my_schedule");
    assert.equal(mySched.isError, undefined);
    const myParsed = data(mySched);
    assert.equal(myParsed.totalClasses, 1);
    assert.equal(myParsed.lectures[0].subject, "Data Structures");
    assert.equal(myParsed.weekStart, "2026-11-16");

    assert.equal((await tool(t, regularToken, "get_faculty_schedule", { faculty: "Prof. Karan" })).isError, true);
    assert.equal((await tool(t, regularToken, "list_faculty_directory")).isError, true);
    assert.equal((await tool(t, regularToken, "refresh_timetable_sync")).isError, true);
    const own = data(await tool(t, regularToken, "get_faculty_schedule", { faculty: "Dr. Aarti P" }));
    assert.equal(own.scopeApplied, "self");
    assert.equal(own.totalClasses, 1);

    const roomsData = data(await tool(t, regularToken, "find_free_rooms_or_slots", { date: "2026-11-16", startTime: "9:00 AM", endTime: "10:00 AM" }));
    assert.deepEqual(roomsData.freeRooms, ["Classroom - 19"]);
    assert.deepEqual(roomsData.occupiedRooms, ["Classroom - 18", "Classroom - 22"]);
    assert.equal(roomsData.totalKnownRooms, 3);
    const mondayRooms = data(await tool(t, regularToken, "find_free_rooms_or_slots", { weekday: "mon", startTime: "10:30" }));
    assert.deepEqual(mondayRooms.freeRooms, ["Classroom - 18", "Classroom - 22"]);
    assert.equal((await tool(t, regularToken, "find_free_rooms_or_slots", { startTime: "noonish" })).isError, true);

    const cohort = data(await tool(t, regularToken, "get_cohort_timetable", { division: "sam altman" }));
    assert.equal(cohort.division, "Sam Altman 2025");
    assert.equal(cohort.course, "BTech");
    assert.equal(cohort.totalSlots, 2);
    assert.deepEqual(cohort.lectures.map((lecture: any) => lecture.subject), ["Data Structures", "Machine Learning"]);
    assert.equal((await tool(t, regularToken, "get_cohort_timetable", { division: "Nobody 2030" })).isError, true);
    const invalid = await tool(t, regularToken, "get_cohort_timetable", { date: "16/11/2026" });
    assert.equal(invalid.isError, true);
    assert.match(invalid.content[0]!.text, /Input validation error/);

    const listing = data(await tool(t, regularToken, "list_cohorts_and_weeks", { course: "btech" }));
    assert.deepEqual(listing.cohorts.map((item: any) => item.division).sort(), ["Jeff Bezos 2025", "Sam Altman 2025"]);
    assert.deepEqual(listing.currentWeek, { start: "2026-11-16", end: "2026-11-16" });
    assert.equal(listing.timezone, "Asia/Kolkata");
    assert.ok(listing.lastSyncedAt);
    assert.deepEqual(listing.savedWeeks, []);

    const changes = data(await tool(t, regularToken, "get_timetable_changes"));
    assert.equal(changes.scope, "mine");
    assert.ok(Array.isArray(changes.changes));
    assert.equal((await tool(t, regularToken, "get_timetable_changes", { scope: "all" })).isError, true);
    assert.equal((await tool(t, regularToken, "get_timetable_changes", { scope: "cohort" })).isError, true);

    const feed = data(await tool(t, regularToken, "get_calendar_subscription_info"));
    assert.equal(feed.feedUrl, `${BASE}/api/calendar.ics?faculty=Dr.%20Aarti%20Pardesi`);

    // Coordinator: Prof. Karan only in Sam Altman 2025, not Jeff Bezos 2025.
    const coordData = data(await tool(t, coordinatorToken, "get_faculty_schedule", { faculty: "Prof. Karan" }));
    assert.equal(coordData.scopeApplied, "coordinator_cohorts");
    assert.equal(coordData.totalClasses, 1);
    assert.equal(coordData.lectures[0].division, "Sam Altman 2025");
    assert.equal((await tool(t, coordinatorToken, "list_faculty_directory")).isError, true);
    assert.equal(data(await tool(t, coordinatorToken, "get_timetable_changes", { scope: "all" })).scope, "coordinator");

    // All-access: every lecture, the directory, and a sync request.
    const allData = data(await tool(t, allAccessToken, "get_faculty_schedule", { faculty: "Prof. Karan" }));
    assert.equal(allData.scopeApplied, "all_faculty");
    assert.equal(allData.totalClasses, 2);

    const dirData = data(await tool(t, allAccessToken, "list_faculty_directory"));
    assert.equal(dirData.total, 3);
    assert.ok(dirData.directory.some((row: any) => row.email === "test-dean@itm.edu" && row.can_see_all_faculty === true));
    assert.equal(data(await tool(t, allAccessToken, "list_faculty_directory", { search: "aarti" })).total, 1);

    const syncData = data(await tool(t, allAccessToken, "refresh_timetable_sync"));
    assert.equal(syncData.ok, true);
    const state = t.raw.prepare("SELECT requested_at FROM job_state WHERE id = 1").get() as { requested_at: string | null };
    assert.ok(state.requested_at, "a user sync request is recorded");
  });

  it("drops a deactivated faculty member and scopes they lost, on the next request", async () => {
    const t = makeEnv();
    await seedFromWorkbook(t);
    const token = await makeToken(dean);
    t.raw.prepare("UPDATE faculty_directory SET can_see_all_faculty = 0 WHERE id = 3").run();
    const profile = data(await tool(t, token, "get_my_profile"));
    assert.deepEqual(profile.scopes, ["timetable:read", "faculty:self"]);
    assert.equal((await tool(t, token, "list_faculty_directory")).isError, true);
    t.raw.prepare("UPDATE faculty_directory SET is_active = 0 WHERE id = 3").run();
    assert.equal((await rpcCall(t, token, "ping")).status, 401);
  });
});

describe("get_timetable_changes", () => {
  it("lists a room change under the faculty who teaches it, the cohort, and all", async () => {
    clearIndexCache();
    const t = makeEnv();
    const { rerun } = await seedFromWorkbook(t);
    await rerun("Classroom - 20");
    const mine = data(await tool(t, await makeToken(regular), "get_timetable_changes"));
    assert.ok(mine.count >= 1, JSON.stringify(mine));
    assert.ok(mine.changes.every((change: any) => change.division === "Sam Altman 2025"));
    assert.ok(mine.changes.some((change: any) => /room/i.test(change.type) || /Classroom - 20/.test(change.summary)));
    assert.equal(data(await tool(t, await makeToken(dean), "get_timetable_changes")).count, 0);
    const cohort = data(await tool(t, await makeToken(regular), "get_timetable_changes", { scope: "cohort", division: "Sam Altman 2025", limit: 1 }));
    assert.equal(cohort.count, 1);
    assert.equal(data(await tool(t, await makeToken(dean), "get_timetable_changes", { scope: "all" })).count, mine.count);
    const schedule = data(await tool(t, await makeToken(regular), "get_my_schedule"));
    assert.equal(schedule.lectures[0].room, "Classroom - 20");
  });
});

describe("refresh_timetable_sync dispatch", () => {
  let restore: (() => void) | null = null;
  afterEach(() => restore?.());

  it("dispatches the GitHub workflow once a minute", async () => {
    clearIndexCache();
    const t = makeEnv({ GITHUB_TOKEN: "gh-token" });
    await seedFromWorkbook(t);
    const stub = stubFetch(() => new Response(null, { status: 204 }));
    restore = stub.restore;
    const token = await makeToken(dean);
    assert.equal(data(await tool(t, token, "refresh_timetable_sync")).dispatched, true);
    assert.equal(data(await tool(t, token, "refresh_timetable_sync")).dispatched, false);
    assert.equal(stub.calls.filter((call) => call.url.includes("/dispatches")).length, 1);
  });
});
