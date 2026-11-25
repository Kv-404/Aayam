import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowRight, X } from "lucide-react-native";
import { fonts, tint, useLook, type Theme } from "./theme";
import { themeList } from "./themes";

type Weight = "regular" | "medium" | "bold" | "mono";

/** Text in Satoshi. RN needs a family per weight, so weight is a prop, not fontWeight. */
export function T({ w = "regular", style, children, lines }: { w?: Weight; style?: TextStyle | (TextStyle | false | undefined)[]; children: ReactNode; lines?: number }) {
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: fonts[w] }, style as TextStyle]}>
      {children}
    </Text>
  );
}

/** Setup row: big label, arrow on the right. Same as the site's "I am" buttons. */
export function ChoiceRow({ label, theme, onPress, note }: { label: string; theme: Theme; onPress: () => void; note?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, { borderColor: theme.border, backgroundColor: pressed ? theme.muted : "transparent" }]}>
      <View style={{ flexShrink: 1 }}>
        <T w="medium" style={{ color: theme.fg, fontSize: 18, letterSpacing: -0.4 }}>
          {label}
        </T>
        {note ? <T style={{ color: theme.mutedFg, fontSize: 13, marginTop: 2 }}>{note}</T> : null}
      </View>
      <ArrowRight size={16} color={theme.mutedFg} strokeWidth={1.75} />
    </Pressable>
  );
}

export function BackLink({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.back}>
      <ArrowLeft size={14} color={theme.mutedFg} strokeWidth={1.75} />
      <T style={{ color: theme.mutedFg, fontSize: 14 }}>Back</T>
    </Pressable>
  );
}

export function PrimaryButton({ label, theme, onPress }: { label: string; theme: Theme; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primary, { backgroundColor: theme.fg, opacity: pressed ? 0.85 : 1 }]}>
      <T w="medium" style={{ color: theme.bg, fontSize: 14 }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Theme cards, class colours, bold colours, Meet button. Same set as the site's theme step and appearance menu. */
export function LookControls() {
  const { theme, setLook } = useLook();
  const look = theme.look;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.grid}>
        {themeList.map((item) => {
          const active = item.id === look.theme;
          return (
            <Pressable
              key={item.id}
              onPress={() => setLook({ theme: item.id })}
              style={({ pressed }) => [styles.themeCard, { borderColor: active ? "transparent" : theme.border, backgroundColor: active ? theme.fg : pressed ? theme.muted : "transparent" }]}
            >
              <View style={styles.swatches}>
                {item.swatch.map((color, index) => (
                  <View key={index} style={[styles.swatch, { backgroundColor: color }]} />
                ))}
              </View>
              <T w="medium" style={{ color: active ? theme.bg : theme.fg, fontSize: 14, marginTop: 8 }}>
                {item.name}
              </T>
              <T style={{ color: active ? theme.bg : theme.mutedFg, opacity: active ? 0.7 : 1, fontSize: 12, marginTop: 4 }}>{item.blurb}</T>
            </Pressable>
          );
        })}
      </View>
      <SwitchRow theme={theme} title="Class colours" note="Each class has its own colour" value={look.colors} onChange={(colors) => setLook({ colors })} />
      {look.colors ? (
        <SwitchRow theme={theme} title="Bold colours" note={look.bold ? "Solid class colours" : "Plain timetable"} value={look.bold} onChange={(bold) => setLook({ bold })} />
      ) : null}
      <View style={[styles.box, { borderColor: theme.border, gap: 10 }]}>
        <View>
          <T w="medium" style={{ color: theme.fg, fontSize: 14 }}>
            Meet button
          </T>
          <T style={{ color: theme.mutedFg, fontSize: 12, marginTop: 1 }}>Open the call, or copy the link.</T>
        </View>
        <Segment
          label="Meet button"
          size="md"
          value={look.meet}
          onChange={(meet) => setLook({ meet })}
          items={[
            { value: "open", label: "Open link" },
            { value: "copy", label: "Copy link" },
          ]}
        />
      </View>
    </View>
  );
}

// Motion is skipped when the phone asks for less of it, same as the site's `prefers-reduced-motion`.
let calmMotion = false;
void AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    calmMotion = on;
  })
  .catch(() => undefined);
const nativeDriver = Platform.OS !== "web";

/**
 * The site's switch (`ColorSwitch.tsx`): a 44×24 pill, foreground when on and muted when off,
 * with a 20px background-coloured knob and a hairline border. `compact` is the 36×20 menu size.
 */
