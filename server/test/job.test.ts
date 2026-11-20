import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import type { BootstrapResponse, SyncInfo } from "../../shared/types.ts";
import { getConfig, spreadsheetUrl, type AppConfig } from "../src/config.ts";
import { sqliteDb } from "../src/d1/sqlite.ts";
import { openWorkingDb, runJob } from "../src/job/pipeline.ts";
import { writeSheetLink } from "../src/services/sheetOverrides.ts";

const fixture = (name: string) => fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
const SHEET = "1iglizdY-oldwwrpBDBy84EEYwtNhnv6mKkf9mFP8NZw";

function setup() {
  const d1 = sqliteDb();
  // Sheets come only from D1. Keep the seeded 2025-29 link (SHEET) and drop the other batches.
  d1.raw.exec("DELETE FROM timetable_sheet_links WHERE batch <> '2025-29'");
  const config: AppConfig = { ...getConfig(), spreadsheetTitle: "Fixture" };
  let file: Buffer | null = fixture("cohort-week.xlsx");
  const lines: string[] = [];
  let clock = new Date("2026-10-14T06:00:00Z");
  const run = (workingDb = openWorkingDb(null)) =>
    runJob({
      sql: d1,
      databaseKey: "test",
      config,
      dataDir: null,
      workingDb,
      now: () => clock,
      log: (line) => lines.push(line),
      download: async () => {
        if (!file) throw new Error("Google Sheets export failed (503).");
        return file;
      },
    });
  const snapshot = async (key: string) =>
    (await d1.all<{ body: string }>("SELECT body FROM snapshots WHERE key = ?", [key]))[0]?.body;
  return {
    d1,
    lines,
    run,
    snapshot,
    setFile: (next: Buffer | null) => (file = next),
    setClock: (next: string) => (clock = new Date(next)),
  };
}

