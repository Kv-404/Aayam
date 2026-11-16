import postgres from "postgres";
import type { DatabaseConnectionStatus } from "../../../shared/types.ts";

let client: postgres.Sql | null = null;
let clientUrl = "";

export function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

/** Shared Postgres client. Supabase's transaction pooler cannot use prepared statements. */
export function getSql() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not configured.");
  if (!client || clientUrl !== url) {
    const previous = client;
    client = postgres(url, {
      ssl: "require",
      max: process.env.VERCEL ? 1 : 4,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 20,
      onnotice: (notice) => {
        if (notice.code === "42P07") return;
        console.log(notice.message);
      },
    });
    clientUrl = url;
    if (previous) void previous.end({ timeout: 1 });
  }
  return client;
}

let lastCheck: { status: DatabaseConnectionStatus; checkedAt: number } | null = null;
let inflightCheck: Promise<DatabaseConnectionStatus> | null = null;

export function resetDatabaseStatusCache() {
  lastCheck = null;
  inflightCheck = null;
}

export async function checkDatabaseConnection(options: { force?: boolean; timeoutMs?: number } = {}): Promise<DatabaseConnectionStatus> {
  const { force = false, timeoutMs = 3000 } = options;
  const now = Date.now();
  if (!force && lastCheck && now - lastCheck.checkedAt < 3000) {
    return lastCheck.status;
  }
  if (!force && inflightCheck) {
    return inflightCheck;
  }

  const runCheck = async (): Promise<DatabaseConnectionStatus> => {
    const url = databaseUrl();
    if (!url) {
      return { connected: false, error: "DATABASE_URL is not configured." };
    }
    const start = performance.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      const sql = getSql();
      const queryPromise = sql`SELECT 1 as alive`;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database check timed out")), timeoutMs);
        timer.unref?.();
      });
      await Promise.race([queryPromise, timeoutPromise]);
      const latencyMs = Math.round(performance.now() - start);
      return { connected: true, latencyMs };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        connected: false,
        error: message || "Database connection failed",
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  inflightCheck = runCheck();
  try {
    const status = await inflightCheck;
    lastCheck = { status, checkedAt: Date.now() };
    return status;
  } finally {
    inflightCheck = null;
  }
}

