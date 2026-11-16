import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { COHORT_TEMPLATES } from "../src/config.ts";
import { hashPassword, verifyPassword } from "../src/services/adminAuth.ts";
import { subscriptionMatches } from "../src/services/notices.ts";
import { acceptSpreadsheetId, mergeSheetOverrides } from "../src/services/sheetOverrides.ts";

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("admin password", () => {
  it("stores a hash that does not contain the password", async () => {
    const password = "correct horse battery";
    const hash = await hashPassword(password);
    assert.equal(hash.startsWith("scrypt$"), true);
    assert.equal(hash.includes(password), false);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword("wrong horse battery", hash), false);
    assert.equal(await verifyPassword(password, null), false);
    assert.equal(await verifyPassword(password, "scrypt$1$1$1$aa$bb"), false);
  });

  it("reads the password hash in one query and nowhere else", () => {
    const root = path.resolve(import.meta.dirname, "../src");
    const hits = sourceFiles(root).filter((file) => /SELECT\s+password_hash/i.test(fs.readFileSync(file, "utf8")));
    assert.deepEqual(
      hits.map((file) => path.basename(file)),
      ["adminAuth.ts"],
    );
  });
});

describe("sheet links", () => {
  it("accepts a Google Sheet link and refuses anything else", () => {
    assert.equal(
      acceptSpreadsheetId("https://docs.google.com/spreadsheets/d/1iglizdY-oldwwrpBDBy84EEYwtNhnv6mKkf9mFP8NZw/edit"),
      "1iglizdY-oldwwrpBDBy84EEYwtNhnv6mKkf9mFP8NZw",
    );
    assert.equal(acceptSpreadsheetId("javascript:alert(1)"), null);
    assert.equal(acceptSpreadsheetId("short"), null);
  });

  it("replaces one batch and keeps the others", () => {
    const base = COHORT_TEMPLATES.map((template) => ({
      id: template.fallbackId,
      course: template.course,
      batch: template.batch,
      divisions: template.divisions,
    }));
    const next = mergeSheetOverrides(base, [
      {
        course: "BTech",
        batch: "2025-29",
        spreadsheetId: "1AdminOverrideSheetIdForTests00000000001",
      },
    ]);
    const updated = next.find((sheet) => sheet.batch === "2025-29");
    const other = next.find((sheet) => sheet.batch === "2026-30");
    assert.equal(updated?.id, "1AdminOverrideSheetIdForTests00000000001");
    assert.notEqual(updated?.id, base.find((sheet) => sheet.batch === "2025-29")?.id);
    assert.deepEqual(updated?.divisions, base.find((sheet) => sheet.batch === "2025-29")?.divisions);
    assert.equal(other?.id, base.find((sheet) => sheet.batch === "2026-30")?.id);
  });
});

describe("student notices", () => {
  it("sends a batch message only to that batch, and an open message to everyone", () => {
    const btech = { course: "BTech", batch: "2025-29" };
    const mca = { course: "MCA", batch: "2026-28" };
    assert.equal(subscriptionMatches(btech, { course: null, batch: null }), true);
    assert.equal(subscriptionMatches(mca, { course: "BTech", batch: null }), false);
    assert.equal(subscriptionMatches(btech, { course: "BTech", batch: "2026-30" }), false);
    assert.equal(subscriptionMatches(btech, { course: "BTech", batch: "2025-29" }), true);
  });
});
