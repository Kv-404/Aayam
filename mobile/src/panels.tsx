import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { CalendarDays, Copy, Download, FileSpreadsheet, History, LogOut, RefreshCw, Search, X } from "lucide-react-native";
import type { PublicLecture } from "@shared/types.ts";
import { cohortLabel } from "@shared/cohort.ts";
import { calendarLinks } from "./api";
import { readSearchHistory, saveSearchHistory } from "./prefs";
import { useLook } from "./theme";
import { LookControls, MenuRow, Sheet, SwitchRow, T } from "./ui";
import { dayMonth, dayShort, WeekRow, type CardLens } from "./cards";

export function SettingsSheet({
  open,
  onClose,
  who,
  sheetUrl,
  notifyOn,
  onNotify,
  onRefresh,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  who: string;
  sheetUrl: string;
  notifyOn: boolean;
  onNotify: (on: boolean) => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const { theme } = useLook();
  const icon = (Icon: typeof RefreshCw) => <Icon size={18} color={theme.fg} strokeWidth={1.75} />;
  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <SwitchRow
        theme={theme}
        title="Notifications"
        note={notifyOn ? "Changes, notices and class reminders" : "Cancelled classes, room changes, reminders"}
        value={notifyOn}
        onChange={onNotify}
      />
      <T w="mono" style={{ color: theme.mutedFg, fontSize: 11, letterSpacing: 2, marginTop: 8 }}>
        APPEARANCE
      </T>
      <LookControls />
      <T w="mono" style={{ color: theme.mutedFg, fontSize: 11, letterSpacing: 2, marginTop: 8 }}>
        TIMETABLE
      </T>
      <MenuRow theme={theme} icon={icon(RefreshCw)} label="Refresh" note="Read the sheet again now" onPress={() => (onRefresh(), onClose())} />
      {sheetUrl ? <MenuRow theme={theme} icon={icon(FileSpreadsheet)} label="Open sheet" onPress={() => void WebBrowser.openBrowserAsync(sheetUrl)} /> : null}
      <MenuRow theme={theme} icon={<LogOut size={18} color={theme.danger} strokeWidth={1.75} />} label="Sign out" note={who} danger onPress={() => (onClose(), onLogout())} />
    </Sheet>
  );
}

export function CalendarSheet({ open, onClose, scope, label, onNotice }: { open: boolean; onClose: () => void; scope: { division?: string; faculty?: string }; label: string; onNotice: (text: string) => void }) {
  const { theme } = useLook();
  const links = calendarLinks(scope, label);
  const icon = (Icon: typeof CalendarDays) => <Icon size={18} color={theme.fg} strokeWidth={1.75} />;
  const copyFeed = async (note: string) => {
    await Clipboard.setStringAsync(links.feed);
    onNotice(note);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add week to calendar">
      <T style={{ color: theme.mutedFg, fontSize: 13 }}>Subscribe once. Your calendar keeps the classes up to date.</T>
      <MenuRow theme={theme} icon={icon(CalendarDays)} label="Google Calendar" onPress={() => void Linking.openURL(links.google)} />
      <MenuRow theme={theme} icon={icon(CalendarDays)} label="Apple Calendar" onPress={() => void Linking.openURL(links.apple)} />
      <MenuRow theme={theme} icon={icon(CalendarDays)} label="Outlook" onPress={() => void Linking.openURL(links.outlook)} />
      <MenuRow
        theme={theme}
        icon={icon(CalendarDays)}
        label="Proton Calendar"
        note="Copies the feed link, then opens Proton"
        onPress={async () => {
          await copyFeed("Feed link copied. Paste it in Proton: Add calendar → From URL.");
          await Linking.openURL(links.proton);
        }}
      />
      <MenuRow theme={theme} icon={icon(Download)} label="Download .ics" onPress={() => void WebBrowser.openBrowserAsync(links.download)} />
      <MenuRow theme={theme} icon={icon(Copy)} label="Copy feed link" onPress={() => void copyFeed("Feed link copied")} />
    </Sheet>
  );
}

