import type { BootstrapResponse, ChangeEvent, PublicLecture, SheetLink } from "@shared/types";
import { SiteFooter } from "@/components/SiteFooter";
import { cohortChoices, cohortLabel, lectureInCohort, type CohortChoice } from "@shared/cohort";
import { findCoordinator } from "@shared/coordinators";
import { changeMatchesFaculty, listFacultyNames } from "@shared/faculty";
import { Bell, CalendarPlus, Check, ChevronDown, Download, FileSpreadsheet, GraduationCap, LogOut, RefreshCw, Settings, X } from "lucide-react";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FacultyScopeMenu } from "@/components/FacultyScopeMenu";
import { fetchCurrentAuth, logoutFaculty } from "@/lib/auth";
import { LectureRoom, MeetChoice } from "@/components/MeetLink";
import RubberSegment from "@/components/RubberSegment";
import { RecentChanges } from "@/components/RecentChanges";
import { SearchPanel } from "@/components/SearchPanel";
import { StudentNoticeBar } from "@/components/StudentNotice";
import { Setup } from "@/components/Setup";
import { TodayView } from "@/components/TodayView";
import { WeeklyView } from "@/components/WeeklyView";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { syncPushSubscription, useChangeNotifications } from "@/hooks/useNotifications";
import { useLectureReminders } from "@/hooks/useLectureReminders";
import { appleWeekCalendarUrl, calendarFeedUrl, googleWeekCalendarUrl, outlookWeekCalendarUrl } from "@/lib/calendar";
import { lensFromScopeId, resolveFacultyView, signInFacultyLens } from "@/lib/facultyView";
import { useAnyMenuOpen, useMenuBackdrop } from "@/lib/menuBackdrop";
import { clearFacultyBrowse, clearStudentAuth, closeExamNotice, closeNotifyHint, hasChosenRole, readCanSeeAllFaculty, readDeviceFacultySession, readExamNoticeClosed, readFacultyEmail, readFacultySession, readFacultyLens, readFacultyPreview, readNotifyHintClosed, readRole, readSetup, readStoredCohort, readStoredFaculty, readStudentBatch, saveCanSeeAllFaculty, saveCohort, saveFaculty, saveFacultyEmail, saveFacultyLens, saveFacultyPreview, saveSetup, themes, type FacultyLens, type MeetAction, type ThemeId, type ViewerRole } from "@/lib/prefs";
import { ColorEditor } from "@/components/ColorEditor";
import { ColorSwitch } from "@/components/ColorSwitch";
import { formatClockTime, formatCompactRange, zonedNow } from "@/lib/time";
import { applyFilters, collapseFullOffDays, defaultFilters, slotPhase, splitByLatestWeek, unique, type Filters } from "@/lib/view";
import { AayamLogo } from "@/components/AayamLogo";

