import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PublicLecture } from "@shared/types.ts";
import { cohortLabel } from "@shared/cohort.ts";
import { reminderText, type ReminderKind } from "@shared/reminders.ts";
import { compactRoom } from "@web/time.ts";
import { API_BASE } from "./api";
import { readSession, type Who } from "./prefs";

// Same key as the site: "1" after opt-in, removed when switched off.
const NOTIFY = "timetable-notify";
const PUSH_TOKEN = "timetable-app-push-token";
/** iOS keeps at most 64 scheduled notifications per app. Stay under it. */
const MAX_SCHEDULED = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function readNotifyOn() {
  try {
    return (await AsyncStorage.getItem(NOTIFY)) === "1";
  } catch {
    return false;
  }
}

/** Android needs channels before it will ask for permission or hand out a push token. */
async function ensureChannels() {
  if (Platform.OS !== "android") return;
  const base = { importance: Notifications.AndroidImportance.HIGH, lightColor: "#ffffff" };
  await Notifications.setNotificationChannelAsync("changes", { ...base, name: "Timetable changes", description: "Cancelled classes, room and time changes" });
  await Notifications.setNotificationChannelAsync("notices", { ...base, name: "Notices", description: "Messages from the admin" });
  await Notifications.setNotificationChannelAsync("reminders", { ...base, name: "Class reminders", description: "10 and 5 minutes before a class, and when it starts" });
}

/**
 * Turn alerts on: ask permission (only from the user's tap, never on load), then register for push.
 * Returns what worked so the switch can say so. Reminders need permission only; push also needs
 * a store or development build with Firebase set up.
 */
export async function enableNotifications(who: Who): Promise<{ ok: boolean; push: boolean; message?: string }> {
  await ensureChannels();
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return { ok: false, push: false, message: "Notifications are blocked. Allow them for Aayam in your phone settings." };
  await AsyncStorage.setItem(NOTIFY, "1");
  const push = await registerPush(who);
  return { ok: true, push, message: push ? undefined : "Class reminders are on. Timetable change alerts need the latest app build." };
}

export async function disableNotifications() {
  await AsyncStorage.removeItem(NOTIFY).catch(() => undefined);
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await unregisterPush();
}

/** Sends this phone's Expo push token and scope to the Worker. False if this build cannot get a token. */
export async function registerPush(who: Who): Promise<boolean> {
  try {
    await ensureChannels();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: Record<string, string>;
    if (who.role === "faculty") {
      const session = await readSession();
      if (!session) return false;
      headers.Authorization = `Bearer ${session}`;
      body = { token, role: "faculty" };
    } else {
      body = { token, role: "student", course: who.student.course, batch: who.student.batch, division: who.student.division };
    }
    const res = await fetch(`${API_BASE}/api/push/app-register`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) return false;
    await AsyncStorage.setItem(PUSH_TOKEN, token);
    return true;
  } catch {
    // Expo Go on Android, or no Firebase config in this build: reminders still work.
    return false;
  }
}

/** Notifications off or signed out: the server forgets this phone. */
export async function unregisterPush() {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN);
    if (!token) return;
    await fetch(`${API_BASE}/api/push/app-unregister`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    await AsyncStorage.removeItem(PUSH_TOKEN);
  } catch {
    // Offline: the job deletes the token once Expo reports it gone.
  }
}

/** Wall-clock minutes on a date in `timeZone`, as an absolute time. */
function zonedInstant(dateIso: string, minutes: number, timeZone: string) {
  const [year, month, day] = dateIso.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(year, month - 1, day, 0, minutes);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (wall - guess));
}

/**
 * Lecture reminders, scheduled on the phone so they arrive with the app closed:
 * 10 minutes before, 5 minutes before, and at the start (same three as the site's reminders).
 * Cancelled classes, OFF and breaks get none. Re-run after every refresh, so a cancellation drops its reminders.
 */
export async function scheduleReminders(lectures: PublicLecture[], timeZone: string, faculty: boolean) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await readNotifyOn())) return 0;
  const now = Date.now();
  const offsets: Array<[ReminderKind, number]> = [
    ["10", -10],
    ["5", -5],
    ["start", 0],
  ];
  const due: Array<{ at: Date; title: string; body: string; id: string }> = [];
  for (const lecture of lectures) {
    if (lecture.kind !== "lecture" || !lecture.date || lecture.displayStatus === "cancelled" || lecture.subject.trim().toUpperCase() === "OFF") continue;
    for (const [kind, offset] of offsets) {
      const at = zonedInstant(lecture.date, lecture.startMinutes + offset, timeZone);
      if (at.getTime() <= now + 15_000) continue;
      // A teacher's reminder names the cohort; a student's does not name the faculty.
      const title = reminderText(lecture.subject, kind, faculty ? cohortLabel(lecture.division) : undefined);
      due.push({ at, title, body: lecture.room ? compactRoom(lecture.room) : "", id: `${lecture.id}:${kind}` });
    }
  }
  due.sort((a, b) => a.at.getTime() - b.at.getTime());
  const next = due.slice(0, MAX_SCHEDULED);
  for (const item of next) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body, sound: "default", data: { kind: "reminder" } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: "reminders" },
    });
  }
  return next.length;
}
