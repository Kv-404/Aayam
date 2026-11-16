import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../src/db.ts";
import { createApp } from "../src/app.ts";
import type { AppConfig } from "../src/config.ts";
import { checkDatabaseConnection, resetDatabaseStatusCache } from "../src/services/postgres.ts";

const dummyConfig: AppConfig = {
  spreadsheetId: "test-sheet",
  spreadsheets: [{ id: "test-sheet", course: "BTech", batch: "2025-29" }],
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

describe("database status", () => {
  it("reports disconnected when DATABASE_URL is not set", async () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      resetDatabaseStatusCache();

      const status = await checkDatabaseConnection({ force: true });
      assert.equal(status.connected, false);
      assert.match(status.error ?? "", /DATABASE_URL is not configured/);
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      }
      resetDatabaseStatusCache();
    }
  });

  it("serves /api/db-status with 503 when disconnected", async () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      resetDatabaseStatusCache();

      const db = openDatabase(":memory:");
      const app = createApp(
        db,
        dummyConfig,
        async () => ({ buffer: Buffer.from("") }),
      );

      const server = app.listen(0);
      try {
        const address = server.address() as AddressInfo;
        const res = await fetch(`http://127.0.0.1:${address.port}/api/db-status`);
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.equal(data.connected, false);
        assert.ok(data.error);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      }
      resetDatabaseStatusCache();
    }
  });

  it("includes db status on /api/health?db=1", async () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      resetDatabaseStatusCache();

      const db = openDatabase(":memory:");
      const app = createApp(
        db,
        dummyConfig,
        async () => ({ buffer: Buffer.from("") }),
      );

      const server = app.listen(0);
      try {
        const address = server.address() as AddressInfo;
        const res = await fetch(`http://127.0.0.1:${address.port}/api/health?db=1`);
        const data = await res.json();
        assert.ok(data.db);
        assert.equal(data.db.connected, false);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      }
      resetDatabaseStatusCache();
    }
  });

  it("caches connection check within 3 seconds unless forced", async () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      resetDatabaseStatusCache();

      const first = await checkDatabaseConnection();
      assert.equal(first.connected, false);

      // Now set URL without forcing refresh - should still return cached result
      process.env.DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy";
      const cached = await checkDatabaseConnection();
      assert.equal(cached.connected, false);

      // With force: true, it attempts with the new URL
      const fresh = await checkDatabaseConnection({ force: true, timeoutMs: 100 });
      assert.equal(fresh.connected, false);
      assert.notEqual(fresh.error, "DATABASE_URL is not configured.");
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
      resetDatabaseStatusCache();
    }
  });
});
