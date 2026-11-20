const calendarDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const longDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const zonedFormatters = new Map<string, Intl.DateTimeFormat>();
function getZonedFormatter(timeZone: string) {
  let fmt = zonedFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "long",
    });
    zonedFormatters.set(timeZone, fmt);
  }
  return fmt;
}

const clockTimeFormatters = new Map<string, Intl.DateTimeFormat>();
function getClockTimeFormatter(timeZone: string) {
  let fmt = clockTimeFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    clockTimeFormatters.set(timeZone, fmt);
  }
  return fmt;
}

const detectedFormatters = new Map<string, Intl.DateTimeFormat>();
function getDetectedFormatter(timeZone: string) {
  let fmt = detectedFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    detectedFormatters.set(timeZone, fmt);
  }
  return fmt;
}

export function zonedNow(date: Date, timeZone: string) {
  const parts = getZonedFormatter(timeZone).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: get("weekday") || "Monday",
  };
}

export function formatClockTime(date: Date, timeZone: string) {
  return getClockTimeFormatter(timeZone).format(date);
}

/** "10:00 AM"–"11:00 AM" becomes "10:00–11:00". Daytime slots stay clear without AM/PM. */
export function formatCompactRange(start: string, end: string) {
  const bare = (label: string) => label.replace(/\s*[AP]M$/i, "").trim();
  const left = bare(start);
  const right = bare(end);
  if (!left) return right;
  if (!right || left === right) return left;
  return `${left}–${right}`;
}

/** Absolute Meet URL, or null when the room is a classroom. */
export function meetHref(room: string) {
  const match = room.trim().match(/((?:https?:\/\/)?(?:www\.)?meet\.google\.com\/[a-z0-9-]+)/i);
  if (!match?.[1]) return null;
  const raw = match[1];
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^www\./i, "")}`;
}

/** "Classroom - 29" and "Room 29" become "Cr 29". A Meet link becomes "Meet". */
export function compactRoom(room: string) {
  const text = room.trim();
  if (meetHref(text)) return "Meet";
  const numbered = text.match(/^(?:classroom(?:\s*no\.?)?|room)\s*[-.]?\s*(\d+)\s*$/i);
  if (numbered?.[1]) return `Cr ${numbered[1]}`;
  const named = text.match(/^room\s+(.+)$/i);
  if (named?.[1]) return `Cr ${named[1]}`;
  return text;
}

export function formatCalendarDate(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  return calendarDateFormatter.format(date);
}

export function formatLongDate(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  return longDateFormatter.format(date);
}

export function formatDetected(iso: string, timeZone: string) {
  return getDetectedFormatter(timeZone).format(new Date(iso));
}

/** 530 becomes "08:50". Used by the time grid's hour gutter and block times. */
// 12h clock, like the rest of the app. `period` adds AM/PM (hour gutter); `hourOnly` drops ":00".
export function clockFromMinutes(total: number, options: { period?: boolean; hourOnly?: boolean } = {}) {
  const value = Math.max(0, Math.round(total));
  const hours24 = Math.floor(value / 60) % 24;
  const minutes = value % 60;
  const hours = hours24 % 12 || 12;
  const base = options.hourOnly && minutes === 0 ? String(hours) : `${hours}:${String(minutes).padStart(2, "0")}`;
  return options.period ? `${base} ${hours24 < 12 ? "AM" : "PM"}` : base;
}
