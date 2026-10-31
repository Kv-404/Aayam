import type { BootstrapResponse, PublicLecture, SheetLink } from "@shared/types";
import { cohortChoices, cohortLabel, cohortPrograms, cohortYears, cohortsInYear, lectureInCohort, type CohortChoice } from "@shared/cohort";
import { findCoordinator } from "@shared/coordinators";
import { changeMatchesFaculty, listFacultyNames } from "@shared/faculty";
import { CalendarPlus, Check, ChevronDown, ChevronLeft, Download, FileSpreadsheet, LogOut, RefreshCw, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FacultyLoginModal } from "@/components/FacultyLoginModal";
import { FacultyScopeMenu } from "@/components/FacultyScopeMenu";
import CodeSlots from "@/components/CodeSlots";
import { fetchCurrentAuth, logoutFaculty, verifyBatchCode } from "@/lib/auth";
import { LectureRoom, MeetChoice } from "@/components/MeetLink";
import { NotifyControl } from "@/components/NotifyControl";
import RubberSegment from "@/components/RubberSegment";
import { RecentChanges } from "@/components/RecentChanges";
import { SearchPanel } from "@/components/SearchPanel";
import { Setup } from "@/components/Setup";
import { TodayView } from "@/components/TodayView";
import { WeeklyView } from "@/components/WeeklyView";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useChangeNotifications } from "@/hooks/useNotifications";
import { useLectureReminders } from "@/hooks/useLectureReminders";
import { appleWeekCalendarUrl, calendarFeedUrl, googleWeekCalendarUrl, outlookWeekCalendarUrl } from "@/lib/calendar";
import { lensFromScopeId, resolveFacultyView, signInFacultyLens } from "@/lib/facultyView";
import { clearFacultyBrowse, clearStudentAuth, hasChosenRole, isBatchUnlocked, readCanSeeAllFaculty, readFacultyEmail, readFacultyLens, readFacultyPreview, readRole, readSetup, readStoredCohort, readStoredFaculty, readStudentBatch, saveCanSeeAllFaculty, saveCohort, saveFaculty, saveFacultyEmail, saveFacultyLens, saveFacultyPreview, saveSetup, saveUnlockedBatch, themes, type FacultyLens, type MeetAction, type ThemeId, type ViewerRole } from "@/lib/prefs";
import { ColorEditor } from "@/components/ColorEditor";
import { ColorSwitch } from "@/components/ColorSwitch";
import { formatClockTime, formatCompactRange, zonedNow } from "@/lib/time";
import { applyFilters, collapseFullOffDays, defaultFilters, slotPhase, unique, type Filters } from "@/lib/view";
import { AayamLogo } from "@/components/AayamLogo";

const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function sheetUrlFor(
  sheets: SheetLink[],
  active: { course?: string; batch?: string } | undefined,
  fallback: string,
) {
  const course = active?.course?.trim().toLowerCase() ?? "";
  const batch = active?.batch?.trim().toLowerCase() ?? "";
  if (!batch) return fallback;
  const match = sheets.find((sheet) =>
    sheet.batch.trim().toLowerCase() === batch &&
    (!course || sheet.course.trim().toLowerCase() === course),
  );
  return match?.spreadsheetUrl ?? fallback;
}

