import { adminLogin, adminLogout, adminNotices, adminPassword, adminSession, adminSheets, pushPublicKey, pushSubscribe } from "./admin.ts";
import { authConfig, authGoogle, authLogout, authMe } from "./auth.ts";
import { database, type Ctx, type Env, type ExecutionContextLike } from "./env.ts";
import { allowedOrigins, errorJson, HttpError, preflight, withCors, withSecurityHeaders } from "./http.ts";
import { bootstrap, calendar, changes, dbStatus, health } from "./read.ts";
import { requestSync } from "./sync.ts";

export type { Env } from "./env.ts";

/**
 * Cloudflare Worker. Static files are served by Workers Assets before this runs; only `/api/*` reaches it.
 * Every timetable response is a prebuilt D1 snapshot written by the sync job.
 */

type Handler = (ctx: Ctx) => Response | Promise<Response>;

const routes: Record<string, Handler> = {
  "GET /api/bootstrap": (ctx) => bootstrap(ctx),
  "POST /api/sync": async (ctx) => {
    await requestSync(ctx.env, "manual", { user: true, db: ctx.db });
    return bootstrap(ctx, { forceRefreshing: true });
  },
  "GET /api/calendar.ics": calendar,
  "GET /api/changes": changes,
  "GET /api/health": health,
  "GET /api/db-status": dbStatus,
  "GET /api/auth/config": authConfig,
  "GET /api/auth/me": authMe,
  "POST /api/auth/google": authGoogle,
  "POST /api/auth/logout": authLogout,
  "GET /api/admin/session": adminSession,
  "POST /api/admin/login": adminLogin,
  "POST /api/admin/logout": adminLogout,
  "POST /api/admin/password": adminPassword,
  "POST /api/admin/sheets": adminSheets,
  "POST /api/admin/notices": adminNotices,
  "GET /api/push/public-key": pushPublicKey,
  "POST /api/push/subscribe": pushSubscribe,
};

const cleanPath = (url: URL) => (url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname);

async function handle(request: Request, env: Env, exec: ExecutionContextLike, url: URL) {
  if (request.method === "OPTIONS") return preflight(request);
  const head = request.method === "HEAD";
  const path = cleanPath(url);
  const handler = routes[`${head ? "GET" : request.method} ${path}`];
  if (!handler) return errorJson(404, "Not found.");
  try {
    const response = await handler({ request, url, env, db: database(env), exec });
    return head ? new Response(null, response) : response;
  } catch (error) {
    if (error instanceof HttpError) return errorJson(error.status, error.message);
    console.error("[api]", request.method, path, error instanceof Error ? error.message : error);
    return errorJson(500, "Something went wrong.");
  }
}

export default {
  async fetch(request: Request, env: Env, exec: ExecutionContextLike): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const response = await handle(request, env, exec, url);
    return withCors(withSecurityHeaders(response, request), request, allowedOrigins(env.CLIENT_ORIGIN));
  },

  /** Cron, every 5 minutes. One D1 write and at most one GitHub request. */
  async scheduled(_controller: unknown, env: Env, exec: ExecutionContextLike): Promise<void> {
    exec.waitUntil(requestSync(env, "cron"));
  },
};
