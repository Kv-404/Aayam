import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { getConfig } from "../src/config.ts";
import { openDatabase } from "../src/db.ts";
import { runSync } from "../src/services/syncScheduler.ts";
import { buildBootstrap } from "../src/views.ts";

const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url);

describe("views", () => {
  it("buildBootstrap matches the payload the Express app produced", async () => {
    // bootstrap-golden.json was written by the old app.ts buildBootstrap over the same two syncs.
    const golden = JSON.parse(fs.readFileSync(fixture("bootstrap-golden.json"), "utf8")) as {
      first: string;
      now: string;
      cases: Array<{ scope: Record<string, string>; body: unknown }>;
    };
    const db = openDatabase(":memory:");
    const config = { ...getConfig(), spreadsheetTitle: "Fixture" };
    const original = fs.readFileSync(fixture("cohort-week.xlsx"));
    const edited = fs.readFileSync(fixture("edited-week.xlsx"));
    await runSync({ db, config, now: new Date(golden.first), load: async () => ({ buffer: original }) });
    await runSync({ db, config, now: new Date(golden.now), load: async () => ({ buffer: edited }) });
    const now = new Date(golden.now);
    for (const item of golden.cases) {
      assert.deepEqual(buildBootstrap(db, config, now, item.scope), item.body, JSON.stringify(item.scope));
    }
    const all = buildBootstrap(db, config, now);
    assert.ok(all.changes.some((change) => change.type === "cancelled"));
  });
});
