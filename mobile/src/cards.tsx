import { Linking, Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Video } from "lucide-react-native";
import type { PublicLecture } from "@shared/types.ts";
import { cohortLabel } from "@shared/cohort.ts";
import { compactRoom, formatCompactRange, meetHref } from "@web/time.ts";
import { chipStyle, type Theme } from "./theme";
import { T } from "./ui";

export const range = (lecture: PublicLecture) => formatCompactRange(lecture.startLabel, lecture.endLabel);
export const isOff = (lecture: PublicLecture) => lecture.kind === "off" || lecture.subject.trim().toUpperCase() === "OFF";
export const dayShort = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
export const dayLong = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
export const dayMonth = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Who a card names. Students see the faculty; a faculty member sees the cohort; wide views show both. */
export type CardLens = "student" | "faculty" | "all";

function personLine(lecture: PublicLecture, lens: CardLens) {
  if (lens === "student") return lecture.faculty;
  const cohort = cohortLabel(lecture.division);
  if (lens === "faculty") return cohort;
  return [cohort, lecture.faculty].filter(Boolean).join(" · ");
}

/** Room text, or a solid "Google Meet" pill that opens or copies the call (site's `.class-meet`, `timetable-meet`). */
export function Room({ room, theme, color, bg, bold, onNotice }: { room: string; theme: Theme; color: string; bg?: string; bold?: boolean; onNotice: (text: string) => void }) {
  const meet = meetHref(room);
  if (meet) {
    return (
      <Pressable
        hitSlop={6}
        accessibilityLabel={theme.look.meet === "copy" ? "Copy Google Meet link" : "Open Google Meet"}
        onPress={async () => {
          if (theme.look.meet === "copy") {
            await Clipboard.setStringAsync(meet);
            onNotice("Meet link copied");
          } else await Linking.openURL(meet);
        }}
        style={({ pressed }) => [styles.meet, { backgroundColor: theme.fg, opacity: pressed ? 0.85 : 1 }]}
      >
        <Video size={12} color={theme.bg} strokeWidth={2} />
        <T w="bold" style={{ color: theme.bg, fontSize: 12, letterSpacing: -0.2 }}>
          Google Meet
        </T>
      </Pressable>
    );
  }
  return (
    <View style={bg ? [styles.roomBadge, { backgroundColor: bg }] : undefined}>
      <T w={bold ? "bold" : "regular"} style={{ color, fontSize: 13, letterSpacing: bold ? -0.3 : 0, opacity: bold ? 1 : 0.85 }} lines={1}>
        {compactRoom(room)}
      </T>
    </View>
  );
}

