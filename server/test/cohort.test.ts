import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cohortChoices, cohortLabel, cohortPrograms, cohortYears, cohortsInYear, lectureInCohort } from "../../shared/cohort.ts";
import { defaultBatchCode, normalizeBatchCode } from "../../shared/batchCode.ts";
import { dropFreshProgramAdditions } from "../src/services/syncScheduler.ts";

describe("cohorts across programs", () => {
  const lectures = [
    { division: "Steve Jobs", course: "BTech", batch: "2023-27", semester: "7" },
    { division: "Steve Jobs (AI/DS)", course: "BTech", batch: "2023-27", semester: "7" },
    { division: "Steve Jobs (Cyber-Sec)", course: "BTech", batch: "2023-27", semester: "7" },
    { division: "Sam Altman 2025", course: "BTech", batch: "2025-29", semester: "3" },
    { division: "Geoffrey Hinton", course: "MCA", batch: "2026-28", semester: "1" },
  ];

  it("groups by program and batch, and shares the unspecialized column with each track", () => {
    const choices = cohortChoices(lectures);
    assert.deepEqual(choices.map((choice) => choice.division), [
      "Sam Altman 2025",
      "Steve Jobs (AI/DS)",
      "Steve Jobs (Cyber-Sec)",
      "Geoffrey Hinton",
    ]);
    const ai = choices.find((choice) => choice.division === "Steve Jobs (AI/DS)");
    assert.deepEqual(ai?.also, ["Steve Jobs"]);
    assert.equal(cohortLabel("Steve Jobs (AI/DS)"), "Steve Jobs · AI/DS");
    assert.equal(cohortLabel("Sam Altman 2025"), "Sam Altman");
    assert.equal(lectureInCohort({ division: "Steve Jobs", course: "BTech", batch: "2023-27" }, ai!), true);
    assert.equal(lectureInCohort({ division: "Steve Jobs (Cyber-Sec)", course: "BTech", batch: "2023-27" }, ai!), false);
    assert.equal(lectureInCohort(lectures[3]!, choices[0]!), true);
  });

  it("lists only the cohorts of the year that was pressed", () => {
    const choices = cohortChoices([
      ...lectures,
      { division: "Tim Cook", course: "BTech", batch: "2026-30", semester: "1" },
      { division: "Jeff Bezos 2025", course: "BTech", batch: "2025-29", semester: "3" },
      { division: "Larry Page 2025", course: "BTech", batch: "2025-29", semester: "3" },
      { division: "Demis Hassabis 2025", course: "BTech", batch: "2025-29", semester: "3" },
      { division: "Elon Musk 2024", course: "BTech", batch: "2024-28", semester: "5" },
    ]);
    assert.deepEqual(cohortPrograms(choices), ["BTech", "MCA"]);
    assert.deepEqual(cohortYears(choices, "BTech"), ["2026-30", "2025-29", "2024-28", "2023-27"]);
    assert.deepEqual(cohortYears(choices, "MCA"), ["2026-28"]);
    assert.deepEqual(
      cohortsInYear(choices, "BTech", "2025-29").map((choice) => choice.division),
      ["Demis Hassabis 2025", "Jeff Bezos 2025", "Larry Page 2025", "Sam Altman 2025"],
    );
  });

  it("treats a program that was not on the previous week as a baseline", () => {
    const events = dropFreshProgramAdditions(
      [{ course: "BTech", batch: "2025 - 29" }],
      [
        { id: "kept", course: "BTech", batch: "2025-29" },
        { id: "fresh", course: "MCA", batch: "2026-28" },
      ],
      [
        { type: "added", lectureId: "kept", dedupeKey: "", detectedAt: "", division: null, course: null, semester: null, tabName: null, date: null, weekday: null, summary: "", previous: null, next: null, fields: [] },
        { type: "added", lectureId: "fresh", dedupeKey: "", detectedAt: "", division: null, course: null, semester: null, tabName: null, date: null, weekday: null, summary: "", previous: null, next: null, fields: [] },
        { type: "changed", lectureId: "kept", dedupeKey: "", detectedAt: "", division: null, course: null, semester: null, tabName: null, date: null, weekday: null, summary: "", previous: null, next: null, fields: [] },
      ],
    );
    assert.deepEqual(events.map((event) => `${event.type}:${event.lectureId}`), ["added:kept", "changed:kept"]);
  });

  it("generates correct 6-digit access codes for each batch", () => {
    assert.equal(defaultBatchCode("BTech", "2026-30"), "202630");
    assert.equal(defaultBatchCode("BTech", "2025-29"), "202529");
    assert.equal(defaultBatchCode("BTech", "2024-28"), "202428");
    assert.equal(defaultBatchCode("BTech", "2023-27"), "202327");
    assert.equal(defaultBatchCode("MCA", "2026-28"), "202628");
    assert.equal(normalizeBatchCode(" 202-529 "), "202529");
  });
});