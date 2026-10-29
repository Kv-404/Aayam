import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Request } from "express";
import { createApp } from "../src/app.ts";
import {
  getClientIp,
  getSessionFromRequest,
  PinRateLimiter,
  pinRateLimiter,
  signSession,
  verifyBatchPinWithNeon,
  verifySession,
} from "../src/auth.ts";
import type { AppConfig } from "../src/config.ts";
import { openDatabase } from "../src/db.ts";

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

describe("faculty session token", () => {
  it("rejects a token whose signature length does not match", () => {
    const token = signSession({ email: "teacher@itm.edu", faculty: "Teacher", canSeeAllFaculty: false });
    const [data] = token.split(".");
    assert.equal(verifySession(`${data}.abc`), null);
    assert.equal(verifySession("not-a-token"), null);
  });

  it("accepts the session from a bearer header when the cookie is missing", () => {
    const token = signSession({ email: "teacher@itm.edu", faculty: "Teacher", canSeeAllFaculty: true });
    const session = getSessionFromRequest({ headers: { authorization: `Bearer ${token}` } } as Request);
    assert.equal(session?.email, "teacher@itm.edu");
    assert.equal(session?.faculty, "Teacher");
    assert.equal(session?.canSeeAllFaculty, true);
    assert.equal(getSessionFromRequest({ headers: { authorization: "Bearer nope" } } as Request), null);
  });

  it("still reads the session cookie", () => {
    const token = signSession({ email: "teacher@itm.edu", faculty: "Teacher", canSeeAllFaculty: false });
    const session = getSessionFromRequest({
      headers: { cookie: `timetable_faculty_session=${encodeURIComponent(token)}` },
    } as Request);
    assert.equal(session?.email, "teacher@itm.edu");
  });
});

