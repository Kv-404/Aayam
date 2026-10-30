import { cohortLabel, cohortsInYear, type CohortChoice } from "@shared/cohort";
import { coordinatorPreviews } from "@shared/coordinators";
import { AlertCircle, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CodeSlots from "@/components/CodeSlots";
import { ColorSwitch } from "@/components/ColorSwitch";
import { MeetChoice } from "@/components/MeetLink";
import { Input } from "@/components/ui/input";
import { fetchGoogleClientId, loginWithGoogleCredential, verifyPin } from "@/lib/auth";
import { signInFacultyLens } from "@/lib/facultyView";
import {
  clearStudentAuth,
  readStoredCohort,
  readStudentBatch,
  saveCanSeeAllFaculty,
  saveCohort,
  saveFaculty,
  saveFacultyEmail,
  saveFacultyLens,
  saveFacultyPreview,
  saveRole,
  saveSetup,
  saveStudentBatch,
  themes,
  type MeetAction,
  type ThemeId,
  type ViewerRole,
} from "@/lib/prefs";
import { cohortToSlug } from "@/lib/slug";

type StepId = "role" | "pin" | "cohort" | "faculty" | "theme";

const facultySteps: StepId[] = ["role", "faculty", "theme"];
const studentSteps: StepId[] = ["role", "pin", "cohort", "theme"];

export function Setup({
  choices,
  faculties,
  cohort,
  faculty,
  initialRole = "",
  theme,
  colors,
  bold,
  meet,
  onTheme,
  onColors,
  onBold,
  onMeet,
  onDone,
  onPickCohort,
  onPickFaculty,
  onPickBatch,
}: {
  choices: CohortChoice[];
  faculties: string[];
  cohort: string;
  faculty: string;
  initialRole?: ViewerRole | "";
  theme: ThemeId;
  colors: boolean;
  bold: boolean;
  meet: MeetAction;
  onTheme: (theme: ThemeId) => void;
  onColors: (on: boolean) => void;
  onBold: (on: boolean) => void;
  onMeet: (action: MeetAction) => void;
  onDone: (choice: { role: ViewerRole; cohort: string; faculty: string }) => void;
  onPickCohort?: (cohort: string) => void;
  onPickFaculty?: (faculty: string) => void;
  onPickBatch?: (course: string, batch: string) => void;
}) {
  const savedBatch = readStudentBatch();
  const saved = choices.find((choice) => choice.division === cohort || choice.division.toLowerCase() === cohort.toLowerCase());
  const [step, setStep] = useState<StepId>(
    initialRole === "faculty"
      ? "faculty"
      : initialRole === "student"
      ? (savedBatch || saved ? "cohort" : "pin")
      : "role"
  );
  const [role, setRole] = useState<ViewerRole | "">(initialRole);
  const [program, setProgram] = useState(savedBatch?.course ?? saved?.course ?? "");
  const [year, setYear] = useState(savedBatch?.batch ?? saved?.batch ?? "");
  const [picked, setPicked] = useState(saved ? saved.division : "");
  const [name, setName] = useState(faculties.includes(faculty) ? faculty : "");
  const [query, setQuery] = useState("");
  const [codeStatus, setCodeStatus] = useState<"idle" | "error" | "success">("idle");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGoogleClientId().then(setClientId);
  }, []);

  useEffect(() => {
    if (step !== "faculty" || name) return;

    let checkInterval: number | undefined;
    async function init() {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return false;
      const cid = await fetchGoogleClientId();
      if (!cid) return false;
      setClientId(cid);

      window.google.accounts.id.initialize({
        client_id: cid,
        callback: async (response) => {
          if (!response.credential) return;
          try {
            setAuthLoading(true);
            setAuthError(null);
            const result = await loginWithGoogleCredential(response.credential);
            setAuthEmail(result.email);
            saveFacultyEmail(result.email);
            saveCanSeeAllFaculty(Boolean(result.canSeeAllFaculty));
            saveFacultyPreview(false);
            saveFacultyLens(signInFacultyLens(result.email, result.faculty, Boolean(result.canSeeAllFaculty)));
            enterFaculty(result.faculty);
          } catch (err: any) {
            setAuthError(err.message || "Failed to sign in. Only authorized faculty are permitted.");
          } finally {
            setAuthLoading(false);
          }
        },
      });
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 280,
      });
      return true;
    }

    init().then((done) => {
      if (!done) {
        checkInterval = window.setInterval(async () => {
          if (await init()) window.clearInterval(checkInterval);
        }, 200);
      }
    });

    return () => {
      if (checkInterval) window.clearInterval(checkInterval);
    };
  }, [step, name, faculties]);

  const cohorts = cohortsInYear(choices, program, year);
  const steps = role === "faculty" ? facultySteps : studentSteps;
  const index = Math.max(0, steps.indexOf(step));
  const visibleFaculties = faculties.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase()));
  const copy: Record<StepId, [string, string]> = {
    role: ["Who are you?", "Choose whether you are a Student or a Teacher."],
    pin: ["Enter Batch PIN", "Enter your 6-digit PIN to access your batch's classes."],
    cohort: ["Select Your Cohort", program && year ? `${program} · ${year}` : "Choose your section / division."],
    faculty: ["Teacher Sign In", "Sign in with your official @itm.edu or @isu.ac.in Google account."],
    theme: ["Pick a theme", "Week is the grid. One day is a compact list. You can change this later."],
  };
  const [title, note] = copy[step];

  function enterFaculty(f: string) {
    setName(f);
    saveFaculty(f);
    saveRole("faculty");
    const choice = { role: "faculty" as ViewerRole, cohort, faculty: f };
    saveSetup({ ...choice, theme });
    onPickFaculty?.(f);
    onDone(choice);
  }

  function pickFaculty(f: string) {
    saveFacultyEmail("");
    saveCanSeeAllFaculty(false);
    saveFacultyPreview(false);
    saveFacultyLens(signInFacultyLens("", f, false));
    enterFaculty(f);
  }

  function goBack() {
    if (step === "pin") {
      setStep("role");
      return;
    }
    if (step === "cohort") {
      clearStudentAuth();
      setProgram("");
      setYear("");
      setPicked("");
      setStep("pin");
      return;
    }
    if (step === "theme") {
      setStep(role === "faculty" ? "faculty" : "cohort");
      return;
    }
    if (step === "faculty") {
      setStep("role");
      return;
    }
  }

  function goNext() {
    if (step === "role") {
      setStep(role === "faculty" ? "faculty" : "pin");
      return;
    }
    if (step === "pin") {
      if (program && year) setStep("cohort");
      return;
    }
    if (step === "cohort") {
      saveCohort(picked);
      saveRole("student");
      onPickCohort?.(picked);
      setStep("theme");
      return;
    }
    if (step === "faculty") {
      if (name) setStep("theme");
      return;
    }
  }

  function canAdvance() {
    if (step === "role") return Boolean(role);
    if (step === "pin") return Boolean(program && year);
    if (step === "cohort") return cohorts.some((choice) => choice.division === picked);
    if (step === "faculty") return Boolean(name);
    return true;
  }

  function finish() {
    if (!role || !canAdvance()) return;
    saveRole(role);
    const choice = { role, cohort: role === "student" ? picked : cohort, faculty: role === "faculty" ? name : faculty };
    saveSetup({ ...choice, theme });
    onDone(choice);
  }

  return (
    <main className={`mx-auto flex min-h-dvh flex-col px-5 py-5 sm:px-6 ${step === "theme" ? "max-w-4xl" : "max-w-lg"}`}>
      <div key={step} className="rise flex flex-1 flex-col justify-center">
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
          {index + 1} of {steps.length}
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{note}</p>
        {step === "role" && (
          <div className="mt-8 flex flex-col gap-3">
            {readStoredCohort() && (
              <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 flex items-center justify-between">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Saved Timetable
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {cohortLabel(readStoredCohort())}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const c = readStoredCohort();
                    const slug = cohortToSlug(c);
                    window.history.pushState(null, "", `/${slug}`);
                    onPickCohort?.(c);
                    onDone({ role: "student", cohort: c, faculty: "" });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <span>Open</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            )}
            <ul className="grid gap-2.5">
              {[
                { id: "student", label: "Student", desc: "Access your batch classes with your 6-digit PIN" },
                { id: "faculty", label: "Teacher / Faculty", desc: "Sign in with your ITM Google account" },
              ].map((option) => {
                const selected = role === option.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      data-testid={`role-${option.id}`}
                      onClick={() => {
                        const nextRole = option.id as ViewerRole;
                        setRole(nextRole);
                        saveRole(nextRole);
                        setStep(nextRole === "faculty" ? "faculty" : (savedBatch ? "cohort" : "pin"));
                      }}
                      className={choiceClass(selected, "items-center px-4 py-3.5 text-lg")}
                      aria-pressed={selected}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-medium text-base sm:text-lg">{option.label}</span>
                        <span className={`text-xs ${selected ? "text-background/80" : "text-muted-foreground"}`}>{option.desc}</span>
                      </div>
                      <ChoiceMark selected={selected} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {step === "pin" && (
          <div className="mt-8 flex flex-col items-center gap-6 text-center">
            <div className="rounded-2xl border border-border/80 bg-card/60 p-6 sm:p-8 backdrop-blur-sm shadow-sm flex flex-col items-center max-w-md w-full">
              <div className="mb-6 flex flex-col items-center">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
                  Student Verification
                </span>
                <p className="text-sm text-muted-foreground">
                  Enter your 6-digit PIN to access your batch's classes.
                </p>
              </div>

              <CodeSlots
                length={6}
                status={codeStatus}
                onChange={() => {
                  setCodeStatus("idle");
                  setCodeError(null);
                }}
                onComplete={async (code) => {
                  setCodeLoading(true);
                  setCodeError(null);
                  try {
                    const res = await verifyPin(code);
                    setCodeLoading(false);
                    if (res.ok && res.course && res.batch) {
                      setProgram(res.course);
                      setYear(res.batch);
                      saveRole("student");
                      saveStudentBatch(res.course, res.batch);
                      setCodeStatus("success");
                      onPickBatch?.(res.course, res.batch);
                      setTimeout(() => {
                        setStep("cohort");
                        setCodeStatus("idle");
                      }, 400);
                    } else {
                      setCodeStatus("error");
                      setCodeError(res.error || "Invalid PIN. Please check with your class representative.");
                    }
                  } catch {
                    setCodeLoading(false);
                    setCodeStatus("error");
                    setCodeError("Failed to verify PIN. Try again.");
                  }
                }}
                autoFocus
                slotSize={46}
                gap={8}
                radius={12}
              />

              {codeLoading && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <span className="size-3 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
                  <span>Verifying PIN with database...</span>
                </div>
              )}

              {codeError && (
                <div className="mt-4 flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}

              <p className="mt-6 text-[11px] text-muted-foreground/80 leading-relaxed">
                Need your batch PIN? Contact your class representative or email{" "}
                <a href="mailto:2025.karamveers@isu.ac.in" className="text-foreground underline underline-offset-2">
                  2025.karamveers@isu.ac.in
                </a>
              </p>
            </div>
          </div>
        )}
        {step === "cohort" && (
          <div className="mt-8 flex flex-col gap-3">
            {program && year && (
              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{program} · {year}</span>
                <button
                  type="button"
                  onClick={() => {
                    clearStudentAuth();
                    setProgram("");
                    setYear("");
                    setPicked("");
                    setStep("pin");
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Change PIN
                </button>
              </div>
            )}
            <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto">
              {cohorts.map((choice) => {
                const selected = picked === choice.division;
                return (
                  <li key={choice.division}>
                    <button
                      type="button"
                      data-testid={`cohort-${choice.division}`}
                      onClick={() => setPicked(choice.division)}
                      className={choiceClass(selected, "items-center px-4 py-3 text-lg")}
                      aria-pressed={selected}
                    >
                      {cohortLabel(choice.division)}
                      <ChoiceMark selected={selected} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {step === "faculty" && (
          <div className="mt-8 flex flex-col items-center">
            {name ? (
              <div className="flex flex-col items-center gap-3 p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 w-full max-w-sm text-center">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-lg">
                  <Check className="size-5 shrink-0" />
                  <span>{name}</span>
                </div>
                {authEmail && <p className="text-xs text-muted-foreground">{authEmail}</p>}
                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Verified ITM Faculty
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Continue to Theme
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 w-full">
                <div ref={googleBtnRef} className="min-h-12 flex justify-center w-full" />
                {authLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="size-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                    <span>Verifying ITM faculty authorization...</span>
                  </div>
                )}
                {authError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left text-xs text-red-500 max-w-sm">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}
                {import.meta.env.DEV && (
                  <div className="w-full max-w-md rounded-lg border border-border bg-card/60 p-3 text-left">
                    <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Preview a coordinator</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {coordinatorPreviews().map((person) => (
                        <a
                          key={person.id}
                          href={`/?preview=${person.id}&menu=1`}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          {person.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {!clientId && (
                  <div className="mt-4 w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400 text-left">
                    <p className="font-semibold mb-1">Development Notice: Google Client ID Not Set</p>
                    <p>Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env</code> to enable live Google Sign-In.</p>
                    <p className="mt-2 text-muted-foreground">For local preview, choose your faculty name below:</p>
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search your name"
                      aria-label="Search faculty names"
                      className="mt-2 text-foreground"
                    />
                    <ul className="mt-2 grid max-h-40 gap-1 overflow-y-auto">
                      {visibleFaculties.map((item) => (
                        <li key={item}>
                          <button
                            type="button"
                            data-testid="faculty-name"
                            onClick={() => pickFaculty(item)}
                            className="text-left text-xs py-1.5 px-2 hover:bg-muted rounded w-full flex items-center justify-between text-foreground"
                          >
                            <span>{item}</span>
                            <ChoiceMark selected={name === item} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {step === "theme" && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {themes.map((item) => {
                const selected = theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onTheme(item.id)}
                    className={choiceClass(selected, "flex-col items-stretch px-3 py-3")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex shrink-0 gap-1" aria-hidden="true">
                        {item.swatch.map((color) => (
                          <span key={color} className="size-3 rounded-full border border-black/10" style={{ background: color }} />
                        ))}
                      </span>
                      <ChoiceMark selected={selected} />
                    </span>
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className={`text-xs ${selected ? "text-background/70" : "text-muted-foreground"}`}>{item.blurb}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 grid gap-2">
              <ColorSwitch on={colors} onChange={onColors} />
              {colors && <ColorSwitch on={bold} onChange={onBold} title="Bold colours" testId="bold-toggle" />}
              <MeetChoice action={meet} onChange={onMeet} />
            </div>
          </>
        )}
      </div>
      <div className="mt-8 flex justify-between border-t border-border pt-4">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-sm disabled:opacity-0"
          disabled={index === 0}
          onClick={goBack}
        >
          Back
        </button>
        {step === "theme" ? (
          <button type="button" className="rounded-md bg-foreground px-4 py-2 text-sm text-background" onClick={finish}>
            Save
          </button>
        ) : (
          <button type="button" className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40" disabled={!canAdvance()} onClick={goNext}>
            Next
          </button>
        )}
      </div>
      <footer className="mt-8 pt-4 border-t border-border/40 text-center text-xs text-muted-foreground flex items-center justify-center gap-3">
        <a
          href="/privacy"
          onClick={(e) => {
            e.preventDefault();
            window.history.pushState(null, "", "/privacy");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="hover:text-foreground underline underline-offset-4"
        >
          Privacy Policy
        </a>
        <span>•</span>
        <a
          href="/terms"
          onClick={(e) => {
            e.preventDefault();
            window.history.pushState(null, "", "/terms");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="hover:text-foreground underline underline-offset-4"
        >
          Terms of Service
        </a>
      </footer>
    </main>
  );
}

function choiceClass(selected: boolean, extra: string) {
  return `flex w-full justify-between gap-3 rounded-lg border text-left tracking-tight ${extra} ${
    selected ? "border-transparent bg-foreground text-background" : "border-border hover:bg-muted"
  }`;
}

function ChoiceMark({ selected }: { selected: boolean }) {
  if (!selected) return <span className="size-5 shrink-0 rounded-full border border-current opacity-35" aria-hidden="true" />;
  return <Check className="size-5 shrink-0" aria-hidden="true" />;
}
