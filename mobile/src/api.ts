import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BootstrapResponse } from "@shared/types.ts";
import { findCoordinator } from "@shared/coordinators.ts";
import type { FacultyPick, Who } from "./prefs";

// Same API as the website. Sheet links live in D1; the app never sees them.
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? "https://aayam.kv404.dev").replace(/\/$/, "");
/** The site sends the faculty session here after Google sign-in (client/src/components/AppAuthPage.tsx). */
export const AUTH_REDIRECT = "aayam://auth";

let etag: string | null = null;
let cached: { key: string; body: BootstrapResponse } | null = null;

function scopeParams(who: Who | null) {
  const params = new URLSearchParams();
  if (who?.role === "student") {
    params.set("division", who.student.division);
    params.set("course", who.student.course);
    params.set("batch", who.student.batch);
  } else if (who?.role === "faculty") {
    // A coordinator or can_see_all teacher downloads everything; the app filters (site does the same).
    if (who.faculty.canSeeAll || findCoordinator(who.faculty.email, who.faculty.faculty)) params.set("all", "1");
    else params.set("faculty", who.faculty.faculty);
  }
  return params.toString();
}

const OFFLINE_KEY = "timetable-app-last-bootstrap";

/**
 * GET /api/bootstrap. Sends If-None-Match so an unchanged timetable costs a 304.
 * The last good copy is kept on the phone; with no network the app shows it, marked offline.
 */
export async function fetchBootstrap(who: Who | null): Promise<BootstrapResponse> {
  const key = scopeParams(who);
  const headers: Record<string, string> = {};
  if (etag && cached?.key === key) headers["If-None-Match"] = etag;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/bootstrap${key ? `?${key}` : ""}`, { headers });
  } catch {
    const saved = cached?.key === key ? cached.body : await readSaved(key);
    if (saved) return { ...saved, sync: { ...saved.sync, refreshing: false, lastError: "You are offline." } };
    throw new Error("You are offline, and there is no saved timetable yet.");
  }
  if (res.status === 304 && cached) return cached.body;
  if (!res.ok) {
    // Server trouble (or a captive portal): show the saved copy like offline, rather than nothing.
    const saved = res.status >= 500 ? (cached?.key === key ? cached.body : await readSaved(key)) : null;
    if (saved) return { ...saved, sync: { ...saved.sync, refreshing: false, lastError: `Timetable is not available (${res.status}).` } };
    throw new Error(`Timetable is not available (${res.status}).`);
  }
  const body = (await res.json()) as BootstrapResponse;
  etag = res.headers.get("ETag");
  cached = { key, body };
  void AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify({ key, body })).catch(() => undefined);
  return body;
}

async function readSaved(key: string) {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_KEY);
    const saved = raw ? (JSON.parse(raw) as { key: string; body: BootstrapResponse }) : null;
    return saved?.key === key ? saved.body : null;
  } catch {
    return null;
  }
}

/** The last timetable saved on the phone for this person, or null. Home-screen widgets read it. */
export function readSavedBootstrap(who: Who | null) {
  const key = scopeParams(who);
  return cached?.key === key ? Promise.resolve(cached.body) : readSaved(key);
}

/** POST /api/sync: asks the job to re-read the sheet. Returns the current timetable with refreshing on. */
export async function requestSync(who: Who | null) {
  await fetch(`${API_BASE}/api/sync`, { method: "POST" }).catch(() => undefined);
  return fetchBootstrap(who);
}

/** GET /api/auth/me with the saved session. */
export async function facultyMe(token: string): Promise<FacultyPick | null> {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Could not check your sign-in.");
  const data = (await res.json()) as { authenticated: boolean; email?: string; faculty?: string; canSeeAllFaculty?: boolean };
  if (!data.authenticated || !data.faculty) return null;
  return { faculty: data.faculty, email: data.email ?? "", canSeeAll: Boolean(data.canSeeAllFaculty) };
}

/**
 * Faculty sign-in by browser handoff. The site page does the normal Google sign-in, then sends the
 * session to aayam://auth with the same `state` we passed, so a link from anywhere else is ignored.
 */
export async function signInFaculty(): Promise<{ token: string; faculty: FacultyPick } | null> {
  const state = Crypto.randomUUID();
  const url = `${API_BASE}/app-auth?state=${encodeURIComponent(state)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, AUTH_REDIRECT);
  if (result.type !== "success") return null;
  const fragment = result.url.split("#")[1] ?? "";
  const params = new URLSearchParams(fragment);
  if (params.get("state") !== state) throw new Error("Sign-in did not come back from Aayam. Try again.");
  const error = params.get("error");
  if (error) throw new Error(error);
  const token = params.get("token");
  if (!token) throw new Error("Sign-in did not return a session.");
  const faculty = await facultyMe(token);
  if (!faculty) throw new Error("Sign-in was refused. Use an authorized faculty account.");
  return { token, faculty };
}

/** Calendar feed links, same as client/src/lib/calendar.ts but without window.location. */
export function calendarLinks(scope: { division?: string; faculty?: string }, label: string) {
  const params = new URLSearchParams();
  if (scope.faculty) params.set("faculty", scope.faculty);
  else if (scope.division) params.set("division", scope.division);
  const feed = `${API_BASE}/api/calendar.ics?${params}`;
  const webcal = feed.replace(/^https?:/, "webcal:");
  return {
    feed,
    download: `${feed}&download=1`,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    apple: webcal,
    outlook: `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(feed)}&name=${encodeURIComponent(label)}`,
    proton: "https://calendar.proton.me/u/0",
  };
}
