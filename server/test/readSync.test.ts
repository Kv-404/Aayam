import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import type { AppConfig } from "../src/config.ts";
import { openDatabase, readSyncState, writeSyncState } from "../src/db.ts";

const config: AppConfig = {
  spreadsheetId: "sheet-a",
  spreadsheets: [
    { id: "sheet-a", course: "BTech", batch: "2025-29" },
    { id: "sheet-b", course: "BTech", batch: "2024-28" },
  ],
  spreadsheetTitle: "Test Timetable",
  collegeName: "College",
  schoolName: "School",
  courseName: "BTech",
  timezone: "Asia/Kolkata",
  dateOrder: "DMY",
  port: 0,
  syncIntervalSeconds: 60,
  highlightHours: 72,
  databasePath: ":memory:",
  clientOrigin: null,
};

describe("sync on read for every sheet", () => {
  let server: http.Server;
  let baseUrl = "";
  let loads = 0;
  const db = openDatabase(":memory:");

  before(async () => {
    const app = createApp(db, config, async () => ({ buffer: Buffer.alloc(0) }), {
      syncOnRead: true,
      loadAll: async () => {
        loads += 1;
        return [];
      },
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address && typeof address === "object") baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    loads = 0;
  });

  it("syncs all sheets for all-access, then waits for the interval", async () => {
    await fetch(`${baseUrl}/api/bootstrap?all=1`);
    assert.equal(loads, 1);
    await fetch(`${baseUrl}/api/bootstrap?all=1`);
    await fetch(`${baseUrl}/api/bootstrap?faculty=Teacher`);
    assert.equal(loads, 1);
  });
});

describe("faculty sync after a recent one-sheet sync", () => {
  it("still loads every sheet", async () => {
    const db = openDatabase(":memory:");
    writeSyncState(db, { ...readSyncState(db), lastSuccessAt: new Date().toISOString() });
    let loads = 0;
    const app = createApp(db, config, async () => ({ buffer: Buffer.alloc(0) }), {
      syncOnRead: true,
      loadAll: async () => {
        loads += 1;
        return [];
      },
    });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : 0;
    try {
      await fetch(`http://127.0.0.1:${port}/api/bootstrap?faculty=Teacher`);
      assert.equal(loads, 1);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