function matches(lecture: PublicLecture, query: string) {
  const text = [lecture.subject, lecture.faculty, lecture.room, cohortLabel(lecture.division), lecture.weekday].join(" ").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

/** Search panel: field, past searches (newest first, at most 8), then matching classes this week. */
export function SearchPanel({ lectures, lens, onClose, onNotice }: { lectures: PublicLecture[]; lens: CardLens; onClose: () => void; onNotice: (text: string) => void }) {
  const { theme } = useLook();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    void readSearchHistory().then(setHistory);
  }, []);

  const remember = (text: string) => {
    const value = text.trim();
    if (!value) return;
    const next = [value, ...history.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 8);
    setHistory(next);
    void saveSearchHistory(next);
  };
  const forget = (text: string | null) => {
    const next = text === null ? [] : history.filter((item) => item !== text);
    setHistory(next);
    void saveSearchHistory(next);
  };

  const results = useMemo(() => (query.trim() ? lectures.filter((lecture) => lecture.kind !== "break" && matches(lecture, query)) : []), [lectures, query]);
  const days = [...new Set(results.map((lecture) => lecture.date ?? ""))];

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.field, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Search size={16} color={theme.mutedFg} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => remember(query)}
          placeholder="Subject, teacher, room"
          placeholderTextColor={theme.mutedFg}
          accessibilityLabel="Search the timetable"
          returnKeyType="search"
          style={[styles.input, { color: theme.fg }]}
        />
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={18} color={theme.mutedFg} />
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        {!query.trim() ? (
          history.length ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <View style={styles.histHead}>
                <T w="mono" style={{ color: theme.mutedFg, fontSize: 11, letterSpacing: 2 }}>
                  RECENT
                </T>
                <Pressable onPress={() => forget(null)} hitSlop={8}>
                  <T style={{ color: theme.mutedFg, fontSize: 13 }}>Clear all</T>
                </Pressable>
              </View>
              {history.map((item) => (
                <View key={item} style={[styles.histRow, { borderColor: theme.border }]}>
                  <Pressable style={styles.histText} onPress={() => setQuery(item)}>
                    <History size={15} color={theme.mutedFg} />
                    <T style={{ color: theme.fg, fontSize: 15 }}>{item}</T>
                  </Pressable>
                  <Pressable onPress={() => forget(item)} hitSlop={8} accessibilityLabel={`Remove ${item}`}>
                    <X size={15} color={theme.mutedFg} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <T style={{ color: theme.mutedFg, fontSize: 14, padding: 16 }}>Search this week by subject, teacher, room or cohort.</T>
          )
        ) : results.length === 0 ? (
          <T style={{ color: theme.mutedFg, fontSize: 14, padding: 16 }}>No classes match “{query.trim()}”.</T>
        ) : (
          days.map((date) => (
            <View key={date} style={{ paddingHorizontal: 16, paddingTop: 16 }} onTouchStart={() => remember(query)}>
              <View style={styles.dayHead}>
                <T w="bold" style={{ color: theme.fg, fontSize: 16 }}>
                  {date ? dayShort(date) : ""}
                </T>
                <T style={{ color: theme.mutedFg, fontSize: 14 }}>{date ? dayMonth(date) : ""}</T>
              </View>
              {results
                .filter((lecture) => (lecture.date ?? "") === date)
                .map((lecture) => (
                  <WeekRow key={lecture.id} lecture={lecture} theme={theme} lens={lens} onNotice={onNotice} />
                ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  // 16px so iOS does not zoom, same rule as the site.
  input: { flex: 1, fontSize: 16, paddingVertical: 10, fontFamily: "Satoshi-Regular" },
  histHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  histRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  histText: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dayHead: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingBottom: 4 },
});
