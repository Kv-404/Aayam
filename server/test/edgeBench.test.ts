import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scopeKey } from "../../shared/scope.ts";
import { assembleBootstrap, bootstrapEtag, todayIn } from "../src/edge/read.ts";

/** Workers Free allows 10 ms of CPU per request. The per-request bootstrap work must be a small slice of it. */

function bootBody(targetBytes: number) {
  const lectures = [];
  let size = 0;
  for (let i = 0; size < targetBytes; i++) {
    const lecture = {
      id: `lec-${i}`,
      slotKey: `Monday|2026-11-16|Sam Altman 2025|${540 + i}`,
      tabName: "Monday",
      course: "BTech",
      semester: "3",
      batch: "2025-29",
      division: "Sam Altman 2025",
      date: "2026-11-16",
      weekday: "Monday",
      startMinutes: 540,
      endMinutes: 600,
      startLabel: "9:00 AM",
      endLabel: "10:00 AM",
      subject: `Data Structures ${i}`,
      faculty: "Dr. Aarti Pardesi & Ms. Kashmira",
      room: "Classroom - 12",
      kind: "lecture",
      displayStatus: "scheduled",
      previous: null,
    };
    size += JSON.stringify(lecture).length + 1;
    lectures.push(lecture);
  }
  return JSON.stringify({ collegeName: "College", schoolName: "School", lectures, changes: [], choices: [], faculties: [] });
}

describe("edge bootstrap CPU", () => {
  it("assembles a ~400 KB bootstrap well inside the 10 ms Workers Free budget", () => {
    const boot = bootBody(400 * 1024);
    assert.ok(boot.length > 400 * 1024 && boot.length < 450 * 1024);
    const sync = JSON.stringify({ lastSuccessAt: new Date().toISOString(), lastError: null, stale: false, tabNames: ["Monday", "Tuesday"] });
    const index = {
      choices: Array.from({ length: 16 }, (_, i) => ({ division: `Division ${i} 2025`, course: "BTech", batch: "2025-29", semester: "3", also: [] })),
      faculties: Array.from({ length: 120 }, (_, i) => `Dr. Person${i} Surname`),
    };
    const notices = JSON.stringify([{ id: "n1", title: "Hello", body: "World", createdAt: new Date().toISOString() }]);
    const encoder = new TextEncoder();
    const runs = 1000;
    let bytes = 0;

    const once = () => {
      const scope = scopeKey({ faculty: "Dr. Person119 S & Ms. Nobody" }, index);
      const today = todayIn("Asia/Kolkata");
      const body = assembleBootstrap({ now: new Date().toISOString(), today, syncBody: sync, refreshing: false, noticesJson: notices, bootBody: boot });
      bootstrapEtag("bootHash", "syncHash", "n1", today + scope);
      // The runtime encodes the body to UTF-8 on the way out; count that too.
      bytes += encoder.encode(body).length;
    };
    for (let i = 0; i < 50; i++) once();
    JSON.parse(assembleBootstrap({ now: "n", today: "t", syncBody: sync, refreshing: true, noticesJson: notices, bootBody: boot }));

    const start = process.cpuUsage();
    for (let i = 0; i < runs; i++) once();
    const used = process.cpuUsage(start);
    const averageMs = (used.user + used.system) / 1000 / runs;
    console.log(`[bench] bootstrap assembly: ${averageMs.toFixed(3)} ms CPU average over ${runs} runs, ${(boot.length / 1024).toFixed(0)} KB body`);
    assert.ok(bytes > 0);
    // ~0.3 ms locally, ~1 ms on shared CI runners. 3 ms still leaves a wide margin under 10 ms.
    assert.ok(averageMs < 3, `average ${averageMs} ms`);
  });
});

