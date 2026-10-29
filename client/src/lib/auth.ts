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

let cachedClientId: string | undefined;

export async function fetchGoogleClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  if (envId) {
    cachedClientId = envId;
    return envId;
  }
  try {
    const res = await fetch(`${base}/api/auth/config`);
    if (res.ok) {
      const data = await res.json();
      if (data.clientId) {
        cachedClientId = (data.clientId as string).trim();
        return cachedClientId;
      }
    }
  } catch {
    // ignore
  }
  return "";
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

export async function verifyPin(pin: string): Promise<{
  ok: boolean;
  course?: string;
  batch?: string;
  error?: string;
}> {
  const cleanPin = pin.trim().replace(/\D/g, "");
  if (!cleanPin) return { ok: false, error: "Please enter a PIN." };
  if (cleanPin.length !== 6) return { ok: false, error: "PIN must be exactly 6 digits." };
  try {
    const res = await fetch(`${base}/api/auth/pin-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: cleanPin }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, course: data.course, batch: data.batch };
    }
    return { ok: false, error: data.error || "Invalid PIN." };
  } catch {
    return { ok: false, error: "Network error while verifying PIN." };
  }
}

export async function verifyBatchCode(course: string, batch: string, code: string): Promise<boolean> {
  const cleanCode = code.trim().replace(/\D/g, "");
  try {
    const res = await fetch(`${base}/api/auth/batch-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course, batch, code: cleanCode }),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.ok);
    }
  } catch {
    return false;
  }
  return false;
}
