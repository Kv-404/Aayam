export const themeIds = ["dark", "light", "nord", "catppuccin", "dracula", "rose", "ocean", "matcha", "sunset"] as const;
export type ThemeId = (typeof themeIds)[number];

export const themes: { id: ThemeId; name: string; dark: boolean; blurb: string; swatch: [string, string, string] }[] = [
  { id: "dark", name: "Dark", dark: true, blurb: "Black and white", swatch: ["#111111", "#f4f4f5", "#3f3f46"] },
  { id: "light", name: "Light", dark: false, blurb: "Clean paper", swatch: ["#ffffff", "#171717", "#e4e4e7"] },
  { id: "nord", name: "Nord", dark: true, blurb: "Cool arctic", swatch: ["#2e3440", "#eceff4", "#88c0d0"] },
  { id: "catppuccin", name: "Catppuccin", dark: true, blurb: "Soft mocha", swatch: ["#1e1e2e", "#cdd6f4", "#cba6f7"] },
  { id: "dracula", name: "Dracula", dark: true, blurb: "Purple night", swatch: ["#282a36", "#f8f8f2", "#bd93f9"] },
  { id: "rose", name: "Rosé Pine", dark: true, blurb: "Dusty rose", swatch: ["#191724", "#e0def4", "#ebbcba"] },
  { id: "ocean", name: "Ocean", dark: true, blurb: "Deep blue", swatch: ["#0b1d36", "#e7f0ff", "#38bdf8"] },
  { id: "matcha", name: "Matcha", dark: true, blurb: "Green night", swatch: ["#121a14", "#e7f5ea", "#86efac"] },
  { id: "sunset", name: "Sunset", dark: true, blurb: "Warm pop", swatch: ["#1c1214", "#ffe8dc", "#fb7185"] },
];

const setupKey = "timetable-setup";
const cohortKey = "timetable-cohort";
const roleKey = "timetable-role";
const facultyKey = "timetable-faculty";
const themeKey = "timetable-theme";
const colorsKey = "timetable-colors";
const boldKey = "timetable-bold";
const meetKey = "timetable-meet";
const canSeeAllKey = "timetable-can-see-all-faculty";
const facultySessionKey = "timetable-faculty-session";
const unlockedBatchesKey = "timetable-unlocked-batches";
const studentBatchKey = "timetable-student-batch";

export type MeetAction = "open" | "copy";

function storageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Choices still apply for this visit when storage is blocked.
  }
}

export function readSetup() {
  return storageGet(setupKey) === "1";
}

export function hasChosenRole() {
  const role = storageGet(roleKey);
  return role === "student" || role === "faculty";
}

export type ViewerRole = "student" | "faculty";

export function readRole(): ViewerRole {
  return storageGet(roleKey) === "faculty" ? "faculty" : "student";
}

export function readStoredCohort() {
  return storageGet(cohortKey) ?? "";
}

export function readStoredFaculty() {
  return storageGet(facultyKey) ?? "";
}

export function readCanSeeAllFaculty(): boolean {
  return storageGet(canSeeAllKey) === "1";
}

export function saveCanSeeAllFaculty(allowed: boolean) {
  storageSet(canSeeAllKey, allowed ? "1" : "0");
}

