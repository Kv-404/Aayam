import type { Express, Request, Response } from "express";
import { COHORT_TEMPLATES, spreadsheetUrl, type SheetSource } from "./config.ts";
import { getClientIp } from "./auth.ts";
import {
  adminLoginLimiter,
  adminSessionValid,
  adminTokenFromRequest,
  bootstrapAdminPasswordFromEnv,
  clearAdminCookie,
  createAdminSession,
  deleteAdminSession,
  deleteAdminSessions,
  hasAdminHeader,
  hashPassword,
  passwordMatches,
  setAdminCookie,
  setAdminPasswordHash,
} from "./services/adminAuth.ts";
import {
  insertNotice,
  listRecentNotices,
  pushPublicKey,
  savePushSubscription,
  sendStudentPush,
  type NoticeAudience,
} from "./services/notices.ts";
import {
  acceptSpreadsheetId,
  deleteSheetOverride,
  readSheetOverrides,
  writeSheetOverride,
} from "./services/sheetOverrides.ts";

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function templateFor(course: string, batch: string) {
  return COHORT_TEMPLATES.find(
    (item) => item.course.toLowerCase() === course.toLowerCase() && item.batch.toLowerCase() === batch.toLowerCase(),
  );
}

function audienceFrom(body: { course?: unknown; batch?: unknown }): NoticeAudience | null {
  const course = text(body.course, 40);
  const batch = text(body.batch, 40);
  if (!course && !batch) return { course: null, batch: null };
  if (!course || !batch) {
    const courseOnly = COHORT_TEMPLATES.some((item) => item.course.toLowerCase() === course.toLowerCase());
    if (course && !batch && courseOnly) return { course, batch: null };
    return null;
  }
  if (!templateFor(course, batch)) return null;
  return { course, batch };
}

async function requireAdmin(req: Request, res: Response) {
  if (!hasAdminHeader(req)) {
    res.status(401).json({ ok: false, error: "Sign in again." });
    return false;
  }
  try {
    const ok = await adminSessionValid(adminTokenFromRequest(req));
    if (!ok) {
      res.status(401).json({ ok: false, error: "Sign in again." });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ ok: false, error: "Admin sign-in is unavailable." });
    return false;
  }
}

function sheetRows(fallback: SheetSource[], overrides: Array<{ course: string; batch: string; spreadsheetId: string }>) {
  return fallback.map((source) => {
    const hit = overrides.find(
      (row) =>
        row.course.toLowerCase() === source.course.toLowerCase() &&
        row.batch.toLowerCase() === (source.batch ?? "").toLowerCase(),
    );
    const id = hit?.spreadsheetId || source.id;
    return {
      course: source.course,
      batch: source.batch ?? "",
      spreadsheetUrl: spreadsheetUrl(id),
    };
  });
}

