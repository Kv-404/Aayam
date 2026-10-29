export type ReminderKind = "10" | "5" | "start";

/** The one bucket that applies right now. A tighter window wins, so opening mid-way does not also announce the earlier one. */
export function dueReminder(startMinutes: number, endMinutes: number, minutes: number): ReminderKind | null {
  if (startMinutes < 0 || endMinutes <= startMinutes) return null;
  const remaining = startMinutes - minutes;
  if (remaining > 0 && remaining <= 5) return "5";
  if (remaining > 5 && remaining <= 10) return "10";
  if (minutes >= startMinutes && minutes < endMinutes && minutes < startMinutes + 2) return "start";
  return null;
}

export function reminderText(subject: string, kind: ReminderKind, cohort?: string) {
  const name = cohort ? `${subject} · ${cohort}` : subject;
  if (kind === "10") return `${name} starting in 10 mins`;
  if (kind === "5") return `${name} starting in 5 mins`;
  return `${name} started`;
}
