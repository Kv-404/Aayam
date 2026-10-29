import { useEffect, useRef, useState } from "react";
import { AlertCircle, Lock, X } from "lucide-react";
import { fetchGoogleClientId, loginWithGoogleCredential } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            hosted_domain?: string;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function FacultyLoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (faculty: string, email: string, canSeeAllFaculty?: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setLoading(false);
      return;
    }

    let checkInterval: number | undefined;

    async function initButton() {
      if (!window.google?.accounts?.id || !buttonContainerRef.current) return false;
      const clientId = await fetchGoogleClientId();
      if (!clientId) {
        setError("Google Client ID is not configured. Please set GOOGLE_CLIENT_ID in .env.");
        return true;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) return;
          try {
            setLoading(true);
            setError(null);
            const result = await loginWithGoogleCredential(response.credential);
            onSuccess(result.faculty, result.email, result.canSeeAllFaculty);
            onClose();
          } catch (err: any) {
            setError(err.message || "Failed to sign in. Only authorized faculty are permitted.");
          } finally {
            setLoading(false);
          }
        },
      });

      buttonContainerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 280,
      });
      return true;
    }

    initButton().then((done) => {
      if (!done) {
        checkInterval = window.setInterval(async () => {
          if (await initButton()) {
            window.clearInterval(checkInterval);
          }
        }, 200);
      }
    });

    return () => {
      if (checkInterval) window.clearInterval(checkInterval);
    };
  }, [open, onClose, onSuccess]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faculty-modal-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent mb-4">
            <Lock className="size-6 text-accent" />
          </div>

          <h2 id="faculty-modal-title" className="text-xl font-semibold tracking-tight">
            Faculty Authentication
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Sign in with your official <span className="font-semibold text-foreground">@itm.edu</span> or <span className="font-semibold text-foreground">@isu.ac.in</span> Google account.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center min-h-12 w-full">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                Verifying faculty authorization...
              </div>
            ) : (
              <div ref={buttonContainerRef} className="flex justify-center w-full" />
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left text-xs text-red-500">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-4 w-full text-center">
            <p className="text-xs text-muted-foreground">
              Are you a student?{" "}
              <button
                type="button"
                onClick={onClose}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Go back to student timetable
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
