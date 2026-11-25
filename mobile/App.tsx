import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import type { BootstrapResponse } from "@shared/types.ts";
import { cohortLabel } from "@shared/cohort.ts";
import { facultyMe, fetchBootstrap, requestSync } from "./src/api";
import { clearWho, defaultLook, readLook, readSession, readWho, saveFaculty, saveLook, saveStudent, type Look, type Who } from "./src/prefs";
import { Setup } from "./src/Setup";
import { Timetable } from "./src/Timetable";
import { buildTheme, fonts, LookContext } from "./src/theme";
import { unregisterPush } from "./src/notify";
import * as Notifications from "expo-notifications";

// Same cadence as the site: about every 5 min while open, nothing in the background.
const POLL_MS = 5 * 60 * 1000;

export default function App() {
  const [fontsReady] = useFonts({
    [fonts.regular]: require("./assets/fonts/Satoshi-Regular.ttf"),
    [fonts.medium]: require("./assets/fonts/Satoshi-Medium.ttf"),
    [fonts.bold]: require("./assets/fonts/Satoshi-Bold.ttf"),
  });
  const [look, setLookState] = useState<Look>(defaultLook);
  const [who, setWho] = useState<Who | null | undefined>(undefined);
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const whoRef = useRef<Who | null>(null);
  const followUp = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = useMemo(() => buildTheme(look), [look]);
  const setLook = useCallback((next: Partial<Look>) => {
    setLookState((prev) => {
      const merged = { ...prev, ...next };
      void saveLook(merged);
      return merged;
    });
  }, []);

  const load = useCallback(async (scope: Who | null, sync = false) => {
    try {
      setError(null);
      const body = sync ? await requestSync(scope) : await fetchBootstrap(scope);
      setData(body);
      // The job is re-reading the sheet: ask again shortly, like the site's 4 s follow-up.
      if (followUp.current) clearTimeout(followUp.current);
      if (body.sync.refreshing) followUp.current = setTimeout(() => void load(whoRef.current), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the timetable.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLookState(await readLook());
      let saved = await readWho();
      if (saved?.role === "faculty") {
        // A revoked or expired session sends the teacher back to sign-in. No network keeps them signed in.
        const token = await readSession();
        const fresh = token ? await facultyMe(token).catch(() => saved?.role === "faculty" ? saved.faculty : null) : null;
        if (!fresh) {
          await clearWho();
          saved = null;
        } else saved = { role: "faculty", faculty: fresh };
      }
      whoRef.current = saved;
      setWho(saved);
      void load(saved);
    })();
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      timer ??= setInterval(() => void load(whoRef.current), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void load(whoRef.current);
        start();
      } else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [load]);

  const finishSetup = async (next: Who, token?: string) => {
    if (next.role === "student") await saveStudent(next.student);
    else if (token) await saveFaculty(next.faculty, token);
    whoRef.current = next;
    setWho(next);
    setHome(false);
    setData(null);
    void load(next);
  };

  // The logo opens the "I am" start screen, like the site's `onReset`: nothing saved is cleared,
  // and "Continue to …" (or Android back) returns to the saved timetable.
  const [home, setHome] = useState(false);
  useEffect(() => {
    if (!home) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!whoRef.current) return false;
      setHome(false);
      return true;
    });
    return () => sub.remove();
  }, [home]);

  const logout = async () => {
    // The phone stops getting this person's alerts. The on/off choice stays for the next sign-in.
    await unregisterPush();
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
    await clearWho();
    whoRef.current = null;
    setWho(null);
    setHome(false);
    setData(null);
    void load(null);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load(whoRef.current, true);
    setRefreshing(false);
  };

  let body;
  if (error && !data) {
    body = (
      <View style={styles.center}>
        <Text style={{ color: theme.danger, textAlign: "center", fontFamily: fonts.regular }}>{error}</Text>
        <Pressable onPress={() => void load(whoRef.current)} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.fg, fontFamily: fonts.medium }}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (!data || who === undefined || !fontsReady) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.mutedFg} />
      </View>
    );
  } else if (!who) {
    body = <Setup choices={data.choices ?? []} onDone={(next, token) => void finishSetup(next, token)} />;
  } else if (home) {
    const resume = who.role === "student" ? cohortLabel(who.student.division) : who.faculty.faculty;
    body = <Setup choices={data.choices ?? []} resume={{ label: resume, onPress: () => setHome(false) }} onDone={(next, token) => void finishSetup(next, token)} />;
  } else {
    body = <Timetable data={data} who={who} refreshing={refreshing} onRefresh={() => void refresh()} onLogout={() => void logout()} onHome={() => setHome(true)} />;
  }

  return (
    <SafeAreaProvider>
      <LookContext.Provider value={{ theme, setLook }}>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        {data && who && fontsReady && !home ? body : <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>{body}</SafeAreaView>}
      </LookContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
