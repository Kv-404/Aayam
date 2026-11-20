import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { cohortLabel, cohortPrograms, cohortYears, cohortsInYear, type CohortChoice, DEFAULT_COHORT_CHOICES } from "@shared/cohort";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { AayamIcon } from "@/components/AayamLogo";
import { ColorSwitch } from "@/components/ColorSwitch";
import { MeetChoice } from "@/components/MeetLink";
import { readStoredCohort, saveRole, saveSetup, saveStudentBatch, themes, type MeetAction, type ThemeId } from "@/lib/prefs";
import { cohortToSlug } from "@/lib/slug";


type Step = "role" | "program" | "batch" | "cohort" | "theme";

export interface HomePageProps {
  onNavigateCohort: (slug: string) => void;
  choices?: CohortChoice[];
  onOpenFacultyLogin?: () => void;
  onNavigateUrl?: (url: string) => void;
  /** Starts that batch's sheet while the section list is still on screen. */
  onPrefetchBatch?: (course: string, batch: string) => void;
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
  colors: boolean;
  bold: boolean;
  meet: MeetAction;
  onColors: (on: boolean) => void;
  onBold: (on: boolean) => void;
  onMeet: (action: MeetAction) => void;
}

function programLabel(course: string) {
  return course.trim().toLowerCase() === "btech" ? "B.Tech" : course;
}

function batchLabel(batch: string) {
  return batch.replace("-", "–");
}

