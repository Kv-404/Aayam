import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { themeIds, type ThemeId } from "./themes";

// Same key names and value shapes as client/src/lib/prefs.ts.
const ROLE = "timetable-role";
const COHORT = "timetable-cohort"; // division string, year included
const BATCH = "timetable-student-batch"; // JSON { course, batch }
const SETUP = "timetable-setup";
const FACULTY = "timetable-faculty";
const FACULTY_EMAIL = "timetable-faculty-email";
const CAN_SEE_ALL = "timetable-can-see-all-faculty";
const THEME = "timetable-theme";
const COLORS = "timetable-colors";
const BOLD = "timetable-bold";
const MEET = "timetable-meet";
const SEARCH = "timetable-search-history";
// Phone app only: the last Day or Week view picked in the bottom bar.
const VIEW = "timetable-app-view";
// The session token stays in the keychain, not AsyncStorage.
const SESSION = "timetable-faculty-session";

export interface StudentPick {
  division: string;
  course: string;
  batch: string;
}

export interface FacultyPick {
  faculty: string;
  email: string;
  canSeeAll: boolean;
}

export type Who = { role: "student"; student: StudentPick } | { role: "faculty"; faculty: FacultyPick };

export interface Look {
  theme: ThemeId;
  colors: boolean;
  bold: boolean;
  meet: "open" | "copy";
}

export const defaultLook: Look = { theme: "dark", colors: true, bold: false, meet: "open" };

export async function readWho(): Promise<Who | null> {
  try {
    const values = Object.fromEntries(await AsyncStorage.multiGet([SETUP, ROLE, COHORT, BATCH, FACULTY, FACULTY_EMAIL, CAN_SEE_ALL]));
    if (values[SETUP] !== "1") return null;
    if (values[ROLE] === "student" && values[COHORT] && values[BATCH]) {
      const { course, batch } = JSON.parse(values[BATCH]) as { course: string; batch: string };
      return { role: "student", student: { division: values[COHORT], course, batch } };
    }
    if (values[ROLE] === "faculty" && values[FACULTY] && (await readSession())) {
      return { role: "faculty", faculty: { faculty: values[FACULTY], email: values[FACULTY_EMAIL] ?? "", canSeeAll: values[CAN_SEE_ALL] === "1" } };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveStudent(pick: StudentPick) {
  await AsyncStorage.multiSet([
    [ROLE, "student"],
    [COHORT, pick.division],
    [BATCH, JSON.stringify({ course: pick.course, batch: pick.batch })],
    [SETUP, "1"],
  ]);
}

export async function saveFaculty(pick: FacultyPick, token: string) {
  await SecureStore.setItemAsync(SESSION, token);
  await AsyncStorage.multiSet([
    [ROLE, "faculty"],
    [FACULTY, pick.faculty],
    [FACULTY_EMAIL, pick.email],
    [CAN_SEE_ALL, pick.canSeeAll ? "1" : "0"],
    [SETUP, "1"],
  ]);
}

export async function readSession() {
  try {
    return await SecureStore.getItemAsync(SESSION);
  } catch {
    return null;
  }
}

/** Log out: the same keys the site clears. Theme, colours and Meet choice stay. */
export async function clearWho() {
  await AsyncStorage.multiRemove([BATCH, ROLE, COHORT, SETUP, FACULTY, FACULTY_EMAIL, CAN_SEE_ALL, "timetable-unlocked-batches"]);
  await SecureStore.deleteItemAsync(SESSION).catch(() => undefined);
}

export async function readLook(): Promise<Look> {
  try {
    const values = Object.fromEntries(await AsyncStorage.multiGet([THEME, COLORS, BOLD, MEET]));
    const stored = values[THEME] === "calendar" ? "light" : values[THEME];
    return {
      theme: themeIds.includes(stored as ThemeId) ? (stored as ThemeId) : "dark",
      colors: values[COLORS] !== "0",
      bold: values[BOLD] === "1",
      meet: values[MEET] === "copy" ? "copy" : "open",
    };
  } catch {
    return defaultLook;
  }
}

export async function saveLook(look: Look) {
  await AsyncStorage.multiSet([
    [THEME, look.theme],
    [COLORS, look.colors ? "1" : "0"],
    [BOLD, look.bold ? "1" : "0"],
    [MEET, look.meet],
  ]).catch(() => undefined);
}

export async function readSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

export async function saveSearchHistory(list: string[]) {
  await AsyncStorage.setItem(SEARCH, JSON.stringify(list.slice(0, 8))).catch(() => undefined);
}

export type TimetableView = "day" | "week";

export async function readView(): Promise<TimetableView | null> {
  try {
    const value = await AsyncStorage.getItem(VIEW);
    return value === "day" || value === "week" ? value : null;
  } catch {
    return null;
  }
}

export async function saveView(view: TimetableView) {
  await AsyncStorage.setItem(VIEW, view).catch(() => undefined);
}
