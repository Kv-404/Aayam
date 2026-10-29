import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanSpreadsheetId,
  parseSheetEntry,
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

  it("parses SPREADSHEET_IDS entries with URLs and course/batch metadata", () => {
    const parsed1 = parseSheetEntry("https://docs.google.com/spreadsheets/d/abc-123/edit:BTech:2026-30");
    assert.equal(parsed1.id, "abc-123");
    assert.equal(parsed1.course, "BTech");
    assert.equal(parsed1.batch, "2026-30");

    const parsed2 = parseSheetEntry("custom-id:2024-28");
    assert.equal(parsed2.id, "custom-id");
    assert.equal(parsed2.batch, "2024-28");

    const parsed3 = parseSheetEntry("https://docs.google.com/spreadsheets/d/mca-sheet-id/edit");
    assert.equal(parsed3.id, "mca-sheet-id");
  });

  it("allows setting cohort links via environment variables without losing cohort divisions", () => {
    const origEnv = { ...process.env };
    try {
      process.env.SPREADSHEET_BTECH_2026_30 = "https://docs.google.com/spreadsheets/d/custom-y1-id/edit";
      process.env.SPREADSHEET_MCA_2026_28 = "custom-mca-id";

      const sources = sheetSources();
      const y1 = sources.find((s) => s.batch === "2026-30");
      assert.ok(y1);
      assert.equal(y1.id, "custom-y1-id");
      assert.ok(y1.divisions?.includes("Andrew NG"));

      const mca = sources.find((s) => s.course === "MCA");
      assert.ok(mca);
      assert.equal(mca.id, "custom-mca-id");
      assert.ok(mca.divisions?.includes("Geoffrey Hinton"));

      // Matching cohort returns the custom configured sheet
      const matched = sheetForScope({ division: "Andrew NG" }, sources);
      assert.equal(matched?.id, "custom-y1-id");
    } finally {
      process.env = origEnv;
    }
  });
});
