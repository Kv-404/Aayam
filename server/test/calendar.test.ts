import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarFile } from "../../shared/calendar.ts";
import type { PublicLecture } from "../../shared/types.ts";

// DTSTAMP is the first class day at midnight UTC, not the time of the run.
const lecture = (date: string, id: string) =>
  ({
    id,
    date,
    division: "BTech 2025",
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    startLabel: "9:00",
    endLabel: "10:00",
    subject: "Maths",
    faculty: "Dr. A",
    room: "Cr 20",
    kind: "lecture",
    displayStatus: "scheduled",
  }) as unknown as PublicLecture;

describe("calendar feed", () => {
  it("does not depend on the wall clock, so the job only rewrites it when classes change", () => {
    const lectures = [lecture("2026-10-14", "b"), lecture("2026-10-12", "a")];
    const first = calendarFile(lectures, "Asia/Kolkata", "Test");
    assert.equal(calendarFile(lectures, "Asia/Kolkata", "Test"), first);
    assert.match(first, /DTSTAMP:20261012T000000Z/);
  });
});
