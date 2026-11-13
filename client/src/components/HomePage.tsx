import { useMemo, useState, type MouseEvent } from "react";
import { cohortLabel, cohortsInYear, type CohortChoice, DEFAULT_COHORT_CHOICES } from "@shared/cohort";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { HomePitch } from "@/components/HomePitch";
import CodeSlots, { fittedSlotSize } from "@/components/CodeSlots";
import { ColorSwitch } from "@/components/ColorSwitch";
import { MeetChoice } from "@/components/MeetLink";
import { verifyPin } from "@/lib/auth";
import {
  clearStudentAuth,
  isBatchUnlocked,
  readStoredCohort,
  readStudentBatch,
  saveRole,
  saveSetup,
  saveStudentBatch,
  themes,
  type MeetAction,
  type ThemeId,
} from "@/lib/prefs";
import { cohortToSlug } from "@/lib/slug";

type Step = "role" | "pin" | "cohort" | "theme";

const sourceUrl = "https://github.com/Kv-404/Aayam";

export interface HomePageProps {
  onNavigateCohort: (slug: string) => void;
  choices?: CohortChoice[];
  onOpenFacultyLogin?: () => void;
  onNavigateUrl?: (url: string) => void;
  theme: ThemeId;
  colors: boolean;
  bold: boolean;
  meet: MeetAction;
  onTheme: (theme: ThemeId) => void;
  onColors: (on: boolean) => void;
  onBold: (on: boolean) => void;
  onMeet: (action: MeetAction) => void;
}

