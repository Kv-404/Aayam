// The Android app (mobile/) shows this site in a webview and adds a small bridge.
// Google sign-in, alerts and reminders go through the phone, since a webview cannot do them.

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

export function inNativeApp() {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}

type Reply = { id: string; ok: boolean; message?: string; on?: boolean; token?: string; faculty?: string; email?: string; canSeeAll?: boolean };

/** Sends a request to the app and waits for its reply (sign-in can take a while in the browser). */
function ask(request: Record<string, unknown>, timeoutMs = 5 * 60 * 1000): Promise<Reply> {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const done = (reply: Reply) => {
      window.removeEventListener("aayam-native", listener);
      window.clearTimeout(timer);
      resolve(reply);
    };
    const listener = (event: Event) => {
      const reply = (event as CustomEvent<Reply>).detail;
      if (reply?.id === id) done(reply);
    };
    const timer = window.setTimeout(() => done({ id, ok: false, message: "The app did not answer. Try again." }), timeoutMs);
    window.addEventListener("aayam-native", listener);
    window.ReactNativeWebView?.postMessage(JSON.stringify({ ...request, id }));
  });
}

export function nativeSignIn() {
  return ask({ type: "signin" });
}

export function nativeNotify(on: boolean) {
  return ask({ type: "notify", on }, 60 * 1000);
}

export function nativeNotifyState() {
  return ask({ type: "notify-state" }, 10 * 1000);
}
