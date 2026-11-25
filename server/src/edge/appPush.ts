import { sessionFromRequest } from "./auth.ts";
import type { Ctx } from "./env.ts";
import { field, json, readJson } from "./http.ts";

/** Expo push tokens look like `ExponentPushToken[xxxxxxxx]`. Anything else is refused. */
const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,128}\]$/;

/**
 * POST /api/push/app-register { token, role, course?, batch?, division? }
 * A faculty device must send its session (Bearer): the name comes from the session, never the body.
 * Plain upsert, no crypto: the job does the sending.
 */
export async function appPushRegister(ctx: Ctx) {
  const body = await readJson(ctx.request);
  const token = field(body.token, 160);
  if (!TOKEN.test(token)) return json({ ok: false, error: "Not an Expo push token." }, 400);
  const role = body.role === "faculty" ? "faculty" : "student";
  let course = "";
  let batch = "";
  let division = "";
  let faculty = "";
  if (role === "faculty") {
    const session = await sessionFromRequest(ctx.env, ctx.request);
    if (!session?.faculty) return json({ ok: false, error: "Sign in again." }, 401);
    faculty = session.faculty;
  } else {
    course = field(body.course, 40);
    batch = field(body.batch, 40);
    division = field(body.division, 80);
    if (!division) return json({ ok: false, error: "Missing cohort." }, 400);
  }
  const now = new Date().toISOString();
  try {
    await ctx.db.run([
      {
        sql: `INSERT INTO app_push_devices (token, role, course, batch, division, faculty, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (token) DO UPDATE SET
            role = excluded.role, course = excluded.course, batch = excluded.batch,
            division = excluded.division, faculty = excluded.faculty, updated_at = excluded.updated_at`,
        params: [token, role, course || null, batch || null, division || null, faculty || null, now, now],
      },
    ]);
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 503);
  }
}

/** POST /api/push/app-unregister { token }: notifications off, or sign-out. */
export async function appPushUnregister(ctx: Ctx) {
  const body = await readJson(ctx.request);
  const token = field(body.token, 160);
  if (!TOKEN.test(token)) return json({ ok: false }, 400);
  try {
    await ctx.db.run([{ sql: "DELETE FROM app_push_devices WHERE token = ?", params: [token] }]);
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 503);
  }
}
