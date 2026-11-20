import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowRight, X } from "lucide-react-native";
import { fonts, useLook, type Theme } from "./theme";
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, { borderColor: theme.border, backgroundColor: pressed ? theme.muted : theme.card }]}>
      <View style={{ flexShrink: 1 }}>
        <T style={{ color: theme.fg, fontSize: 18 }}>{label}</T>
        {note ? <T style={{ color: theme.mutedFg, fontSize: 13, marginTop: 2 }}>{note}</T> : null}
      </View>
      <ArrowRight size={18} color={theme.mutedFg} strokeWidth={1.75} />
    </Pressable>
  );
}

export function BackLink({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.back}>
      <ArrowLeft size={16} color={theme.mutedFg} strokeWidth={1.75} />
      <T style={{ color: theme.mutedFg, fontSize: 15 }}>Back</T>
    </Pressable>
  );
}

export function PrimaryButton({ label, theme, onPress }: { label: string; theme: Theme; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primary, { backgroundColor: theme.fg, opacity: pressed ? 0.85 : 1 }]}>
      <T w="medium" style={{ color: theme.bg, fontSize: 16 }}>
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
              style={[styles.themeCard, { borderColor: theme.border, backgroundColor: active ? theme.fg : "transparent" }]}
            >
              <View style={styles.swatches}>
                {item.swatch.map((color, index) => (
                  <View key={index} style={[styles.swatch, { backgroundColor: color, borderColor: active ? tintBorder(theme.bg) : theme.border }]} />
                ))}
              </View>
              <T w="medium" style={{ color: active ? theme.bg : theme.fg, fontSize: 15, marginTop: 8 }}>
                {item.name}
              </T>
              <T style={{ color: active ? theme.bg : theme.mutedFg, opacity: active ? 0.7 : 1, fontSize: 12, marginTop: 2 }}>{item.blurb}</T>
            </Pressable>
          );
        })}
      </View>
      <SwitchRow theme={theme} title="Class colours" note="Each class has its own colour" value={look.colors} onChange={(colors) => setLook({ colors })} />
      {look.colors ? (
        <SwitchRow theme={theme} title="Bold colours" note={look.bold ? "Solid class colours" : "Plain timetable"} value={look.bold} onChange={(bold) => setLook({ bold })} />
      ) : null}
      <View style={[styles.box, { borderColor: theme.border }]}>
        <T style={{ color: theme.fg, fontSize: 15 }}>Meet button</T>
        <T style={{ color: theme.mutedFg, fontSize: 12, marginTop: 2 }}>Open the call, or copy the link.</T>
        <View style={[styles.split, { backgroundColor: theme.muted }]}>
          {(["open", "copy"] as const).map((id) => {
            const active = look.meet === id;
            return (
              <Pressable key={id} onPress={() => setLook({ meet: id })} style={[styles.splitItem, active && { backgroundColor: theme.fg }]}>
                <T style={{ color: active ? theme.bg : theme.fg, fontSize: 14 }}>{id === "open" ? "Open link" : "Copy link"}</T>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const tintBorder = (hex: string) => `${hex}33`;

export function SwitchRow({ theme, title, note, value, onChange }: { theme: Theme; title: string; note?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={[styles.box, styles.switchRow, { borderColor: theme.border }]}>
      <View style={{ flex: 1 }}>
        <T style={{ color: theme.fg, fontSize: 15 }}>{title}</T>
        {note ? <T style={{ color: theme.mutedFg, fontSize: 12, marginTop: 2 }}>{note}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.fg, false: theme.muted }} thumbColor={value ? theme.bg : theme.mutedFg} ios_backgroundColor={theme.muted} />
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
  choice: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 18 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 8 },
  primary: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  themeCard: { width: "48%", flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  swatches: { flexDirection: "row", gap: 4 },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  box: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  split: { flexDirection: "row", borderRadius: 8, padding: 3, marginTop: 10 },
  splitItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 6 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { maxHeight: "85%", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
