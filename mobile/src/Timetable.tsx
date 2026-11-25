import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, GraduationCap, Search, Settings, X } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BootstrapResponse, ChangeEvent, PublicLecture } from "@shared/types.ts";
import { cohortLabel, lectureInCohort } from "@shared/cohort.ts";
import { changeMatchesFaculty, lectureMatchesFaculty } from "@shared/faculty.ts";
import { coordinatorChoices, findCoordinator } from "@shared/coordinators.ts";
import { formatDetected, zonedNow } from "@web/time.ts";
import { readView, saveView, type Who } from "./prefs";
import { tint, useLook, type Theme } from "./theme";
import { Logo } from "./Logo";
import { Segment, T } from "./ui";
import { DayCard, WeekCell, dayLong, dayMonth, dayShort, isOff, range, type CardLens } from "./cards";
import { CalendarSheet, SearchPanel, SettingsSheet } from "./panels";
import * as Notifications from "expo-notifications";
import { disableNotifications, enableNotifications, readNotifyOn, registerPush, scheduleReminders } from "./notify";

// expo-notifications has no last-tap API on web; the hook throws there.
const useLastTap = Platform.OS === "web" ? () => null : Notifications.useLastNotificationResponse;

type Tab = "day" | "week" | "updates";
type FacultyLens = "mine" | "cohorts" | "all";
const lensLabel: Record<FacultyLens, string> = { mine: "My classes", cohorts: "My cohorts", all: "All classes" };
// The site's Now tag (emerald-500).
const LIVE_GREEN = "#10b981";
const EXAM_URL = "https://exam.somyacodes.in/";
const EXAM_KEY = "timetable-exam-notice";
const NOTICE_KEY = "timetable-notice-ids";
const readKey = (key: string) => AsyncStorage.getItem(key).catch(() => null);
const writeKey = (key: string, value: string) => AsyncStorage.setItem(key, value).catch(() => undefined);