export function Switch({ value, onChange, compact, label }: { value: boolean; onChange: (value: boolean) => void; compact?: boolean; label?: string }) {
  const { theme } = useLook();
  const size = compact ? { w: 36, h: 20, knob: 16 } : { w: 44, h: 24, knob: 20 };
  const travel = size.w - size.knob - 4;
  const pos = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    if (calmMotion) pos.setValue(value ? 1 : 0);
    else Animated.timing(pos, { toValue: value ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, pos]);
  const off = compact ? tint(theme.mutedFg, 0.3) : theme.muted;
  return (
    <Pressable onPress={() => onChange(!value)} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}>
      <Animated.View
        style={{
          width: size.w,
          height: size.h,
          borderRadius: size.h / 2,
          backgroundColor: pos.interpolate({ inputRange: [0, 1], outputRange: [off, theme.fg] }),
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            width: size.knob,
            height: size.knob,
            borderRadius: size.knob / 2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            backgroundColor: theme.bg,
            transform: [{ translateX: pos.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

/** A bordered row with a title, a note, and the switch. The whole row toggles, like the site's button. */
export function SwitchRow({ theme, title, note, value, onChange }: { theme: Theme; title: string; note?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      style={({ pressed }) => [styles.box, styles.switchRow, { borderColor: theme.border, backgroundColor: pressed ? theme.muted : "transparent" }]}
    >
      <View style={{ flex: 1 }}>
        <T w="medium" style={{ color: theme.fg, fontSize: 14 }}>
          {title}
        </T>
        {note ? <T style={{ color: theme.mutedFg, fontSize: 12, marginTop: 1 }}>{note}</T> : null}
      </View>
      <Switch value={value} onChange={onChange} label={title} />
    </Pressable>
  );
}

export interface SegmentItem<V extends string> {
  value: V;
  label: string;
  /** Bold label, as the site marks today in the day picker. */
  strong?: boolean;
  /** Small dot after the label (today). */
  dot?: boolean;
}

// Same presets as client/src/components/RubberSegment.tsx.
const SEGMENT_SIZES = {
  sm: { height: 28, font: 12 },
  md: { height: 36, font: 13 },
  lg: { height: 44, font: 14 },
};

/**
 * The site's RubberSegment: a muted track, a foreground thumb that slides to the picked slot, equal slots.
 * Idle labels are foreground at 70%; the picked one is background on the thumb.
 */
export function Segment<V extends string>({
  items,
  value,
  onChange,
  size = "sm",
  label,
  style,
}: {
  items: SegmentItem<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: keyof typeof SEGMENT_SIZES;
  label?: string;
  style?: ViewStyle;
}) {
  const { theme } = useLook();
  const inset = 3;
  const preset = SEGMENT_SIZES[size];
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((item) => item.value === value));
  const slot = items.length ? (width - inset * 2) / items.length : 0;
  const pos = useRef(new Animated.Value(index)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!width) return;
    if (!placed.current || calmMotion) {
      placed.current = true;
      pos.setValue(index);
      return;
    }
    Animated.spring(pos, { toValue: index, useNativeDriver: nativeDriver, speed: 22, bounciness: 3 }).start();
  }, [index, width, pos]);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.segment, { height: preset.height, padding: inset, backgroundColor: theme.muted }, style]}
    >
      {width ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentThumb,
            {
              top: inset,
              bottom: inset,
              left: inset,
              width: slot,
              backgroundColor: theme.fg,
              transform: [{ translateX: Animated.multiply(pos, slot) }],
            },
          ]}
        />
      ) : null}
      {items.map((item) => {
        const active = item.value === value;
        const color = active ? theme.bg : theme.fg;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={item.label}
            style={({ pressed }) => [styles.segmentItem, { transform: [{ scale: pressed && !active ? 0.96 : 1 }] }]}
          >
            <T w={item.strong ? "bold" : "medium"} style={{ color, opacity: active ? 1 : 0.7, fontSize: preset.font, letterSpacing: item.strong ? -0.2 : 0 }} lines={1}>
              {item.label}
            </T>
            {item.dot ? <View style={[styles.segmentDot, { backgroundColor: color, opacity: active ? 0.9 : 0.63 }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet for menus (settings, calendar). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { theme } = useLook();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHead}>
          <T w="medium" style={{ color: theme.fg, fontSize: 17 }}>
            {title}
          </T>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={20} color={theme.mutedFg} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 10 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

/** A plain row in a sheet: icon, label, optional note. */
export function MenuRow({ theme, icon, label, note, onPress, danger }: { theme: Theme; icon?: ReactNode; label: string; note?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, { borderColor: theme.border, backgroundColor: pressed ? theme.muted : theme.card }]}>
      {icon}
      <View style={{ flex: 1 }}>
        <T style={{ color: danger ? theme.danger : theme.fg, fontSize: 15 }}>{label}</T>
        {note ? <T style={{ color: theme.mutedFg, fontSize: 12, marginTop: 2 }}>{note}</T> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 8 },
  primary: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  themeCard: { width: "48.8%", borderWidth: 1, borderRadius: 16, padding: 12 },
  swatches: { flexDirection: "row", gap: 4 },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  box: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  segment: { flexDirection: "row", borderRadius: 8, overflow: "hidden" },
  segmentThumb: { position: "absolute", borderRadius: 5 },
  segmentItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
  segmentDot: { width: 5, height: 5, borderRadius: 3 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { maxHeight: "85%", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
