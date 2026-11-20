import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Search, Settings } from "lucide-react-native";
import type { BootstrapResponse, ChangeEvent, PublicLecture } from "@shared/types.ts";
import { cohortLabel, lectureInCohort } from "@shared/cohort.ts";
import { changeMatchesFaculty, lectureMatchesFaculty } from "@shared/faculty.ts";
import { zonedNow } from "@web/time.ts";
import type { Who } from "./prefs";
import { tint, useLook, type Theme } from "./theme";
import { Logo } from "./Logo";
import { T } from "./ui";
import { DayCard, WeekRow, dayLong, dayMonth, dayShort, isOff, range, type CardLens } from "./cards";
import { CalendarSheet, SearchPanel, SettingsSheet } from "./panels";

type Tab = "day" | "week" | "updates";

export function Timetable({ data, who, refreshing, onRefresh, onLogout }: { data: BootstrapResponse; who: Who; refreshing: boolean; onRefresh: () => void; onLogout: () => void }) {
  const { theme } = useLook();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("day");
  const [wide, setWide] = useState(false); // canSeeAll faculty: My classes or All classes
  const [panel, setPanel] = useState<"none" | "search" | "calendar" | "settings" | "scope">("none");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2800);
  };

  const faculty = who.role === "faculty" ? who.faculty : null;
  const lens: CardLens = faculty ? (wide ? "all" : "faculty") : "student";

  const mine = useMemo(() => {
    let list: PublicLecture[];
    if (who.role === "student") {
      const choice = data.choices?.find((item) => item.division === who.student.division && item.course === who.student.course && item.batch === who.student.batch);
      list = data.lectures.filter((lecture) => lectureInCohort(lecture, choice ?? who.student));
    } else if (wide) {
      list = data.lectures.filter((lecture) => lecture.kind !== "break");
    } else {
      // Lunch and OFF rows carry no faculty, so they never show on a teacher's timetable.
      list = data.lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, who.faculty.faculty));
    }
    return [...list].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.startMinutes - b.startMinutes || a.division.localeCompare(b.division));
  }, [data.lectures, data.choices, who, wide]);

  const changes = useMemo(() => {
    if (who.role === "student") return data.changes.filter((change) => !change.division || change.division === who.student.division);
    if (wide) return data.changes;
    const ids = new Set(mine.map((lecture) => lecture.id));
    return data.changes.filter((change) => changeMatchesFaculty(change, who.faculty.faculty, ids));
  }, [data.changes, who, wide, mine]);

  const days = useMemo(() => [...new Set(mine.map((lecture) => lecture.date).filter((date): date is string => !!date))].sort(), [mine]);
  const [day, setDay] = useState(days.includes(data.today) ? data.today : (days[0] ?? data.today));
  useEffect(() => {
    if (days.length && !days.includes(day)) setDay(days.includes(data.today) ? data.today : days[0]!);
  }, [days, day, data.today]);

  const now = zonedNow(new Date(data.now), data.timezone);
  const stamp = (date: string | null, minutes: number) => `${date ?? ""}${String(minutes).padStart(4, "0")}`;
  const nowStamp = stamp(now.iso, now.minutes);
  // Many classes run at once in All classes, so it has no Now mark (same rule as the site).
  const isLive = (lecture: PublicLecture) => !wide && lecture.date === now.iso && lecture.startMinutes <= now.minutes && now.minutes < lecture.endMinutes;
  const next = wide ? undefined : mine.find((lecture) => lecture.kind === "lecture" && lecture.displayStatus !== "cancelled" && !isOff(lecture) && stamp(lecture.date, lecture.endMinutes) > nowStamp);

  const title = faculty ? (wide ? "All classes" : faculty.faculty) : cohortLabel(who.role === "student" ? who.student.division : "");
  const subtitle = who.role === "student" ? `${who.student.course === "BTech" ? "B.Tech" : who.student.course} · ${who.student.batch.replace("-", "–")}` : faculty?.email ?? "";
  const calendarScope = faculty ? { faculty: faculty.faculty } : { division: who.role === "student" ? who.student.division : undefined };

  const icon = (Icon: typeof Search, onPress: () => void, label: string) => (
    <Pressable onPress={onPress} hitSlop={8} style={styles.icon} accessibilityLabel={label}>
      <Icon size={19} color={theme.fg} strokeWidth={1.75} />
    </Pressable>
  );

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
          {icon(CalendarPlus, () => setPanel("calendar"), "Add week to calendar")}
          {icon(Search, () => setPanel(panel === "search" ? "none" : "search"), "Search")}
          {icon(Settings, () => setPanel("settings"), "Settings")}
        </View>
        {panel === "scope" ? (
          <View style={[styles.menu, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <T style={{ color: theme.mutedFg, fontSize: 12 }}>{subtitle}</T>
            {faculty?.canSeeAll ? (
              <View style={[styles.split, { backgroundColor: theme.muted }]}>
                {[false, true].map((value) => (
                  <Pressable key={String(value)} onPress={() => (setWide(value), setPanel("none"))} style={[styles.splitItem, wide === value && { backgroundColor: theme.fg }]}>
                    <T w="medium" style={{ color: wide === value ? theme.bg : theme.fg, fontSize: 14 }}>
                      {value ? "All classes" : "My classes"}
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
                  <T w={date === data.today ? "bold" : "medium"} style={{ color: active ? theme.bg : theme.mutedFg, fontSize: 13 }}>
                    {dayShort(date)}
                  </T>
                  {date === data.today ? <View style={[styles.todayDot, { backgroundColor: active ? theme.bg : theme.fg }]} /> : null}
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

      {panel === "search" ? (
        <SearchPanel lectures={mine} lens={lens} onClose={() => setPanel("none")} onNotice={showNotice} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 96 + insets.bottom }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.mutedFg} />}>
          {tab === "day" ? (
            <DayList
              lectures={mine.filter((lecture) => lecture.date === day)}
              date={day}
              today={data.today}
              theme={theme}
              days={days}
              onDay={setDay}
              lens={lens}
              isLive={isLive}
              onNotice={showNotice}
            />
          ) : null}
          {tab === "week"
            ? days.map((date) => <WeekDay key={date} date={date} today={data.today} lectures={mine.filter((lecture) => lecture.date === date)} theme={theme} lens={lens} onNotice={showNotice} />)
            : null}
          {tab === "updates" ? <Updates changes={changes} theme={theme} /> : null}
          {data.sync.lastError ? <T style={{ color: theme.danger, fontSize: 13, paddingHorizontal: 16, marginTop: 12 }}>Showing the last good copy. {data.sync.lastError}</T> : null}
        </ScrollView>
      )}

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
        sheetUrl={data.spreadsheetUrl}
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

function Updates({ changes, theme }: { changes: ChangeEvent[]; theme: Theme }) {
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
        changes.map((change) => (
          <View key={change.id} style={[styles.change, { borderColor: theme.border }]}>
            <T w="medium" style={{ color: theme.fg, fontSize: 15 }}>
              {change.summary}
            </T>
            <T style={{ color: theme.mutedFg, fontSize: 12, marginTop: 2 }}>
              {[change.division ? cohortLabel(change.division) : "", change.date ? `${dayShort(change.date)}, ${dayMonth(change.date)}` : ""].filter(Boolean).join(" · ")}
            </T>
          </View>
        ))
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
  toast: { position: "absolute", alignSelf: "center", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  rubber: { flexDirection: "row", borderRadius: 10, padding: 3 },
  rubberItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 7 },
});