export function Timetable({
  data,
  who,
  refreshing,
  onRefresh,
  onLogout,
  onHome,
}: {
  data: BootstrapResponse;
  who: Who;
  refreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  /** The logo: back to the "I am" start screen, keeping the saved choices (site's `onReset`). */
  onHome: () => void;
}) {
  const { theme } = useLook();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // A phone opens on Day, a teacher on Week (same as the site); the last Day/Week pick wins (`timetable-app-view`).
  const [tab, setTabState] = useState<Tab>(who.role === "faculty" ? "week" : "day");
  const tabPicked = useRef(false);
  const setTab = (next: Tab) => {
    tabPicked.current = true;
    setTabState(next);
  };
  useEffect(() => {
    void readView().then((saved) => {
      if (saved && !tabPicked.current) setTabState(saved);
    });
  }, []);
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
    const kind = lastTap?.notification.request.content.data?.kind;
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
    if (who.role === "student") return data.changes.filter((change) => !change.division || change.division === who.student.division);
    if (view === "all") return data.changes;
    if (view === "cohorts") {
      const divisions = new Set(myCohorts.flatMap((choice) => [choice.division, ...choice.also]));
      return data.changes.filter((change) => change.division && divisions.has(change.division));
    }
    const ids = new Set(mine.map((lecture) => lecture.id));
    return data.changes.filter((change) => changeMatchesFaculty(change, who.faculty.faculty, ids));
  }, [data.changes, who, view, myCohorts, mine]);

  // Reminders follow the person's own classes (not All classes), and re-plan after every refresh.
  const ownLectures = useMemo(
    () => (who.role === "faculty" ? data.lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, who.faculty.faculty)) : wide ? [] : mine),
    [data.lectures, who, mine, wide],
  );
  useEffect(() => {
    if (notifyOn) void scheduleReminders(ownLectures, data.timezone, who.role === "faculty").catch(() => undefined);
  }, [notifyOn, ownLectures, data.timezone, who.role]);

  const days = useMemo(() => [...new Set(mine.map((lecture) => lecture.date).filter((date): date is string => !!date))].sort(), [mine]);
  const [day, setDay] = useState(days.includes(data.today) ? data.today : (days[0] ?? data.today));
  useEffect(() => {
    if (days.length && !days.includes(day)) setDay(days.includes(data.today) ? data.today : days[0]!);
  }, [days, day, data.today]);
  // The pager needs at least one page, even on a week with no classes.
  const pagerDays = days.length ? days : [day];

  const now = zonedNow(new Date(data.now), data.timezone);
  const stamp = (date: string | null, minutes: number) => `${date ?? ""}${String(minutes).padStart(4, "0")}`;
  const nowStamp = stamp(now.iso, now.minutes);
  // Many classes run at once in All classes, so it has no Now mark (same rule as the site).
  const isLive = (lecture: PublicLecture) => !wide && lecture.date === now.iso && lecture.startMinutes <= now.minutes && now.minutes < lecture.endMinutes;
  const next = wide ? undefined : mine.find((lecture) => lecture.kind === "lecture" && lecture.displayStatus !== "cancelled" && !isOff(lecture) && stamp(lecture.date, lecture.endMinutes) > nowStamp);

  const title = faculty ? lensLabel[view].replace("My classes", faculty.faculty) : cohortLabel(who.role === "student" ? who.student.division : "");
  const subtitle = who.role === "student" ? `${who.student.course === "BTech" ? "B.Tech" : who.student.course} · ${who.student.batch.replace("-", "–")}` : faculty?.email ?? "";
  const calendarScope = faculty ? { faculty: faculty.faculty } : { division: who.role === "student" ? who.student.division : undefined };

  const icon = (Icon: typeof Search, onPress: () => void, label: string, active = false) => (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.icon, (pressed || active) && { backgroundColor: theme.muted }]}
      accessibilityLabel={label}
    >
      <Icon size={17} color={active ? theme.fg : theme.mutedFg} strokeWidth={1.75} />
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
    void readKey(NOTICE_KEY).then((raw) => setClosedNotices(raw ? (JSON.parse(raw) as string[]) : []));
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

  const bottomPad = (notifyOn || hintGone ? 80 : 134) + insets.bottom;
  const refresh = () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.mutedFg} />;
  const syncError = data.sync.lastError ? <T style={{ color: theme.danger, fontSize: 13, paddingHorizontal: 12, marginTop: 12 }}>Showing the last good copy. {data.sync.lastError}</T> : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderColor: theme.border, backgroundColor: theme.bg }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              setPanel("none");
              onHome();
            }}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Aayam Home"
            style={({ pressed }) => [styles.logo, pressed && { backgroundColor: theme.muted }]}
          >
            <Logo height={16} color={theme.fg} />
          </Pressable>
          <Pressable
            onPress={() => setPanel(panel === "scope" ? "none" : "scope")}
            style={({ pressed }) => [styles.cohortBtn, (pressed || panel === "scope") && { backgroundColor: theme.muted }]}
            hitSlop={4}
          >
            <T w="medium" style={{ color: theme.fg, fontSize: 14, letterSpacing: -0.2, flexShrink: 1 }} lines={1}>
              {title}
            </T>
            <ChevronDown size={14} color={theme.mutedFg} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={openExams}
            hitSlop={4}
            accessibilityLabel="University exams"
            style={({ pressed }) => [
              styles.icon,
              examMode ? { backgroundColor: tint(theme.danger, 0.16), borderWidth: 1, borderColor: tint(theme.danger, 0.4) } : pressed && { backgroundColor: theme.muted },
            ]}
          >
            <GraduationCap size={17} color={examMode ? theme.danger : theme.fg} strokeWidth={1.75} />
          </Pressable>
          {icon(CalendarPlus, () => setPanel("calendar"), "Add week to calendar")}
          {icon(Search, () => setPanel(panel === "search" ? "none" : "search"), "Search", panel === "search")}
          {icon(Settings, () => setPanel("settings"), "Settings")}
        </View>
        {panel === "scope" ? (
          <View style={[styles.menu, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <T style={{ color: theme.mutedFg, fontSize: 12 }}>{subtitle}</T>
            {lensOptions.length > 1 ? (
              <Segment
                label="Teacher view"
                size="md"
                value={view}
                onChange={(value) => {
                  setView(value);
                  setPanel("none");
                }}
                items={lensOptions.map((value) => ({ value, label: lensLabel[value] }))}
              />
            ) : null}
            <Pressable onPress={onLogout} style={{ paddingVertical: 6 }}>
              <T style={{ color: theme.fg, fontSize: 15 }}>{faculty ? "Sign out" : "Change cohort"}</T>
            </Pressable>
          </View>
        ) : null}
        {panel === "search" ? null : tab === "day" ? (
          <Segment
            label="Days"
            value={day}
            onChange={setDay}
            items={pagerDays.map((date) => ({ value: date, label: dayShort(date), strong: date === data.today, dot: date === data.today }))}
          />
        ) : next ? (
          <View style={[styles.nextPill, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={[styles.nextTag, { backgroundColor: isLive(next) ? tint(LIVE_GREEN, 0.15) : theme.muted }]}>
              {isLive(next) ? <View style={[styles.liveDot, { backgroundColor: LIVE_GREEN }]} /> : null}
              <T w={isLive(next) ? "bold" : "mono"} style={{ color: isLive(next) ? LIVE_GREEN : theme.mutedFg, fontSize: 10, letterSpacing: 1 }}>
                {isLive(next) ? "NOW" : "NEXT"}
              </T>
            </View>
            <T w="medium" style={{ color: theme.fg, fontSize: 12, flex: 1 }} lines={1}>
              {next.subject}
            </T>
            <T style={{ color: theme.mutedFg, fontSize: 11 }} lines={1}>
              {faculty ? `${cohortLabel(next.division)} · ` : ""}
            </T>
            <T w="mono" style={{ color: theme.mutedFg, fontSize: 11 }}>
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
      ) : tab === "day" ? (
        <DayPager
          key={`${pagerDays.join(",")}:${width}`}
          days={pagerDays}
          day={day}
          onDay={setDay}
          width={width}
          renderDay={(date) => (
            <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} refreshControl={refresh()}>
              <DayList
                lectures={mine.filter((lecture) => lecture.date === date)}
                date={date}
                today={data.today}
                theme={theme}
                days={pagerDays}
                onDay={setDay}
                lens={lens}
                isLive={isLive}
                onNotice={showNotice}
              />
              {syncError}
            </ScrollView>
          )}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} refreshControl={refresh()}>
          {tab === "week" ? <WeekBoard days={days} today={data.today} lectures={mine} theme={theme} lens={lens} width={width} isLive={isLive} onNotice={showNotice} /> : null}
          {tab === "updates" ? <Updates changes={changes} theme={theme} timezone={data.timezone} /> : null}
          {syncError}
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
        <Segment
          label="Timetable views"
          size="md"
          value={tab}
          onChange={(id) => {
            setTab(id);
            setPanel("none");
            if (id !== "updates") void saveView(id);
          }}
          items={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "updates", label: "Updates" },
          ]}
        />
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
        <T w="bold" style={{ color: date === today ? theme.fg : theme.mutedFg, fontSize: 14 }}>
          {dayLong(date)}, {dayMonth(date)}
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
              <View style={[styles.lunchPill, { borderColor: tint(theme.border, 0.4), backgroundColor: tint(theme.muted, 0.5) }]}>
                <T w="mono" style={{ color: theme.mutedFg, fontSize: 11 }}>
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

/** Day view pager: one page per day of the current week, swipe to move, snaps, opens on the picked day. */
function DayPager({ days, day, onDay, width, renderDay }: { days: string[]; day: string; onDay: (date: string) => void; width: number; renderDay: (date: string) => ReactElement }) {
  const list = useRef<FlatList<string>>(null);
  const start = Math.max(0, days.indexOf(day));
  const shown = useRef(start);
  // While a tab or arrow scrolls the pager, pages passed on the way do not move the tabs.
  const target = useRef<number | null>(null);
  useEffect(() => {
    const index = days.indexOf(day);
    if (index < 0 || index === shown.current) return;
    shown.current = index;
    target.current = index;
    list.current?.scrollToIndex({ index, animated: true });
  }, [day, days]);
  // Viewability fires on web and native alike (momentum end does not fire on web). The callback must stay stable, so it reads refs.
  const latest = useRef({ days, day, onDay });
  latest.current = { days, day, onDay };
  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const index = viewableItems[0]?.index;
    if (index == null) return;
    if (target.current !== null) {
      if (index !== target.current) return;
      target.current = null;
    }
    const { days: all, day: current, onDay: pick } = latest.current;
    const date = all[index];
    shown.current = index;
    if (date && date !== current) pick(date);
  }).current;
  return (
    <FlatList
      ref={list}
      data={days}
      keyExtractor={(date) => date}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={start}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      windowSize={3}
      extraData={renderDay}
      viewabilityConfig={viewability}
      onViewableItemsChanged={onViewable}
      onScrollBeginDrag={() => {
        target.current = null;
      }}
      renderItem={({ item }) => <View style={{ width }}>{renderDay(item)}</View>}
    />
  );
}

