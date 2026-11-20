import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { AayamIcon } from "@/components/AayamLogo";
import { fetchGoogleClientId, loadGoogleScript } from "@/lib/auth";

/** The only place a session is sent. Fixed, so this page cannot be used to send a token anywhere else. */
const APP_REDIRECT = "aayam://auth";
const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

function readState() {
  const state = new URLSearchParams(window.location.search).get("state") ?? "";
  return /^[A-Za-z0-9-]{8,64}$/.test(state) ? state : "";
}

function backToApp(state: string, values: Record<string, string>) {
  const fragment = new URLSearchParams({ state, ...values }).toString();
  window.location.replace(`${APP_REDIRECT}#${fragment}`);
}

/**
 * /app-auth: faculty sign-in for the phone app. The app opens this page in the system browser with a
 * random `state`; after Google sign-in the session goes back to aayam://auth with that state.
 * The browser is not signed in: no cookie, nothing saved here.
 */
export function AppAuthPage() {
  const [state] = useState(readState);
  const [error, setError] = useState<string | null>(state ? null : "Open this page from the Aayam app.");
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    loadGoogleScript();
    let timer: number | undefined;

    async function initButton() {
      if (!window.google?.accounts?.id || !buttonRef.current) return false;
      const clientId = await fetchGoogleClientId();
      if (!clientId) {
        setError("Google sign-in is unavailable right now. Please try again shortly.");
        return true;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) return;
          setLoading(true);
          setError(null);
          try {
            const res = await fetch(`${base}/api/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "omit",
              body: JSON.stringify({ credential: response.credential }),
            });
            const data = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string; error?: string };
            if (!res.ok || !data.ok || typeof data.token !== "string") throw new Error(data.error || "Sign-in was refused. Use an authorized faculty account.");
            backToApp(state, { token: data.token });
          } catch (err) {
            setLoading(false);
            setError(err instanceof Error ? err.message : "Sign-in failed.");
          }
        },
      });
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", text: "signin_with", shape: "pill", width: 280 });
      return true;
    }

    void initButton().then((done) => {
      if (!done) {
        timer = window.setInterval(async () => {
          if (await initButton()) window.clearInterval(timer);
        }, 200);
      }
    });
    return () => window.clearInterval(timer);
  }, [state]);

  return (
    <main className="flex min-h-dvh flex-col bg-background px-6 py-4 text-foreground">
      <AayamIcon size={30} />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <h1 className="text-4xl tracking-tight">Faculty sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your <span className="font-semibold text-foreground">@itm.edu</span> or <span className="font-semibold text-foreground">@isu.ac.in</span> Google account. You
          will go back to the Aayam app.
        </p>
        <div className="mt-8 flex min-h-12 items-center">
          {loading ? <p className="text-sm text-muted-foreground">Signing you in…</p> : <div ref={buttonRef} />}
        </div>
        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        {state && error ? (
          <button type="button" onClick={() => backToApp(state, { error })} className="mt-4 self-start text-sm text-muted-foreground underline underline-offset-4">
            Back to the app
          </button>
        ) : null}
      </div>
    </main>
  );
}
