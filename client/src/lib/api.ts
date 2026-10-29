import type { BootstrapResponse } from "@shared/types";

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
}

export function fetchBootstrap(scope?: BootstrapScope) {
  const url = new URL(`${base}/api/bootstrap`, window.location.origin);
  if (scope?.faculty) url.searchParams.set("faculty", scope.faculty);
  else if (scope?.division) url.searchParams.set("division", scope.division);
  else {
    if (scope?.course) url.searchParams.set("course", scope.course);
    if (scope?.batch) url.searchParams.set("batch", scope.batch);
  }
  return fetch(url.toString(), { credentials: "include" }).then(read);
}

export function refreshBootstrap(scope?: BootstrapScope) {
  const url = new URL(`${base}/api/sync`, window.location.origin);
  if (scope?.faculty) url.searchParams.set("faculty", scope.faculty);
  else if (scope?.division) url.searchParams.set("division", scope.division);
  else {
    if (scope?.course) url.searchParams.set("course", scope.course);
    if (scope?.batch) url.searchParams.set("batch", scope.batch);
  }
  return fetch(url.toString(), { method: "POST", credentials: "include" }).then(read);
}
