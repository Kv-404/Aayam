import { recoverFacultySession } from "@/lib/facultyBoot";
import { clearFacultySession, readFacultySession, saveFacultySession } from "@/lib/prefs";

export interface AuthState {
  authenticated: boolean;
  email?: string;
  faculty?: string;
  canSeeAllFaculty?: boolean;
  /** The session check never reached the server. Keep the saved faculty sign-in. */
  offline?: boolean;
}

const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

function authHeaders(): HeadersInit {
  const token = readFacultySession();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchCurrentAuth(): Promise<AuthState> {
  try {
    await recoverFacultySession();
    const res = await fetch(`${base}/api/auth/me`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!res.ok) return { authenticated: false, offline: true };
    const data = (await res.json()) as AuthState;
    if (!data.authenticated) clearFacultySession();
    return data;
  } catch {
    return { authenticated: false, offline: true };
  }
}

export async function loginWithGoogleCredential(credential: string): Promise<{
  ok: boolean;
  email: string;
  faculty: string;
  canSeeAllFaculty?: boolean;
}> {
  const res = await fetch(`${base}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ credential }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Google authentication failed.");
  }
  if (typeof data.token === "string") saveFacultySession(data.token);
  return data;
}

/** Google's sign-in script is only needed on the teacher sign-in screen, so students never download it. */
export function loadGoogleScript() {
  if (typeof document === "undefined" || window.google?.accounts?.id) return;
  if (document.querySelector('script[data-gsi]')) return;
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.dataset.gsi = "1";
  document.head.appendChild(script);
}

let clientIdTask: Promise<string> | null = null;
let clientIdMissedAt = 0;

/** One lookup per page. A missing id is not asked for again for a minute, so a retry loop stays local. */
export function fetchGoogleClientId(): Promise<string> {
  if (clientIdTask && (clientIdMissedAt === 0 || Date.now() - clientIdMissedAt < 60_000)) return clientIdTask;
  clientIdMissedAt = 0;
  clientIdTask = (async () => {
    const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    if (envId) return envId;
    try {
      const res = await fetch(`${base}/api/auth/config`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.clientId === "string" && data.clientId.trim()) return data.clientId.trim();
      }
    } catch {
      // ignore
    }
    clientIdMissedAt = Date.now();
    return "";
  })();
  return clientIdTask;
}

export async function logoutFaculty(): Promise<void> {
  const headers = authHeaders();
  clearFacultySession();
  try {
    await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers,
    });
  } catch {
    // Ignore error on logout
  }
}
