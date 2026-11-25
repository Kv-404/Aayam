import { isHomeScreenApp } from "@/lib/facultyBoot";

/** Android APK of the phone app in `mobile/`, the same Releases link as the README. There is no iOS build to link yet. */
export const ANDROID_APP_URL = "https://github.com/Kv-404/Aayam/releases/latest";

/** Android phone browser only: not desktop, not iOS, not a home-screen icon, not an in-app webview. */
export function canOfferAndroidApp() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (!/Android/i.test(ua) || !/Mobile/i.test(ua)) return false;
  if ("ReactNativeWebView" in window || /; wv\)/.test(ua)) return false;
  return !isHomeScreenApp();
}
