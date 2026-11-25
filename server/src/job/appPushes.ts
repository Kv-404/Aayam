import type { SqlDb } from "../d1/sql.ts";
import { cohortLabel } from "../../../shared/cohort.ts";
import { deviceWantsChange, subscriptionMatches, type AppDevice } from "../services/pushAudience.ts";

/** Same list as client/src/lib/notifyChanges.ts: a class disappeared, came back, or moved. */
const ALERT_TYPES = new Set([
  "cancelled",
  "restored",
  "rescheduled",
  "room_change",
  "faculty_change",
  "subject_change",
  "details_changed",
  "replaced",
  "added",
  "removed",
  "reverted",
  "tab_added",
  "tab_removed",
]);

/** A change the job finds this late (job was down) is old news: mark it sent, do not buzz phones. */
const CHANGE_WINDOW_MS = 6 * 60 * 60 * 1000;
const EXPO_URL = "https://exp.host/--/api/v2/push/send";
const BATCH = 100;

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: "changes" | "notices";
  data: Record<string, string>;
}

export type ExpoSend = (messages: ExpoMessage[]) => Promise<Array<{ status: string; details?: { error?: string } }>>;

/** Expo's push service relays to FCM (Android) and APNs (iOS). `EXPO_ACCESS_TOKEN` is optional. */
export const expoSend: ExpoSend = async (messages) => {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(EXPO_URL, { method: "POST", headers, body: JSON.stringify(messages) });
  if (!res.ok) throw new Error(`Expo push answered ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
  return data.data ?? [];
};

export interface AppPushResult {
  changes: number;
  notices: number;
  delivered: number;
  removed: number;
}

interface ChangeRow {
  id: number;
  detected_at: string;
  type: string;
  lecture_id: string | null;
  division: string | null;
  summary: string;
  previous: string | null;
  next: string | null;
}

export interface AppNotice {
  id: string;
  title: string;
  body: string;
  course: string | null;
  batch: string | null;
}

const parse = (value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value) as { faculty?: string };
  } catch {
    return null;
  }
};

/** Send in batches of 100; a token Expo calls DeviceNotRegistered is deleted. */
async function deliver(sql: SqlDb, messages: ExpoMessage[], send: ExpoSend) {
  let delivered = 0;
  const gone = new Set<string>();
  for (let start = 0; start < messages.length; start += BATCH) {
    const chunk = messages.slice(start, start + BATCH);
    const tickets = await send(chunk);
    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") delivered += 1;
      else if (ticket.details?.error === "DeviceNotRegistered") gone.add(chunk[index]!.to);
    });
  }
  if (gone.size > 0) {
    await sql.run([{ sql: "DELETE FROM app_push_devices WHERE token IN (SELECT value FROM json_each(?))", params: [JSON.stringify([...gone])] }]);
  }
  return { delivered, removed: gone.size };
}

/**
 * Phone pushes after a sync: timetable changes detected since the last run, and the notices
 * `sendPendingPushes` just claimed. Several changes for one phone become one message.
 */
export async function sendAppPushes(sql: SqlDb, now: Date, notices: AppNotice[] = [], send: ExpoSend = expoSend): Promise<AppPushResult> {
  const result: AppPushResult = { changes: 0, notices: 0, delivered: 0, removed: 0 };
  const stamp = now.toISOString();

  const state = (await sql.all<{ changes_after: string }>("SELECT changes_after FROM app_push_state WHERE id = 1"))[0];
  // First run: start from now so the existing log is not replayed.
  if (!state) {
    await sql.run([{ sql: "INSERT OR IGNORE INTO app_push_state (id, changes_after) VALUES (1, ?)", params: [stamp] }]);
  }
  const after = state?.changes_after ?? stamp;
  const rows = state
    ? await sql.all<ChangeRow>(
        "SELECT id, detected_at, type, lecture_id, division, summary, previous, next FROM timetable_changes WHERE week_id = 'live' AND detected_at > ? ORDER BY detected_at DESC, id DESC",
        [after],
      )
    : [];
  if (rows.length > 0) {
    const newest = rows.reduce((max, row) => (row.detected_at > max ? row.detected_at : max), after);
    await sql.run([{ sql: "UPDATE app_push_state SET changes_after = ? WHERE id = 1", params: [newest] }]);
  }
  const changes = rows.filter((row) => ALERT_TYPES.has(row.type) && now.getTime() - Date.parse(row.detected_at) <= CHANGE_WINDOW_MS);

  const devices = changes.length > 0 || notices.length > 0 ? await sql.all<AppDevice>("SELECT token, role, course, batch, division, faculty FROM app_push_devices") : [];
  if (devices.length === 0) return { ...result, changes: changes.length, notices: notices.length };

  const lectureIds = [...new Set(changes.map((change) => change.lecture_id).filter((id): id is string => Boolean(id)))];
  const lectureFaculty = new Map<string, string>();
  if (lectureIds.length > 0 && devices.some((device) => device.role === "faculty")) {
    const owners = await sql.all<{ id: string; faculty: string }>(
      "SELECT id, faculty FROM timetable_lectures WHERE week_id = 'live' AND id IN (SELECT value FROM json_each(?))",
      [JSON.stringify(lectureIds)],
    );
    for (const owner of owners) lectureFaculty.set(owner.id, owner.faculty);
  }

  const messages: ExpoMessage[] = [];
  for (const device of devices) {
    const mine = changes.filter((change) =>
      deviceWantsChange(device, { lectureId: change.lecture_id, division: change.division, previous: parse(change.previous), next: parse(change.next) }, lectureFaculty),
    );
    const newest = mine[0];
    if (newest) {
      // Faculty see the cohort in the title; a student already knows their own.
      const title = device.role === "faculty" && newest.division ? cohortLabel(newest.division) : "Timetable changed";
      messages.push({
        to: device.token,
        title,
        body: mine.length === 1 ? newest.summary : `${mine.length} updates. ${newest.summary}`,
        sound: "default",
        channelId: "changes",
        data: { kind: "change", id: String(newest.id) },
      });
    }
    if (device.role !== "faculty") {
      for (const notice of notices) {
        if (!subscriptionMatches(device, notice)) continue;
        messages.push({ to: device.token, title: notice.title, body: notice.body, sound: "default", channelId: "notices", data: { kind: "notice", id: notice.id } });
      }
    }
  }
  const sent = messages.length > 0 ? await deliver(sql, messages, send) : { delivered: 0, removed: 0 };
  return { changes: changes.length, notices: notices.length, ...sent };
}
