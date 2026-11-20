import { createContext, useContext } from "react";
import { Platform } from "react-native";
import type { DisplayStatus } from "@shared/types.ts";
import { toneFor } from "@web/calendarTone.ts";
import { palettes, themeList, type ThemeId } from "./themes";
import { defaultLook, type Look } from "./prefs";

export function buildTheme(look: Look) {
  const palette = palettes[look.theme];
  const meta = themeList.find((item) => item.id === look.theme)!;
  return { ...palette, id: look.theme as ThemeId, isDark: meta.dark, look };
}

export type Theme = ReturnType<typeof buildTheme>;

export const LookContext = createContext<{ theme: Theme; setLook: (next: Partial<Look>) => void }>({
  theme: buildTheme(defaultLook),
  setLook: () => undefined,
});

export function useLook() {
  return useContext(LookContext);
}

/** `color-mix(in oklab, colour N%, transparent)` as hex with alpha. */
export function tint(hex: string, alpha = 0.16) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

/**
 * The site's `.cal-chip` in three modes (client/src/index.css):
 * colours on = 16% tint + 3px bar; bold = solid tone with ink text; colours off = plain with a border-coloured bar.
 */
export function chipStyle(theme: Theme, subject: string, status: DisplayStatus) {
  const tone = theme.tones[toneFor(subject, status)];
  if (!theme.look.colors) return { bg: "transparent", bar: theme.border, text: theme.fg, sub: theme.mutedFg, roomBg: tint(theme.bg, 0.8) };
  if (theme.look.bold) return { bg: tone.fill, bar: "transparent", text: tone.ink, sub: tone.ink, roomBg: "transparent" };
  return { bg: tint(tone.fill), bar: tone.fill, text: theme.fg, sub: theme.fg, roomBg: tint(theme.bg, 0.8) };
}

export const fonts = {
  regular: "Satoshi-Regular",
  medium: "Satoshi-Medium",
  bold: "Satoshi-Bold",
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
};
