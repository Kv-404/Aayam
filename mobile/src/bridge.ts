import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { fetchBootstrap, readSavedBootstrap, signInFaculty } from "./api";
import { disableNotifications, enableNotifications, readNotifyOn, registerPush, scheduleReminders, unregisterPush } from "./notify";
import { readLook, readWho, type Who } from "./prefs";
import { ownLectures } from "./widgets/data";
import { refreshWidgets } from "./widgets/handler";

// The site is the app's UI. These are the site's localStorage keys the phone needs for alerts and widgets.
// Same names as client/src/lib/prefs.ts and ./prefs.ts, so they copy across as they are.
const SESSION = "timetable-faculty-session";
export const MIRRORED_KEYS = [
  "timetable-setup",
  "timetable-role",
  "timetable-cohort",
  "timetable-student-batch",
  "timetable-faculty",
  "timetable-faculty-email",
  "timetable-can-see-all-faculty",
  "timetable-theme",
  "timetable-colors",
  "timetable-bold",
  "timetable-meet",
  SESSION,
];

/**
 * Runs in the page before it loads: wraps localStorage so every change sends the keys above to the phone.
 * The page itself needs no change for this.
 */
export const injectedBridge = `(function () {
  if (window.__aayamBridge) return;
  window.__aayamBridge = true;
  var keys = ${JSON.stringify(MIRRORED_KEYS)};
  var timer;
  function send() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var state = {};
      try { keys.forEach(function (key) { state[key] = window.localStorage.getItem(key); }); } catch (e) { return; }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "state", state: state }));
    }, 250);
  }
  ["setItem", "removeItem", "clear"].forEach(function (name) {
    var original = Storage.prototype[name];
    Storage.prototype[name] = function () {
      var result = original.apply(this, arguments);
      if (this === window.localStorage) send();
      return result;
    };
  });
  window.addEventListener("load", send);
  send();
})();
true;`;

/** Script that hands a reply to the page's `aayam-native` listener (client/src/lib/nativeApp.ts). */
export function replyScript(reply: Record<string, unknown>) {
  return `window.dispatchEvent(new CustomEvent("aayam-native", { detail: ${JSON.stringify(reply)} })); true;`;
}

let lastWho: string | null = null;

/** Copies the page's choices into phone storage, then re-registers push and redraws widgets when needed. */
export async function applyState(state: Record<string, string | null>) {
  const set: [string, string][] = [];
  const remove: string[] = [];
  for (const key of MIRRORED_KEYS) {
    if (key === SESSION) continue;
    const value = state[key];
    if (typeof value === "string") set.push([key, value]);
    else remove.push(key);
  }
  if (set.length) await AsyncStorage.multiSet(set);
  if (remove.length) await AsyncStorage.multiRemove(remove);
  const session = state[SESSION];
  if (session) await SecureStore.setItemAsync(SESSION, session).catch(() => undefined);
  else await SecureStore.deleteItemAsync(SESSION).catch(() => undefined);

  const who = await readWho();
  const signature = JSON.stringify(who);
  if (signature !== lastWho) {
    const first = lastWho === null;
    lastWho = signature;
    if (!who) {
      // Signed out on the site: the phone stops this person's alerts.
      if (!first) {
        await unregisterPush();
        await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
      }
    } else if (await readNotifyOn()) {
      void registerPush(who);
    }
  }
  await refreshNative(who);
}

/** Reminders and widgets come from the phone's own fetch, so they work with the app closed. */
export async function refreshNative(who?: Who | null) {
  const person = who === undefined ? await readWho() : who;
  if (!person) return;
  const data = await fetchBootstrap(person).catch(() => readSavedBootstrap(person));
  if (!data) return;
  if (await readNotifyOn()) {
    const lectures = ownLectures(data, person).filter((lecture) => lecture.kind !== "break");
    await scheduleReminders(lectures, data.timezone, person.role === "faculty").catch(() => undefined);
  }
  await refreshWidgets(data, person, await readLook()).catch(() => undefined);
}

type Request = { type: "signin"; id: string } | { type: "notify"; id: string; on: boolean } | { type: "notify-state"; id: string };

/** Answers a request from the page. The reply carries the same id. */
export async function handleRequest(message: Request): Promise<Record<string, unknown>> {
  try {
    if (message.type === "signin") {
      const result = await signInFaculty();
      if (!result) return { id: message.id, ok: false };
      return { id: message.id, ok: true, token: result.token, faculty: result.faculty.faculty, email: result.faculty.email, canSeeAll: result.faculty.canSeeAll };
    }
    if (message.type === "notify-state") return { id: message.id, ok: true, on: await readNotifyOn() };
    if (!message.on) {
      await disableNotifications();
      return { id: message.id, ok: true, on: false };
    }
    const who = await readWho();
    if (!who) return { id: message.id, ok: false, message: "Pick your class first." };
    const result = await enableNotifications(who);
    if (result.ok) void refreshNative(who);
    return { id: message.id, ok: result.ok, on: result.ok, message: result.message };
  } catch (err) {
    return { id: message.id, ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
  }
}