export function HomePage({
  onNavigateCohort,
  choices = DEFAULT_COHORT_CHOICES,
  onOpenFacultyLogin,
  onNavigateUrl,
  theme,
  colors,
  bold,
  meet,
  onTheme,
  onColors,
  onBold,
  onMeet,
}: HomePageProps) {
  const initialBatch = readStudentBatch();
  const savedCohort = readStoredCohort();
  const hasSavedAccess = Boolean(
    savedCohort &&
    initialBatch &&
    isBatchUnlocked(initialBatch.course, initialBatch.batch)
  );
  const [step, setStep] = useState<Step>("role");
  const [program, setProgram] = useState(initialBatch?.course ?? "");
  const [year, setYear] = useState(initialBatch?.batch ?? "");
  const [division, setDivision] = useState("");
  const [codeStatus, setCodeStatus] = useState<"idle" | "error" | "success">("idle");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  const cohorts = useMemo(
    () => (program && year ? cohortsInYear(choices, program, year) : []),
    [choices, program, year],
  );

  const copy: Record<Exclude<Step, "role">, [string, string]> = {
    pin: ["Enter batch PIN", "Enter the 6-digit PIN for your batch."],
    cohort: ["Select your section", program && year ? `${program} · ${year}` : "Choose your section."],
    theme: ["Select a theme", division ? `${cohortLabel(division)}. You can change this later.` : "You can change this later."],
  };
  const [title, note] = step === "role" ? ["", ""] : copy[step];

  function openStudent() {
    const batch = readStudentBatch();
    if (batch) {
      const own = cohortsInYear(choices, batch.course, batch.batch);
      if (own.length > 0) {
        setProgram(batch.course);
        setYear(batch.batch);
        setStep("cohort");
        return;
      }
    }
    setProgram("");
    setYear("");
    setStep("pin");
  }

  function goBack() {
    setCodeStatus("idle");
    setCodeError(null);
    if (step === "theme") {
      setStep("cohort");
      return;
    }
    setStep("role");
  }

  function useDifferentPin() {
    clearStudentAuth();
    setProgram("");
    setYear("");
    setCodeStatus("idle");
    setCodeError(null);
    setStep("pin");
  }

  function openCohort(next: string) {
    setDivision(next);
    setStep("theme");
  }

  function saveTheme() {
    if (!division) return;
    saveRole("student");
    saveSetup({ role: "student", cohort: division, faculty: "", theme });
    onNavigateCohort(cohortToSlug(division));
  }

  function openPage(event: MouseEvent, url: string) {
    event.preventDefault();
    if (onNavigateUrl) {
      onNavigateUrl(url);
      return;
    }
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  if (step === "role") {
    return (
      <HomePitch
        hasSavedAccess={hasSavedAccess}
        savedLabel={savedCohort ? cohortLabel(savedCohort) : ""}
        onContinue={() => {
          if (savedCohort) onNavigateCohort(cohortToSlug(savedCohort));
        }}
        onOpenStudent={openStudent}
        onOpenFaculty={() => onOpenFacultyLogin?.()}
        onOpenPage={openPage}
        sourceUrl={sourceUrl}
      />
    );
  }

  return (
    <main className={`mx-auto flex min-h-dvh w-full flex-col px-5 py-5 sm:px-6 ${step === "theme" ? "max-w-3xl" : "max-w-lg"}`}>
      <div key={step} className={`rise flex flex-col ${step === "theme" ? "py-4 sm:py-6" : "flex-1 justify-center"}`}>
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>

        {step === "pin" && (
          <div className="mt-8 flex flex-col items-center gap-6 text-center">
            <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-card p-6 sm:p-8">
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
                      window.setTimeout(() => {
                        setStep("cohort");
                        setCodeStatus("idle");
                      }, 400);
                    } else {
                      setCodeStatus("error");
                      setCodeError(res.error || "Invalid PIN. Check with your class representative.");
                    }
                  } catch {
                    setCodeLoading(false);
                    setCodeStatus("error");
                    setCodeError("Could not verify the PIN. Try again.");
                  }
                }}
                autoFocus
                slotSize={fittedSlotSize()}
                gap={8}
                radius={12}
              />

              {codeLoading && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="size-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                  <span>Checking the PIN</span>
                </div>
              )}

              {codeError && (
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-danger">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}

              <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
                Need a PIN? Ask your class representative or email{" "}
                <a href="mailto:2025.karamveers@isu.ac.in" className="text-foreground underline underline-offset-2">
                  2025.karamveers@isu.ac.in
                </a>
              </p>
            </div>
          </div>
        )}

        {step === "cohort" && (
          <div className="mt-8 flex flex-col gap-3">
            <div className="flex justify-end px-1 text-xs text-muted-foreground">
              <button type="button" onClick={useDifferentPin} className="hover:text-foreground">
                Different PIN
              </button>
            </div>
            {cohorts.length > 0 ? (
              <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto">
                {cohorts.map((choice) => (
                  <li key={choice.division}>
                    <button
                      type="button"
                      onClick={() => openCohort(choice.division)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left text-base font-medium tracking-tight hover:bg-muted"
                    >
                      {cohortLabel(choice.division)}
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
                No sections are listed for this batch yet.
              </p>
            )}
          </div>
        )}

        {step === "theme" && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
            <div className="mt-6 grid gap-2">
              <ColorSwitch on={colors} onChange={onColors} />
              {colors && <ColorSwitch on={bold} onChange={onBold} title="Bold colours" testId="bold-toggle" />}
              <MeetChoice action={meet} onChange={onMeet} />
            </div>
          </>
        )}
      </div>

      <div className={`flex items-center justify-between border-t border-border ${step === "theme" ? "mt-6 pt-4" : "mt-8 pt-4"}`}>
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back
        </button>
        {step === "theme" && (
          <button type="button" onClick={saveTheme} disabled={!division} className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40">
            Save
          </button>
        )}
      </div>

      <footer className={`flex items-center justify-center gap-3 border-t border-border/40 text-center text-xs text-muted-foreground ${step === "theme" ? "mt-6 pt-4" : "mt-8 pt-4"}`}>
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">
          GitHub
        </a>
        <span aria-hidden="true">•</span>
        <a href="/privacy" onClick={(event) => openPage(event, "/privacy")} className="underline-offset-4 hover:text-foreground hover:underline">
          Privacy Policy
        </a>
        <span aria-hidden="true">•</span>
        <a href="/terms" onClick={(event) => openPage(event, "/terms")} className="underline-offset-4 hover:text-foreground hover:underline">
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

export default HomePage;