export function Dashboard({
  data,
  now,
  pending,
  onRefresh,
  theme,
  colors,
  bold,
  meet,
  onTheme,
  onColors,
  onBold,
  onMeet,
  onReset,
  onScopeChange,
}: {
  data: BootstrapResponse;
  now: Date;
  pending: boolean;
  onRefresh: () => void;
  theme: ThemeId;
  colors: boolean;
  bold: boolean;
  meet: MeetAction;
  onTheme: (theme: ThemeId) => void;
  onColors: (on: boolean) => void;
  onBold: (on: boolean) => void;
  onMeet: (action: MeetAction) => void;
  onReset?: () => void;
  onScopeChange?: (scope: { division?: string; faculty?: string; all?: boolean }) => void;
}) {
  const [ready, setReady] = useState(() => readSetup() && hasChosenRole());
  const [role, setRole] = useState<ViewerRole>(readRole);
  const [cohort, setCohort] = useState(readStoredCohort);
  const [faculty, setFaculty] = useState(readStoredFaculty);
  const [canSeeAll, setCanSeeAll] = useState(() => readCanSeeAllFaculty());
  const [authEmail, setAuthEmail] = useState<string | undefined>(() => readFacultyEmail() || undefined);
  const [lens, setLens] = useState<FacultyLens | null>(() => readFacultyLens());
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [setupSeed, setSetupSeed] = useState(0);
  const [seedRole, setSeedRole] = useState<ViewerRole | "">("");
  const [filters, setFilters] = useState<Filters>(() => {
    const stored = readRole() === "faculty" ? "" : readStoredCohort();
    const initial = cohortChoices(data.lectures).find((choice) => choice.division === stored);
    const base = defaultFilters(data.lectures, data.today);
    return {
      ...base,
      division: stored,
      course: initial?.course || base.course,
      batch: initial?.batch || base.batch,
      semester: initial?.semester || base.semester,
      faculty: "",
    };
  });
  const [view, setView] = useState("week");
  const [weekId, setWeekId] = useState("live");
  const zone = zonedNow(now, data.timezone);
  const choices = data.choices && data.choices.length > 0 ? data.choices : cohortChoices(data.lectures);
  const facultyNames = data.faculties && data.faculties.length > 0 ? data.faculties : listFacultyNames(data.lectures.filter((lecture) => lecture.kind !== "break").map((lecture) => lecture.faculty));
  const choice = choices.find(
    (item) =>
      item.division === cohort ||
      item.division.toLowerCase() === cohort.toLowerCase() ||
      (cohort.toLowerCase() === "andrew" && item.division.toLowerCase().startsWith("andrew")),
  );
  const selected = choice ? choice.division : cohort;

  const savedWeeks = data.savedWeeks ?? [];
  const selectedWeek = savedWeeks.find((week) => week.id === weekId);
  const lectureFeed = selectedWeek?.lectures ?? data.lectures;
  const board = resolveFacultyView({
    lectures: lectureFeed,
    choices,
    facultyNames,
    signedInName: faculty,
    email: authEmail,
    canSeeAll,
    lens,
  });
  const selectedFaculty = board.signedInName;

  useEffect(() => {
    if (import.meta.env.DEV && readFacultyPreview()) {
      setAuthEmail(readFacultyEmail() || undefined);
      setCanSeeAll(readCanSeeAllFaculty());
      setLens(readFacultyLens());
      return;
    }
    let cancelled = false;
    fetchCurrentAuth().then((auth) => {
      if (cancelled || auth.offline) return;
      if (auth.authenticated && auth.faculty) {
        setAuthEmail(auth.email);
        saveFacultyEmail(auth.email ?? "");
        const hasAll = Boolean(auth.canSeeAllFaculty);
        setCanSeeAll(hasAll);
        saveCanSeeAllFaculty(hasAll);
        saveFacultyPreview(false);
        if (!readFacultyLens()) {
          const next = signInFacultyLens(auth.email ?? "", auth.faculty, hasAll);
          saveFacultyLens(next);
          setLens(next);
        }
        if (role === "faculty") {
          const stored = readStoredFaculty();
          if (stored) {
            setFaculty(stored);
          } else {
            setFaculty(auth.faculty);
            saveFaculty(auth.faculty);
          }
        }
      } else {
        setAuthEmail(undefined);
        setCanSeeAll(false);
        setLens(null);
        clearFacultyBrowse();
        if (readRole() === "faculty") onReset?.();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (role !== "faculty" || !board.wide || !selectedFaculty) return;
    onScopeChange?.({ all: true, faculty: selectedFaculty });
  }, [role, board.wide, selectedFaculty]);

  useEffect(() => {
    const nextRole = readRole();
    setRole(nextRole);
    if (nextRole === "faculty") {
      setFaculty(readStoredFaculty());
    } else {
      setCohort(readStoredCohort());
    }
  }, [data]);
  const studentBatch = readStudentBatch();
  const availableChoices = useMemo(() => {
    if (role === "student" && studentBatch) {
      const match = choices.filter(
        (c) => c.course === studentBatch.course && c.batch === studentBatch.batch
      );
      if (match.length > 0) return match;
    }
    if (role === "student" && selected) {
      const current = choices.find((c) => c.division === selected);
      if (current) {
        return choices.filter((c) => c.course === current.course && c.batch === current.batch);
      }
    }
    return choices;
  }, [choices, role, studentBatch, selected]);
  const facultyPool = board.lectures;
  const facultyChoice = choices.find((item) => item.division === filters.division) ?? board.sheet;
  const facultyVisible = filters.division
    ? facultyPool.filter((lecture) => {
        const picked = choices.find((item) => item.division === filters.division);
        return picked ? lectureInCohort(lecture, picked) : lecture.division === filters.division;
      })
    : facultyPool;
  const studentPool = choice ? lectureFeed.filter((lecture) => lectureInCohort(lecture, choice)) : [];
  const watchedDivisions = new Set(choice ? [choice.division, ...choice.also] : selected ? [selected] : []);
  const facultyIds = new Set(facultyPool.map((lecture) => lecture.id));
  const facultyFilter = board.facultyFilter;
  const facultyDivisions = board.watchedDivisions;
  const cohortChanges = role === "faculty"
    ? (facultyFilter
        ? data.changes.filter((change) => changeMatchesFaculty(change, facultyFilter, facultyIds))
        : facultyDivisions
          ? data.changes.filter((change) => !change.division || facultyDivisions.has(change.division))
          : data.changes)
    : data.changes.filter((change) => watchedDivisions.size === 0 || !change.division || watchedDivisions.has(change.division));
  const notifications = useChangeNotifications(cohortChanges);

  const courses = [...new Set(choices.map((item) => item.course))];
  const batches = [...new Set(choices.filter((item) => item.course === filters.course).map((item) => item.batch))];
  const semesters = [...new Set(choices.filter((item) => item.course === filters.course && item.batch === filters.batch).map((item) => item.semester))];
  const scope = role === "faculty" ? facultyVisible : studentPool.filter((lecture) => lecture.kind !== "break");
  const days = dayOrder.filter((day) => scope.some((lecture) => lecture.weekday === day));
  const requestedDay = filters.day || zone.weekday;
  const activeDay = days.includes(requestedDay) ? requestedDay : days[0] ?? "";
  const subjects = unique(scope.map((lecture) => lecture.subject));
  const faculties = unique(scope.map((lecture) => lecture.faculty));
  const rooms = unique(scope.map((lecture) => lecture.room));
  const pool = role === "faculty" ? facultyVisible : studentPool;
  const effective = { ...filters, course: "", batch: "", semester: "", division: "", faculty: role === "faculty" ? "" : filters.faculty };
  const dayLectures = collapseFullOffDays(applyFilters(pool, effective));
  const weekLectures = collapseFullOffDays(applyFilters(pool, effective, { ignoreDay: true }));
  const todayPack = useMemo(() => resolveToday(dayLectures, zone.iso, filters.day), [dayLectures, zone.iso, filters.day]);
  const upcoming = nextClass(scope, zone.iso, zone.minutes);
  const changes = cohortChanges;
  const failing = Boolean(data.sync.lastError);
  const activeSheet = role === "student" ? choice : facultyChoice;
  const sheetUrl = sheetUrlFor(data.sheets, activeSheet, data.spreadsheetUrl);

  function navigateDay(direction: -1 | 1) {
    if (days.length <= 1) return;
    const activeDay = filters.day || zone.weekday;
    const idx = days.indexOf(activeDay);
    const validIdx = idx === -1 ? 0 : idx;
    const nextIdx = (validIdx + direction + days.length) % days.length;
    const nextDay = days[nextIdx];
    if (nextDay) {
      patch({ day: nextDay });
      if (view !== "today") setView("today");
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "w" || e.key === "W") {
        setView("week");
      } else if (e.key === "d" || e.key === "D" || e.key === "t" || e.key === "T") {
        patch({ day: "" });
        setView("today");
      } else if (e.key === "u" || e.key === "U") {
        setView("updates");
      } else if (e.key === "ArrowLeft" && view === "today") {
        navigateDay(-1);
      } else if (e.key === "ArrowRight" && view === "today") {
        navigateDay(1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, filters.day, zone.weekday, days]);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    const deltaY = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < 0) {
        navigateDay(1);
      } else {
        navigateDay(-1);
      }
    }
  }

  function choose(division: string) {
    const next = choices.find((item) => item.division === division || item.division.toLowerCase() === division.toLowerCase());
    const targetDivision = next?.division ?? division;
    saveCohort(targetDivision);
    setCohort(targetDivision);
    setRole("student");
    onScopeChange?.({ division: targetDivision });
    setFilters((current) => ({
      ...current,
      division: targetDivision,
      course: next?.course ?? current.course,
      batch: next?.batch ?? current.batch,
      semester: next?.semester ?? current.semester,
      day: "",
      subject: "",
      faculty: "",
      room: "",
      query: "",
      status: "all",
    }));
  }

  function handleFacultyLoginSuccess(facultyName: string, email: string, canSeeAllFaculty?: boolean) {
    const isAllAccess = Boolean(canSeeAllFaculty);
    const nextLens = signInFacultyLens(email, facultyName, isAllAccess);
    setAuthEmail(email);
    setCanSeeAll(isAllAccess);
    setLens(nextLens);
    saveFacultyEmail(email);
    saveCanSeeAllFaculty(isAllAccess);
    saveFacultyPreview(false);
    saveFacultyLens(nextLens);
    setRole("faculty");

    setFaculty(facultyName);
    saveFaculty(facultyName);
    saveSetup({ role: "faculty", cohort: selected, faculty: facultyName, theme });
    const person = findCoordinator(email, facultyName);
    onScopeChange?.(isAllAccess || person ? { all: true, faculty: facultyName } : { faculty: facultyName });
    setFilters((current) => ({ ...current, division: "", day: "", subject: "", faculty: "", room: "", query: "", status: "all" }));
    setLoginModalOpen(false);
  }

  async function handleFacultyLogout() {
    await logoutFaculty();
    setAuthEmail(undefined);
    setCanSeeAll(false);
    setLens(null);
    clearFacultyBrowse();
    const targetDivision = readStoredCohort();
    if (targetDivision) {
      choose(targetDivision);
    } else {
      setRole("student");
      openSetup("student");
    }
  }

  function handleStudentLogout() {
    clearStudentAuth();
    setCohort("");
    setRole("student");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/");
    }
    onScopeChange?.({});
    onReset?.();
    openSetup("");
  }

  function chooseLens(id: string) {
    const next = lensFromScopeId(id);
    saveFacultyLens(next);
    setLens(next);
    setRole("faculty");
    setFilters((current) => ({ ...current, division: "", day: "", subject: "", faculty: "", room: "", query: "", status: "all" }));
  }

  function handleSwitchToFaculty() {
    if (authEmail && faculty) {
      setRole("faculty");
      saveFaculty(faculty);
      onScopeChange?.({ faculty });
      setFilters((current) => ({ ...current, division: "", day: "", subject: "", faculty: "", room: "", query: "", status: "all" }));
    } else {
      setLoginModalOpen(true);
    }
  }

  function openSetup(next: ViewerRole | "") {
    setSeedRole(next);
    setSetupSeed((current) => current + 1);
    setReady(false);
  }

  function applyIdentity(choice: { role: ViewerRole; cohort: string; faculty: string }) {
    saveSetup({ ...choice, theme });
    setRole(choice.role);
    if (choice.cohort) setCohort(choice.cohort);
    if (choice.faculty) setFaculty(choice.faculty);
    if (choice.role === "faculty") {
      const email = readFacultyEmail();
      const allowed = readCanSeeAllFaculty();
      const nextLens = readFacultyLens() ?? signInFacultyLens(email, choice.faculty, allowed);
      setAuthEmail(email || undefined);
      setCanSeeAll(allowed);
      setLens(nextLens);
      const person = findCoordinator(email, choice.faculty);
      onScopeChange?.(allowed || person ? { all: true, faculty: choice.faculty } : { faculty: choice.faculty });
    } else onScopeChange?.({ division: choice.cohort });
    const next = choices.find((item) => item.division === choice.cohort);
    setFilters((current) => ({
      ...current,
      division: choice.role === "student" ? choice.cohort : "",
      course: next?.course ?? current.course,
      batch: next?.batch ?? current.batch,
      semester: next?.semester ?? current.semester,
      faculty: "",
      day: "",
      subject: "",
      room: "",
      query: "",
      status: "all",
    }));
    setReady(true);
    setView("week");
  }

  function patch(partial: Partial<Filters>) {
    if (role === "student" && partial.course && partial.course !== filters.course) {
      const next = choices.find((item) => item.course === partial.course);
      if (next) {
        saveCohort(next.division);
        setCohort(next.division);
        setRole("student");
        onScopeChange?.({ division: next.division });
        setFilters((current) => ({ ...current, ...partial, course: next.course, batch: next.batch, semester: next.semester, division: next.division, subject: "", faculty: "", room: "" }));
        return;
      }
    }
    if (role === "student" && partial.batch && partial.batch !== filters.batch) {
      const next = choices.find((item) => item.course === filters.course && item.batch === partial.batch);
      if (next) {
        saveCohort(next.division);
        setCohort(next.division);
        setRole("student");
        onScopeChange?.({ division: next.division });
        setFilters((current) => ({ ...current, batch: next.batch, semester: next.semester, division: next.division, subject: "", faculty: "", room: "" }));
        return;
      }
    }
    setFilters((current) => {
      const next = {
        ...current,
        ...partial,
        division: role === "faculty" ? ("division" in partial ? partial.division || "" : current.division) : selected,
      };
      if (partial.course || partial.batch || partial.semester !== undefined) {
        next.subject = "";
        next.faculty = "";
        next.room = "";
      }
      return next;
    });
  }

  const missingIdentity = role === "faculty" ? (!selectedFaculty && !board.wide) : !selected;
  const reminders = useLectureReminders({
    lectures: scope,
    today: zone.iso,
    minutes: zone.minutes,
    enabled: ready && !missingIdentity && notifications.optedIn,
    showCohort: role === "faculty" && board.showDivision,
  });
  if (!ready || missingIdentity) {
    return (
      <Setup
        key={setupSeed}
        choices={choices}
        faculties={facultyNames}
        cohort={selected}
        faculty={selectedFaculty || faculty}
        initialRole={!ready ? seedRole : role}
        theme={theme}
        colors={colors}
        bold={bold}
        meet={meet}
        onTheme={onTheme}
        onColors={onColors}
        onBold={onBold}
        onMeet={onMeet}
        onPickCohort={(c) => onScopeChange?.({ division: c })}
        onPickFaculty={(f) => {
          const email = readFacultyEmail();
          const allowed = readCanSeeAllFaculty();
          const person = findCoordinator(email, f);
          onScopeChange?.(allowed || person ? { all: true, faculty: f } : { faculty: f });
        }}
        onDone={applyIdentity}
      />
    );
  }

  const weekLabel = data.weekStart && data.weekEnd ? `${formatShort(data.weekStart)} – ${formatShort(data.weekEnd)}` : "This week";
  const severalBatches = new Set(savedWeeks.map((week) => week.batch).filter(Boolean)).size > 1;
  const segmentProps = {
    trackColor: "var(--muted)",
    thumbColor: "var(--foreground)",
    textColor: "var(--foreground)",
    activeTextColor: "var(--background)",
    size: "sm" as const,
    radius: 8,
  };
  const viewControl = (className: string) => (
    <RubberSegment
      items={[
        { value: "today", label: "Day" },
        { value: "week", label: "Week" },
        { value: "updates", label: "Updates" },
      ]}
      value={view}
      onChange={(next) => {
        if (next === "today" && view !== "today") {
          patch({ day: "" });
        }
        setView(next);
      }}
      aria-label="Timetable views"
      className={className}
      {...segmentProps}
    />
  );
  const dayControl = (className: string) => days.length > 0 && activeDay ? (
    <RubberSegment
      items={days.map((day) => {
        const isToday = day === zone.weekday;
        return {
          value: day,
          label: (
            <span className="relative inline-flex items-center justify-center gap-1">
              <span className={isToday ? "font-bold tracking-tight" : undefined}>{day.slice(0, 3)}</span>
              {isToday && (
                <span
                  className="size-1.5 rounded-full bg-current opacity-90"
                  aria-label="Today"
                  title="Today"
                />
              )}
            </span>
          ),
        };
      })}
      value={activeDay}
      onChange={(day) => {
        patch({ day });
        setView("today");
      }}
      aria-label="Days"
      equalSlots
      className={className}
      {...segmentProps}
    />
  ) : null;
  const weekControl = savedWeeks.length > 0 ? (
    <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span className="sr-only">Week</span>
      <select
        aria-label="Choose a week"
        value={selectedWeek ? selectedWeek.id : "live"}
        onChange={(event) => setWeekId(event.target.value)}
        className="min-w-0 max-w-full rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground"
      >
        <option value="live">{weekLabel}</option>
        {savedWeeks.map((week) => (
          <option key={week.id} value={week.id}>
            {formatShort(week.start)} – {formatShort(week.end)}
            {severalBatches && week.batch ? ` · ${week.batch}` : ""}
          </option>
        ))}
      </select>
    </label>
  ) : null;
  const notice = reminders.notice ?? notifications.notice;
  const dismissNotice = () => {
    if (reminders.notice) reminders.dismiss();
    else notifications.dismiss();
  };
  const searchPlaceholder = role === "faculty" ? "Subject, cohort, or room" : "Subject, faculty, or room";

  return (
    <Tabs value={view} onValueChange={setView} className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex flex-col gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3.5">
          {/* Row 1: Brand (left), Desktop Status (center), Toolbar (right) - NEVER wraps on mobile */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0">
            {/* Left: Brand + Identity (Cohort / Faculty) */}
            <div className="min-w-0 flex items-center gap-1.5 sm:gap-2 shrink">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  onReset?.();
                }}
                title="Aayam Home"
                aria-label="Aayam Home"
                className="inline-flex shrink-0 items-center justify-center rounded-lg p-0.5 text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
              >
                <AayamLogo size={16} className="sm:scale-110 sm:origin-left transition-transform" />
              </a>
              {role === "faculty" ? (
                board.wide ? (
                  <FacultyScopeMenu
                    label={board.label}
                    email={authEmail}
                    badge={board.badge || "Coordinator"}
                    sections={board.sections}
                    activeId={board.activeId}
                    onPick={chooseLens}
                    onLogout={handleFacultyLogout}
                    onSwitchToStudent={() => {
                      const fallback = readStoredCohort();
                      if (fallback) {
                        choose(fallback);
                      } else {
                        setRole("student");
                        openSetup("student");
                      }
                    }}
                  />
                ) : (
                  <AuthenticatedFacultyBadge faculty={selectedFaculty || faculty} email={authEmail} onLogout={handleFacultyLogout} />
                )
              ) : (
                <StudentCohortMenu choices={availableChoices} value={selected} onChange={choose} onSwitch={handleSwitchToFaculty} />
              )}
            </div>

            {/* Center on Desktop: HeaderStatus */}
            <div className="hidden sm:flex flex-1 items-center justify-center min-w-0 px-2 max-w-lg mx-auto">
              <HeaderStatus
                lecture={upcoming}
                today={zone.iso}
                minutes={zone.minutes}
                showCohort={role === "faculty" && board.showDivision}
                meet={meet}
                clockLabel={formatClockTime(now, data.timezone)}
              />
            </div>

            {/* Right: Actions Toolbar */}
            <div className="relative z-30 flex shrink-0 items-center gap-0.5 sm:gap-1">
              <SearchPanel
                query={filters.query}
                placeholder={searchPlaceholder}
                filters={effective}
                courses={role === "student" ? [] : courses}
                batches={role === "student" ? [] : batches}
                semesters={role === "student" ? [] : semesters}
                days={days}
                subjects={subjects}
                faculties={faculties}
                rooms={rooms}
                cohorts={role === "faculty" ? unique(facultyPool.map((lecture) => lecture.division)) : undefined}
                cohortFormat={(division: string) => {
                  const item = choices.find((entry) => entry.division === division);
                  const name = cohortLabel(division);
                  return item ? `${name} · ${item.course} ${item.batch}` : name;
                }}
                onQuery={(query: string) => patch({ query })}
                onChange={patch}
                onClear={() => patch({ division: "", day: "", subject: "", faculty: "", room: "", status: "all", query: "" })}
              />
              {role !== "faculty" || board.calendar ? (
                <CalendarMenu
                  scope={role === "faculty" ? board.calendar ?? { faculty: selectedFaculty } : { division: selected }}
                  label={role === "faculty" ? board.label : cohortLabel(selected)}
                />
              ) : null}
              <a
                href={sheetUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the sheet"
                className="inline-flex size-7.5 sm:size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <FileSpreadsheet className="size-4" aria-hidden="true" />
              </a>
              <IconButton label={pending ? "Refreshing" : "Refresh"} onClick={onRefresh} disabled={pending} testId="refresh-button">
                <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
              </IconButton>
              <AppearanceMenu theme={theme} colors={colors} bold={bold} meet={meet} subjects={subjects} notifications={notifications.optedIn} onTheme={onTheme} onColors={onColors} onBold={onBold} onMeet={onMeet} onDisable={notifications.disable} role={role} onStudentLogout={handleStudentLogout} />
            </div>
          </div>

          {/* Row 2 on Mobile: HeaderStatus Pill */}
          <div className="sm:hidden w-full">
            <HeaderStatus
              lecture={upcoming}
              today={zone.iso}
              minutes={zone.minutes}
              showCohort={role === "faculty" && board.showDivision}
              meet={meet}
              clockLabel={formatClockTime(now, data.timezone)}
            />
          </div>

          {/* Row 3, desktop: day switch, week history, then Day / Week / Updates. Phones use the bottom bar. */}
          <div className="hidden sm:flex sm:items-center sm:justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {view === "today" && dayControl("max-w-xl")}
              {weekControl}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {viewControl("shrink-0")}
              <NotifyControl optedIn={notifications.optedIn} pulse={reminders.pulse} onEnable={() => void notifications.enable()} />
            </div>
          </div>
          <div className="flex justify-end sm:hidden">
            <NotifyControl optedIn={notifications.optedIn} pulse={reminders.pulse} onEnable={() => void notifications.enable()} />
          </div>
        </div>
      </header>

      <main id="timetable" className={`flex-1 flex flex-col px-4 py-4 ${view === "today" ? "pb-44" : "pb-28"} sm:px-6 sm:py-5 sm:pb-5`}>
        <h1 className="sr-only">{role === "faculty" ? board.label : cohortLabel(selected)} timetable</h1>
        <p data-testid="sync-status" role={failing ? "alert" : "status"} className={`text-sm ${failing ? "mb-3 text-warning" : "sr-only"}`}>
          {failing ? data.sync.lastError || "Could not refresh. The last timetable is still shown." : syncedLabel(data.sync.lastSuccessAt, now)}
        </p>

        <div className="flex-1">
          <TabsContent value="today" className="rise mt-0">
            <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="min-h-[40vh]">
              <TodayView
                key={filters.day || todayPack.lectures[0]?.date || zone.weekday}
                lectures={todayPack.lectures}
                today={zone.iso}
                minutes={zone.minutes}
                showDivision={role === "faculty" && board.showDivision}
                note={todayPack.note}
                meet={meet}
                onPrevDay={() => navigateDay(-1)}
                onNextDay={() => navigateDay(1)}
              />
            </div>
          </TabsContent>
          <TabsContent value="week" className="rise mt-0">
            <WeeklyView lectures={weekLectures} showDivision={role === "faculty" && board.showDivision} today={zone.iso} minutes={zone.minutes} meet={meet} />
          </TabsContent>
          <TabsContent value="updates" className="rise mt-0">
            {selectedWeek ? (
              <p className="py-8 text-sm text-muted-foreground">Updates are for the current sheet, not this older week.</p>
            ) : (
              <RecentChanges changes={changes} timeZone={data.timezone} />
            )}
          </TabsContent>
        </div>
        <footer className="mt-auto pt-10 pb-6 border-t border-border/40 text-center text-xs text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span>ITM / ISU Timetable</span>
          <span>•</span>
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
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md sm:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-col gap-2 px-3 py-2">
          {weekControl}
          {view === "today" && dayControl("w-full")}
          {viewControl("w-full")}
        </div>
      </div>
      {notice && (
        <div
          role="status"
          data-testid="notify-notice"
          className={`fixed inset-x-3 ${view === "today" ? "bottom-44" : "bottom-28"} z-50 flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm`}
        >
          <p className="min-w-0 flex-1 leading-snug">{notice}</p>
          <button type="button" className="shrink-0 text-xs text-muted-foreground hover:text-foreground" onClick={dismissNotice}>
            Close
          </button>
        </div>
      )}
      <FacultyLoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={handleFacultyLoginSuccess}
      />
    </Tabs>
  );
}

