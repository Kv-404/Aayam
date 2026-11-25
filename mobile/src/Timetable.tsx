import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, GraduationCap, Search, Settings, X } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BootstrapResponse, ChangeEvent, PublicLecture } from "@shared/types.ts";
import { cohortLabel, lectureInCohort } from "@shared/cohort.ts";
import { changeMatchesFaculty, lectureMatchesFaculty } from "@shared/faculty.ts";
import { coordinatorChoices, findCoordinator } from "@shared/coordinators.ts";
import { formatDetected, zonedNow } from "@web/time.ts";
import type { Who } from "./prefs";
import { tint, useLook, type Theme } from "./theme";
import { Logo } from "./Logo";
import { T } from "./ui";
import { DayCard, WeekRow, dayLong, dayMonth, dayShort, isOff, range, type CardLens } from "./cards";
import { CalendarSheet, SearchPanel, SettingsSheet } from "./panels";
import * as Notifications from "expo-notifications";
import { disableNotifications, enableNotifications, readNotifyOn, registerPush, scheduleReminders } from "./notify";
import { refreshWidgets } from "./widgets/handler";

// expo-notifications has no last-tap API on web; the hook throws there.
const useLastTap = Platform.OS === "web" ? () => null : Notifications.useLastNotificationResponse;

type Tab = "day" | "week" | "updates";
type FacultyLens = "mine" | "cohorts" | "all";
const lensLabel: Record<FacultyLens, string> = { mine: "My classes", cohorts: "My cohorts", all: "All classes" };
const EXAM_URL = "https://exam.somyacodes.in/";
const EXAM_KEY = "timetable-exam-notice";
const NOTICE_KEY = "timetable-notice-ids";
const readKey = (key: string) => AsyncStorage.getItem(key).catch(() => null);
const writeKey = (key: string, value: string) => AsyncStorage.setItem(key, value).catch(() => undefined);
/** The alert tap already acted on, so a remount (sign out, sign in) does not jump tabs again. */
let handledTap: string | null = null;

