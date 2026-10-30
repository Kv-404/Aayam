import { scopeForSavedFaculty } from "@shared/facultySession";
import type { BootstrapScope } from "@/lib/api";
import {
  readCanSeeAllFaculty,
  readDeviceFacultySession,
  readFacultyEmail,
  readFacultySession,
  readMirroredFacultySession,
  readRole,
  readStoredFaculty,
  saveFacultySession,
} from "@/lib/prefs";

/** iPhone home-screen icons open as their own app, with storage Safari does not share. */
export function isHomeScreenApp() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** A faculty sign-in kept on this device. The public home page stays for everyone else. */
export function storedFacultyScope(): BootstrapScope | null {
  const token = readFacultySession() || readDeviceFacultySession();
  if (token && !readFacultySession()) saveFacultySession(token);
  const scope = scopeForSavedFaculty({
    token,
    role: readRole(),
    faculty: readStoredFaculty(),
    email: readFacultyEmail(),
    canSeeAll: readCanSeeAllFaculty(),
  });
  return scope;
}

/** localStorage is the first copy. The device cookie and IndexedDB cover a shortcut that dropped it. */
export async function recoverFacultySession() {
  const current = readFacultySession();
  if (current) return current;
  const fromCookie = readDeviceFacultySession();
  if (fromCookie) {
    saveFacultySession(fromCookie);
    return fromCookie;
  }
  const mirrored = await readMirroredFacultySession();
  if (mirrored) {
    saveFacultySession(mirrored);
    return mirrored;
  }
  return "";
}