describe("PIN verification and rate limiting", () => {
  beforeEach(() => {
    pinRateLimiter.clear();
  });

  describe("PinRateLimiter unit logic", () => {
    it("allows attempts up to maxAttempts and then blocks", () => {
      const limiter = new PinRateLimiter(5, 5 * 60 * 1000);
      const ip = "192.168.1.10";

      for (let i = 0; i < 5; i++) {
        const status = limiter.check(ip);
        assert.equal(status.limited, false);
        assert.equal(status.remainingAttempts, 5 - i);
        limiter.recordFailure(ip);
      }

      const blockedStatus = limiter.check(ip);
      assert.equal(blockedStatus.limited, true);
      assert.equal(blockedStatus.remainingAttempts, 0);
      assert.ok(blockedStatus.retryAfterSeconds > 0 && blockedStatus.retryAfterSeconds <= 300);
    });

    it("resets failed attempts for an IP", () => {
      const limiter = new PinRateLimiter(5, 5 * 60 * 1000);
      const ip = "192.168.1.20";

      for (let i = 0; i < 5; i++) {
        limiter.recordFailure(ip);
      }
      assert.equal(limiter.check(ip).limited, true);

      limiter.reset(ip);
      assert.equal(limiter.check(ip).limited, false);
      assert.equal(limiter.check(ip).remainingAttempts, 5);
    });

    it("expires old failed attempts outside the window", () => {
      const windowMs = 5000;
      const limiter = new PinRateLimiter(3, windowMs);
      const ip = "192.168.1.30";
      const t0 = 1000000;

      limiter.recordFailure(ip, t0);
      limiter.recordFailure(ip, t0 + 1000);
      limiter.recordFailure(ip, t0 + 2000);

      // Blocked at t0 + 2500
      assert.equal(limiter.check(ip, t0 + 2500).limited, true);

      // At t0 + 5500, t0 has expired (diff=5500 > 5000), leaving 2 valid attempts
      const statusAfter = limiter.check(ip, t0 + 5500);
      assert.equal(statusAfter.limited, false);
      assert.equal(statusAfter.remainingAttempts, 1);

      // At t0 + 7500, all have expired
      const statusAllExpired = limiter.check(ip, t0 + 7500);
      assert.equal(statusAllExpired.limited, false);
      assert.equal(statusAllExpired.remainingAttempts, 3);
    });

    it("keeps tracking isolated between different IPs", () => {
      const limiter = new PinRateLimiter(2, 60000);
      limiter.recordFailure("ip-1");
      limiter.recordFailure("ip-1");
      assert.equal(limiter.check("ip-1").limited, true);
      assert.equal(limiter.check("ip-2").limited, false);
    });
  });

  describe("getClientIp", () => {
    it("extracts client IP from x-forwarded-for header string", () => {
      const req = {
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
      } as unknown as Request;
      assert.equal(getClientIp(req), "203.0.113.195");
    });

    it("extracts client IP from x-forwarded-for header array", () => {
      const req = {
        headers: { "x-forwarded-for": ["198.51.100.1", "10.0.0.1"] },
      } as unknown as Request;
      assert.equal(getClientIp(req), "198.51.100.1");
    });

    it("falls back to req.ip or socket remote address", () => {
      const reqWithIp = { headers: {}, ip: "10.10.10.10" } as unknown as Request;
      assert.equal(getClientIp(reqWithIp), "10.10.10.10");

      const reqWithSocket = {
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      } as unknown as Request;
      assert.equal(getClientIp(reqWithSocket), "127.0.0.1");
    });
  });

  describe("verifyBatchPinWithNeon format validation", () => {
    it("rejects non-6-digit PINs without error", async () => {
      assert.equal(await verifyBatchPinWithNeon(""), null);
      assert.equal(await verifyBatchPinWithNeon("123"), null);
      assert.equal(await verifyBatchPinWithNeon("12345"), null);
      assert.equal(await verifyBatchPinWithNeon("1234567"), null);
      assert.equal(await verifyBatchPinWithNeon("abcdef"), null);
      assert.equal(await verifyBatchPinWithNeon("12345a"), null);
      assert.equal(await verifyBatchPinWithNeon("12 456"), null);
    });

    it("accepts known 6-digit fallback PINs", async () => {
      const result = await verifyBatchPinWithNeon("481920");
      assert.ok(result);
      assert.equal(result.ok, true);
      assert.equal(result.course, "BTech");
      assert.equal(result.batch, "2026-30");
    });

    it("returns null for wrong 6-digit PIN", async () => {
      assert.equal(await verifyBatchPinWithNeon("000000"), null);
    });
  });

  describe("HTTP endpoints rate limiting and hardening", () => {
    let server: http.Server;
    let baseUrl: string;

    beforeEach(async () => {
      pinRateLimiter.clear();
      const db = openDatabase(":memory:");
      const app = createApp(db, dummyConfig, async () => ({
        buffer: Buffer.from(""),
        spreadsheetTitle: "Test",
      }));
      server = http.createServer(app);
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          if (address && typeof address === "object") {
            baseUrl = `http://127.0.0.1:${address.port}`;
          }
          resolve();
        });
      });
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => {
        if (server) {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    it("returns 400 if PIN is missing or not a 6-digit format", async () => {
      const resMissing = await fetch(`${baseUrl}/api/auth/pin-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(resMissing.status, 400);
      const dataMissing = await resMissing.json();
      assert.equal(dataMissing.ok, false);
      assert.equal(dataMissing.error, "Missing PIN.");

      const resAlpha = await fetch(`${baseUrl}/api/auth/pin-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "abc123" }),
      });
      assert.equal(resAlpha.status, 400);
      const dataAlpha = await resAlpha.json();
      assert.equal(dataAlpha.ok, false);
      assert.equal(dataAlpha.error, "Invalid PIN format. PIN must be exactly 6 digits.");

      const resShort = await fetch(`${baseUrl}/api/auth/pin-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "123" }),
      });
      assert.equal(resShort.status, 400);
      const dataShort = await resShort.json();
      assert.equal(dataShort.ok, false);
      assert.equal(dataShort.error, "Invalid PIN format. PIN must be exactly 6 digits.");
    });

    it("returns 200 with batch metadata for valid 6-digit PIN", async () => {
      const res = await fetch(`${baseUrl}/api/auth/pin-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "481920" }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.course, "BTech");
      assert.equal(data.batch, "2026-30");
    });

    it("blocks an IP after 5 failed attempts with 429 and Retry-After header", async () => {
      const testIp = "203.0.113.50";

      for (let i = 0; i < 5; i++) {
        const resFail = await fetch(`${baseUrl}/api/auth/pin-verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": testIp,
          },
          body: JSON.stringify({ pin: "000000" }),
        });
        assert.equal(resFail.status, 401);
        const dataFail = await resFail.json();
        assert.equal(dataFail.ok, false);
      }

      // 6th attempt should be blocked
      const resBlocked = await fetch(`${baseUrl}/api/auth/pin-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIp,
        },
        body: JSON.stringify({ pin: "481920" }), // Even correct PIN is blocked
      });
      assert.equal(resBlocked.status, 429);
      assert.ok(resBlocked.headers.get("retry-after"));
      const dataBlocked = await resBlocked.json();
      assert.equal(dataBlocked.ok, false);
      assert.match(dataBlocked.error, /Too many failed attempts/);
    });

    it("resets failed count when correct PIN is entered before reaching limit", async () => {
      const testIp = "203.0.113.60";

      // 2 failed attempts
      for (let i = 0; i < 2; i++) {
        const resFail = await fetch(`${baseUrl}/api/auth/pin-verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": testIp,
          },
          body: JSON.stringify({ pin: "000000" }),
        });
        assert.equal(resFail.status, 401);
      }

      // Valid attempt resets failures
      const resSuccess = await fetch(`${baseUrl}/api/auth/pin-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIp,
        },
        body: JSON.stringify({ pin: "481920" }),
      });
      assert.equal(resSuccess.status, 200);

      // Should have full 5 attempts available again
      assert.equal(pinRateLimiter.check(testIp).remainingAttempts, 5);
    });
  });
});
