import { Alert, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// New app builds are GitHub releases tagged app-vX.Y.Z with an aayam-X.Y.Z.apk asset.
// The page inside the app updates on its own; this only covers the app shell (push, widgets, bridge).
const RELEASES = "https://api.github.com/repos/Kv-404/Aayam/releases?per_page=10";
const SNOOZE = "timetable-app-update-snooze"; // JSON { version, until }
const LAST_CHECK = "timetable-app-update-checked";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

type Release = { tag_name: string; draft: boolean; html_url: string; assets: { name: string; browser_download_url: string }[] };

function parse(version: string) {
  return version.replace(/^app-v|^v/, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewer(candidate: string, current: string) {
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff > 0;
  }
  return false;
}

/** Looks for a newer app release on GitHub and offers to download it. Quiet when offline. */
export async function checkForAppUpdate(force = false) {
  if (Platform.OS !== "android") return;
  const current = Constants.expoConfig?.version;
  if (!current) return;
  try {
    const now = Date.now();
    if (!force && now - Number((await AsyncStorage.getItem(LAST_CHECK)) ?? 0) < CHECK_EVERY_MS) return;
    await AsyncStorage.setItem(LAST_CHECK, String(now));
    const res = await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return;
    const releases = (await res.json()) as Release[];
    const latest = releases.find((release) => !release.draft && release.tag_name.startsWith("app-v"));
    if (!latest || !isNewer(latest.tag_name, current)) return;
    const version = latest.tag_name.replace(/^app-v/, "");
    const snooze = JSON.parse((await AsyncStorage.getItem(SNOOZE)) ?? "null") as { version: string; until: number } | null;
    if (!force && snooze?.version === version && snooze.until > now) return;
    const apk = latest.assets.find((asset) => asset.name.endsWith(".apk"));
    const url = apk?.browser_download_url ?? latest.html_url;
    Alert.alert(`Aayam ${version} is out`, "Download the update and open it to install over this version. Your class and settings stay.", [
      { text: "Later", style: "cancel", onPress: () => void AsyncStorage.setItem(SNOOZE, JSON.stringify({ version, until: now + SNOOZE_MS })) },
      { text: "Download", onPress: () => void Linking.openURL(url) },
    ]);
  } catch {
    // Offline or GitHub rate limit: try again next time.
  }
}
