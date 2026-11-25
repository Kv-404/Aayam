import { useCallback, useEffect, useRef, useState, type ComponentType, type RefAttributes } from "react";
import { ActivityIndicator, AppState, BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewNavigation, type WebViewProps } from "react-native-webview";
import { API_BASE } from "./src/api";
import { applyState, handleRequest, injectedBridge, refreshNative, replyScript } from "./src/bridge";
import { readLook } from "./src/prefs";
import { buildTheme } from "./src/theme";
import { checkForAppUpdate } from "./src/update";

// The app shows the site itself, so every web deploy reaches the phone with no new build.
// The phone adds what a page cannot: Google sign-in outside the webview, push alerts, reminders and widgets.
const SITE = API_BASE;
const SITE_HOST = new URL(SITE).host;

// react-native-webview's types lose the ref under React 19's types; the component forwards it.
type WebHandle = { injectJavaScript: (script: string) => void; goBack: () => void; reload: () => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & RefAttributes<WebHandle>>;

export default function App() {
  const web = useRef<WebHandle>(null);
  const [colors, setColors] = useState({ bg: "#0a0b0e", fg: "#f5f5f5", dark: true });
  const [failed, setFailed] = useState(false);
  // No network: load the last copy Android kept. The page then shows its own saved timetable.
  const [offline, setOffline] = useState(false);
  const canGoBack = useRef(false);

  useEffect(() => {
    void checkForAppUpdate();
    void readLook().then((look) => {
      const theme = buildTheme(look);
      setColors({ bg: theme.bg, fg: theme.fg, dark: theme.isDark });
    });
  }, []);

  // Back on the phone: the page goes back first, then the app closes.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack.current) return false;
      web.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Coming back to the app re-plans reminders and redraws widgets from a fresh timetable.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void refreshNative();
      void checkForAppUpdate();
      setOffline(false);
    });
    return () => sub.remove();
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let message: { type?: string; id?: string; state?: Record<string, string | null> };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === "state" && message.state) {
      void applyState(message.state).then(() =>
        readLook().then((look) => {
          const theme = buildTheme(look);
          setColors({ bg: theme.bg, fg: theme.fg, dark: theme.isDark });
        }),
      );
      return;
    }
    if (message.id && (message.type === "signin" || message.type === "notify" || message.type === "notify-state")) {
      void handleRequest(message as Parameters<typeof handleRequest>[0]).then((reply) => web.current?.injectJavaScript(replyScript(reply)));
    }
  }, []);

  // Only the site opens inside the app. Meet, the exam site, calendars and mail go to their own apps.
  const onNavigate = useCallback((request: WebViewNavigation) => {
    const url = request.url;
    if (url.startsWith("about:") || url.startsWith("data:") || url.startsWith("blob:")) return true;
    try {
      if (new URL(url).host === SITE_HOST) return true;
    } catch {
      return false;
    }
    void Linking.openURL(url).catch(() => undefined);
    return false;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={colors.dark ? "light" : "dark"} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
        {failed ? (
          <View style={styles.center}>
            <Text style={{ color: colors.fg, textAlign: "center", marginBottom: 12 }}>Could not reach Aayam. Check your connection.</Text>
            <Pressable
              onPress={() => {
                setFailed(false);
                setOffline(false);
                web.current?.reload();
              }}
            >
              <Text style={{ color: colors.fg, fontWeight: "600" }}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        <WebView
          ref={web}
          source={{ uri: `${SITE}/` }}
          style={{ flex: 1, backgroundColor: colors.bg, display: failed ? ("none" as const) : ("flex" as const) }}
          injectedJavaScriptBeforeContentLoaded={injectedBridge}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onNavigate}
          onNavigationStateChange={(state) => {
            canGoBack.current = state.canGoBack;
          }}
          cacheMode={offline ? "LOAD_CACHE_ONLY" : "LOAD_DEFAULT"}
          onError={() => {
            if (offline) setFailed(true);
            else {
              setOffline(true);
              setTimeout(() => web.current?.reload(), 0);
            }
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500 && !event.nativeEvent.url.includes("/api/")) setFailed(true);
          }}
          applicationNameForUserAgent="AayamApp/1.1"
          setSupportMultipleWindows={false}
          domStorageEnabled
          javaScriptEnabled
          sharedCookiesEnabled
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          overScrollMode="never"
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.center, StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
              <ActivityIndicator color={colors.fg} />
            </View>
          )}
          onContentProcessDidTerminate={() => web.current?.reload()}
          onRenderProcessGone={() => web.current?.reload()}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
