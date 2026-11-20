import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cohortLabel, DEFAULT_COHORT_CHOICES, type CohortChoice } from "@shared/cohort";
import { coordinatorPreview, findCoordinator } from "@shared/coordinators";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { HomePage } from "@/components/HomePage";
import { LoadingScreen } from "@/components/LoadingScreen";
import { fetchBootstrap, refreshBootstrap, type BootstrapScope } from "@/lib/api";
import { fetchCurrentAuth } from "@/lib/auth";
import { isHomeScreenApp, recoverFacultySession, storedFacultyScope } from "@/lib/facultyBoot";
import { signInFacultyLens } from "@/lib/facultyView";
import { ColorProvider } from "@/lib/colorState";
import {
  applyBold,
  applyColors,
  applyTheme,
  hasChosenRole,
  readCachedBootstrap,
  readCanSeeAllFaculty,
  readFacultyEmail,
  readFacultyLens,
  readRole,
  readSetup,
  readStoredBold,
  readStoredColors,
  readStoredCohort,
  readStoredFaculty,
  readStoredMeet,
  readStoredTheme,
  readStudentBatch,
  saveCachedBootstrap,
  saveCanSeeAllFaculty,
  saveCohort,
  saveFaculty,
  saveFacultyEmail,
  saveFacultyLens,
  saveFacultyPreview,
  saveMeet,
  saveRole,
  saveSetup,
  type MeetAction,
  type ThemeId,
  type ViewerRole,
} from "@/lib/prefs";
import { cohortToSlug, slugToCohort } from "@/lib/slug";