const FacultyLoginModal = lazy(() => import("@/components/FacultyLoginModal").then((m) => ({ default: m.FacultyLoginModal })));

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
  scopeAll = false,
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
  scopeAll?: boolean;
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
  // Desktop opens on the week. A phone opens on the day. Faculty always open on the week.
  const [view, setView] = useState(() => {
    if (readRole() === "faculty") return "week";
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) return "week";
    return "today";
  });
  const [notifyHintClosed, setNotifyHintClosed] = useState(readNotifyHintClosed);
  const [examNoticeClosed, setExamNoticeClosed] = useState(readExamNoticeClosed);
  const [fadeIn, setFadeIn] = useState(false);
  const menuOpen = useAnyMenuOpen();
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

  // Bootstrap carries the published week. Older dated rows, if any, never reach the grid.
  const lectureFeed = useMemo(() => splitByLatestWeek(data.lectures).latest, [data.lectures]);
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
    // A student with no faculty sign-in on this device has nothing to check. Saves a request per visit.
    if (readRole() === "student" && !readFacultySession() && !readDeviceFacultySession()) return;
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
        const wasFaculty = readRole() === "faculty";
        clearFacultyBrowse();
        if (wasFaculty) onReset?.();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // A wide view filters every year on the client, so any narrower download would hide lectures.
    if (role !== "faculty" || !board.wide || !selectedFaculty || scopeAll) return;
    onScopeChange?.({ all: true, faculty: selectedFaculty });
  }, [role, board.wide, selectedFaculty, scopeAll]);

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
  const inPickedCohort = (list: PublicLecture[]) => {
    if (!filters.division) return list;
    const picked = choices.find((item) => item.division === filters.division);
    return list.filter((lecture) => (picked ? lectureInCohort(lecture, picked) : lecture.division === filters.division));
  };
  const facultyVisible = inPickedCohort(facultyPool);
  const studentPool = choice ? lectureFeed.filter((lecture) => lectureInCohort(lecture, choice)) : [];
  const watchedDivisions = new Set(choice ? [choice.division, ...choice.also] : selected ? [selected] : []);
  const lectureIds = (list: PublicLecture[]) => new Set(list.map((lecture) => lecture.id));
  const facultyFilter = board.facultyFilter;
  const facultyDivisions = board.watchedDivisions;
  const visibleChanges = (list: ChangeEvent[], facultyIds: Set<string>) =>
    role === "faculty"
      ? facultyFilter
        ? list.filter((change) => changeMatchesFaculty(change, facultyFilter, facultyIds))
        : facultyDivisions
          ? list.filter((change) => !change.division || facultyDivisions.has(change.division))
          : list
      : list.filter((change) => watchedDivisions.size === 0 || !change.division || watchedDivisions.has(change.division));
  const liveChanges = visibleChanges(data.changes, lectureIds(board.lectures));
  const notifications = useChangeNotifications(liveChanges);
  useEffect(() => {
    if (role !== "student" || !notifications.optedIn) return;
    void syncPushSubscription();
  }, [role, notifications.optedIn]);

  const courses = [...new Set(choices.map((item) => item.course))];
  const batches = [...new Set(choices.filter((item) => item.course === filters.course).map((item) => item.batch))];
  const semesters = [...new Set(choices.filter((item) => item.course === filters.course && item.batch === filters.batch).map((item) => item.semester))];
  const scope = role === "faculty" ? facultyVisible : studentPool.filter((lecture) => lecture.kind !== "break");
  const days = dayOrder.filter((day) => scope.some((lecture) => lecture.weekday === day));
  const subjects = unique(scope.map((lecture) => lecture.subject));
  const faculties = unique(scope.map((lecture) => lecture.faculty));
  const rooms = unique(scope.map((lecture) => lecture.room));
  const pool = role === "faculty" ? facultyVisible : studentPool;
  const effective = { ...filters, course: "", batch: "", semester: "", division: "", faculty: role === "faculty" ? "" : filters.faculty };
  // Fold whole OFF days before filtering, so a filter that leaves one OFF slot cannot turn a teaching day into a day off.
  const foldedPool = collapseFullOffDays(pool);
  const dayLectures = applyFilters(foldedPool, effective);
  const weekLectures = applyFilters(foldedPool, effective, { ignoreDay: true });
  const pinnedDay = filters.day;
  const todayPack = useMemo(
    () => resolveToday(dayLectures, zone.iso, pinnedDay, data.weekStart, data.weekEnd),
    [dayLectures, zone.iso, pinnedDay, data.weekStart, data.weekEnd],
  );
  const batchCounts = useMemo(() => {
    if (role !== "faculty" || !board.facultyFilter || filters.division) return [];
    const counts = new Map<string, number>();
    for (const lecture of facultyVisible) {
      if (lecture.kind !== "lecture") continue;
      counts.set(lecture.batch, (counts.get(lecture.batch) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
  }, [role, board.facultyFilter, filters.division, facultyVisible]);
  const requestedDay = filters.day || todayPack.lectures[0]?.weekday || zone.weekday;
  const activeDay = days.includes(requestedDay) ? requestedDay : days[0] ?? "";
  const liveScope = scope;
  // All classes has many lectures at once, so "the current class" means nothing there until one cohort is filtered.
  const liveMarks = role !== "faculty" || board.showLive || Boolean(filters.division);
  const upcoming = liveMarks ? nextClass(liveScope, zone.iso, zone.minutes) : undefined;
  const filtersOn = Boolean(filters.subject || filters.faculty || filters.room || filters.status !== "all" || (role === "faculty" && filters.division));
  const changes = liveChanges;
  const failing = Boolean(data.sync.lastError);
  const activeSheet = role === "student" ? choice : facultyChoice;
  const sheetUrl = sheetUrlFor(data.sheets, activeSheet, data.spreadsheetUrl);

  function navigateDay(direction: -1 | 1) {
    if (days.length <= 1) return;
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
  }, [view, filters.day, zone.weekday, days, activeDay]);

  // A new view or day starts at its top. Runs before the phone week view scrolls itself to today.
  const shownOnce = useRef(false);
  useLayoutEffect(() => {
    if (shownOnce.current) window.scrollTo({ top: 0, behavior: "instant" });
    shownOnce.current = true;
  }, [view, filters.day]);

  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const wheelLock = useRef(0);

  function swipeDay(deltaX: number, deltaY: number) {
    if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) navigateDay(deltaX < 0 ? 1 : -1);
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, input, textarea, select")) return;
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  function handlePointerUp(event: React.PointerEvent) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    swipeDay(event.clientX - start.x, event.clientY - start.y);
  }

  function handleWheel(event: React.WheelEvent) {
    if (Date.now() < wheelLock.current) return;
    if (Math.abs(event.deltaX) < 24 || Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;
    wheelLock.current = Date.now() + 450;
    navigateDay(event.deltaX > 0 ? 1 : -1);
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
    setView("week");
    setLoginModalOpen(false);
  }

  async function handleFacultyLogout() {
    await logoutFaculty();
    setAuthEmail(undefined);
    setCanSeeAll(false);
    setLens(null);
    setFaculty("");
    clearFacultyBrowse();
    const targetDivision = readStoredCohort();
    if (targetDivision) {
      choose(targetDivision);
    } else {
      onReset?.();
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
    setFadeIn(true);
    setView(choice.role === "faculty" ? "week" : "today");
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
    lectures: liveScope,
    today: zone.iso,
    minutes: zone.minutes,
    enabled: ready && !missingIdentity && notifications.optedIn && liveMarks,
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
  const notice = reminders.notice ?? notifications.notice;
  const dismissNotice = () => {
    if (reminders.notice) reminders.dismiss();
    else notifications.dismiss();
  };
  const floatBottom = "bottom-[calc(3.75rem+env(safe-area-inset-bottom))]";
  const phoneDays = view === "today" ? dayControl("w-full") : null;
  const desktopDays = view === "today" ? dayControl("w-full max-w-xl") : null;
  const dismissNotifyHint = () => {
    closeNotifyHint();
    setNotifyHintClosed(true);
  };
  const showNotifyHint = !notifications.optedIn && !notifyHintClosed && !notice;
  const searchPlaceholder = role === "faculty" ? "Subject, cohort, or room" : "Subject, faculty, or room";
  const statusLine = (
    <HeaderStatus
      lecture={upcoming}
      today={zone.iso}
      minutes={zone.minutes}
      showCohort={role === "faculty" && board.showDivision}
      meet={meet}
      clockLabel={formatClockTime(now, data.timezone)}
      emptyNote={liveMarks ? "No upcoming classes" : ""}
    />
  );
  return (
    <Tabs value={view} onValueChange={setView} className={`min-h-dvh flex flex-col ${fadeIn ? "page-fade" : ""}`}>
      {/* Under the header, whose menus stay sharp. A click here closes them through their outside-click listeners. */}
      <div
        aria-hidden="true"
        data-testid="menu-backdrop"
        data-open={menuOpen ? "true" : undefined}
        className={`fixed inset-0 z-25 bg-background/40 backdrop-blur-sm transition-[opacity,visibility] duration-200 ${menuOpen ? "visible opacity-100" : "invisible opacity-0"}`}
      />
      <header className="sticky top-0 z-30 short:relative border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex flex-col gap-2 px-3 py-2 sm:px-5 sm:py-2.5">
          <div className="flex items-center gap-2 w-full min-w-0">
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

            <div className="hidden min-w-0 flex-1 items-center justify-center px-3 xl:flex">
              {desktopDays ?? statusLine}
            </div>

            <div className="relative z-30 ml-auto flex shrink-0 items-center gap-1">
              <div className="hidden items-center xl:flex">
                {viewControl("shrink-0")}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <a
                  href="https://exam.somyacodes.in/"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="exam-schedule"
                  aria-label="University exams"
                  title="University exams"
                  className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:h-9 sm:min-w-9 xl:px-2"
                >
                  <GraduationCap className="size-4 shrink-0" aria-hidden="true" />
                  <span className="hidden xl:inline text-xs font-medium">Exam</span>
                </a>
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open the sheet"
                  title="Open the sheet"
                  className="hidden sm:inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9"
                >
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  aria-label={pending ? "Refreshing" : "Refresh"}
                  title={pending ? "Refreshing" : "Refresh"}
                  data-testid="refresh-button"
                  disabled={pending}
                  onClick={onRefresh}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 sm:size-9"
                >
                  <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
                </button>
                <CalendarMenu
                  scope={role === "faculty" ? board.calendar ?? { faculty: selectedFaculty } : { division: selected }}
                  label={role === "faculty" ? board.label : cohortLabel(selected)}
                />
                <SearchPanel
                  query={filters.query}
                  placeholder={searchPlaceholder}
                  filters={{ ...effective, division: role === "faculty" ? filters.division : "" }}
                  filtersOn={filtersOn}
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
                  onChange={(partial) => {
                    patch(partial);
                    if (partial.day) setView("today");
                  }}
                  onClear={() => patch({ division: "", day: "", subject: "", faculty: "", room: "", status: "all", query: "" })}
                />
                <AppearanceMenu theme={theme} colors={colors} bold={bold} meet={meet} subjects={subjects} notifications={notifications.optedIn} onTheme={onTheme} onColors={onColors} onBold={onBold} onMeet={onMeet} onEnable={() => void notifications.enable()} onDisable={notifications.disable} role={role} sheetUrl={sheetUrl} pending={pending} onRefresh={onRefresh} onStudentLogout={handleStudentLogout} onFacultyLogout={handleFacultyLogout} />
              </div>
            </div>
          </div>
          <div className="w-full sm:hidden">{phoneDays ?? statusLine}</div>
          <div className="hidden w-full min-w-0 items-center gap-3 sm:flex xl:hidden">
            {viewControl("shrink-0")}
            <div className="flex min-w-0 flex-1 items-center justify-end">{desktopDays ?? statusLine}</div>
          </div>
        </div>
      </header>
      {role === "student" ? <StudentNoticeBar notices={data.notices ?? []} optedIn={notifications.optedIn} /> : null}
      {!examNoticeClosed && (
        <div
          role="status"
          data-testid="exam-notice"
          className="flex items-center gap-2 border-b border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger sm:px-6"
        >
          <GraduationCap className="size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 leading-snug">
            AT/KT and every exam schedule are on the exam site.
          </p>
          <a
            href="https://exam.somyacodes.in/"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-md bg-danger px-2.5 py-1 text-xs font-medium text-danger-foreground hover:opacity-90"
          >
            Open
          </a>
          <button
            type="button"
            aria-label="Dismiss exam notice"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-danger hover:bg-danger/10"
            onClick={() => {
              closeExamNotice();
              setExamNoticeClosed(true);
            }}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <main id="timetable" className={`flex flex-1 flex-col px-4 py-4 ${showNotifyHint ? "pb-[calc(8rem+env(safe-area-inset-bottom))]" : "pb-[calc(4.5rem+env(safe-area-inset-bottom))]"} sm:px-6 sm:py-5 sm:pb-5`}>
        <h1 className="sr-only">{role === "faculty" ? board.label : cohortLabel(selected)} timetable</h1>
        <p data-testid="sync-status" role={failing ? "alert" : "status"} className={`text-sm ${failing ? "mb-3 text-warning" : "sr-only"}`}>
          {failing ? data.sync.lastError || "Could not refresh. The last timetable is still shown." : syncedLabel(data.sync.lastSuccessAt, now)}
        </p>

        {view !== "updates" && batchCounts.length > 0 && (
          <div data-testid="batch-summary" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>This week:</span>
            {batchCounts.map(([batch, count]) => (
              <span key={batch} className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                {batch} · {count} {count === 1 ? "class" : "classes"}
              </span>
            ))}
          </div>
        )}
        {role === "faculty" && board.wide && !board.facultyFilter && (
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Cohort:</span>
            <button
              type="button"
              onClick={() => patch({ division: "" })}
              className={`px-2.5 py-1 rounded-full font-medium shrink-0 transition-colors ${
                !filters.division
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              All cohorts
            </button>
            {unique(facultyPool.map((l) => l.division)).map((division) => (
              <button
                key={division}
                type="button"
                onClick={() => patch({ division })}
                className={`px-2.5 py-1 rounded-full font-medium shrink-0 transition-colors ${
                  filters.division === division
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {cohortLabel(division)}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1">
          <TabsContent value="today" className="rise mt-0">
            <div onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { drag.current = null; }} onWheel={handleWheel} className="min-h-[40vh] touch-pan-y">
              <TodayView
                key={activeDay}
                lectures={todayPack.lectures}
                today={zone.iso}
                minutes={zone.minutes}
                showDivision={role === "faculty" && board.showDivision}
                showFaculty={role === "faculty" && board.showFaculty}
                showLive={liveMarks}
                note={todayPack.note}
                meet={meet}
                onPrevDay={() => navigateDay(-1)}
                onNextDay={() => navigateDay(1)}
              />
            </div>
          </TabsContent>
          <TabsContent value="week" className="rise mt-0">
            <WeeklyView lectures={weekLectures} showDivision={role === "faculty" && board.showDivision} showFaculty={role === "faculty" && board.showFaculty} showLive={liveMarks} today={zone.iso} minutes={zone.minutes} meet={meet} />
          </TabsContent>
          <TabsContent value="updates" className="rise mt-0">
            <RecentChanges changes={changes} timeZone={data.timezone} />
          </TabsContent>
        </div>
        <SiteFooter className="-mx-4 mt-10 px-4 sm:-mx-6 sm:mt-12 sm:px-6" />
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur-md sm:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="px-3 py-2">
          {viewControl("w-full")}
        </div>
      </div>
      {notice && (
        <div
          role="status"
          data-testid="notify-notice"
          className={`fixed inset-x-3 ${floatBottom} z-50 flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm`}
        >
          <p className="min-w-0 flex-1 leading-snug">{notice}</p>
          <button type="button" className="shrink-0 text-xs text-muted-foreground hover:text-foreground" onClick={dismissNotice}>
            Close
          </button>
        </div>
      )}
      {showNotifyHint && (
        <div
          role="status"
          data-testid="notify-hint"
          className={`menu-pop-up fixed inset-x-3 ${floatBottom} z-50 flex items-center gap-2 rounded-lg border border-border bg-background py-1 pr-1 pl-3 text-xs shadow-lg short:hidden sm:hidden`}
        >
          <Bell className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-muted-foreground">Get class change alerts</p>
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 font-semibold text-foreground hover:bg-muted"
            onClick={() => {
              dismissNotifyHint();
              void notifications.enable();
            }}
          >
            Turn on
          </button>
          <button type="button" aria-label="Dismiss" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={dismissNotifyHint}>
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      {loginModalOpen ? (
        <Suspense fallback={null}>
          <FacultyLoginModal
            open={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
            onSuccess={handleFacultyLoginSuccess}
          />
        </Suspense>
      ) : null}
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
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/80 bg-background/90 px-2 py-1 shadow-xs sm:px-2.5">
      <div className="flex flex-col text-left min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 font-semibold text-xs sm:text-sm text-foreground truncate sm:max-w-[200px]">
            {faculty}
          </span>
          <span className="hidden shrink-0 items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 sm:inline-flex dark:text-emerald-400">
            {domainLabel}
          </span>
        </div>
        {email && (
          <span className="hidden text-[11px] text-muted-foreground truncate sm:block sm:max-w-[200px]">
            {email}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="ml-1 hidden items-center gap-1 rounded-md px-2 py-1 text-xs sm:inline-flex text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Sign out of faculty mode"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        <span>Sign out</span>
      </button>
    </div>
  );
}

function CalendarMenu({ scope, label }: { scope: { division?: string; faculty?: string }; label: string }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState({ top: 56, right: 12 });
  const feed = calendarFeedUrl(scope, false, true);
  const file = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "timetable"}.ics`;

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const node = event.target as Node;
      if (buttonRef.current?.contains(node) || panelRef.current?.contains(node)) return;
      setOpen(false);
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

  async function addToCalendar(url: string) {
    try {
      await navigator.clipboard.writeText(feed);
      setNotice("The calendar link is copied. Paste it if the calendar does not ask for it.");
    } catch {
      setNotice(feed);
    }
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={`Add ${label}'s week to a calendar`}
        data-testid="calendar-week"
        onClick={() => {
          if (!open) place();
          setOpen((current) => !current);
        }}
        className={`inline-flex size-8 items-center justify-center rounded-md sm:size-9 ${open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Add this week"
          className="tools-pop fixed z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border/60 bg-background/75 shadow-2xl backdrop-blur-xl"
          style={{ top: anchor.top, right: anchor.right }}
        >
          <div className="grid gap-0.5 p-1.5">
            <p className="px-2 py-1 text-xs text-muted-foreground">Add this week</p>
                <a role="menuitem" data-testid="calendar-download" href={calendarFeedUrl(scope, true)} download={file} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted">
                  <Download className="size-4" aria-hidden="true" />
                  Download the week
                </a>
                <button type="button" role="menuitem" data-testid="calendar-google" onClick={() => void addToCalendar(googleWeekCalendarUrl(scope))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted">
                  <CalendarPlus className="size-4" aria-hidden="true" />
                  Google Calendar
                </button>
                <a role="menuitem" data-testid="calendar-apple" href={appleWeekCalendarUrl(scope)} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted">
                  <CalendarPlus className="size-4" aria-hidden="true" />
                  Apple Calendar
                </a>
                <a role="menuitem" data-testid="calendar-outlook" href={outlookWeekCalendarUrl(scope, label)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted">
                  <CalendarPlus className="size-4" aria-hidden="true" />
                  Outlook
                </a>
                <button type="button" role="menuitem" data-testid="calendar-proton" onClick={() => void addToCalendar("https://calendar.proton.me")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted">
                  <CalendarPlus className="size-4" aria-hidden="true" />
                  Proton Calendar
                </button>
                {notice ? <p className="mt-1 break-all px-2 pb-1 text-xs text-muted-foreground">{notice}</p> : null}
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
  sheetUrl,
  pending,
  onRefresh,
  onTheme,
  onColors,
  onBold,
  onMeet,
  onEnable,
  onDisable,
  onStudentLogout,
  onFacultyLogout,
}: {
  theme: ThemeId;
  colors: boolean;
  bold: boolean;
  meet: MeetAction;
  subjects: string[];
  notifications: boolean;
  role?: ViewerRole | "";
  sheetUrl: string;
  pending: boolean;
  onRefresh: () => void;
  onTheme: (theme: ThemeId) => void;
  onColors: (on: boolean) => void;
  onBold: (on: boolean) => void;
  onMeet: (action: MeetAction) => void;
  onEnable: () => void;
  onDisable: () => void;
  onStudentLogout?: () => void;
  onFacultyLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useMenuBackdrop(open);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={menuRef} className="relative">
      <IconButton label="Settings" pressed={open} onClick={() => setOpen((current) => !current)} testId="appearance-button">
        <Settings className="size-4" aria-hidden="true" />
      </IconButton>
      {open && createPortal(
        <div className="settings-glass fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Settings">
          <button type="button" className="absolute inset-0 bg-black/20" aria-label="Close settings" onClick={() => setOpen(false)} />
          <div className="absolute top-3 right-3 bottom-3 flex w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-y-auto rounded-3xl border border-border bg-background p-5 shadow-2xl sm:top-4 sm:right-4 sm:bottom-auto sm:max-h-[min(40rem,calc(100dvh-2rem))] sm:p-6">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-medium tracking-tight">Settings</h2>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-background/40 text-foreground hover:bg-background/70">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Theme</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {themes.map((item) => {
              const selected = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => onTheme(item.id)}
                  className={`flex flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-colors ${
                    selected ? "border-transparent bg-foreground text-background" : "border-white/10 bg-background/40 hover:bg-background/70"
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
                if (next) onEnable();
                else onDisable();
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
          <div className="mt-5 border-t border-border pt-3">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Actions</p>
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onRefresh();
                }}
                disabled={pending}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className={`size-3.5 ${pending ? "animate-spin text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                  <span>{pending ? "Refreshing timetable..." : "Refresh timetable"}</span>
                </span>
                {pending && <span className="text-[11px] text-muted-foreground">Syncing...</span>}
              </button>
              {sheetUrl && (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Open spreadsheet</span>
                  </span>
                </a>
              )}
            </div>
          </div>
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
          {role === "faculty" && (
            <div className="mt-3 border-t border-border pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onFacultyLogout?.();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
        </div>,
        document.body,
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
  useMenuBackdrop(open);
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
    <div ref={menuRef} className="relative min-w-0">
      <button
        type="button"
        aria-label="Cohort"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md px-1 sm:px-1.5 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span className="min-w-0 text-left">
          <span className="block truncate sm:max-w-[200px] font-semibold text-foreground text-xs sm:text-sm">
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
        <div role="menu" aria-label="Cohorts in batch" className="menu-pop absolute top-full left-0 z-40 mt-1 max-h-[min(24rem,calc(100dvh-5rem))] min-w-56 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-sm max-sm:fixed max-sm:inset-x-3 max-sm:top-12 max-sm:mt-0">
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
  emptyNote,
}: {
  lecture: PublicLecture | undefined;
  today: string;
  minutes: number;
  showCohort: boolean;
  meet: MeetAction;
  clockLabel: string;
  emptyNote: string;
}) {
  if (!lecture) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground w-full">
        <span className="truncate">{clockLabel}</span>
        {emptyNote && <span className="text-[11px] text-muted-foreground/75 font-mono">{emptyNote}</span>}
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

function resolveToday(lectures: PublicLecture[], today: string, day: string, weekStart: string | null, weekEnd: string | null) {
  if (day) {
    return { lectures: lectures.filter((lecture) => lecture.weekday === day), note: undefined as string | undefined };
  }
  const todays = lectures.filter((lecture) => lecture.date === today);
  if (todays.length > 0) return { lectures: todays, note: undefined };
  const dated = lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date));
  const gap = (date: string) => Math.abs(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`));
  const nearest = dated.reduce<string | undefined>((best, date) => (best === undefined || gap(date) < gap(best) ? date : best), undefined);
  if (!nearest) return { lectures: [], note: "This sheet has no dated lectures." };
  // Inside the published week, an empty today just means no class for this person or cohort.
  if (weekStart && weekEnd && today >= weekStart && today <= weekEnd) {
    const next = dated.filter((date) => date > today).sort()[0];
    return {
      lectures: lectures.filter((lecture) => lecture.date === (next ?? nearest)),
      note: next ? "No classes today. Showing the next day with classes." : "No more classes this week. Showing the last day with classes.",
    };
  }
  return {
    lectures: lectures.filter((lecture) => lecture.date === nearest),
    note: "Today is outside the dates in the sheet. Showing the nearest day.",
  };
}

function syncedLabel(iso: string | null, now: Date) {
  if (!iso) return "Not synced yet";
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Synced just now";
  return minutes < 60 ? `Synced ${minutes}m ago` : `Synced ${Math.round(minutes / 60)}h ago`;
}