export function readUnlockedBatches(): string[] {
  const raw = storageGet(unlockedBatchesKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isBatchUnlocked(course: string, batch: string): boolean {
  if (!course || !batch) return false;
  const key = `${course.trim()}:${batch.trim()}`;
  const list = readUnlockedBatches();
  if (list.includes(key)) return true;
  const student = readStudentBatch();
  if (
    student &&
    student.course.trim().toLowerCase() === course.trim().toLowerCase() &&
    student.batch.trim().toLowerCase() === batch.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function saveUnlockedBatch(course: string, batch: string) {
  if (!course || !batch) return;
  const key = `${course.trim()}:${batch.trim()}`;
  const current = readUnlockedBatches();
  if (!current.includes(key)) {
    storageSet(unlockedBatchesKey, JSON.stringify([...current, key]));
  }
}

export function saveStudentBatch(course: string, batch: string) {
  storageSet(studentBatchKey, JSON.stringify({ course, batch }));
  saveUnlockedBatch(course, batch);
}

export function readStudentBatch(): { course: string; batch: string } | null {
  const raw = storageGet(studentBatchKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.course === "string" && typeof parsed.batch === "string") {
      return parsed;
    }
  } catch {}
  return null;
}

export function clearStudentAuth() {
  try {
    localStorage.removeItem(studentBatchKey);
    localStorage.removeItem(unlockedBatchesKey);
    localStorage.removeItem(cohortKey);
    localStorage.removeItem(roleKey);
    localStorage.removeItem(setupKey);
  } catch {}
}

export function readStoredTheme(): ThemeId {
  const stored = storageGet(themeKey);
  if (stored === "calendar") {
    storageSet(themeKey, "light");
    return "light";
  }
  if (themeIds.includes(stored as ThemeId)) return stored as ThemeId;
  if (storageGet("theme") === "light") return "light";
  return "dark";
}

export function readStoredColors() {
  return storageGet(colorsKey) !== "0";
}

export function readStoredBold() {
  return storageGet(boldKey) === "1";
}

/** Absent key stays "open" so a saved theme and cohort are left alone. */
export function readStoredMeet(): MeetAction {
  return storageGet(meetKey) === "copy" ? "copy" : "open";
}

export function themeMeta(id: ThemeId) {
  return themes.find((theme) => theme.id === id) ?? themes[0]!;
}

export function applyTheme(id: ThemeId) {
  const theme = themeMeta(id);
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.classList.toggle("dark", theme.dark);
  document.documentElement.style.colorScheme = theme.dark ? "dark" : "light";
  storageSet(themeKey, theme.id);
  storageSet("theme", theme.dark ? "dark" : "light");
}

export function applyColors(on: boolean) {
  document.documentElement.dataset.colors = on ? "on" : "off";
  storageSet(colorsKey, on ? "1" : "0");
}

export function applyBold(on: boolean) {
  document.documentElement.dataset.bold = on ? "on" : "off";
  storageSet(boldKey, on ? "1" : "0");
}

export function saveMeet(action: MeetAction) {
  storageSet(meetKey, action);
}

export function saveCohort(division: string) {
  if (division) {
    storageSet(cohortKey, division);
    storageSet(roleKey, "student");
  }
}

export function saveFaculty(name: string) {
  if (name) {
    storageSet(facultyKey, name);
    storageSet(roleKey, "faculty");
  }
}

export function readFacultySession() {
  return storageGet(facultySessionKey) ?? "";
}

export function saveFacultySession(token: string) {
  if (token) storageSet(facultySessionKey, token);
}

export function clearFacultySession() {
  try {
    localStorage.removeItem(facultySessionKey);
  } catch {
    // The cookie clear still signs the browser out.
  }
}

export function saveRole(role: ViewerRole) {
  storageSet(roleKey, role);
}

export function saveSetup(choices: { role: ViewerRole; cohort: string; faculty: string; theme: ThemeId }) {
  storageSet(roleKey, choices.role);
  if (choices.role === "student" && choices.cohort) {
    saveCohort(choices.cohort);
  } else if (choices.role === "faculty" && choices.faculty) {
    saveFaculty(choices.faculty);
  } else {
    if (choices.cohort) storageSet(cohortKey, choices.cohort);
    if (choices.faculty) storageSet(facultyKey, choices.faculty);
  }
  applyTheme(choices.theme);
  storageSet(setupKey, "1");
}

const searchHistoryKey = "timetable-search-history";
const searchHistoryLimit = 8;

function normalizeSearchHistory(items: unknown[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
    if (next.length === searchHistoryLimit) break;
  }
  return next;
}

export function readSearchHistory(): string[] {
  try {
    const raw = storageGet(searchHistoryKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeSearchHistory(parsed);
  } catch {
    return [];
  }
}

export function rememberSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return readSearchHistory();
  const next = normalizeSearchHistory([trimmed, ...readSearchHistory()]);
  storageSet(searchHistoryKey, JSON.stringify(next));
  return next;
}

export function forgetSearch(query: string) {
  const key = query.trim().toLowerCase();
  const next = readSearchHistory().filter((item) => item.toLowerCase() !== key);
  storageSet(searchHistoryKey, JSON.stringify(next));
  return next;
}

export function clearSearchHistory() {
  storageSet(searchHistoryKey, "[]");
  return [];
}
