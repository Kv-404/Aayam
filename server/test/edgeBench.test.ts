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