export function registerAdminRoutes(
  app: Express,
  deps: {
    fallbackSheets: SheetSource[];
    syncSheet: (source: SheetSource) => Promise<{ ok: boolean; error: string | null }>;
  },
) {
  app.get("/api/push/public-key", async (_req, res) => {
    const publicKey = await pushPublicKey();
    res.json({ publicKey });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    const endpoint = text(req.body?.endpoint, 2000);
    const p256dh = text(req.body?.keys?.p256dh, 200);
    const authKey = text(req.body?.keys?.auth, 200);
    const course = text(req.body?.course, 40);
    const batch = text(req.body?.batch, 40);
    const division = text(req.body?.division, 80);
    const local = endpoint.startsWith("http://localhost") || endpoint.startsWith("http://127.0.0.1");
    if ((!endpoint.startsWith("https://") && !local) || !p256dh || !authKey) {
      res.status(400).json({ ok: false });
      return;
    }
    try {
      await savePushSubscription({
        endpoint,
        p256dh,
        authKey,
        course: course || null,
        batch: batch || null,
        division: division || null,
      });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get("/api/admin/session", async (req, res) => {
    try {
      const signedIn = await adminSessionValid(adminTokenFromRequest(req));
      if (!signedIn) {
        res.json({ signedIn: false });
        return;
      }
      const overrides = await readSheetOverrides();
      const notices = await listRecentNotices();
      res.json({ signedIn: true, sheets: sheetRows(deps.fallbackSheets, overrides), notices });
    } catch {
      res.json({ signedIn: false });
    }
  });

  app.post("/api/admin/login", async (req, res) => {
    const ip = getClientIp(req);
    const rate = adminLoginLimiter.check(ip);
    if (rate.limited) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      res.status(429).json({ ok: false, error: `Too many tries. Wait ${rate.retryAfterSeconds} seconds.` });
      return;
    }
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password || password.length > 200) {
      adminLoginLimiter.recordFailure(ip);
      res.status(401).json({ ok: false, error: "That password is not right." });
      return;
    }
    try {
      await bootstrapAdminPasswordFromEnv();
      const match = await passwordMatches(password);
      if (!match) {
        adminLoginLimiter.recordFailure(ip);
        res.status(401).json({ ok: false, error: "That password is not right." });
        return;
      }
      adminLoginLimiter.reset(ip);
      const token = await createAdminSession();
      setAdminCookie(res, token);
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: "Admin sign-in is unavailable." });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    try {
      await deleteAdminSession(adminTokenFromRequest(req));
    } catch {
      // The cookie is still cleared.
    }
    clearAdminCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/admin/password", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const current = typeof req.body?.current === "string" ? req.body.current : "";
    const next = typeof req.body?.next === "string" ? req.body.next : "";
    if (next.length < 12 || next.length > 200) {
      res.status(400).json({ ok: false, error: "Use at least 12 characters." });
      return;
    }
    try {
      const match = await passwordMatches(current);
      if (!match) {
        res.status(401).json({ ok: false, error: "That password is not right." });
        return;
      }
      await setAdminPasswordHash(await hashPassword(next));
      await deleteAdminSessions();
      const token = await createAdminSession();
      setAdminCookie(res, token);
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: "The password could not be changed." });
    }
  });

  app.post("/api/admin/sheets", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const course = text(req.body?.course, 40);
    const batch = text(req.body?.batch, 40);
    const template = templateFor(course, batch);
    const spreadsheetId = acceptSpreadsheetId(text(req.body?.url, 300));
    if (!template || !spreadsheetId) {
      res.status(400).json({ ok: false, error: "Paste a Google Sheet link for one of the batches." });
      return;
    }
    const previous = (await readSheetOverrides()).find(
      (row) => row.course.toLowerCase() === course.toLowerCase() && row.batch.toLowerCase() === batch.toLowerCase(),
    );
    try {
      await writeSheetOverride(template.course, template.batch, spreadsheetId);
      const outcome = await deps.syncSheet({
        id: spreadsheetId,
        course: template.course,
        batch: template.batch,
        divisions: template.divisions,
      });
      if (!outcome.ok) {
        if (previous) await writeSheetOverride(template.course, template.batch, previous.spreadsheetId);
        else await deleteSheetOverride(template.course, template.batch);
        res.status(400).json({ ok: false, error: outcome.error ?? "That sheet could not be read." });
        return;
      }
      const overrides = await readSheetOverrides();
      res.json({ ok: true, sheets: sheetRows(deps.fallbackSheets, overrides) });
    } catch {
      res.status(503).json({ ok: false, error: "The sheet link could not be saved." });
    }
  });

  app.post("/api/admin/notices", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const title = text(req.body?.title, 80);
    const body = text(req.body?.body, 280).replace(/\s+/g, " ");
    const audience = audienceFrom(req.body ?? {});
    if (!title || !body || !audience) {
      res.status(400).json({ ok: false, error: "Write a title, a message, and who should see it." });
      return;
    }
    try {
      await insertNotice(title, body, audience);
      const delivered = await sendStudentPush(title, body, audience).catch(() => 0);
      const notices = await listRecentNotices();
      res.json({ ok: true, delivered, notices });
    } catch {
      res.status(503).json({ ok: false, error: "The message could not be sent." });
    }
  });
}
