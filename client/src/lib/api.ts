import type { BootstrapResponse, ChangeEvent, DatabaseConnectionStatus, PublicLecture } from "@shared/types";

const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

async function read(response: Response): Promise<BootstrapResponse> {
  if (!response.ok) throw new Error("The timetable service is not responding.");
  return response.json() as Promise<BootstrapResponse>;
}

export interface BootstrapScope {
  division?: string;
  faculty?: string;
  course?: string;
  batch?: string;
  /** Every lecture. Coordinators and all-faculty access filter this on the client. */
  all?: boolean;
}

function applyScope(url: URL, scope?: BootstrapScope) {
  if (scope?.all) {
    url.searchParams.set("all", "1");
    return;
  }
  if (scope?.faculty) {
    url.searchParams.set("faculty", scope.faculty);
    return;
  }
  if (scope?.division) url.searchParams.set("division", scope.division);
  if (scope?.course) url.searchParams.set("course", scope.course);
  if (scope?.batch) url.searchParams.set("batch", scope.batch);
}

export function fetchBootstrap(scope?: BootstrapScope) {
  const url = new URL(`${base}/api/bootstrap`, window.location.origin);
  applyScope(url, scope);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  return fetch(url.toString(), { credentials: "include", signal: controller.signal })
    .then(read)
    .finally(() => clearTimeout(timer));
}

export function fetchSavedWeek(monday: string, scope?: BootstrapScope) {
  const url = new URL(`${base}/api/week`, window.location.origin);
  url.searchParams.set("monday", monday);
  applyScope(url, scope);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  return fetch(url.toString(), { credentials: "include", signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) throw new Error("That week could not be loaded.");
      return response.json() as Promise<{ lectures: PublicLecture[]; changes: ChangeEvent[]; spreadsheetUrl?: string | null }>;
    })
    .finally(() => clearTimeout(timer));
}

export function refreshBootstrap(scope?: BootstrapScope) {
  const url = new URL(`${base}/api/sync`, window.location.origin);
  applyScope(url, scope);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  return fetch(url.toString(), { method: "POST", credentials: "include", signal: controller.signal })
    .then(read)
    .finally(() => clearTimeout(timer));
}

export async function fetchDatabaseStatus(fresh = false): Promise<DatabaseConnectionStatus> {
  const url = new URL(`${base}/api/db-status`, window.location.origin);
  if (fresh) url.searchParams.set("fresh", "1");
  try {
    const response = await fetch(url.toString(), { credentials: "include" });
    const data = await response.json();
    return {
      connected: Boolean(data?.connected),
      latencyMs: typeof data?.latencyMs === "number" ? data.latencyMs : undefined,
      error: typeof data?.error === "string" ? data.error : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      error: message || "Connection failed",
    };
  }
}