export function HomePage({
  onNavigateCohort,
  choices = DEFAULT_COHORT_CHOICES,
  onOpenFacultyLogin,
  onNavigateUrl,
  onPrefetchBatch,
  theme,
  onTheme,
  colors,
  bold,
  meet,
  onColors,
  onBold,
  onMeet,
}: HomePageProps) {
  const calm = useReducedMotion();
  const savedCohort = readStoredCohort();
  const [enter] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("enter") ?? ""));
  const [step, setStep] = useState<Step>(enter === "student" ? "program" : "role");
  const [program, setProgram] = useState("");
  const [batch, setBatch] = useState("");
  const [cohort, setCohort] = useState("");

  useEffect(() => {
    if (enter === "faculty") onOpenFacultyLogin?.();
    if (enter) window.history.replaceState(null, "", "/");
  }, [enter, onOpenFacultyLogin]);

  const programs = useMemo(() => cohortPrograms(choices), [choices]);
  const batches = useMemo(() => (program ? cohortYears(choices, program) : []), [choices, program]);
  const cohorts = useMemo(() => (program && batch ? cohortsInYear(choices, program, batch) : []), [choices, program, batch]);

  function openPage(event: MouseEvent, url: string) {
    event.preventDefault();
    if (onNavigateUrl) {
      onNavigateUrl(url);
      return;
    }
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function openAdmin(event: MouseEvent) {
    openPage(event, "/admin");
  }

  function chooseProgram(course: string) {
    setProgram(course);
    setBatch("");
    setStep("batch");
  }

  function chooseBatch(next: string) {
    setBatch(next);
    saveRole("student");
    saveStudentBatch(program, next);
    onPrefetchBatch?.(program, next);
    setStep("cohort");
  }

  function chooseCohort(division: string) {
    setCohort(division);
    saveRole("student");
    saveStudentBatch(program, batch);
    setStep("theme");
  }

  function finish() {
    saveRole("student");
    saveStudentBatch(program, batch);
    saveSetup({ role: "student", cohort, faculty: "", theme });
    onNavigateCohort(cohortToSlug(cohort));
  }

  function goBack() {
    if (step === "theme") {
      setStep("cohort");
      return;
    }
    if (step === "cohort") {
      setStep("batch");
      return;
    }
    if (step === "batch") {
      setStep("program");
      return;
    }
    setStep("role");
  }

  const heading =
    step === "role" ? "I am" : step === "program" ? "Which course?" : step === "batch" ? "Which batch?" : step === "cohort" ? "Which cohort?" : "Pick a theme";
  const note =
    step === "program"
      ? "B.Tech or MCA."
      : step === "batch"
        ? programLabel(program)
        : step === "cohort" || step === "theme"
          ? `${programLabel(program)} · ${batchLabel(batch)}${step === "theme" && cohort ? ` · ${cohortLabel(cohort)}` : ""}`
          : "";

  return (
    <div className="flex min-h-dvh flex-col">
    <main className={`relative mx-auto flex w-full flex-1 flex-col px-6 pt-24 pb-8 ${step === "theme" ? "max-w-4xl" : "max-w-md"}`}>
      <div className="fixed inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <AayamIcon size={26} />
        <div className="flex items-center gap-2">
          <a
            href="/admin"
            onClick={openAdmin}
            className="text-[11px] text-muted-foreground/70 hover:text-foreground"
          >
            Admin
          </a>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={step}
            initial={calm ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={calm ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: calm ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-4xl font-medium tracking-tight">{heading}</h1>
            {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}

            {step === "role" && (
              <div className="mt-8 grid gap-3">
                <Choice label="Student" onClick={() => setStep("program")} />
                <Choice label="Faculty" onClick={() => onOpenFacultyLogin?.()} />
                {savedCohort ? (
                  <button
                    type="button"
                    onClick={() => onNavigateCohort(cohortToSlug(savedCohort))}
                    className="mt-2 text-left text-sm text-muted-foreground hover:text-foreground"
                  >
                    Continue to {cohortLabel(savedCohort)}
                  </button>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <a href="https://exam.somyacodes.in/" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">
                    Exam schedule
                  </a>
                </div>
              </div>
            )}

            {step === "program" && (
              <ul className="mt-8 grid gap-3">
                {programs.map((course) => (
                  <li key={course}>
                    <Choice label={programLabel(course)} onClick={() => chooseProgram(course)} />
                  </li>
                ))}
              </ul>
            )}

            {step === "batch" && (
              <ul className="mt-8 grid gap-3">
                {batches.map((item) => (
                  <li key={item}>
                    <Choice label={batchLabel(item)} onClick={() => chooseBatch(item)} />
                  </li>
                ))}
              </ul>
            )}

            {step === "theme" && (
              <>
              <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {themes.map((item) => {
                  const selected = theme === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onTheme(item.id)}
                        className={`flex w-full flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-colors duration-200 ${
                          selected ? "border-transparent bg-foreground text-background" : "border-border hover:bg-muted"
                        }`}
                      >
                        <span className="flex gap-1" aria-hidden="true">
                          {item.swatch.map((color) => (
                            <span key={color} className="size-3 rounded-full border border-black/10" style={{ background: color }} />
                          ))}
                        </span>
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className={`text-xs ${selected ? "text-background/70" : "text-muted-foreground"}`}>{item.blurb}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6 grid gap-2">
                <ColorSwitch on={colors} onChange={onColors} />
                {colors ? <ColorSwitch on={bold} onChange={onBold} title="Bold colours" testId="bold-toggle" /> : null}
                <MeetChoice action={meet} onChange={onMeet} />
              </div>
              </>
            )}

            {step === "cohort" && (
              <ul className="mt-8 grid max-h-[50dvh] gap-3 overflow-y-auto">
                {cohorts.length > 0 ? (
                  cohorts.map((choice) => (
                    <li key={choice.division}>
                      <Choice label={cohortLabel(choice.division)} onClick={() => chooseCohort(choice.division)} />
                    </li>
                  ))
                ) : (
                  <li className="rounded-2xl border border-border px-5 py-4 text-sm text-muted-foreground">No sections for this year yet.</li>
                )}
              </ul>
            )}
          </m.div>
        </AnimatePresence>
      </div>

      {step !== "role" && (
        <div className="mt-8 flex items-center justify-between text-sm">
          <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back
          </button>
          {step === "theme" ? (
            <button type="button" onClick={finish} className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background">
              Continue
            </button>
          ) : (
            <span />
          )}
        </div>
      )}

    </main>
    <SiteFooter className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))]" />
    </div>
  );
}

function Choice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border px-5 py-4 text-left text-lg font-medium tracking-tight transition-colors duration-200 hover:bg-muted"
    >
      {label}
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

export default HomePage;