export function Timetable({ data, who, refreshing, onRefresh, onLogout }: { data: BootstrapResponse; who: Who; refreshing: boolean; onRefresh: () => void; onLogout: () => void }) {
  const { theme } = useLook();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("day");
  const [panel, setPanel] = useState<"none" | "search" | "calendar" | "settings" | "scope">("none");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2800);
  };

  const faculty = who.role === "faculty" ? who.faculty : null;

  // Teacher views, same as the site: own classes; a coordinator's cohorts; everything for can_see_all.
  const coordinator = faculty ? findCoordinator(faculty.email, faculty.faculty) : undefined;
  const lensOptions: FacultyLens[] = faculty ? ["mine", ...(coordinator ? (["cohorts"] as const) : []), ...(faculty.canSeeAll ? (["all"] as const) : [])] : [];
  const [view, setView] = useState<FacultyLens>(faculty?.canSeeAll ? "all" : coordinator ? "cohorts" : "mine");
  const wide = view !== "mine";
  const myCohorts = useMemo(() => (coordinator ? coordinatorChoices(data.choices ?? [], coordinator) : []), [coordinator, data.choices]);

  // Notifications: the switch, push registration once per signed-in person, and taps on alerts.
  const [notifyOn, setNotifyOn] = useState(false);
  const whoKey = who.role === "faculty" ? `f:${who.faculty.faculty}` : `s:${who.student.division}`;
  useEffect(() => {
    void readNotifyOn().then((on) => {
      setNotifyOn(on);
      if (on) void registerPush(who);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whoKey]);
  // The site's notify hint: shown until turned on or closed (`timetable-notify-hint`).
  const [hintGone, setHintGone] = useState(true);
  useEffect(() => {
    void AsyncStorage.getItem("timetable-notify-hint").then((value) => setHintGone(value === "1")).catch(() => undefined);
  }, []);
  const closeHint = () => {
    setHintGone(true);
    void AsyncStorage.setItem("timetable-notify-hint", "1").catch(() => undefined);
  };
  const lastTap = useLastTap();
  useEffect(() => {
    if (!lastTap) return;
    const tapId = `${lastTap.notification.request.identifier}:${lastTap.notification.date}`;
    if (handledTap === tapId) return;
    handledTap = tapId;
    const kind = lastTap.notification.request.content.data?.kind;
    if (kind === "change" || kind === "notice") setTab("updates");
    else if (kind === "reminder") setTab("day");
  }, [lastTap]);
  const toggleNotify = async (on: boolean) => {
    if (!on) {
      await disableNotifications();
      setNotifyOn(false);
      showNotice("Notifications off");
      return;
    }
    const result = await enableNotifications(who);
    setNotifyOn(result.ok);
    showNotice(result.message ?? "Notifications on");
  };

  const lens: CardLens = faculty ? (wide ? "all" : "faculty") : "student";

  const mine = useMemo(() => {
    let list: PublicLecture[];
    if (who.role === "student") {
      const choice = data.choices?.find((item) => item.division === who.student.division && item.course === who.student.course && item.batch === who.student.batch);
      list = data.lectures.filter((lecture) => lectureInCohort(lecture, choice ?? who.student));
    } else if (view === "all") {
      list = data.lectures.filter((lecture) => lecture.kind !== "break");
    } else if (view === "cohorts") {
      list = data.lectures.filter((lecture) => lecture.kind !== "break" && myCohorts.some((choice) => lectureInCohort(lecture, choice)));
    } else {
      // Lunch and OFF rows carry no faculty, so they never show on a teacher's timetable.
      list = data.lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, who.faculty.faculty));
    }
    return [...list].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.startMinutes - b.startMinutes || a.division.localeCompare(b.division));
  }, [data.lectures, data.choices, who, view, myCohorts]);

  const changes = useMemo(() => {
    if (who.role === "student") {
      // The cohort and its shared column, same as the site's watched divisions.
      const choice = data.choices?.find((item) => item.division === who.student.division && item.course === who.student.course && item.batch === who.student.batch);
      const divisions = new Set([who.student.division, ...(choice?.also ?? [])]);
      return data.changes.filter((change) => !change.division || divisions.has(change.division));
    }
    if (view === "all") return data.changes;
    if (view === "cohorts") {
      const divisions = new Set(myCohorts.flatMap((choice) => [choice.division, ...choice.also]));
      return data.changes.filter((change) => !change.division || divisions.has(change.division));
    }
    const ids = new Set(mine.map((lecture) => lecture.id));
    return data.changes.filter((change) => changeMatchesFaculty(change, who.faculty.faculty, ids));
  }, [data.changes, data.choices, who, view, myCohorts, mine]);

  // Reminders follow the person's own classes (not All classes), and re-plan after every refresh.
  const ownLectures = useMemo(
    () => (who.role === "faculty" ? data.lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, who.faculty.faculty)) : wide ? [] : mine),
    [data.lectures, who, mine, wide],
  );
  useEffect(() => {
    if (notifyOn) void scheduleReminders(ownLectures, data.timezone, who.role === "faculty").catch(() => undefined);
  }, [notifyOn, ownLectures, data.timezone, who.role]);
  // Android home-screen widgets redraw from every new timetable and look.
  useEffect(() => void refreshWidgets(data, who, theme.look), [data, who, theme.look]);

  // The phone's own clock, ticking, like the site. `data.now` is frozen while the server answers 304 or the app is offline.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const now = zonedNow(new Date(clock), data.timezone);
  const today = now.iso;

  const days = useMemo(() => [...new Set(mine.map((lecture) => lecture.date).filter((date): date is string => !!date))].sort(), [mine]);
  const [day, setDay] = useState(days.includes(today) ? today : (days[0] ?? today));
  useEffect(() => {
    if (days.length && !days.includes(day)) setDay(days.includes(today) ? today : days[0]!);
  }, [days, day, today]);

  const stamp = (date: string | null, minutes: number) => `${date ?? ""}${String(minutes).padStart(4, "0")}`;
  const nowStamp = stamp(now.iso, now.minutes);
  // Many classes run at once in All classes, so it has no Now mark (same rule as the site).
  const isLive = (lecture: PublicLecture) => !wide && lecture.date === now.iso && lecture.startMinutes <= now.minutes && now.minutes < lecture.endMinutes;
  const next = wide ? undefined : mine.find((lecture) => lecture.kind === "lecture" && lecture.displayStatus !== "cancelled" && !isOff(lecture) && stamp(lecture.date, lecture.endMinutes) > nowStamp);

  const title = faculty ? lensLabel[view].replace("My classes", faculty.faculty) : cohortLabel(who.role === "student" ? who.student.division : "");
  const subtitle = who.role === "student" ? `${who.student.course === "BTech" ? "B.Tech" : who.student.course} · ${who.student.batch.replace("-", "–")}` : faculty?.email ?? "";
  const calendarScope = faculty ? { faculty: faculty.faculty } : { division: who.role === "student" ? who.student.division : undefined };

  const icon = (Icon: typeof Search, onPress: () => void, label: string) => (
    <Pressable onPress={onPress} hitSlop={8} style={styles.icon} accessibilityLabel={label}>
      <Icon size={19} color={theme.fg} strokeWidth={1.75} />
    </Pressable>
  );

  // Exam season: a red Exam button and a banner, closed until the next exam season (`timetable-exam-notice`).
  const examMode = data.examMode === true;
  const [examClosed, setExamClosed] = useState(true);
  useEffect(() => {
    void readKey(EXAM_KEY).then((value) => {
      if (!examMode && value === "1") void writeKey(EXAM_KEY, "0");
      setExamClosed(examMode ? value === "1" : false);
    });
  }, [examMode]);
  const openExams = () => void WebBrowser.openBrowserAsync(EXAM_URL);

  // Admin notices for a student: newest one not yet closed. An edited notice shows again.
  const [closedNotices, setClosedNotices] = useState<string[] | null>(null);
  useEffect(() => {
    void readKey(NOTICE_KEY).then((raw) => {
      let list: string[] = [];
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) list = parsed.filter((item): item is string => typeof item === "string");
      } catch {
        // A damaged list shows the notices again rather than none.
      }
      setClosedNotices(list);
    });
  }, []);
  const noticeKey = (item: { id: string; createdAt: string; updatedAt?: string }) => (item.updatedAt && item.updatedAt !== item.createdAt ? `${item.id}:${item.updatedAt}` : item.id);
  const liveNotice =
    who.role === "student" && closedNotices
      ? (data.notices ?? []).find((item) => (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()) && !closedNotices.includes(noticeKey(item)))
      : undefined;
  const closeNotice = () => {
    if (!liveNotice || !closedNotices) return;
    const next = [...closedNotices, noticeKey(liveNotice)].slice(-40);
    setClosedNotices(next);
    void writeKey(NOTICE_KEY, JSON.stringify(next));
  };

  // The picked batch's own workbook; never another batch's (site's `sheetUrlFor`).
  const sheetUrl =
    who.role === "student"
      ? (data.sheets.find((sheet) => sheet.batch.trim().toLowerCase() === who.student.batch.trim().toLowerCase() && sheet.course.trim().toLowerCase() === who.student.course.trim().toLowerCase())?.spreadsheetUrl ?? "")
      : "";

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 18, borderColor: theme.border, backgroundColor: theme.bg }]}>
        <View style={styles.headerRow}>
          <Logo height={22} color={theme.fg} />
          <Pressable onPress={() => setPanel(panel === "scope" ? "none" : "scope")} style={styles.cohortBtn} hitSlop={6}>
            <T w="medium" style={{ color: theme.fg, fontSize: 15, flexShrink: 1 }} lines={1}>
              {title}
            </T>
            <ChevronDown size={14} color={theme.mutedFg} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={openExams}
            hitSlop={8}
            accessibilityLabel="University exams"
            style={[styles.icon, examMode && { backgroundColor: tint(theme.danger, 0.16), borderRadius: 8 }]}
          >
            <GraduationCap size={19} color={examMode ? theme.danger : theme.fg} strokeWidth={1.75} />
          </Pressable>
          {icon(CalendarPlus, () => setPanel("calendar"), "Add week to calendar")}
          {icon(Search, () => setPanel(panel === "search" ? "none" : "search"), "Search")}
          {icon(Settings, () => setPanel("settings"), "Settings")}
        </View>
        {panel === "scope" ? (
          <View style={[styles.menu, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <T style={{ color: theme.mutedFg, fontSize: 12 }}>{subtitle}</T>
            {lensOptions.length > 1 ? (
              <View style={[styles.split, { backgroundColor: theme.muted }]}>
                {lensOptions.map((value) => (
                  <Pressable key={value} onPress={() => (setView(value), setPanel("none"))} style={[styles.splitItem, view === value && { backgroundColor: theme.fg }]}>
                    <T w="medium" style={{ color: view === value ? theme.bg : theme.fg, fontSize: 13 }}>
                      {lensLabel[value]}
                    </T>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable onPress={onLogout} style={{ paddingVertical: 6 }}>
              <T style={{ color: theme.fg, fontSize: 15 }}>{faculty ? "Sign out" : "Change cohort"}</T>
            </Pressable>
          </View>
        ) : null}
        {panel === "search" ? null : tab === "day" ? (
          <View style={[styles.segment, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {days.map((date) => {
              const active = date === day;
              return (
                <Pressable key={date} onPress={() => setDay(date)} style={[styles.segItem, active && { backgroundColor: theme.fg }]}>
                  <T w={date === today ? "bold" : "medium"} style={{ color: active ? theme.bg : theme.mutedFg, fontSize: 13 }}>
                    {dayShort(date)}
                  </T>
                  {date === today ? <View style={[styles.todayDot, { backgroundColor: active ? theme.bg : theme.fg }]} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : next ? (
          <View style={[styles.nextPill, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={[styles.nextTag, { backgroundColor: theme.muted }]}>
              <T w="mono" style={{ color: theme.mutedFg, fontSize: 10, letterSpacing: 1 }}>
                {isLive(next) ? "NOW" : "NEXT"}
              </T>
            </View>
            <T w="medium" style={{ color: theme.fg, fontSize: 13, flex: 1 }} lines={1}>
              {next.subject}
              {faculty ? ` · ${cohortLabel(next.division)}` : ""}
            </T>
            <T w="mono" style={{ color: theme.mutedFg, fontSize: 12 }}>
              {next.date === now.iso ? "" : `${dayShort(next.date ?? "")} `}
              {range(next)}
            </T>
          </View>
        ) : null}
      </View>

      {examMode && !examClosed && panel !== "search" ? (
        <View style={[styles.banner, { backgroundColor: tint(theme.danger, 0.16), borderColor: tint(theme.danger, 0.3) }]}>
          <GraduationCap size={16} color={theme.danger} strokeWidth={1.75} />
          <T style={{ color: theme.danger, fontSize: 13, flex: 1 }}>AT/KT and every exam schedule are on the exam site.</T>
          <Pressable onPress={openExams} style={[styles.bannerBtn, { backgroundColor: theme.danger }]}>
            <T w="medium" style={{ color: theme.bg, fontSize: 12 }}>
              Open
            </T>
          </Pressable>
          <Pressable onPress={() => (setExamClosed(true), void writeKey(EXAM_KEY, "1"))} hitSlop={8} accessibilityLabel="Dismiss exam notice">
            <X size={15} color={theme.danger} />
          </Pressable>
        </View>
      ) : null}
      {liveNotice && panel !== "search" ? (
        <View style={[styles.banner, { backgroundColor: theme.muted, borderColor: theme.border, alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <T w="medium" style={{ color: theme.fg, fontSize: 14 }}>
              {liveNotice.title}
            </T>
            <T style={{ color: theme.mutedFg, fontSize: 13, marginTop: 2 }}>{liveNotice.body}</T>
          </View>
          <Pressable onPress={closeNotice} hitSlop={8}>
            <T style={{ color: theme.mutedFg, fontSize: 12 }}>Got it</T>
          </Pressable>
        </View>
      ) : null}

      {panel === "search" ? (
        <SearchPanel lectures={mine} lens={lens} onClose={() => setPanel("none")} onNotice={showNotice} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: (notifyOn || hintGone ? 96 : 150) + insets.bottom }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.mutedFg} />}>
          {tab === "day" ? (
            <DayList
              lectures={mine.filter((lecture) => lecture.date === day)}
              date={day}
              today={today}
              theme={theme}
              days={days}
              onDay={setDay}
              lens={lens}
              isLive={isLive}
              onNotice={showNotice}
            />
          ) : null}
          {tab === "week"
            ? days.map((date) => <WeekDay key={date} date={date} today={today} lectures={mine.filter((lecture) => lecture.date === date)} theme={theme} lens={lens} onNotice={showNotice} />)
            : null}
          {tab === "updates" ? <Updates changes={changes} theme={theme} timezone={data.timezone} /> : null}
          {data.sync.lastError ? <T style={{ color: theme.danger, fontSize: 13, paddingHorizontal: 16, marginTop: 12 }}>Showing the last good copy. {data.sync.lastError}</T> : null}
        </ScrollView>
      )}

      {!notifyOn && !hintGone && panel === "none" ? (
        <View style={[styles.hint, { bottom: insets.bottom + 68, backgroundColor: theme.card, borderColor: theme.border }]}>
          <Bell size={16} color={theme.mutedFg} strokeWidth={1.75} />
          <T style={{ color: theme.mutedFg, fontSize: 14, flex: 1 }}>Get class change alerts</T>
          <Pressable onPress={() => (closeHint(), void toggleNotify(true))} hitSlop={8}>
            <T w="medium" style={{ color: theme.fg, fontSize: 14 }}>
              Turn on
            </T>
          </Pressable>
          <Pressable onPress={closeHint} hitSlop={8} accessibilityLabel="Close">
            <X size={16} color={theme.mutedFg} />
          </Pressable>
        </View>
      ) : null}

      {notice ? (
        <View style={[styles.toast, { bottom: insets.bottom + 72, backgroundColor: theme.fg }]}>
          <T style={{ color: theme.bg, fontSize: 13 }}>{notice}</T>
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 8, backgroundColor: theme.bg, borderColor: theme.border }]}>
        <View style={[styles.rubber, { backgroundColor: theme.muted }]}>
          {(["day", "week", "updates"] as const).map((id) => {
            const active = tab === id;
            return (
              <Pressable key={id} onPress={() => (setTab(id), setPanel("none"))} style={[styles.rubberItem, active && { backgroundColor: theme.fg }]}>
                <T w="medium" style={{ color: active ? theme.bg : theme.mutedFg, fontSize: 14 }}>
                  {id === "day" ? "Day" : id === "week" ? "Week" : "Updates"}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SettingsSheet
        open={panel === "settings"}
        onClose={() => setPanel("none")}
        who={faculty ? faculty.email || faculty.faculty : `${cohortLabel(who.role === "student" ? who.student.division : "")} · ${subtitle}`}
        sheetUrl={sheetUrl}
        notifyOn={notifyOn}
        onNotify={(on) => void toggleNotify(on)}
        onRefresh={onRefresh}
        onLogout={onLogout}
      />
      <CalendarSheet open={panel === "calendar"} onClose={() => setPanel("none")} scope={calendarScope} label={`Aayam · ${title}`} onNotice={showNotice} />
    </View>
  );
}

function DayList({
  lectures,
  date,
  today,
  theme,
  days,
  onDay,
  lens,
  isLive,
  onNotice,
}: {
  lectures: PublicLecture[];
  date: string;
  today: string;
  theme: Theme;
  days: string[];
  onDay: (date: string) => void;
  lens: CardLens;
  isLive: (lecture: PublicLecture) => boolean;
  onNotice: (text: string) => void;
}) {
  const index = days.indexOf(date);
  const allOff = lectures.length > 0 && lectures.every(isOff);
  return (
    <View style={styles.page}>
      <View style={styles.dateRow}>
        <T w="medium" style={{ color: theme.fg, fontSize: 17 }}>
          {dayShort(date)}, {dayMonth(date)}
        </T>
        {date === today ? <TodayChip theme={theme} /> : null}
        <View style={{ flex: 1 }} />
        <ArrowBtn theme={theme} disabled={index <= 0} onPress={() => onDay(days[index - 1]!)} icon="left" />
        <ArrowBtn theme={theme} disabled={index >= days.length - 1} onPress={() => onDay(days[index + 1]!)} icon="right" />
      </View>
      {lectures.length === 0 ? <T style={{ color: theme.mutedFg, fontSize: 14, marginTop: 24 }}>No classes this day.</T> : null}
      {allOff ? (
        <T w="medium" style={{ color: theme.danger, fontSize: 15, marginTop: 8 }}>
          {dayLong(date)} Off
        </T>
      ) : (
        lectures.map((lecture) =>
          lecture.kind === "break" ? (
            <View key={lecture.id} style={styles.lunchRow}>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
              <View style={[styles.lunchPill, { borderColor: theme.border }]}>
                <T w="mono" style={{ color: theme.mutedFg, fontSize: 12 }}>
                  {lecture.subject || "Lunch"} · {range(lecture)}
                </T>
              </View>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
            </View>
          ) : (
            <DayCard key={lecture.id} lecture={lecture} theme={theme} lens={lens} live={isLive(lecture)} onNotice={onNotice} />
          ),
        )
      )}
    </View>
  );
}

function WeekDay({ date, today, lectures, theme, lens, onNotice }: { date: string; today: string; lectures: PublicLecture[]; theme: Theme; lens: CardLens; onNotice: (text: string) => void }) {
  const allOff = lectures.length > 0 && lectures.every(isOff);
  return (
    <View style={[styles.page, { paddingTop: 24 }]}>
      <View style={styles.weekHead}>
        <T w="bold" style={{ color: allOff ? theme.danger : theme.fg, fontSize: 18 }}>
          {dayShort(date)}
        </T>
        <T style={{ color: allOff ? theme.danger : theme.mutedFg, fontSize: 16 }}>{dayMonth(date)}</T>
        {date === today ? <TodayChip theme={theme} /> : null}
      </View>
      {allOff ? (
        <T w="medium" style={{ color: theme.danger, fontSize: 15, paddingVertical: 10 }}>
          {dayLong(date)} Off
        </T>
      ) : (
        lectures.map((lecture) => <WeekRow key={lecture.id} lecture={lecture} theme={theme} lens={lens} onNotice={onNotice} />)
      )}
    </View>
  );
}

// Labels and detail rows match client/src/components/RecentChanges.tsx.
const changeLabels: Record<string, string> = {
  added: "Added",
  removed: "Removed",
  cancelled: "Cancelled",
  restored: "Restored",
  reverted: "Reverted",
  rescheduled: "Rescheduled",
  room_change: "Room",
  faculty_change: "Faculty",
  subject_change: "Subject",
  details_changed: "Updated",
  replaced: "Replacement",
  tab_added: "New tab",
  tab_removed: "Tab removed",
};
const detailFields: Array<{ key: keyof NonNullable<ChangeEvent["previous"]>; label: string }> = [
  { key: "subject", label: "Subject" },
  { key: "faculty", label: "Faculty" },
  { key: "room", label: "Room" },
  { key: "startLabel", label: "Starts" },
  { key: "endLabel", label: "Ends" },
  { key: "status", label: "Status" },
];
function detailRows(change: ChangeEvent) {
  return detailFields.flatMap((field) => {
    const before = change.previous?.[field.key];
    const after = change.next?.[field.key];
    if (!before && !after) return [];
    if (before && after && before !== after) return [{ label: field.label, value: `${before} → ${after}` }];
    return [{ label: field.label, value: after || before || "" }];
  });
}

function Updates({ changes, theme, timezone }: { changes: ChangeEvent[]; theme: Theme; timezone: string }) {
  return (
    <View style={[styles.page, { paddingTop: 20 }]}>
      <T w="mono" style={{ color: theme.mutedFg, fontSize: 12, letterSpacing: 2.5 }}>
        UPDATES
      </T>
      <T style={{ color: theme.mutedFg, fontSize: 15, lineHeight: 22, marginTop: 4 }}>
        Each update is its own entry. The time is when this page detected the change, not when the sheet was edited.
      </T>
      {changes.length === 0 ? (
        <T style={{ color: theme.mutedFg, fontSize: 15, lineHeight: 22, marginTop: 40 }}>
          No changes yet. The current sheet is the baseline. Edits, cancellations, and new classes show up here after the next sync.
        </T>
      ) : (
        changes.map((change) => {
          const danger = change.type === "cancelled" || change.type === "removed";
          return (
            <View key={change.id} style={[styles.change, { borderColor: theme.border }]}>
              <View style={styles.changeHead}>
                <View style={[styles.changeTag, { backgroundColor: danger ? tint(theme.danger, 0.16) : theme.muted }]}>
                  <T w="medium" style={{ color: danger ? theme.danger : theme.fg, fontSize: 11 }}>
                    {changeLabels[change.type] ?? "Update"}
                  </T>
                </View>
                <T style={{ color: theme.mutedFg, fontSize: 12, flex: 1 }} lines={1}>
                  {[change.division ? cohortLabel(change.division) : "", change.date ? `${dayShort(change.date)}, ${dayMonth(change.date)}` : ""].filter(Boolean).join(" · ")}
                </T>
                <T w="mono" style={{ color: theme.mutedFg, fontSize: 11 }}>
                  {formatDetected(change.detectedAt, timezone)}
                </T>
              </View>
              <T w="medium" style={{ color: theme.fg, fontSize: 15, marginTop: 6 }}>
                {change.summary}
              </T>
              {detailRows(change).map((row) => (
                <T key={row.label} style={{ color: theme.mutedFg, fontSize: 13, marginTop: 2 }}>
                  <T w="medium" style={{ color: theme.fg, fontSize: 13 }}>
                    {row.label}
                  </T>{" "}
                  {row.value}
                </T>
              ))}
            </View>
          );
        })
      )}
    </View>
  );
}

function TodayChip({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.todayChip, { backgroundColor: tint(theme.primary, 0.1) }]}>
      <T w="medium" style={{ color: theme.primary, fontSize: 11 }}>
        Today
      </T>
    </View>
  );
}

function ArrowBtn({ theme, disabled, onPress, icon }: { theme: Theme; disabled: boolean; onPress: () => void; icon: "left" | "right" }) {
  const Icon = icon === "left" ? ChevronLeft : ChevronRight;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.arrow, { borderColor: theme.border, opacity: disabled ? 0.35 : 1 }]}>
      <Icon size={16} color={theme.fg} strokeWidth={1.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cohortBtn: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  icon: { padding: 4 },
  menu: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  split: { flexDirection: "row", borderRadius: 8, padding: 3 },
  splitItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 6 },
  segment: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 3 },
  segItem: { flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4, paddingVertical: 6, borderRadius: 7 },
  todayDot: { width: 4, height: 4, borderRadius: 2 },
  nextPill: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
  nextTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  page: { paddingHorizontal: 16 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 16, paddingBottom: 10 },
  arrow: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  todayChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  lunchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 10 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  lunchPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  weekHead: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingBottom: 8 },
  change: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  changeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  changeTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  hint: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  bannerBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  toast: { position: "absolute", alignSelf: "center", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  rubber: { flexDirection: "row", borderRadius: 10, padding: 3 },
  rubberItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 7 },
});
