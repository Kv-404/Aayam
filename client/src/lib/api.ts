import type { BootstrapResponse, ChangeEvent, PublicLecture } from "@shared/types";

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
  return fetch(url.toString(), { credentials: "include" }).then(read);
}

export function fetchSavedWeek(monday: string, scope?: BootstrapScope) {
  const url = new URL(`${base}/api/week`, window.location.origin);
  url.searchParams.set("monday", monday);
  applyScope(url, scope);
  return fetch(url.toString(), { credentials: "include" }).then(async (response) => {
    if (!response.ok) throw new Error("That week could not be loaded.");
    return response.json() as Promise<{ lectures: PublicLecture[]; changes: ChangeEvent[]; spreadsheetUrl?: string | null }>;
  });
}

export function refreshBootstrap(scope?: BootstrapScope) {
  const url = new URL(`${base}/api/sync`, window.location.origin);
  applyScope(url, scope);
  return fetch(url.toString(), { method: "POST", credentials: "include" }).then(read);
}
