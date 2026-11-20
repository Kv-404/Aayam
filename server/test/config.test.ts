import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanSpreadsheetId,
  COHORT_TEMPLATES,
  primarySheetId,
  sheetForScope,
  sheetSources,
  spreadsheetExportUrl,
  spreadsheetUrl,
} from "../src/config.ts";

describe("cohort sheet config", () => {
  it("extracts spreadsheet ID from various Google Sheets URLs and bare IDs", () => {
    assert.equal(
      cleanSpreadsheetId("https://docs.google.com/spreadsheets/d/15v70vR-WThtqWvdA84HwtddenAPKnF-s1mU3xl1RHCM/edit?gid=0#gid=0"),
      "15v70vR-WThtqWvdA84HwtddenAPKnF-s1mU3xl1RHCM",
    );
    assert.equal(
      cleanSpreadsheetId("https://docs.google.com/spreadsheets/u/1/d/1p3Rjmg-PTjxl-XgWfLbKVzItXq1waoEFvIWo3DpAvpw/edit"),
      "1p3Rjmg-PTjxl-XgWfLbKVzItXq1waoEFvIWo3DpAvpw",
    );
    assert.equal(
      cleanSpreadsheetId("https://docs.google.com/spreadsheets/d/1Fzv6FWD0EAWWZFcByFkEYTyIu3eMS4tM3BEkW2Gl1j8/export?format=xlsx"),
      "1Fzv6FWD0EAWWZFcByFkEYTyIu3eMS4tM3BEkW2Gl1j8",
    );
    assert.equal(
      cleanSpreadsheetId("  1J8MbPOqIRVeHQYmc1ukK9tx_1ZL1jmcYLpHmrjYtPAQ  "),
      "1J8MbPOqIRVeHQYmc1ukK9tx_1ZL1jmcYLpHmrjYtPAQ",
    );
  });

  it("builds valid edit and export URLs even if passed a full URL", () => {
    const raw = "https://docs.google.com/spreadsheets/d/my-sheet-id/edit?gid=123";
    assert.equal(spreadsheetUrl(raw), "https://docs.google.com/spreadsheets/d/my-sheet-id/edit");
    assert.equal(spreadsheetExportUrl(raw), "https://docs.google.com/spreadsheets/d/my-sheet-id/export?format=xlsx");
  });

  it("builds sources only from D1 sheet link rows, keeping cohort divisions", () => {
    const y1 = "1o_sNayHt8v4WlyZUVcmPWhyjNQ6i8ONuX2zMo5czg0w";
    const mcaId = "custom-mca-sheet-id-000000000";
    const { sources, missing } = sheetSources([
      { course: "btech", batch: "2026-30", spreadsheet_id: `https://docs.google.com/spreadsheets/d/${y1}/edit` },
      { course: "MCA", batch: "2026-28", spreadsheet_id: mcaId },
      { course: "BTech", batch: "2024-28", spreadsheet_id: "javascript:alert(1)" },
      { course: "BTech", batch: "1999-03", spreadsheet_id: "unknown-batch-sheet-id-0000000" },
    ]);
    assert.deepEqual(sources.map((s) => `${s.course} ${s.batch} ${s.id}`), [`BTech 2026-30 ${y1}`, `MCA 2026-28 ${mcaId}`]);
    assert.ok(sources[0]!.divisions?.includes("Andrew NG"));
    assert.ok(sources[1]!.divisions?.includes("Geoffrey Hinton"));
    assert.deepEqual(missing.map((t) => t.batch), ["2025-29", "2024-28", "2023-27"]);
    assert.equal(missing.length + sources.length, COHORT_TEMPLATES.length);
    assert.equal(sheetForScope({ division: "Andrew NG" }, sources)?.id, y1);
    assert.equal(primarySheetId(sources), y1);
    assert.equal(primarySheetId([]), "");
  });

  it("ignores sheet env variables", () => {
    const origEnv = { ...process.env };
    try {
      process.env.SPREADSHEET_BTECH_2026_30 = "custom-y1-id-from-env-0000000";
      process.env.SPREADSHEET_IDS = "custom-id-from-env-000000000:2024-28";
      assert.deepEqual(sheetSources([]).sources, []);
    } finally {
      process.env = origEnv;
    }
  });
});