function AuthenticatedFacultyBadge({
  faculty,
  email,
  onLogout,
}: {
  faculty: string;
  email?: string;
  onLogout: () => void;
}) {
  const domainLabel = email?.includes("@isu.ac.in") ? "@isu.ac.in" : "@itm.edu";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/90 px-2.5 py-1 shadow-xs">
      <div className="flex flex-col text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm text-foreground truncate max-w-[130px] sm:max-w-[200px]">
            {faculty}
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            {domainLabel}
          </span>
        </div>
        {email && (
          <span className="text-[11px] text-muted-foreground truncate max-w-[130px] sm:max-w-[200px]">
            {email}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Sign out of faculty mode"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}

function CalendarMenu({ scope, label }: { scope: { division?: string; faculty?: string }; label: string }) {
  const [open, setOpen] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState<{ type: "google" | "proton"; copied: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const feed = calendarFeedUrl(scope, false, true);
  const file = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "timetable"}.ics`;
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function addToGoogle() {
    try {
      await navigator.clipboard.writeText(feed);
      setCalendarNotice({ type: "google", copied: true });
    } catch {
      setCalendarNotice({ type: "google", copied: false });
    }
    window.open(googleWeekCalendarUrl(scope), "_blank", "noopener");
    setOpen(false);
  }

  async function addToProton() {
    try {
      await navigator.clipboard.writeText(feed);
      setCalendarNotice({ type: "proton", copied: true });
    } catch {
      setCalendarNotice({ type: "proton", copied: false });
    }
    window.open("https://calendar.proton.me", "_blank", "noopener");
    setOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        data-testid="calendar-week"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Add ${label}'s week to a calendar`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-8 sm:size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Add week" className="menu-pop absolute top-full right-0 z-40 mt-1 w-56 rounded-lg border border-border bg-background p-1 shadow-sm">
          <a role="menuitem" data-testid="calendar-download" href={calendarFeedUrl(scope, true)} download={file} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
            <Download className="size-4" aria-hidden="true" />
            Download file
          </a>
          <button type="button" role="menuitem" data-testid="calendar-google" onClick={() => void addToGoogle()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
            <CalendarPlus className="size-4" aria-hidden="true" />
            Google Calendar
          </button>
          <a role="menuitem" data-testid="calendar-apple" href={appleWeekCalendarUrl(scope)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
            <CalendarPlus className="size-4" aria-hidden="true" />
            Apple Calendar
          </a>
          <a role="menuitem" data-testid="calendar-outlook" href={outlookWeekCalendarUrl(scope, label)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
            <CalendarPlus className="size-4" aria-hidden="true" />
            Outlook
          </a>
          <button type="button" role="menuitem" data-testid="calendar-proton" onClick={() => void addToProton()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
            <CalendarPlus className="size-4" aria-hidden="true" />
            Proton Calendar
          </button>
        </div>
      )}
      {calendarNotice && (
        <div role="status" data-testid={calendarNotice.type === "google" ? "google-note" : "proton-note"} className="absolute top-full right-0 z-40 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-3 text-sm shadow-sm">
          <p className="font-medium text-foreground">
            {calendarNotice.type === "google" ? "Google Calendar link copied" : (calendarNotice.copied ? "Link copied." : "Copy this link.")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {calendarNotice.type === "google"
              ? "If Google Calendar doesn't prompt automatically: in Google Calendar, click '+' next to 'Other calendars' > 'From URL', and paste this link."
              : "In Proton Calendar, click + next to My calendars, choose Add calendar from URL, and paste it."}
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground bg-muted p-1.5 rounded">{feed}</p>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="text-xs text-foreground font-medium hover:underline"
              onClick={async () => {
                await navigator.clipboard.writeText(feed);
              }}
            >
              Copy link
            </button>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setCalendarNotice(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppearanceMenu({
  theme,
  colors,
  bold,
  meet,
  subjects,
  notifications,
  role,
  onTheme,
  onColors,
  onBold,
  onMeet,
  onDisable,
  onStudentLogout,
}: {
  theme: ThemeId;
  colors: boolean;
  bold: boolean;
  meet: MeetAction;
  subjects: string[];
  notifications: boolean;
  role?: ViewerRole | "";
  onTheme: (theme: ThemeId) => void;
  onColors: (on: boolean) => void;
  onBold: (on: boolean) => void;
  onMeet: (action: MeetAction) => void;
  onDisable: () => void;
  onStudentLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={menuRef} className="relative">
      <IconButton label="Settings" pressed={open} onClick={() => setOpen((current) => !current)} testId="appearance-button">
        <Settings className="size-4" aria-hidden="true" />
      </IconButton>
      {open && (
        <div role="menu" aria-label="Settings" className="menu-pop absolute top-full right-0 z-40 mt-1 max-h-[min(32rem,calc(100dvh-5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-md">
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">Theme</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {themes.map((item) => {
              const selected = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => onTheme(item.id)}
                  className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                    selected ? "border-transparent bg-foreground text-background font-medium" : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="flex gap-0.5 shrink-0" aria-hidden="true">
                      {item.swatch.map((color) => (
                        <span key={color} className="size-2 rounded-full border border-black/10" style={{ background: color }} />
                      ))}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </span>
                  {selected && <Check className="size-3 shrink-0 ml-1" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 border-t border-border pt-2 space-y-1">
            <ColorSwitch compact on={colors} onChange={onColors} />
            {colors && (
              <ColorSwitch compact on={bold} onChange={onBold} title="Bold colours" testId="bold-toggle" />
            )}
            <ColorSwitch
              compact
              on={notifications}
              onChange={(next) => {
                if (!next) onDisable();
              }}
              title="Notifications"
              testId="notify-toggle"
            />
          </div>
          <div className="mt-2.5 border-t border-border pt-2.5">
            <MeetChoice compact menu action={meet} onChange={onMeet} />
          </div>
          {colors && (
            <div className="mt-2.5 border-t border-border pt-2.5">
              <ColorEditor theme={theme} subjects={subjects} />
            </div>
          )}
          {role === "student" && (
            <div className="mt-3 border-t border-border pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onStudentLogout?.();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Log Out of Student Batch</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentCohortMenu({
  choices,
  value,
  onChange,
  onSwitch,
}: {
  choices: CohortChoice[];
  value: string;
  onChange: (division: string) => void;
  onSwitch: () => void;
}) {
  const selected = choices.find((choice) => choice.division === value || choice.division.toLowerCase() === value.toLowerCase());
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Cohort"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex max-w-full items-center gap-1 rounded-md px-1 sm:px-1.5 py-1 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span className="min-w-0 text-left">
          <span className="block truncate max-w-[85px] xs:max-w-[130px] sm:max-w-[200px] font-semibold text-foreground text-xs sm:text-sm">
            {selected ? cohortLabel(selected.division) : "Cohort"}
          </span>
          {selected && (
            <span className="hidden xs:block truncate text-[10px] sm:text-[11px] font-normal text-muted-foreground">
              {selected.course} · {selected.batch}
            </span>
          )}
        </span>
        <ChevronDown className="size-3 sm:size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Cohorts in batch" className="menu-pop absolute top-full left-0 z-40 mt-1 max-h-[min(24rem,calc(100dvh-5rem))] min-w-56 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-sm">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
            {selected ? `${selected.course} · ${selected.batch}` : "Your Batch"}
          </div>
          {choices.map((choice) => (
            <button
              key={choice.division}
              type="button"
              role="menuitem"
              data-testid={`cohort-${choice.division}`}
              onClick={() => {
                onChange(choice.division);
                setOpen(false);
              }}
              className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                choice.division === value ? "font-medium bg-muted/60" : ""
              }`}
            >
              <span>{cohortLabel(choice.division)}</span>
              {choice.division === value && <Check className="size-4 shrink-0 text-foreground" />}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSwitch();
            }}
            className="mt-1 block w-full rounded-md border-t border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            I'm a teacher
          </button>
        </div>
      )}
    </div>
  );
}

function CohortMenu({
  label,
  detail,
  ariaLabel,
  value,
  options,
  groups,
  format,
  onChange,
  switchLabel,
  onSwitch,
}: {
  label: string;
  detail?: string;
  ariaLabel: string;
  value: string;
  options: string[];
  groups?: { label: string; options: string[] }[];
  format: (value: string) => string;
  onChange: (value: string) => void;
  switchLabel: string;
  onSwitch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex max-w-full items-center gap-1 rounded-md px-1.5 text-sm font-medium ${detail ? "py-1" : "h-9"}`}
      >
        <span className="min-w-0 text-left">
          <span className="block truncate">{label}</span>
          {detail && <span className="block truncate text-[11px] font-normal text-muted-foreground">{detail}</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label={ariaLabel} className="menu-pop absolute top-full left-0 z-40 mt-1 max-h-[min(24rem,calc(100dvh-5rem))] min-w-56 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-sm">
          {(groups ?? [{ label: "", options }]).map((group) => (
            <div key={group.label || "cohorts"}>
              {group.label && <p className="px-3 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">{group.label}</p>}
              {group.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${option === value ? "font-medium" : ""}`}
                >
                  {format(option)}
                </button>
              ))}
            </div>
          ))}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSwitch(); }} className="mt-1 block w-full rounded-md border-t border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            {switchLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  pressed,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  pressed?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className="inline-flex size-8 sm:size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function HeaderStatus({
  lecture,
  today,
  minutes,
  showCohort,
  meet,
  clockLabel,
}: {
  lecture: PublicLecture | undefined;
  today: string;
  minutes: number;
  showCohort: boolean;
  meet: MeetAction;
  clockLabel: string;
}) {
  if (!lecture) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground w-full">
        <span className="truncate">{clockLabel}</span>
        <span className="text-[11px] text-muted-foreground/75 font-mono">No upcoming classes</span>
      </div>
    );
  }
  const live = slotPhase(lecture, today, minutes) === "now";
  const range = formatCompactRange(lecture.startLabel, lecture.endLabel);
  const when = lecture.date && lecture.date !== today ? `${lecture.weekday.slice(0, 3)} ${range}` : range;
  return (
    <div
      data-testid={live ? "now-banner" : "next-banner"}
      className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 text-xs transition-colors w-full"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            live
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
              : "bg-muted text-muted-foreground font-mono"
          }`}
        >
          {live && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          {live ? "Now" : "Next"}
        </span>
        <span className="font-medium text-foreground truncate max-w-[130px] xs:max-w-[190px] sm:max-w-[240px] md:max-w-none">
          {lecture.subject}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
        {showCohort && <span className="hidden xs:inline">{cohortLabel(lecture.division)} · </span>}
        <span className="font-mono">{when}</span>
        {lecture.room && <LectureRoom room={lecture.room} action={meet} variant="inline" />}
      </div>
    </div>
  );
}

function nextClass(lectures: PublicLecture[], today: string, minutes: number) {
  const classes = lectures
    .filter((lecture) => lecture.kind === "lecture" && lecture.displayStatus !== "cancelled" && lecture.date)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.startMinutes - b.startMinutes);
  return (
    classes.find((lecture) => slotPhase(lecture, today, minutes) === "now") ??
    classes.find((lecture) => {
      const phase = slotPhase(lecture, today, minutes);
      return phase === "upcoming" || phase === "later";
    })
  );
}

function resolveToday(lectures: PublicLecture[], today: string, day: string) {
  if (day) {
    return { lectures: lectures.filter((lecture) => lecture.weekday === day), note: undefined as string | undefined };
  }
  const todays = lectures.filter((lecture) => lecture.date === today);
  if (todays.length > 0) return { lectures: todays, note: undefined };
  const dated = lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)).sort();
  const nearest = dated.find((date) => date >= today) ?? dated[0];
  if (!nearest) return { lectures: [], note: "This sheet has no dated lectures." };
  return {
    lectures: lectures.filter((lecture) => lecture.date === nearest),
    note: "Today is outside the dates in the sheet. Showing the nearest day.",
  };
}

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });

function formatShort(iso: string) {
  return shortDateFormatter.format(new Date(`${iso}T12:00:00Z`));
}

function syncedLabel(iso: string | null, now: Date) {
  if (!iso) return "Not synced yet";
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Synced just now";
  return minutes < 60 ? `Synced ${minutes}m ago` : `Synced ${Math.round(minutes / 60)}h ago`;
}
