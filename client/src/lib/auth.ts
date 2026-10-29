export interface AuthState {
  authenticated: boolean;
  email?: string;
  faculty?: string;
  canSeeAllFaculty?: boolean;
}

const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

export async function fetchCurrentAuth(): Promise<AuthState> {
  try {
    const res = await fetch(`${base}/api/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) return { authenticated: false };
    return (await res.json()) as AuthState;
  } catch {
    return { authenticated: false };
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
  try {
    await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
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