// Pages a timetable visit never opens load on demand.
const loadDashboard = () => import("@/components/Dashboard");
const Dashboard = lazy(() => loadDashboard().then((m) => ({ default: m.Dashboard })));
const AdminPage = lazy(() => import("@/components/AdminPage").then((m) => ({ default: m.AdminPage })));
const PitchPage = lazy(() => import("@/components/PitchPage").then((m) => ({ default: m.PitchPage })));
const PrivacyPolicy = lazy(() => import("@/components/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import("@/components/TermsOfService").then((m) => ({ default: m.TermsOfService })));
const FacultyLoginModal = lazy(() => import("@/components/FacultyLoginModal").then((m) => ({ default: m.FacultyLoginModal })));

/**
 * The data job runs every few minutes and a sync in progress lands within one or two. After a Refresh tap
 * the page checks every 20 seconds. A sync the scheduler started on its own gets one check every 90 seconds.
 * Either stops after three minutes and falls back to the normal five-minute check.
 */
const REFRESH_POLL_MS = 20 * 1000;
const BACKGROUND_SYNC_POLL_MS = 90 * 1000;
const REFRESH_POLL_LIMIT_MS = 3 * 60 * 1000;

function readScopeFromUrl(choices: CohortChoice[]): {
  scope: BootstrapScope;
  role?: ViewerRole;
  matchedCohort?: CohortChoice;
  isUnknownSlug?: boolean;
} | null {
  if (typeof window === "undefined") return null;
  const p = window.location.pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (
    p === "/terms" ||
    p === "/terms-of-service" ||
    p === "/privacy" ||
    p === "/privacy-policy" ||
    p === "/pitch" ||
    p === "/admin"
  ) {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const faculty = params.get("faculty")?.trim();
  if (faculty) {
    return { scope: { faculty }, role: "faculty" };
  }
  let division = (params.get("division") || params.get("cohort"))?.trim();
  if (division) {
    if (division.toLowerCase() === "andrew") {
      division = "Andrew NG";
    }
    const matched =
      choices.find((c) => c.division.toLowerCase() === division?.toLowerCase()) ??
      slugToCohort(division, choices);
    return {
      scope: { division: matched?.division ?? division },
      role: "student",
      matchedCohort: matched,
    };
  }
  const course = params.get("course")?.trim();
  const batch = params.get("batch")?.trim();
  if (course || batch) {
    return { scope: { course, batch } };
  }

  // Path-based slug check (e.g. /larry-page)
  const slug = p.replace(/^\/+|\/+$/g, "");
  if (slug) {
    const matched = slugToCohort(slug, choices);
    if (matched) {
      return {
        scope: { division: matched.division },
        role: "student",
        matchedCohort: matched,
      };
    }
    return { scope: {}, isUnknownSlug: true };
  }

  return null;
}

function pathRoute(pathname: string) {
  const p = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (p === "/privacy" || p === "/privacy-policy") return "/privacy";
  if (p === "/terms" || p === "/terms-of-service") return "/terms";
  if (p === "/pitch") return "/pitch";
  if (p === "/admin") return "/admin";
  return "/";
}

function isPublicHome() {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  if (path !== "/" && path !== "") return false;
  const params = new URLSearchParams(window.location.search);
  return !params.get("division") && !params.get("cohort");
}

function bootPreview(): BootstrapScope | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get("preview");
  if (!id) return null;
  const person = coordinatorPreview(id);
  if (!person) return null;
  const lens = signInFacultyLens(person.email, person.name, person.canSeeAllFaculty);
  saveFaculty(person.name);
  saveFacultyEmail(person.email);
  saveCanSeeAllFaculty(person.canSeeAllFaculty);
  saveFacultyPreview(true);
  saveFacultyLens(lens);
  saveSetup({ role: "faculty", cohort: readStoredCohort(), faculty: person.name, theme: readStoredTheme() });
  return { all: true, faculty: person.name };
}

function keepPreview(target: string) {
  if (!import.meta.env.DEV || typeof window === "undefined") return target;
  const current = new URLSearchParams(window.location.search);
  const preview = current.get("preview");
  const menu = current.get("menu");
  if (!preview && !menu) return target;
  const url = new URL(target, window.location.origin);
  if (preview) url.searchParams.set("preview", preview);
  if (menu) url.searchParams.set("menu", menu);
  return `${url.pathname}${url.search}`;
}

function syncUrl(scope: BootstrapScope) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const p = url.pathname.toLowerCase();
  if (pathRoute(p) !== "/") {
    if (url.search) window.history.replaceState(null, "", url.pathname);
    return;
  }

  if (scope.faculty) {
    const target = keepPreview(`/?faculty=${encodeURIComponent(scope.faculty)}`);
    const current = window.location.pathname + window.location.search;
    if (current !== target) {
      window.history.replaceState(null, "", target);
    }
    return;
  }

  if (scope.division) {
    const slug = cohortToSlug(scope.division);
    const target = `/${slug}`;
    const current = window.location.pathname + window.location.search;
    if (current !== target) {
      window.history.replaceState(null, "", target);
    }
    return;
  }

  if (window.location.pathname === "/" && window.location.search) {
    window.history.replaceState(null, "", "/");
  }
}

function usePreferences() {
  const [theme, setTheme] = useState<ThemeId>(readStoredTheme);
  const [colors, setColors] = useState(readStoredColors);
  const [bold, setBold] = useState(readStoredBold);
  const [meet, setMeet] = useState<MeetAction>(readStoredMeet);
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.removeItem("timetable-layout");
      localStorage.removeItem("timetable-week");
    } catch {
      // A blocked store still leaves this visit on the week grid and the compact day.
    }
  }, [theme]);
  useEffect(() => {
    applyColors(colors);
  }, [colors]);
  useEffect(() => {
    applyBold(bold);
  }, [bold]);
  return {
    theme,
    colors,
    bold,
    meet,
    chooseTheme: (next: ThemeId) => setTheme(next),
    chooseColors: (next: boolean) => setColors(next),
    chooseBold: (next: boolean) => setBold(next),
    chooseMeet: (next: MeetAction) => {
      setMeet(next);
      saveMeet(next);
    },
  };
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // A hidden tab has nothing to repaint. Coming back corrects the clock at once.
    const tick = () => {
      if (!document.hidden) setNow(new Date());
    };
    const timer = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}

/** What a signed-in teacher reads: every sheet for a wide view, or every lecture under their name. */
function facultyReadScope(name: string): BootstrapScope {
  const wide = readCanSeeAllFaculty() || Boolean(findCoordinator(readFacultyEmail(), name));
  return wide ? { all: true, faculty: name } : { faculty: name };
}

