import { useMemo, useState, type MouseEvent } from "react";
import { cohortLabel, cohortsInYear, type CohortChoice, DEFAULT_COHORT_CHOICES } from "@shared/cohort";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AayamIcon } from "@/components/AayamLogo";
import CodeSlots from "@/components/CodeSlots";
import { ColorSwitch } from "@/components/ColorSwitch";
import { MeetChoice } from "@/components/MeetLink";
import { verifyPin } from "@/lib/auth";
import { clearStudentAuth, readStudentBatch, saveRole, saveSetup, saveStudentBatch, themes, type MeetAction, type ThemeId } from "@/lib/prefs";
import { cohortToSlug } from "@/lib/slug";

type Step = "role" | "pin" | "cohort" | "theme";

const sourceUrl = "https://github.com/Kv-404/Aayam";

const sees = [
  { title: "Today", note: "The day's classes in order, with the room and who is teaching." },
  { title: "This week", note: "Those same classes as a grid, so you can see the whole week at once." },
  { title: "What changed", note: "A cancelled class or a new room stays on the timetable. You are not looking at an old copy of the sheet." },
];

const opens = [
  {
    title: "Students",
    note: "Enter the 6-digit PIN for your batch, then choose your section. The timetable shows only that section.",
    action: "Open as student" as const,
  },
  {
    title: "Faculty",
    note: "Sign in with your @itm.edu or @isu.ac.in Google account. You see the classes you teach.",
    action: "Faculty sign in" as const,
  },
];

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
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <AayamIcon size={22} />
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button type="button" onClick={openStudent} className="rounded-md px-2.5 py-1.5 text-sm hover:bg-muted">
                Student
              </button>
              <button type="button" onClick={() => onOpenFacultyLogin?.()} className="rounded-md bg-foreground px-2.5 py-1.5 text-sm text-background">
                Faculty
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 sm:px-8 sm:py-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="rise">
              <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">ITM / ISU</p>
              <h1 className="mt-3 max-w-xl text-4xl font-medium tracking-tight sm:text-5xl">The live college timetable.</h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                This site reads the official timetable sheet and shows it for one section, or for one teacher. You get today, the week, and the changes: a cancelled class or a moved room shows up here.
              </p>
              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={openStudent} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background sm:w-auto">
                  Open as student
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => onOpenFacultyLogin?.()} className="w-full rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted sm:w-auto">
                  Faculty sign in
                </button>
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:w-auto">
                  View the code
                </a>
              </div>
            </div>
            <SheetPreview />
          </div>

          <section className="mt-16">
            <h2 className="text-lg font-medium tracking-tight">What you see</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The sheet stays the source. This page is the view of it: the day as a list, the week as a grid, and the edits that happened since the last version.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {sees.map((item) => (
                <li key={item.title} className="rounded-xl border border-border px-4 py-5">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.note}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-medium tracking-tight">How you open it</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {opens.map((item) => (
                <li key={item.title} className="flex flex-col rounded-xl border border-border px-4 py-5">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.note}</p>
                  <button
                    type="button"
                    onClick={item.action === "Open as student" ? openStudent : () => onOpenFacultyLogin?.()}
                    className="mt-4 self-start text-sm underline underline-offset-4 hover:text-foreground"
                  >
                    {item.action}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-muted-foreground sm:px-8">
            <p>College timetable for students and faculty.</p>
            <div className="flex items-center gap-3">
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">
                GitHub
              </a>
              <a href="/privacy" onClick={(event) => openPage(event, "/privacy")} className="underline-offset-4 hover:text-foreground hover:underline">
                Privacy
              </a>
              <a href="/terms" onClick={(event) => openPage(event, "/terms")} className="underline-offset-4 hover:text-foreground hover:underline">
                Terms
              </a>
            </div>
          </div>
        </footer>
      </div>
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
                slotSize={46}
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

const previewDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const previewRows: Array<{ time: string; cells: string[] }> = [
  { time: "09:00", cells: ["Maths", "Physics", "", "Maths", "Lab"] },
  { time: "10:00", cells: ["", "Lab", "Maths", "", "Physics"] },
  { time: "11:15", cells: ["English", "", "~Physics", "Lab", ""] },
  { time: "12:15", cells: ["Lab", "English", "", "", "Maths"] },
];

function SheetPreview() {
  return (
    <div className="rise overflow-hidden rounded-xl border border-border bg-card" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>This week</span>
        <span className="rounded-md bg-foreground px-2 py-0.5 text-[10px] text-background">Week</span>
      </div>
      <div className="grid grid-cols-[2.75rem_repeat(5,minmax(0,1fr))]">
        <div className="border-b border-border" />
        {previewDays.map((day) => (
          <div key={day} className="border-b border-l border-border px-1.5 py-2 text-[11px] text-muted-foreground">
            {day}
          </div>
        ))}
        {previewRows.map((row) => (
          <div key={row.time} className="contents">
            <div className="border-b border-border px-1 py-2.5 font-mono text-[9px] text-muted-foreground sm:text-[10px]">{row.time}</div>
            {row.cells.map((cell, index) => {
              const cancelled = cell.startsWith("~");
              const label = cancelled ? cell.slice(1) : cell;
              return (
                <div key={`${row.time}-${index}`} className="min-w-0 border-b border-l border-border p-1">
                  {label ? (
                    <div className={`truncate rounded-md px-1 py-1 text-[10px] font-medium sm:text-[11px] ${cancelled ? "text-muted-foreground line-through" : "bg-muted"}`}>
                      {label}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default HomePage;
