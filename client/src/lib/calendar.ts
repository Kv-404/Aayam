import { calendarFile } from "@shared/calendar";
import { cohortName } from "@shared/cohort";

export { eventTitle, googleCalendarUrl, googleStamp } from "@shared/calendar";
export { cohortName };

export function calendarFeedUrl(scope: { division?: string; faculty?: string }, download = false, external = false) {
  let origin = typeof window !== "undefined" ? window.location.origin : "https://timetable.kv404.dev";
  if (external && typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || !window.location.hostname)) {
    origin = "https://timetable.kv404.dev";
  }
  const feed = new URL("/api/calendar.ics", origin);
  if (scope.faculty) feed.searchParams.set("faculty", scope.faculty);
  else if (scope.division) feed.searchParams.set("division", scope.division);
  if (download) feed.searchParams.set("download", "1");
  return feed.toString();
}

export function googleWeekCalendarUrl(scope: { division?: string; faculty?: string }) {
  const feed = calendarFeedUrl(scope, false, true);
  const webcal = feed.replace(/^https?:/, "webcal:");
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
}

export function appleWeekCalendarUrl(scope: { division?: string; faculty?: string }) {
  return calendarFeedUrl(scope, false, false).replace(/^https?:/, "webcal:");
}

export function outlookWeekCalendarUrl(scope: { division?: string; faculty?: string }, label: string) {
  const feed = calendarFeedUrl(scope, false, true);
  return `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(feed)}&name=${encodeURIComponent(label)}`;
}

export function downloadCalendarFile(filename: string, lectures: Parameters<typeof calendarFile>[0], timeZone: string) {
  const body = calendarFile(lectures, timeZone);
  if (!body.includes("BEGIN:VEVENT")) return false;
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
