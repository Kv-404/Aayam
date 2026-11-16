import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it } from "node:test";
import ExcelJS from "exceljs";
import { createDistributedRateLimiter, PinRateLimiter } from "../src/auth.ts";
import { createApp } from "../src/app.ts";
import { getConfig } from "../src/config.ts";
import {
  openDatabase,
  readUnhydratedWeekIds,
  replaceWeekBackups,
  upsertWeekBackups,
  type WeekBackupRecord,
} from "../src/db.ts";
import { MemoryRedisStore, resetRedisForTests, setRedisForTests } from "../src/services/redis.ts";
import { runSync } from "../src/services/syncScheduler.ts";

async function makeWorkbook(subject = "Algorithms", room = "Classroom - 12") {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Monday");
  sheet.getCell("A1").value = "SEMESTER - 3";
  sheet.getCell("A2").value = "16/11/2026 (Monday)";
  sheet.getCell("A3").value = "Timing";
  sheet.getCell("B3").value = "Sam Altman 2025";
  sheet.getCell("A4").value = "9:00 AM - 10:00 AM";
  sheet.getCell("B4").value = subject;
  sheet.getCell("A5").value = "Faculty";
  sheet.getCell("B5").value = "Dr. Aarti P";
  sheet.getCell("A6").value = "Classroom No";
  sheet.getCell("B6").value = room;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function withServer(
  app: ReturnType<typeof createApp>,
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Redis caching & egress reduction", () => {
  afterEach(() => {
    resetRedisForTests();
  });

  it("compresses large JSON payloads transparently in Redis", async () => {
    const store = new MemoryRedisStore();
    const bigPayload = {
      items: Array.from({ length: 400 }, (_, i) => ({
        id: `lec-${i}`,
        subject: "Distributed Systems & Cloud Computing",
        faculty: "Dr. Aarti Pardesi",
        room: `Classroom - ${i}`,
      })),
    };
    await store.setJson("big:test", bigPayload, 60, 1024);
    const raw = await store.get("big:test");
    assert.ok(raw?.startsWith("gz:"), "Expected large payload to be gzipped");
    const restored = await store.getJson<typeof bigPayload>("big:test");
    assert.equal(restored?.items.length, 400);
    assert.equal(restored?.items[0]?.id, "lec-0");
  });

  it("shares distributed rate limits across instances when Redis is shared", async () => {
    const shared = new MemoryRedisStore(10_000, true);
    setRedisForTests(shared);

    const limiterA = createDistributedRateLimiter("pin-test", new PinRateLimiter(3, 60_000), 3, 60);
    const limiterB = createDistributedRateLimiter("pin-test", new PinRateLimiter(3, 60_000), 3, 60);

    await limiterA.recordFailure("203.0.113.10");
    await limiterA.recordFailure("203.0.113.10");
    assert.equal((await limiterB.check("203.0.113.10")).limited, false);

    await limiterB.recordFailure("203.0.113.10");
    const blocked = await limiterA.check("203.0.113.10");
    assert.equal(blocked.limited, true);

    await limiterB.reset("203.0.113.10");
    assert.equal((await limiterA.check("203.0.113.10")).limited, false);
  });

  it("tracks unhydrated summary weeks until hydrated on demand", () => {
    const db = openDatabase(":memory:");
    const summaryOnly: WeekBackupRecord = {
      id: "BTech|2025-29|2026-10-12|2026-10-17",
      course: "BTech",
      batch: "2025-29",
      start: "2026-10-12",
      end: "2026-10-17",
      lectures: [],
      changes: [],
    };
    replaceWeekBackups(db, [summaryOnly], new Set([summaryOnly.id]));
    assert.deepEqual(readUnhydratedWeekIds(db, [summaryOnly.id]), [summaryOnly.id]);

    upsertWeekBackups(
      db,
      [
        {
          ...summaryOnly,
          lectures: [],
        },
      ],
      true,
    );
    assert.deepEqual(readUnhydratedWeekIds(db, [summaryOnly.id]), []);
  });

  it("serves cached bootstrap responses with ETag 304 Not Modified", async () => {
    const shared = new MemoryRedisStore(10_000, true);
    setRedisForTests(shared);
    const db = openDatabase(":memory:");
    const buf = await makeWorkbook();
    const config = { ...getConfig(), syncIntervalSeconds: 60 };
    await runSync({
      db,
      config,
      load: async () => ({ buffer: buf }),
    });

    const app = createApp(db, config, async () => ({ buffer: buf }));
    await withServer(app, async (baseUrl) => {
      const first = await fetch(`${baseUrl}/api/bootstrap?division=${encodeURIComponent("Sam Altman 2025")}`);
      assert.equal(first.status, 200);
      const etag = first.headers.get("etag");
      assert.ok(etag, "Expected weak ETag on bootstrap response");
      const data = (await first.json()) as { lectures: unknown[] };
      assert.equal(data.lectures.length, 1);

      const second = await fetch(`${baseUrl}/api/bootstrap?division=${encodeURIComponent("Sam Altman 2025")}`, {
        headers: { "If-None-Match": etag! },
      });
      assert.equal(second.status, 304);
    });
  });

  it("respects Redis sync lock and cooldown across requests", async () => {
    const shared = new MemoryRedisStore(10_000, true);
    setRedisForTests(shared);
    const db = openDatabase(":memory:");
    const buf = await makeWorkbook();
    let fetchCount = 0;
    const config = { ...getConfig(), syncIntervalSeconds: 60 };
    const app = createApp(
      db,
      config,
      async () => {
        fetchCount += 1;
        return { buffer: buf };
      },
      {
        syncOnRead: true,
        loadAll: async () => {
          fetchCount += 1;
          return [{ buffer: buf, course: "BTech", spreadsheetId: config.spreadsheetId }];
        },
      },
    );

    await withServer(app, async (baseUrl) => {
      const r1 = await fetch(`${baseUrl}/api/bootstrap?all=1`);
      assert.equal(r1.status, 200);
      const countAfterFirst = fetchCount;
      assert.ok(countAfterFirst >= 1);

      const r2 = await fetch(`${baseUrl}/api/bootstrap?all=1`);
      assert.equal(r2.status, 200);
      assert.equal(fetchCount, countAfterFirst, "Expected second read within interval to skip sheet download");
    });
  });
});