describe("sync job", () => {
  it("renders every scope once, writes nothing when nothing changed, and keeps cancellations across a restart", async () => {
    const env = setup();
    const working = openWorkingDb(null);
    const first = await env.run(working);
    assert.equal(first.ok, true, first.error ?? "");
    assert.equal(first.sync?.ok, true);
    assert.equal(first.hydrated, true);

    const keys = (await env.d1.all<{ key: string }>("SELECT key FROM snapshots")).map((row) => row.key);
    for (const key of ["index", "sync", "changes", "boot:all", "boot:none", "boot:b:btech|2025-29", "boot:b:btech|", "boot:b:|2025-29", "boot:d:jeff bezos 2025"]) {
      assert.ok(keys.includes(key), `missing ${key}`);
    }
    assert.ok(keys.some((key) => key.startsWith("boot:f:")));
    assert.ok(keys.some((key) => key.startsWith("ics:d:")));
    assert.ok(keys.some((key) => key.startsWith("ics:f:")));
    assert.ok(!keys.some((key) => key.startsWith("week:")), "past weeks are not published");

    const none = JSON.parse((await env.snapshot("boot:none"))!) as BootstrapResponse;
    assert.equal(none.lectures.length, 0);
    for (const key of keys.filter((name) => name.startsWith("boot:"))) {
      const body = JSON.parse((await env.snapshot(key))!) as Record<string, unknown>;
      for (const field of ["now", "today", "sync", "notices"]) assert.equal(field in body, false, `${key} has ${field}`);
      assert.ok(Object.keys(body).length > 0);
    }
    const index = JSON.parse((await env.snapshot("index"))!) as { batches: string[]; faculties: string[] };
    assert.ok(index.batches.includes("btech|2025-29"));
    const jobState = await env.d1.all<{ finished_at: string | null }>("SELECT finished_at FROM job_state WHERE id = 1");
    assert.ok(jobState[0]?.finished_at);

    const second = await env.run(working);
    assert.equal(second.ok, true);
    assert.equal(second.hydrated, false);
    assert.equal(second.snapshots?.written, 0);
    assert.equal(second.snapshots?.deleted, 0);
    assert.equal(second.archive?.upserted, 0);

    // A lecture disappears while its day is still published: cancelled, not dropped.
    env.setFile(fixture("edited-week.xlsx"));
    env.setClock("2026-10-14T07:00:00Z");
    const third = await env.run(working);
    assert.equal(third.sync?.changeCount, 1);

    // A new runner with an empty working database rebuilds from D1 alone.
    const restarted = await env.run(openWorkingDb(null));
    assert.equal(restarted.hydrated, true);
    assert.equal(restarted.sync?.unchanged, true);
    const boot = JSON.parse((await env.snapshot("boot:d:jeff bezos 2025"))!) as BootstrapResponse;
    const cancelled = boot.lectures.filter((lecture) => lecture.displayStatus === "cancelled" && lecture.kind === "lecture");
    assert.ok(cancelled.some((lecture) => lecture.subject === "Software Engineering & Project Management"));
    assert.ok(boot.changes.some((change) => change.type === "cancelled"));
  });

  it("keeps the last copy and publishes lastError when a sheet cannot be downloaded", async () => {
    const env = setup();
    const working = openWorkingDb(null);
    await env.run(working);
    const before = await env.snapshot("boot:all");
    env.setFile(null);
    env.setClock("2026-10-14T08:00:00Z");
    const failed = await env.run(working);
    assert.equal(failed.ok, true);
    assert.equal(failed.sync?.ok, false);
    const sync = JSON.parse((await env.snapshot("sync"))!) as SyncInfo;
    assert.ok(sync.lastError);
    assert.equal("refreshing" in sync, false);
    assert.equal(await env.snapshot("boot:all"), before);
  });

  it("links the header to the sheet stored in D1, even before the new sheet syncs", async () => {
    const env = setup();
    const working = openWorkingDb(null);
    const NEW = "1NewAdminSheetForTheHeaderLink0000000001";
    const headerLink = async () => {
      const boot = JSON.parse((await env.snapshot("boot:b:btech|2025-29"))!) as BootstrapResponse;
      return { top: boot.spreadsheetUrl, batch: boot.sheets.find((sheet) => sheet.batch === "2025-29")?.spreadsheetUrl };
    };
    assert.equal((await env.run(working)).ok, true);
    assert.deepEqual(await headerLink(), { top: spreadsheetUrl(SHEET), batch: spreadsheetUrl(SHEET) });

    // An admin saves a new link at /admin; the new sheet cannot be read yet, so lectures still carry SHEET.
    await writeSheetLink("BTech", "2025-29", NEW, env.d1);
    env.setFile(null);
    env.setClock("2026-10-14T08:00:00Z");
    assert.equal((await env.run(working)).ok, true);
    assert.deepEqual(await headerLink(), { top: spreadsheetUrl(NEW), batch: spreadsheetUrl(NEW) });

    // Once it downloads, the batch is replaced from the new sheet and the link stays on it.
    env.setFile(fixture("cohort-week.xlsx"));
    env.setClock("2026-10-14T09:00:00Z");
    assert.equal((await env.run(working)).ok, true);
    assert.deepEqual(await headerLink(), { top: spreadsheetUrl(NEW), batch: spreadsheetUrl(NEW) });
    assert.ok(env.lines.some((line) => line.includes(`moved to sheet ${NEW}`)));
  });

  it("skips a batch with no D1 sheet link and syncs nothing when there are none", async () => {
    const env = setup();
    assert.ok((await env.run()).ok);
    assert.ok(env.lines.some((line) => line.includes("no sheet link in D1 for BTech 2026-30")));
    env.d1.raw.exec("DELETE FROM timetable_sheet_links");
    const empty = await env.run();
    assert.equal(empty.ok, true);
    assert.equal(empty.sync, null);
    assert.ok(env.lines.some((line) => line.includes("no sheet links in D1")));
  });

  it("marks a queued notice sent once and stores a push key", async () => {
    const env = setup();
    const stamp = new Date("2026-10-14T05:00:00Z").toISOString();
    await env.d1.run([
      { sql: "INSERT INTO student_notices (id, title, body, course, batch, created_at) VALUES ('n1', 'Hi', 'Body', 'BTech', '2099-03', ?)", params: [stamp] },
    ]);
    const first = await env.run();
    assert.equal(first.pushes?.notices, 1);
    assert.equal(first.pushes?.delivered, 0);
    const rows = await env.d1.all<{ pushed_at: string | null }>("SELECT pushed_at FROM student_notices");
    assert.ok(rows[0]?.pushed_at);
    const keys = await env.d1.all<{ public_key: string }>("SELECT public_key FROM push_vapid");
    assert.equal(keys.length, 1);
    const again = await env.run();
    assert.equal(again.pushes?.notices, 0);
  });
});
