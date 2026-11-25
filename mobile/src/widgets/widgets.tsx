import { FlexWidget, ListWidget, TextWidget, type HexColor } from "react-native-android-widget";
import type { Theme } from "../theme";
import type { WidgetLecture, WidgetState } from "./data";

// Android widget views (react-native-android-widget primitives, not React Native views).
// Font files are copied in by the plugin (app.json); names match src/theme.ts `fonts`.
const font = { regular: "Satoshi-Regular", medium: "Satoshi-Medium", bold: "Satoshi-Bold", mono: "monospace" };
const hex = (value: string) => value as HexColor;

export const widgetNames = { next: "NextClass", today: "Today" } as const;

function Shell({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Open Aayam"
      style={{ height: "match_parent", width: "match_parent", flexDirection: "column", backgroundColor: hex(theme.card), borderRadius: 18, borderWidth: 1, borderColor: hex(theme.border), padding: 12 }}
    >
      {children}
    </FlexWidget>
  );
}

function Note({ theme, text }: { theme: Theme; text: string }) {
  return (
    <FlexWidget style={{ flex: 1, width: "match_parent", justifyContent: "center", alignItems: "center" }}>
      <TextWidget text={text} maxLines={3} style={{ fontSize: 14, fontFamily: font.medium, color: hex(theme.mutedFg), textAlign: "center" }} />
    </FlexWidget>
  );
}

function Label({ theme, text }: { theme: Theme; text: string }) {
  return <TextWidget text={text} maxLines={1} truncate="END" style={{ fontSize: 11, fontFamily: font.mono, color: hex(theme.mutedFg), letterSpacing: 0.08 }} />;
}

/** "Cancelled" in danger red, or the chip ink on a bold card (same rule as cards.tsx). */
function Cancelled({ theme, lecture }: { theme: Theme; lecture: WidgetLecture }) {
  const color = theme.look.colors && theme.look.bold ? lecture.chip.text : theme.danger;
  return <TextWidget text="Cancelled" style={{ fontSize: 12, fontFamily: font.bold, color: hex(color) }} />;
}

/** Small widget: the class on now, or the next one today. A cancelled class keeps its subject colour. */
export function NextClassWidget({ state }: { state: WidgetState }) {
  const { theme } = state;
  if (state.kind !== "ok") {
    return (
      <Shell theme={theme}>
        <Note theme={theme} text={state.kind === "setup" ? "Open Aayam to pick your class" : state.message} />
      </Shell>
    );
  }
  const lecture = state.next;
  if (!lecture) {
    return (
      <Shell theme={theme}>
        <Label theme={theme} text="TODAY" />
        <Note theme={theme} text={state.done ? "No more classes today" : "No classes today"} />
      </Shell>
    );
  }
  const { chip } = lecture;
  return (
    <Shell theme={theme}>
      <Label theme={theme} text={lecture.live ? "NOW" : "NEXT"} />
      <FlexWidget style={{ flex: 1, width: "match_parent", flexDirection: "row", marginTop: 6, backgroundColor: hex(chip.bg), borderRadius: 12, overflow: "hidden" }}>
        <FlexWidget style={{ width: 3, height: "match_parent", backgroundColor: hex(chip.bar) }} />
        <FlexWidget style={{ flex: 1, height: "match_parent", flexDirection: "column", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8 }}>
          <TextWidget text={lecture.time} maxLines={1} style={{ fontSize: 12, fontFamily: font.mono, color: hex(chip.text) }} />
          <TextWidget text={lecture.subject} maxLines={2} truncate="END" style={{ fontSize: 17, fontFamily: font.bold, color: hex(chip.text), marginTop: 2 }} />
          {lecture.cancelled ? <Cancelled theme={theme} lecture={lecture} /> : null}
          {lecture.person ? <TextWidget text={lecture.person} maxLines={1} truncate="END" style={{ fontSize: 12, fontFamily: font.regular, color: hex(chip.sub), marginTop: 2 }} /> : null}
          {lecture.room ? <TextWidget text={lecture.room} maxLines={1} truncate="END" style={{ fontSize: 12, fontFamily: font.medium, color: hex(chip.sub) }} /> : null}
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

function TodayRow({ theme, lecture }: { theme: Theme; lecture: WidgetLecture }) {
  const { chip } = lecture;
  const foot = [lecture.person, lecture.room].filter(Boolean).join(" · ");
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ width: "match_parent", flexDirection: "column", paddingBottom: 6 }}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", backgroundColor: hex(chip.bg), borderRadius: 10, overflow: "hidden" }}>
        <FlexWidget style={{ width: 3, height: "match_parent", backgroundColor: hex(chip.bar) }} />
        <FlexWidget style={{ flex: 1, flexDirection: "column", paddingHorizontal: 10, paddingVertical: 6 }}>
          <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <TextWidget text={lecture.time} maxLines={1} style={{ fontSize: 11, fontFamily: font.mono, color: hex(chip.text) }} />
            {lecture.cancelled ? <Cancelled theme={theme} lecture={lecture} /> : lecture.live ? <TextWidget text="NOW" style={{ fontSize: 11, fontFamily: font.mono, color: hex(chip.text) }} /> : null}
          </FlexWidget>
          <TextWidget text={lecture.subject} maxLines={1} truncate="END" style={{ fontSize: 15, fontFamily: font.bold, color: hex(chip.text) }} />
          {foot ? <TextWidget text={foot} maxLines={1} truncate="END" style={{ fontSize: 12, fontFamily: font.regular, color: hex(chip.sub) }} /> : null}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/** Medium widget: every class today for the saved cohort, or the teacher's own classes. */
export function TodayWidget({ state }: { state: WidgetState }) {
  const { theme } = state;
  if (state.kind !== "ok") {
    return (
      <Shell theme={theme}>
        <Note theme={theme} text={state.kind === "setup" ? "Open Aayam to pick your class" : state.message} />
      </Shell>
    );
  }
  return (
    <Shell theme={theme}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <TextWidget text="Today" style={{ fontSize: 15, fontFamily: font.bold, color: hex(theme.fg) }} />
        <Label theme={theme} text={state.title} />
      </FlexWidget>
      {state.today.length === 0 ? (
        <Note theme={theme} text="No classes today" />
      ) : (
        <ListWidget style={{ height: "match_parent", width: "match_parent" }}>
          {state.today.map((lecture) => (
            <TodayRow key={lecture.id} theme={theme} lecture={lecture} />
          ))}
        </ListWidget>
      )}
    </Shell>
  );
}