/** Day view card: time on top, subject below, person and room on the right. */
export function DayCard({ lecture, theme, lens, live, onNotice }: { lecture: PublicLecture; theme: Theme; lens: CardLens; live: boolean; onNotice: (text: string) => void }) {
  const chip = chipStyle(theme, lecture.subject, lecture.displayStatus);
  const cancelled = lecture.displayStatus === "cancelled" && !isOff(lecture);
  const person = personLine(lecture, lens);
  return (
    <View style={[styles.dayCard, { backgroundColor: chip.bg }]}>
      <View style={[styles.bar, { backgroundColor: chip.bar }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.timeRow}>
          <T w="mono" style={{ color: chip.text, fontSize: 13, opacity: 0.85 }}>
            {range(lecture)}
          </T>
          {live ? (
            <View style={[styles.nowMark, { backgroundColor: chip.text }]}>
              <T w="mono" style={{ color: theme.look.colors && theme.look.bold ? chip.bg : theme.bg, fontSize: 10, letterSpacing: 0.8 }}>
                NOW
              </T>
            </View>
          ) : null}
        </View>
        <T w="medium" style={{ color: chip.text, fontSize: 18, letterSpacing: -0.4, marginTop: 2, textDecorationLine: cancelled ? "line-through" : "none" }}>
          {lecture.subject}
        </T>
        {cancelled ? (
          <T w="bold" style={{ color: theme.look.bold && theme.look.colors ? chip.text : theme.danger, fontSize: 12, marginTop: 2 }}>
            Cancelled
          </T>
        ) : null}
      </View>
      {!isOff(lecture) ? (
        <View style={{ alignItems: "flex-end", maxWidth: "42%", gap: 1 }}>
          {person ? (
            <T style={{ color: chip.sub, fontSize: 13, opacity: 0.85, textAlign: "right" }} lines={2}>
              {person}
            </T>
          ) : null}
          {lecture.room ? <Room room={lecture.room} theme={theme} color={chip.sub} onNotice={onNotice} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Week row on a phone: time column, then a card with the subject and a foot line with the room badge. */
export function WeekRow({ lecture, theme, lens, onNotice }: { lecture: PublicLecture; theme: Theme; lens: CardLens; onNotice: (text: string) => void }) {
  if (lecture.kind === "break") {
    return (
      <View style={[styles.weekRow, { borderColor: theme.border }]}>
        <View style={styles.timeCol} />
        <T style={{ color: theme.mutedFg, fontSize: 13, paddingVertical: 4 }}>
          {lecture.subject || "Lunch"} break · {range(lecture)}
        </T>
      </View>
    );
  }
  const chip = chipStyle(theme, lecture.subject, lecture.displayStatus);
  const cancelled = lecture.displayStatus === "cancelled" && !isOff(lecture);
  const [start, end] = range(lecture).split("–");
  const person = personLine(lecture, lens);
  return (
    <View style={[styles.weekRow, { borderColor: theme.border }]}>
      <View style={styles.timeCol}>
        <T w="mono" style={{ color: theme.mutedFg, fontSize: 12, textAlign: "right" }}>
          {start}
        </T>
        {end ? (
          <T w="mono" style={{ color: theme.mutedFg, fontSize: 12, textAlign: "right" }}>
            {end}
          </T>
        ) : null}
      </View>
      <View style={[styles.weekCard, { backgroundColor: chip.bg }]}>
        <View style={[styles.bar, { backgroundColor: chip.bar }]} />
        <T w="medium" style={{ color: chip.text, fontSize: 16, letterSpacing: -0.4, textDecorationLine: cancelled ? "line-through" : "none" }}>
          {lecture.subject}
        </T>
        {cancelled ? (
          <T w="bold" style={{ color: theme.look.bold && theme.look.colors ? chip.text : theme.danger, fontSize: 12 }}>
            Cancelled
          </T>
        ) : null}
        {!isOff(lecture) && (person || lecture.room) ? (
          <View style={styles.weekFoot}>
            <T w="medium" style={{ color: chip.sub, fontSize: 13, flexShrink: 1 }} lines={1}>
              {person}
            </T>
            {lecture.room ? <Room room={lecture.room} theme={theme} color={chip.sub} bg={chip.roomBg} bold onNotice={onNotice} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Compact week cell: time and room, subject (two lines at most), cohort or faculty. Fits a narrow day column. */
export function WeekCell({ lecture, theme, lens, live, onNotice }: { lecture: PublicLecture; theme: Theme; lens: CardLens; live: boolean; onNotice: (text: string) => void }) {
  if (lecture.kind === "break") {
    return (
      <View style={[styles.cellBreak, { borderColor: theme.border }]}>
        <T w="mono" style={{ color: theme.mutedFg, fontSize: 11 }} lines={1}>
          {lecture.subject || "Lunch"} · {range(lecture)}
        </T>
      </View>
    );
  }
  const chip = chipStyle(theme, lecture.subject, lecture.displayStatus);
  const off = isOff(lecture);
  const cancelled = lecture.displayStatus === "cancelled" && !off;
  const person = off ? "" : personLine(lecture, lens);
  return (
    <View style={[styles.cell, { backgroundColor: chip.bg }, live && { borderWidth: 1.5, borderColor: chip.text }]}>
      <View style={[styles.bar, { backgroundColor: chip.bar }]} />
      <View style={styles.cellTop}>
        <T w="mono" style={{ color: chip.text, fontSize: 11, opacity: 0.85 }} lines={1}>
          {range(lecture)}
        </T>
        {!off && lecture.room ? <Room room={lecture.room} theme={theme} color={chip.sub} bold onNotice={onNotice} /> : null}
      </View>
      <T w="medium" style={{ color: chip.text, fontSize: 14, letterSpacing: -0.3, textDecorationLine: cancelled ? "line-through" : "none" }} lines={2}>
        {lecture.subject}
      </T>
      {cancelled ? (
        <T w="bold" style={{ color: theme.look.bold && theme.look.colors ? chip.text : theme.danger, fontSize: 11 }}>
          Cancelled
        </T>
      ) : null}
      {person ? (
        <T style={{ color: chip.sub, fontSize: 12, opacity: 0.85 }} lines={1}>
          {person}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dayCard: { flexDirection: "row", gap: 10, borderRadius: 10, paddingVertical: 10, paddingRight: 12, paddingLeft: 14, marginBottom: 8, overflow: "hidden" },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nowMark: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  weekRow: { flexDirection: "row", gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  timeCol: { width: 48, paddingTop: 6 },
  weekCard: { flex: 1, minWidth: 0, borderRadius: 10, paddingVertical: 8, paddingRight: 10, paddingLeft: 12, overflow: "hidden", gap: 2 },
  weekFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  meet: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  cell: { borderRadius: 8, paddingVertical: 6, paddingRight: 8, paddingLeft: 10, marginBottom: 6, overflow: "hidden", gap: 1 },
  cellTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 4, rowGap: 2 },
  cellBreak: { borderWidth: 1, borderStyle: "dashed", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6, alignItems: "center" },
  roomBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
});
