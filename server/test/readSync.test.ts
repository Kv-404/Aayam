import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import type { AppConfig } from "../src/config.ts";
import { openDatabase, readSyncState, replaceLectures, writeSyncState } from "../src/db.ts";
import type { StoredLecture } from "../src/model.ts";

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

function savedLecture(): StoredLecture {
  const slot = {
    subject: "Networks",
    faculty: "Dr. Aarti",
    room: "Classroom - 12",
    startMinutes: 540,
    endMinutes: 600,
    startLabel: "9:00 AM",
    endLabel: "10:00 AM",
    sourceStatus: "scheduled",
    reason: "",
    kind: "lecture",
    explicitMark: null,
  } as StoredLecture["anchor"];
  return {
    ...slot,
    id: "saved",
    slotKey: "saved",
    tabName: "Monday",
    course: "BTech",
    semester: "5",
    batch: "2024-28",
    division: "Elon Musk 2024",
    date: "2026-10-26",
    weekday: "Monday",
    reason: null,
    recurring: false,
    anchor: slot,
    highlight: null,
  } as StoredLecture;
}

describe("background sync on read", () => {
  it("answers from the saved copy while the sheets download, then reports the sync done", async () => {
    const db = openDatabase(":memory:");
    replaceLectures(db, [savedLecture()]);
    writeSyncState(db, { ...readSyncState(db), bootstrapped: true, lastSuccessAt: "2026-10-26T00:00:00.000Z" });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const background: Promise<unknown>[] = [];
    const app = createApp(db, config, async () => ({ buffer: Buffer.alloc(0) }), {
      syncOnRead: true,
      loadAll: async () => {
        await gate;
        return [];
      },
      runInBackground: (work) => background.push(work),
    });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const url = `http://127.0.0.1:${address && typeof address === "object" ? address.port : 0}/api/bootstrap?all=1`;
    try {
      const first = await (await fetch(url)).json();
      assert.equal(first.lectures.length, 1);
      assert.equal(first.sync.refreshing, true);
      assert.equal(background.length, 1);
      release();
      await background[0];
      const next = await (await fetch(url)).json();
      assert.equal(next.sync.refreshing, false);
      assert.equal(background.length, 1);
    } finally {
      release();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("waits for the sheets when there is no saved copy", async () => {
    const db = openDatabase(":memory:");
    const background: Promise<unknown>[] = [];
    let finished = false;
    const app = createApp(db, config, async () => ({ buffer: Buffer.alloc(0) }), {
      syncOnRead: true,
      loadAll: async () => {
        finished = true;
        return [];
      },
      runInBackground: (work) => background.push(work),
    });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      const body = await (await fetch(`http://127.0.0.1:${address && typeof address === "object" ? address.port : 0}/api/bootstrap?all=1`)).json();
      assert.equal(finished, true);
      assert.equal(background.length, 0);
      assert.equal(body.sync.refreshing, false);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("PIN check when the database fails", () => {
  it("reports a server error, not an invalid PIN", async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "not-a-database-url";
    const original = console.error;
    console.error = () => {};
    const app = createApp(openDatabase(":memory:"), config, async () => ({ buffer: Buffer.alloc(0) }));
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      const res = await fetch(`http://127.0.0.1:${address && typeof address === "object" ? address.port : 0}/api/auth/pin-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "000000" }),
      });
      const body = await res.json();
      assert.equal(res.status, 500);
      assert.doesNotMatch(body.error, /invalid pin/i);
    } finally {
      console.error = original;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
