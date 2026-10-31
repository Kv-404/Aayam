import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase, readWeekBackups, type StoredChange } from "../src/db.ts";
import type { StoredLecture } from "../src/model.ts";
import { archiveToRows, rowsToArchive } from "../src/services/neonRows.ts";
import type { TimetableArchive } from "../src/services/timetableArchive.ts";
import { changesForWeek, rememberPublishedWeeks, rememberReplacedWeeks, weeksFromLectures } from "../src/services/weekBackup.ts";

function lecture(id: string, overrides: Partial<StoredLecture> = {}): StoredLecture {
  return {
    id,
    slotKey: id,
    tabName: "Monday",
    course: "BTech",
    semester: "3",
    batch: "2025-29",
    division: "Sam Altman 2025",
    date: "2026-10-26",
    weekday: "Monday",
    startMinutes: 540,
    endMinutes: 600,
    startLabel: "9:00 AM",
    endLabel: "10:00 AM",
    subject: "DSA",
    faculty: "Dr. Aarti",
    room: "Classroom - 38",
    kind: "lecture",
    sourceStatus: "scheduled",
    reason: null,
    explicitMark: null,
    recurring: false,
    anchor: {
      subject: "DSA",
      faculty: "Dr. Aarti",
      room: "Classroom - 38",
      startMinutes: 540,
      endMinutes: 600,
      startLabel: "9:00 AM",
      endLabel: "10:00 AM",
      sourceStatus: "scheduled",
      reason: "",
      kind: "lecture",
      explicitMark: null,
    },
    highlight: null,
    ...overrides,
  };
}

function change(overrides: Partial<StoredChange> = {}): StoredChange {
  return {
    id: 1,
    dedupeKey: "room-1",
    detectedAt: "2026-10-26T04:00:00.000Z",
    type: "room_change",
    lectureId: "a",
    division: "Sam Altman 2025",
    course: "BTech",
    semester: "3",
    tabName: "Monday",
    date: "2026-10-26",
    weekday: "Monday",
    summary: "Room changed.",
    previous: { room: "Classroom - 38" },
    next: { room: "Classroom - 40" },
    fields: ["room"],
    ...overrides,
  };
}

describe("saved weeks", () => {
  it("keeps an outgoing week and the updates that belonged to it", () => {
    const db = openDatabase(":memory:");
    const previous = [lecture("a"), lecture("b", { division: "Jeff Bezos 2025", batch: "2025-29" })];
    const next = [lecture("c", { date: "2026-11-02", subject: "ML" })];
    rememberReplacedWeeks(db, previous, next, [change(), change({ id: 2, dedupeKey: "other", date: "2026-11-02", division: "Sam Altman 2025" })]);
    const saved = readWeekBackups(db);
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.start, "2026-10-26");
    assert.equal(saved[0]?.lectures.length, 2);
    assert.deepEqual(saved[0]?.changes.map((item) => item.dedupeKey), ["room-1"]);
  });

  it("updates the published week in place and still keeps the older one", () => {
    const db = openDatabase(":memory:");
    rememberReplacedWeeks(db, [lecture("old", { date: "2026-10-26" })], [lecture("live", { date: "2026-11-02" })], [change()]);
    rememberPublishedWeeks(db, [lecture("live", { date: "2026-11-02", subject: "ML" }), lecture("live-2", { id: "live-2", date: "2026-11-03" })]);
    const saved = readWeekBackups(db);
    assert.equal(saved.length, 2);
    const current = saved.find((week) => week.start === "2026-11-02");
    const past = saved.find((week) => week.start === "2026-10-26");
    assert.equal(current?.lectures.length, 2);
    assert.equal(current?.end, "2026-11-03");
    assert.equal(past?.changes.length, 1);
    assert.equal(past?.lectures[0]?.subject, "DSA");
  });

  it("stores each update and each lecture as its own row", () => {
    const older = lecture("old", { date: "2026-10-26" });
    const live = lecture("live", { date: "2026-11-02", subject: "ML" });
    const weeks = weeksFromLectures([older]);
    const archived = weeks[0]!;
    archived.changes = changesForWeek(archived, [change()], weeks);
    const archive: TimetableArchive = {
      version: 1,
      savedAt: "2026-11-02T01:00:00.000Z",
      lectures: [live],
      changes: [],
      sync: {
        lastSuccessAt: "2026-11-02T01:00:00.000Z",
        lastAttemptAt: "2026-11-02T01:00:00.000Z",
        lastError: null,
        bootstrapped: true,
        contentHash: "hash",
        tabNames: ["Monday"],
        parseIssues: [],
        spreadsheetTitle: "week",
      },
      weeks: [archived],
    };
    const rows = archiveToRows(archive);
    assert.equal(rows.lectures.length, 2);
    assert.equal(rows.changes.length, 1);
    assert.equal(rows.changes[0]?.week_id, archived.id);
    assert.notEqual(rows.lectures[0]?.week_id, rows.lectures[1]?.week_id);
    const restored = rowsToArchive(archive.savedAt, archive.sync, rows);
    const saved = restored.weeks?.[0];
    assert.equal(restored.lectures[0]?.subject, "ML");
    assert.equal(saved?.lectures[0]?.subject, "DSA");
    assert.equal(saved?.changes[0]?.summary, "Room changed.");
    assert.equal(saved?.changes[0]?.next?.room, "Classroom - 40");
  });
});