/** A saved timetable visit fetches the grid code alongside the bootstrap request. The home page fetches it once idle. */
function usePreloadDashboard(home: boolean) {
  useEffect(() => {
    if (!home) {
      void loadDashboard();
      return;
    }
    const timer = window.setTimeout(() => void loadDashboard(), 2000);
    return () => window.clearTimeout(timer);
  }, [home]);
}

export function App() {
  const preferences = usePreferences();
  const calmMotion = useReducedMotion();
  const now = useNow();
  const queryClient = useQueryClient();
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [route, setRoute] = useState(() => (typeof window === "undefined" ? "/" : pathRoute(window.location.pathname)));

  useEffect(() => {
    function handleLocation() {
      setRoute(pathRoute(window.location.pathname));
    }
    window.addEventListener("popstate", handleLocation);
    return () => window.removeEventListener("popstate", handleLocation);
  }, []);

  const [boot] = useState(bootPreview);
  const [returning] = useState(() => (boot || !isPublicHome() ? null : storedFacultyScope()));
  const [sessionGate, setSessionGate] = useState<"open" | "check">(() => {
    if (boot || returning) return "open";
    return isHomeScreenApp() ? "check" : "open";
  });
  const [configured, setConfigured] = useState(() => {
    if (boot || returning) return true;
    if (isPublicHome()) {
      return false;
    }
    const urlScope = readScopeFromUrl(DEFAULT_COHORT_CHOICES);
    if (urlScope?.role === "faculty") return readRole() === "faculty" && Boolean(readStoredFaculty());
    if (urlScope?.role || urlScope?.matchedCohort) return true;
    return readSetup() && hasChosenRole();
  });

  usePreloadDashboard(!configured);

  const [scope, setScope] = useState<BootstrapScope>(() => {
    if (boot) return boot;
    if (returning) return returning;
    if (isPublicHome()) {
      return {};
    }
    const urlScope = readScopeFromUrl(DEFAULT_COHORT_CHOICES);
    if (urlScope) {
      if (urlScope.role === "faculty") {
        const stored = readStoredFaculty();
        return readRole() === "faculty" && stored ? { faculty: stored } : {};
      }
      if (urlScope.scope.division) {
        const matched = urlScope.matchedCohort ?? slugToCohort(urlScope.scope.division, DEFAULT_COHORT_CHOICES);
        if (matched) saveCohort(urlScope.scope.division);
      }
      return urlScope.scope;
    }
    const role = readRole();
    if (role === "faculty") {
      const f = readStoredFaculty();
      return f ? facultyReadScope(f) : {};
    }
    const c = readStoredCohort();
    return c ? { division: c } : {};
  });

  useEffect(() => {
    syncUrl(scope);
  }, [scope]);

  useEffect(() => {
    if (boot || returning) return;
    let cancel = false;
    void (async () => {
      await recoverFacultySession();
      const saved = storedFacultyScope();
      if (cancel) return;
      if (saved && (isPublicHome() || isHomeScreenApp())) {
        setScope(saved);
        setConfigured(true);
        setSessionGate("open");
        return;
      }
      if (!isHomeScreenApp()) {
        setSessionGate("open");
        return;
      }
      const auth = await fetchCurrentAuth();
      if (cancel) return;
      if (auth.authenticated && auth.faculty) {
        const allowed = Boolean(auth.canSeeAllFaculty);
        saveFaculty(auth.faculty);
        saveFacultyEmail(auth.email ?? "");
        saveRole("faculty");
        saveCanSeeAllFaculty(allowed);
        saveFacultyPreview(false);
        if (!readFacultyLens()) saveFacultyLens(signInFacultyLens(auth.email ?? "", auth.faculty, allowed));
        const wide = allowed || Boolean(findCoordinator(auth.email, auth.faculty));
        setScope(wide ? { all: true, faculty: auth.faculty } : { faculty: auth.faculty });
        setConfigured(true);
      }
      setSessionGate("open");
    })();
    return () => {
      cancel = true;
    };
  }, [boot, returning]);

  useEffect(() => {
    function onPopState() {
      const next = pathRoute(window.location.pathname);
      setRoute(next);
      if (next !== "/") return;

      if (isPublicHome()) {
        setConfigured(false);
        setScope({});
        return;
      }

      const activeChoices =
        queryClient.getQueryData<any>(["bootstrap", scope])?.choices ?? DEFAULT_COHORT_CHOICES;
      const parsed = readScopeFromUrl(activeChoices);
      // Back or forward must not narrow a teacher to one cohort or one name.
      const teacher = readRole() === "faculty" ? readStoredFaculty() : "";
      if (parsed && teacher) {
        setScope(facultyReadScope(teacher));
        setConfigured(true);
      } else if (parsed) {
        if (parsed.scope.division) {
          const matched = parsed.matchedCohort ?? slugToCohort(parsed.scope.division, activeChoices);
          if (matched) saveCohort(parsed.scope.division);
          setScope(parsed.scope);
          setConfigured(true);
        } else {
          setScope(parsed.scope);
        }
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [queryClient, scope]);

  function handleReset() {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/");
    }
    setConfigured(false);
    setScope({});
  }

  function handleScopeChange(next: BootstrapScope) {
    if (next.all) {
      const name = next.faculty || readStoredFaculty();
      if (name) saveFaculty(name);
      setScope({ all: true, faculty: name });
      setConfigured(true);
      if (name && typeof window !== "undefined") {
        const target = keepPreview(`/?faculty=${encodeURIComponent(name)}`);
        const current = window.location.pathname + window.location.search;
        if (current !== target) window.history.replaceState(null, "", target);
      }
      return;
    }
    if (next.faculty) {
      saveFaculty(next.faculty);
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", keepPreview(`/?faculty=${encodeURIComponent(next.faculty)}`));
      }
      setScope(next);
      setConfigured(true);
    } else if (next.division) {
      saveCohort(next.division);
      const slug = cohortToSlug(next.division);
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", `/${slug}`);
      }
      setScope(next);
      setConfigured(true);
    } else if (Object.keys(next).length === 0 || (!next.division && !next.faculty && !("faculty" in next))) {
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", "/");
      }
      setConfigured(false);
      setScope({});
    } else {
      setScope(next);
    }
  }

  // When the server says a background sync is running, when that started. Polling fast stops after a few minutes.
  const refreshingSince = useRef<number | null>(null);
  // Mirrors `awaitingSync` below for the interval callback.
  const userAsked = useRef(false);

  const query = useQuery({
    queryKey: ["bootstrap", scope],
    queryFn: () => fetchBootstrap(scope),
    initialData: () => readCachedBootstrap(scope),
    placeholderData: keepPreviousData,
    // Focus or a reconnect asks again at most once a minute. An unchanged copy comes back as a 304.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
    enabled: Boolean(configured || scope.division || scope.faculty || scope.all || (scope.course && scope.batch)),
    refetchInterval: (result) => {
      if (result.state.data?.sync?.refreshing) {
        refreshingSince.current ??= Date.now();
        if (Date.now() - refreshingSince.current < REFRESH_POLL_LIMIT_MS) {
          return userAsked.current ? REFRESH_POLL_MS : BACKGROUND_SYNC_POLL_MS;
        }
      } else {
        refreshingSince.current = null;
      }
      const intervalSec = result.state.data?.sync?.intervalSeconds ?? 300;
      return Math.max(intervalSec, 300) * 1000;
    },
  });

  useEffect(() => {
    if (query.data && query.data.lectures && query.data.lectures.length > 0) {
      saveCachedBootstrap(scope, query.data);
    }
  }, [query.data, scope]);

  // Refresh only asks the server to run its sync job. The button keeps spinning until that copy arrives.
  const [awaitingSync, setAwaitingSync] = useState(false);
  const refreshing = Boolean(query.data?.sync?.refreshing);
  userAsked.current = awaitingSync;
  useEffect(() => {
    if (!awaitingSync) return;
    if (!refreshing) {
      setAwaitingSync(false);
      return;
    }
    const timer = window.setTimeout(() => setAwaitingSync(false), REFRESH_POLL_LIMIT_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingSync, refreshing]);

  const refresh = useMutation({
    mutationFn: () => refreshBootstrap(scope),
    onSuccess: (data) => {
      const waiting = Boolean(data.sync?.refreshing);
      userAsked.current = waiting;
      // A tap starts a fresh three-minute window even if the scheduler's sync was already running.
      if (waiting) refreshingSince.current = Date.now();
      setAwaitingSync(waiting);
      queryClient.setQueryData(["bootstrap", scope], data);
      saveCachedBootstrap(scope, data);
    },
    onError: (err) => {
      console.warn("Manual refresh failed, falling back to background query:", err);
      void query.refetch();
    },
  });

  // Back to the timetable's own address, so a reload stays on it.
  function leaveLegalPage() {
    const target = scope.faculty
      ? keepPreview(`/?faculty=${encodeURIComponent(scope.faculty)}`)
      : scope.division
        ? `/${cohortToSlug(scope.division)}`
        : "/";
    window.history.pushState(null, "", target);
    setRoute("/");
  }

  function renderPage(): [string, ReactNode] {
  if (route === "/privacy") {
    return ["privacy", (
      <PrivacyPolicy
        onBack={leaveLegalPage}
      />
    )];
  }

  if (route === "/terms") {
    return ["terms", (
      <TermsOfService
        onBack={leaveLegalPage}
      />
    )];
  }

  if (route === "/pitch") {
    const saved = readStoredCohort();
    return ["pitch", (
      <PitchPage
        hasSavedAccess={Boolean(saved)}
        savedLabel={saved ? cohortLabel(saved) : ""}
        onContinue={() => {
          if (!saved) return;
          saveCohort(saved);
          saveRole("student");
          window.history.pushState(null, "", `/${cohortToSlug(saved)}`);
          setScope({ division: saved });
          setConfigured(true);
          setRoute("/");
        }}
        onOpenStudent={() => {
          window.history.pushState(null, "", "/?enter=student");
          setConfigured(false);
          setScope({});
          setRoute("/");
        }}
        onOpenFaculty={() => {
          window.history.pushState(null, "", "/?enter=faculty");
          setConfigured(false);
          setScope({});
          setRoute("/");
        }}
        onOpenPage={(event, url) => {
          event.preventDefault();
          window.history.pushState(null, "", url);
          setRoute(pathRoute(url));
        }}
      />
    )];
  }

  if (route === "/admin") {
    return ["admin", (
      <AdminPage
        onHome={() => {
          window.history.pushState(null, "", "/");
          setConfigured(false);
          setScope({});
          setRoute("/");
        }}
      />
    )];
  }

  const choices = query.data?.choices && query.data.choices.length > 0 ? query.data.choices : DEFAULT_COHORT_CHOICES;

  // Check for unknown slug
  if (typeof window !== "undefined") {
    const parsed = readScopeFromUrl(choices);
    if (parsed?.isUnknownSlug) {
      return ["not-found", (
        <main className="mx-auto flex min-h-dvh flex-col items-center justify-center px-4 py-8 max-w-md text-center">
          <div className="rounded-2xl border border-border/80 bg-card/70 p-8 shadow-sm">
            <h1 className="text-2xl font-medium tracking-tight text-foreground">Timetable Not Found</h1>
            <p className="mt-2 text-sm text-muted-foreground">The timetable page you are looking for does not exist.</p>
            <button
              type="button"
              onClick={() => {
                window.history.pushState(null, "", "/");
                setConfigured(false);
                setScope({});
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-xs font-medium cursor-pointer"
            >
              <span>Go to Home</span>
            </button>
          </div>
        </main>
      )];
    }
  }

  const waitingForShortcut =
    sessionGate === "check" && !configured && !scope.division && !scope.faculty && !scope.all;
  if (waitingForShortcut) {
    return ["loading", <LoadingScreen />];
  }

  // Root or unconfigured: Show Home Page
  if (!configured || (typeof window !== "undefined" && window.location.pathname === "/" && !scope.division && !scope.faculty && !scope.all)) {
    return ["home", (
      <ColorProvider theme={preferences.theme}>
        <HomePage
          choices={DEFAULT_COHORT_CHOICES}
          theme={preferences.theme}
          onTheme={preferences.chooseTheme}
          colors={preferences.colors}
          bold={preferences.bold}
          meet={preferences.meet}
          onColors={preferences.chooseColors}
          onBold={preferences.chooseBold}
          onMeet={preferences.chooseMeet}
          onPrefetchBatch={(course, batch) => setScope({ course, batch })}
          onOpenFacultyLogin={() => setFacultyModalOpen(true)}
          onNavigateCohort={(slug) => {
            const matched = slugToCohort(slug, DEFAULT_COHORT_CHOICES);
            const targetDiv = matched?.division ?? slug;
            saveCohort(targetDiv);
            saveRole("student");
            const saved = readStudentBatch();
            const targetSlug = matched ? cohortToSlug(matched.division) : slug;
            if (typeof window !== "undefined") {
              window.history.pushState(null, "", `/${targetSlug}`);
            }
            setScope({
              division: targetDiv,
              course: matched?.course ?? saved?.course,
              batch: matched?.batch ?? saved?.batch,
            });
            setConfigured(true);
          }}
          onNavigateUrl={(url) => {
            if (url === "/privacy" || url === "/privacy-policy") {
              window.history.pushState(null, "", "/privacy");
              setRoute("/privacy");
            } else if (url === "/terms" || url === "/terms-of-service") {
              window.history.pushState(null, "", "/terms");
              setRoute("/terms");
            } else {
              window.history.pushState(null, "", url);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }
          }}
        />
        {facultyModalOpen ? (
          <Suspense fallback={null}>
            <FacultyLoginModal
              open={facultyModalOpen}
              onClose={() => setFacultyModalOpen(false)}
              onSuccess={(fac, email, allFac) => {
                const allowed = Boolean(allFac);
                const lens = signInFacultyLens(email, fac, allowed);
                saveFaculty(fac);
                saveFacultyEmail(email);
                saveRole("faculty");
                saveCanSeeAllFaculty(allowed);
                saveFacultyPreview(false);
                saveFacultyLens(lens);
                setFacultyModalOpen(false);
                const wide = allowed || Boolean(findCoordinator(email, fac));
                if (typeof window !== "undefined") {
                  window.history.pushState(null, "", keepPreview(`/?faculty=${encodeURIComponent(fac)}`));
                }
                setScope(wide ? { all: true, faculty: fac } : { faculty: fac });
                setConfigured(true);
              }}
            />
          </Suspense>
        ) : null}
      </ColorProvider>
    )];
  }

  if (query.isPending && !query.data) {
    return ["loading", <LoadingScreen />];
  }

  if (!query.data) {
    return ["unavailable", (
      <div className="mx-auto max-w-3xl px-4 py-16" role="alert">
        <h1 className="text-xl font-medium">The timetable is unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">Start the API server, then try again.</p>
        <button type="button" className="mt-4 text-sm underline underline-offset-4" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    )];
  }

  return ["timetable", (
    <ColorProvider theme={preferences.theme}>
      <Dashboard
        data={query.data}
        now={now}
        pending={refresh.isPending || awaitingSync}
        onRefresh={() => refresh.mutate()}
        theme={preferences.theme}
        colors={preferences.colors}
        bold={preferences.bold}
        meet={preferences.meet}
        onTheme={preferences.chooseTheme}
        onColors={preferences.chooseColors}
        onBold={preferences.chooseBold}
        onMeet={preferences.chooseMeet}
        onReset={handleReset}
        onScopeChange={handleScopeChange}
        scopeAll={Boolean(scope.all)}
      />
    </ColorProvider>
  )];
  }

  const [page, content] = renderPage();
  // Fade only. A transform here would make this wrapper the anchor for the fixed bottom bar and sticky header.
  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
      <m.div
        key={page}
        data-page={page}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: calmMotion ? 0 : 0.24, ease: "easeOut" } }}
        exit={{ opacity: 0, transition: { duration: calmMotion ? 0 : 0.12, ease: "easeIn" } }}
      >
        <Suspense fallback={<LoadingScreen />}>{content}</Suspense>
      </m.div>
    </AnimatePresence>
  );
}