/** Week view: one narrow column per day, swipe sideways through the week, opens on today. */
function WeekBoard({
  days,
  today,
  lectures,
  theme,
  lens,
  width,
  isLive,
  onNotice,
}: {
  days: string[];
  today: string;
  lectures: PublicLecture[];
  theme: Theme;
  lens: CardLens;
  width: number;
  isLive: (lecture: PublicLecture) => boolean;
  onNotice: (text: string) => void;
}) {
  const gap = 8;
  const pad = 12;
  // About two and a third days on screen, so the next column peeks in.
  const column = Math.max(140, Math.floor((width - pad * 2 - gap * 2) / 2.3));
  const scroller = useRef<ScrollViewInstance>(null);
  const placed = useRef(false);
  if (!days.length) return <T style={{ color: theme.mutedFg, fontSize: 14, padding: 16, marginTop: 8 }}>No classes this week.</T>;
  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={column + gap}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 14, gap }}
      onContentSizeChange={() => {
        if (placed.current) return;
        placed.current = true;
        const index = days.indexOf(today);
        if (index > 0) scroller.current?.scrollTo({ x: index * (column + gap), animated: false });
      }}
    >
      {days.map((date) => {
        const list = lectures.filter((lecture) => lecture.date === date);
        const allOff = list.length > 0 && list.every(isOff);
        const isToday = date === today;
        return (
          <View key={date} style={{ width: column }}>
            <View style={[styles.colHead, { borderColor: isToday ? theme.fg : theme.border }]}>
              <T w="bold" style={{ color: allOff ? theme.danger : theme.fg, fontSize: 14 }}>
                {dayShort(date)}
              </T>
              <T style={{ color: allOff ? theme.danger : theme.mutedFg, fontSize: 12 }}>{dayMonth(date)}</T>
              {isToday ? <View style={[styles.todayDot, { backgroundColor: theme.fg }]} /> : null}
            </View>
            {allOff ? (
              <T w="medium" style={{ color: theme.danger, fontSize: 13, paddingVertical: 6 }}>
                {dayLong(date)} Off
              </T>
            ) : (
              list.map((lecture) => <WeekCell key={lecture.id} lecture={lecture} theme={theme} lens={lens} live={isLive(lecture)} onNotice={onNotice} />)
            )}
          </View>
        );
      })}
    </ScrollView>
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
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={icon === "left" ? "Previous day" : "Next day"}
      style={({ pressed }) => [styles.arrow, { borderColor: tint(theme.border, 0.4), backgroundColor: pressed ? theme.muted : tint(theme.muted, 0.3), opacity: disabled ? 0.35 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
    >
      <Icon size={14} color={theme.mutedFg} strokeWidth={1.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  logo: { borderRadius: 8, padding: 2 },
  cohortBtn: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 5 },
  icon: { width: 32, height: 32, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  menu: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  todayDot: { width: 5, height: 5, borderRadius: 3 },
  nextPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  nextTag: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  page: { paddingHorizontal: 12 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 14, paddingBottom: 8 },
  arrow: { width: 36, height: 36, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  colHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 6, marginBottom: 8, borderBottomWidth: 2 },
  todayChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  lunchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  lunchPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  change: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  changeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  changeTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  hint: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  bannerBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  toast: { position: "absolute", alignSelf: "center", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