describe("edge MCP tool CPU", () => {
  /** A faculty `boot:` row of ~50 KB and the full 200-row `changes` snapshot: the heaviest tool reads both. */
  function lectureRows(targetBytes: number) {
    const lectures = [];
    let size = 0;
    for (let i = 0; size < targetBytes; i++) {
      const lecture = {
        id: `lec-${i}`,
        slotKey: `Monday|2026-11-16|Sam Altman 2025|${540 + i}`,
        tabName: "Monday",
        course: "BTech",
        semester: "3",
        batch: "2025-29",
        division: i % 2 ? "Sam Altman 2025" : "Jeff Bezos 2025",
        date: `2026-11-${String(16 + (i % 6)).padStart(2, "0")}`,
        weekday: "Monday",
        startMinutes: 540 + (i % 8) * 60,
        endMinutes: 600 + (i % 8) * 60,
        startLabel: "9:00 AM",
        endLabel: "10:00 AM",
        subject: `Data Structures ${i}`,
        faculty: "Dr. Aarti Pardesi & Ms. Kashmira",
        room: `Classroom - ${i % 30}`,
        kind: "lecture",
        sourceStatus: "scheduled",
        displayStatus: i % 9 ? "scheduled" : "cancelled",
        reason: null,
        previous: null,
        changeDetectedAt: null,
        changeSummary: null,
        explicitMark: null,
        recurring: false,
      };
      size += JSON.stringify(lecture).length + 1;
      lectures.push(lecture);
    }
    return lectures;
  }

  it("answers get_timetable_changes (the heaviest tool) in well under 10 ms of CPU", async () => {
    const { handleRpc } = await import("../src/edge/mcp.ts");
    const { signMcpAccessToken, verifyMcpAccessToken } = await import("../src/edge/oauthStore.ts");
    const secret = "bench-secret-that-is-at-least-32-characters";
    const lectures = lectureRows(50 * 1024);
    const boot = JSON.stringify({ collegeName: "College", weekStart: "2026-11-16", weekEnd: "2026-11-21", lectures, changes: [], choices: [], faculties: [] });
    const changes = JSON.stringify({
      changes: Array.from({ length: 200 }, (_, i) => ({
        id: 200 - i,
        detectedAt: new Date(Date.UTC(2026, 10, 16, 6, i)).toISOString(),
        type: i % 3 ? "room_change" : "cancelled",
        lectureId: `lec-${i * 3}`,
        division: i % 2 ? "Sam Altman 2025" : "Jeff Bezos 2025",
        course: "BTech",
        semester: "3",
        tabName: "Monday",
        date: "2026-11-16",
        weekday: "Monday",
        summary: `Data Structures ${i} moved from Classroom - 12 to Classroom - 14.`,
        previous: { subject: `Data Structures ${i}`, faculty: i % 4 ? "Prof. Karan" : "Dr. Aarti Pardesi", room: "Classroom - 12", startLabel: "9:00 AM", endLabel: "10:00 AM" },
        next: { subject: `Data Structures ${i}`, faculty: "Prof. Karan", room: "Classroom - 14", startLabel: "9:00 AM", endLabel: "10:00 AM" },
        fields: ["room"],
      })),
    });
    const index = {
      choices: Array.from({ length: 16 }, (_, i) => ({ division: `Division ${i} 2025`, course: "BTech", batch: "2025-29", semester: "3", also: [] })),
      faculties: [...Array.from({ length: 120 }, (_, i) => `Dr. Person${i} Surname`), "Dr. Aarti Pardesi"],
      batches: [],
      timezone: "Asia/Kolkata",
    };
    const io = {
      async snapshots(keysFor: (current: typeof index) => string[], fixed: string[] = []) {
        const bodies = new Map<string, string>();
        for (const key of [...fixed, ...keysFor(index)]) bodies.set(key, key === "changes" ? changes : boot);
        return { index, bodies };
      },
      weekSummary: async () => ({ weekStart: null, weekEnd: null, savedWeeks: null, divisions: null, sync: null }),
      roomUse: async () => ({ rooms: [], busy: [] }),
      directory: async () => [],
      requestSync: async () => ({ dispatched: false }),
    };
    const identity = { id: 1, email: "a@itm.edu", facultyName: "Dr. Aarti Pardesi", canSeeAllFaculty: true, coordinatorCohorts: [] };
    const { token } = await signMcpAccessToken(secret, {
      iss: "https://x.test",
      aud: "https://x.test/mcp",
      faculty: identity,
      scopes: ["timetable:read", "faculty:self", "faculty:all"],
      clientId: "c",
    });
    const request = JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "get_timetable_changes", arguments: { scope: "mine", limit: 100 } } });
    const cohortRequest = JSON.stringify({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "get_faculty_schedule", arguments: { faculty: "Ms. Kashmira" } } });

    const once = async (body: string) => {
      const payload = await verifyMcpAccessToken(secret, token);
      assert.ok(payload);
      const reply = await handleRpc(JSON.parse(body), {
        auth: { token, clientId: "c", scopes: payload.scopes, expiresAt: payload.exp, resource: payload.aud, identity, jti: payload.jti },
        io,
        origin: "https://x.test",
        timezone: "Asia/Kolkata",
        now: new Date(),
      });
      return JSON.stringify(reply);
    };
    const first = JSON.parse(await once(request));
    assert.ok(JSON.parse(first.result.content[0].text).count > 0);
    assert.ok(JSON.parse(JSON.parse(await once(cohortRequest)).result.content[0].text).totalClasses > 0);
    for (let i = 0; i < 20; i++) await once(request);

    for (const [name, body] of [["get_timetable_changes", request], ["get_faculty_schedule", cohortRequest]] as const) {
      const runs = 200;
      const start = process.cpuUsage();
      for (let i = 0; i < runs; i++) await once(body);
      const used = process.cpuUsage(start);
      const averageMs = (used.user + used.system) / 1000 / runs;
      console.log(`[bench] MCP ${name}: ${averageMs.toFixed(3)} ms CPU average over ${runs} runs (${(boot.length / 1024).toFixed(0)} KB boot, ${(changes.length / 1024).toFixed(0)} KB changes)`);
      assert.ok(averageMs < 3, `${name} average ${averageMs} ms`);
    }
  });
});
