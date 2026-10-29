import { useState } from "react";
import { AlertCircle, ArrowRight, Calendar, Home, Lock } from "lucide-react";
import CodeSlots from "@/components/CodeSlots";
import { verifyPin } from "@/lib/auth";
import {
  isBatchUnlocked,
  readStudentBatch,
  readStoredCohort,
  readStoredTheme,
  saveCohort,
  saveRole,
  saveSetup,
  saveStudentBatch,
  saveUnlockedBatch,
} from "@/lib/prefs";
import { cohortToSlug } from "@/lib/slug";
import { cohortLabel, type CohortChoice } from "@shared/cohort";

export interface AccessDeniedProps {
  cohort: CohortChoice;
  choices?: CohortChoice[];
  onUnlocked?: (cohort: CohortChoice) => void;
  onGoHome?: () => void;
  onGoToMyTimetable?: (slug: string) => void;
}

export function AccessDenied({
  cohort,
  choices = [],
  onUnlocked,
  onGoHome,
  onGoToMyTimetable,
}: AccessDeniedProps) {
  const [codeStatus, setCodeStatus] = useState<"idle" | "error" | "success">("idle");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  const studentBatch = readStudentBatch();
  const hasOtherBatch =
    studentBatch &&
    (studentBatch.course !== cohort.course || studentBatch.batch !== cohort.batch);
  const currentAccess = hasOtherBatch
    ? `${studentBatch.course} ${studentBatch.batch}`
    : null;

  // Determine user's accessible cohort if available
  const storedCohort = readStoredCohort();
  let myTimetable: { slug: string; label: string } | null = null;

  if (storedCohort) {
    const matchedChoice = choices.find(
      (c) => c.division.toLowerCase() === storedCohort.toLowerCase()
    );
    if (matchedChoice && isBatchUnlocked(matchedChoice.course, matchedChoice.batch)) {
      myTimetable = {
        slug: cohortToSlug(matchedChoice.division),
        label: cohortLabel(matchedChoice.division),
      };
    }
  }

  if (!myTimetable && studentBatch) {
    const match = choices.find(
      (c) => c.course === studentBatch.course && c.batch === studentBatch.batch
    );
    if (match) {
      myTimetable = {
        slug: cohortToSlug(match.division),
        label: cohortLabel(match.division),
      };
    }
  }

  const handlePinComplete = async (code: string) => {
    setCodeLoading(true);
    setCodeError(null);
    try {
      const res = await verifyPin(code);
      setCodeLoading(false);
      if (res.ok && res.course && res.batch) {
        if (res.course === cohort.course && res.batch === cohort.batch) {
          saveUnlockedBatch(res.course, res.batch);
          saveStudentBatch(res.course, res.batch);
          saveCohort(cohort.division);
          saveRole("student");
          saveSetup({
            role: "student",
            cohort: cohort.division,
            faculty: "",
            theme: readStoredTheme(),
          });
          setCodeStatus("success");
          setTimeout(() => {
            onUnlocked?.(cohort);
          }, 350);
        } else {
          saveUnlockedBatch(res.course, res.batch);
          setCodeStatus("error");
          setCodeError(
            `This PIN is for ${res.course} ${res.batch}, but this timetable is for ${cohort.course} ${cohort.batch}.`
          );
        }
      } else {
        setCodeStatus("error");
        setCodeError(res.error || `Invalid PIN for ${cohort.batch}. Please try again.`);
      }
    } catch {
      setCodeLoading(false);
      setCodeStatus("error");
      setCodeError("Failed to verify PIN. Check your connection.");
    }
  };

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const handleGoMyTimetable = (slug: string) => {
    if (onGoToMyTimetable) {
      onGoToMyTimetable(slug);
    } else if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/${slug}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh flex-col items-center justify-center px-4 py-8 max-w-lg">
      <div className="rise w-full flex flex-col items-center text-center">
        <div className="rounded-2xl border border-border/80 bg-card/70 p-6 sm:p-8 backdrop-blur-sm shadow-sm flex flex-col items-center w-full">
          <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Lock className="size-7" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
            Access Restricted
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Don't have access to this batch
          </p>

          <div className="mt-5 w-full rounded-xl border border-border/70 bg-muted/20 p-4 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
                Target Timetable
              </span>
              <span className="font-semibold text-foreground">
                {cohort.course} · {cohort.batch}
              </span>
            </div>
            <div className="mt-1.5 text-base font-medium text-foreground">
              {cohort.division}
            </div>
            {currentAccess && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Your current access:</span>
                <span className="font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                  {currentAccess}
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center w-full">
            <div className="mb-4 text-center">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
                Batch PIN Required
              </span>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Enter the 6-digit access PIN for{" "}
                <span className="font-medium text-foreground">{cohort.batch}</span> to unlock
                this timetable.
              </p>
            </div>

            <CodeSlots
              length={6}
              status={codeStatus}
              onChange={() => {
                setCodeStatus("idle");
                setCodeError(null);
              }}
              onComplete={handlePinComplete}
              autoFocus
              slotSize={44}
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

            <p className="mt-5 text-[11px] text-muted-foreground/80 leading-relaxed text-center">
              Need your batch PIN? Contact your class representative or email{" "}
              <a
                href="mailto:2025.karamveers@isu.ac.in"
                className="text-foreground underline underline-offset-2"
              >
                2025.karamveers@isu.ac.in
              </a>
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-border/60 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
            <button
              type="button"
              onClick={handleGoHome}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-background hover:bg-muted/60 px-4 py-2.5 text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              <Home className="size-4" />
              <span>Go to Home</span>
            </button>

            {myTimetable && (
              <button
                type="button"
                onClick={() => handleGoMyTimetable(myTimetable!.slug)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background hover:opacity-90 px-4 py-2.5 text-xs font-medium transition-opacity cursor-pointer"
              >
                <Calendar className="size-4" />
                <span>Go to my timetable ({myTimetable.label})</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
