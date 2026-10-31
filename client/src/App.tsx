import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_COHORT_CHOICES, type CohortChoice } from "@shared/cohort";
import { coordinatorPreview, findCoordinator } from "@shared/coordinators";
import { DEFAULT_FACULTY_NAMES } from "@shared/faculty";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/AccessDenied";
import { Dashboard } from "@/components/Dashboard";
import { FacultyLoginModal } from "@/components/FacultyLoginModal";
import { HomePage } from "@/components/HomePage";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { Setup } from "@/components/Setup";
import { TermsOfService } from "@/components/TermsOfService";
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
  isBatchUnlocked,
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

function readScopeFromUrl(choices: CohortChoice[]): {
  scope: BootstrapScope;
  role?: ViewerRole;
  matchedCohort?: CohortChoice;
  isUnknownSlug?: boolean;
} | null {
  if (typeof window === "undefined") return null;
  const p = window.location.pathname.toLowerCase();
  if (p === "/terms" || p === "/terms-of-service" || p === "/privacy" || p === "/privacy-policy") {
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
  if (p === "/terms" || p === "/terms-of-service" || p === "/privacy" || p === "/privacy-policy") {
    if (url.search) {
      window.history.replaceState(null, "", url.pathname);
    }
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
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function App() {
  const preferences = usePreferences();
  const now = useNow();
  const queryClient = useQueryClient();
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [route, setRoute] = useState(() => {
    if (typeof window === "undefined") return "/";
    const p = window.location.pathname.toLowerCase();
    if (p === "/privacy" || p === "/privacy-policy") return "/privacy";
    if (p === "/terms" || p === "/terms-of-service") return "/terms";
    return "/";
  });

  useEffect(() => {
    function handleLocation() {
      const p = window.location.pathname.toLowerCase();
      if (p === "/privacy" || p === "/privacy-policy") setRoute("/privacy");
      else if (p === "/terms" || p === "/terms-of-service") setRoute("/terms");
      else setRoute("/");
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
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      return false;
    }
    const urlScope = readScopeFromUrl(DEFAULT_COHORT_CHOICES);
    if (urlScope?.role === "faculty") return readRole() === "faculty" && Boolean(readStoredFaculty());
    if (urlScope?.role || urlScope?.matchedCohort) return true;
    return readSetup() && hasChosenRole();
  });

  const [scope, setScope] = useState<BootstrapScope>(() => {
    if (boot) return boot;
    if (returning) return returning;
    if (typeof window !== "undefined" && window.location.pathname === "/") {
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
        if (matched && isBatchUnlocked(matched.course, matched.batch)) {
          saveCohort(urlScope.scope.division);
        }
      }
      return urlScope.scope;
    }
    const role = readRole();
    if (role === "faculty") {
      const f = readStoredFaculty();
      if (!f) return {};
      const wide = readCanSeeAllFaculty() || Boolean(findCoordinator(readFacultyEmail(), f));
      return wide ? { all: true, faculty: f } : { faculty: f };
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
      const p = window.location.pathname.toLowerCase();
      if (p === "/privacy" || p === "/privacy-policy") {
        setRoute("/privacy");
        return;
      }
      if (p === "/terms" || p === "/terms-of-service") {
        setRoute("/terms");
        return;
      }
      setRoute("/");

      if (p === "/") {
        setConfigured(false);
        setScope({});
        return;
      }

      const activeChoices =
        queryClient.getQueryData<any>(["bootstrap", scope])?.choices ?? DEFAULT_COHORT_CHOICES;
      const parsed = readScopeFromUrl(activeChoices);
      if (parsed) {
        if (parsed.role === "faculty" && parsed.scope.faculty) {
          const stored = readStoredFaculty();
          if (readRole() === "faculty" && stored) {
            setScope({ faculty: stored });
            setConfigured(true);
          }
        } else if (parsed.scope.division) {
          const matched = parsed.matchedCohort ?? slugToCohort(parsed.scope.division, activeChoices);
          if (matched && isBatchUnlocked(matched.course, matched.batch)) {
            saveCohort(parsed.scope.division);
          }
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

  const query = useQuery({
    queryKey: ["bootstrap", scope],
    queryFn: () => fetchBootstrap(scope),
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: Boolean(configured || scope.division || scope.faculty || scope.all || (scope.course && scope.batch)),
    refetchInterval: (result) => (result.state.data?.sync.intervalSeconds ?? 45) * 1000,
  });

  const refresh = useMutation({
    mutationFn: () => refreshBootstrap(scope),
    onSuccess: (data) => queryClient.setQueryData(["bootstrap", scope], data),
  });

  if (route === "/privacy") {
    return (
      <PrivacyPolicy
        onBack={() => {
          window.history.pushState(null, "", "/");
          setRoute("/");
        }}
      />
    );
  }

  if (route === "/terms") {
    return (
      <TermsOfService
        onBack={() => {
          window.history.pushState(null, "", "/");
          setRoute("/");
        }}
      />
    );
  }

  const choices = query.data?.choices && query.data.choices.length > 0 ? query.data.choices : DEFAULT_COHORT_CHOICES;
  const faculties = query.data?.faculties && query.data.faculties.length > 0 ? query.data.faculties : DEFAULT_FACULTY_NAMES;

  // Check for unknown slug
  if (typeof window !== "undefined") {
    const parsed = readScopeFromUrl(choices);
    if (parsed?.isUnknownSlug) {
      return (
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
      );
    }
  }

  // Access Control verification for cohort URLs
  if (scope.division) {
    const matchedCohort =
      choices.find((c) => c.division.toLowerCase() === scope.division?.toLowerCase()) ??
      slugToCohort(scope.division, choices);

    const isFaculty = readRole() === "faculty" && Boolean(readStoredFaculty());

    if (matchedCohort && !isFaculty) {
      const allowed = isBatchUnlocked(matchedCohort.course, matchedCohort.batch);
      if (!allowed) {
        return (
          <AccessDenied
            cohort={matchedCohort}
            choices={choices}
            onUnlocked={(unlockedCohort) => {
              setScope({ division: unlockedCohort.division });
              setConfigured(true);
            }}
            onGoHome={() => {
              window.history.pushState(null, "", "/");
              setConfigured(false);
              setScope({});
            }}
            onGoToMyTimetable={(slug) => {
              const matched = slugToCohort(slug, choices);
              if (matched) {
                window.history.pushState(null, "", `/${slug}`);
                saveCohort(matched.division);
                setScope({ division: matched.division });
                setConfigured(true);
              }
            }}
          />
        );
      }
    }
  }

  const waitingForShortcut =
    sessionGate === "check" && !configured && !scope.division && !scope.faculty && !scope.all;
  if (waitingForShortcut) {
    return <LoadingScreen />;
  }

  // Root or unconfigured: Show Home Page
  if (!configured || (typeof window !== "undefined" && window.location.pathname === "/" && !scope.division && !scope.faculty && !scope.all)) {
    return (
      <ColorProvider theme={preferences.theme}>
        <HomePage
          choices={choices}
          theme={preferences.theme}
          colors={preferences.colors}
          bold={preferences.bold}
          meet={preferences.meet}
          onTheme={preferences.chooseTheme}
          onColors={preferences.chooseColors}
          onBold={preferences.chooseBold}
          onMeet={preferences.chooseMeet}
          onOpenFacultyLogin={() => setFacultyModalOpen(true)}
          onNavigateCohort={(slug) => {
            const matched = slugToCohort(slug, choices);
            const targetDiv = matched?.division ?? slug;
            saveCohort(targetDiv);
            saveRole("student");
            const targetSlug = matched ? cohortToSlug(matched.division) : slug;
            if (typeof window !== "undefined") {
              window.history.pushState(null, "", `/${targetSlug}`);
            }
            setScope({ division: targetDiv });
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
      </ColorProvider>
    );
  }

  if (query.isPending && !query.data) {
    return <LoadingScreen />;
  }

  if (!query.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16" role="alert">
        <h1 className="text-xl font-medium">The timetable is unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">Start the API server, then try again.</p>
        <button type="button" className="mt-4 text-sm underline underline-offset-4" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <ColorProvider theme={preferences.theme}>
      <Dashboard
        data={query.data}
        now={now}
        pending={refresh.isPending}
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
      />
    </ColorProvider>
  );
}
