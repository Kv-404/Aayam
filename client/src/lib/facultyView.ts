import { cohortLabel, lectureInCohort, type CohortChoice } from "@shared/cohort";
import { coordinatorChoices, divisionMatchesAssigned, findCoordinator } from "@shared/coordinators";
import { lectureMatchesFaculty } from "@shared/faculty";
import type { PublicLecture } from "@shared/types";
import type { ScopeSection } from "@/components/FacultyScopeMenu";
import type { FacultyLens } from "@/lib/prefs";

export interface FacultyBoard {
  wide: boolean;
  label: string;
  badge: "" | "Coordinator" | "All access";
  showDivision: boolean;
  lectures: PublicLecture[];
  calendar: { division?: string; faculty?: string } | null;
  sheet?: CohortChoice;
  /** Set when the grid is one person's lectures. */
  facultyFilter: string | null;
  /** Set when the grid is one or more cohorts. Null means every change. */
  watchedDivisions: Set<string> | null;
  sections: ScopeSection[];
  activeId: string;
  signedInName: string;
}

function notBreak(lecture: PublicLecture) {
  return lecture.kind !== "break";
}

function lensId(lens: FacultyLens) {
  if (lens.kind === "cohort") return `cohort:${lens.division}`;
  if (lens.kind === "faculty") return `faculty:${lens.name}`;
  return lens.kind;
}

function activeLens(
  lens: FacultyLens | null,
  canSeeAll: boolean,
  hasCohorts: boolean,
  choices: CohortChoice[],
  mine: CohortChoice[],
): FacultyLens {
  const fallback: FacultyLens = canSeeAll ? { kind: "all" } : hasCohorts ? { kind: "cohorts" } : { kind: "self" };
  const stored = lens ?? fallback;
  if (stored.kind === "all") return canSeeAll ? stored : fallback;
  if (stored.kind === "cohorts") return hasCohorts ? stored : fallback;
  if (stored.kind === "cohort") {
    const allowed = canSeeAll ? choices : mine;
    return allowed.some((choice) => choice.division === stored.division) ? stored : fallback;
  }
  if (stored.kind === "faculty" && stored.name) return stored;
  if (stored.kind === "self" && !canSeeAll && !hasCohorts) return stored;
  return fallback;
}

function cohortItems(list: CohortChoice[]) {
  return list.map((choice) => ({
    id: `cohort:${choice.division}`,
    label: cohortLabel(choice.division),
    hint: choice.batch,
  }));
}

export function resolveFacultyView({
  lectures,
  choices,
  facultyNames,
  signedInName,
  email,
  canSeeAll,
  lens,
}: {
  lectures: PublicLecture[];
  choices: CohortChoice[];
  facultyNames: string[];
  signedInName: string;
  email?: string;
  canSeeAll: boolean;
  lens: FacultyLens | null;
}): FacultyBoard {
  const person = findCoordinator(email, signedInName);
  const wide = canSeeAll || Boolean(person);
  const signed =
    facultyNames.find(
      (name) => name === signedInName || name.toLowerCase() === signedInName.toLowerCase() || lectureMatchesFaculty(name, signedInName),
    ) ?? signedInName;
  const mine = person ? coordinatorChoices(choices, person) : [];
  const ownLectures = lectures.filter((lecture) => notBreak(lecture) && lectureMatchesFaculty(lecture.faculty, signed));

  if (!wide) {
    return {
      wide: false,
      label: signed,
      badge: "",
      showDivision: true,
      lectures: ownLectures,
      calendar: signed ? { faculty: signed } : null,
      facultyFilter: signed,
      watchedDivisions: null,
      sections: [],
      activeId: "self",
      signedInName: signed,
    };
  }

  const active = activeLens(lens, canSeeAll, mine.length > 0, choices, mine);
  const facultySection: ScopeSection = {
    title: "All faculty",
    items: facultyNames.map((name) => ({ id: `faculty:${name}`, label: name })),
  };
  const sections: ScopeSection[] = [];
  if (canSeeAll) {
    sections.push({ title: "Classes", items: [{ id: "all", label: "All classes" }] });
    const groups = new Map<string, CohortChoice[]>();
    for (const choice of choices) {
      const key = `${choice.course} · ${choice.batch}`;
      groups.set(key, [...(groups.get(key) ?? []), choice]);
    }
    for (const [title, group] of groups) {
      sections.push({ title, items: cohortItems(group) });
    }
  } else if (mine.length > 0) {
    sections.push({
      title: "Your cohorts",
      items: [{ id: "cohorts", label: "All my cohorts" }, ...cohortItems(mine)],
    });
  }
  sections.push(facultySection);

  let viewLectures = ownLectures;
  let label = signed;
  let showDivision = true;
  let calendar: FacultyBoard["calendar"] = signed ? { faculty: signed } : null;
  let sheet: CohortChoice | undefined;
  let facultyFilter: string | null = signed;
  let watchedDivisions: Set<string> | null = null;

  if (active.kind === "all") {
    viewLectures = lectures.filter(notBreak);
    label = "All classes";
    calendar = null;
    facultyFilter = null;
  } else if (active.kind === "cohorts" && person) {
    viewLectures = lectures.filter(
      (lecture) => notBreak(lecture) && person.cohorts.some((assigned) => divisionMatchesAssigned(lecture.division, assigned)),
    );
    label = "My cohorts";
    calendar = null;
    facultyFilter = null;
    watchedDivisions = new Set(mine.flatMap((choice) => [choice.division, ...choice.also]));
  } else if (active.kind === "cohort") {
    const choice = choices.find((item) => item.division === active.division);
    viewLectures = choice
      ? lectures.filter((lecture) => lectureInCohort(lecture, choice))
      : lectures.filter((lecture) => lecture.division === active.division);
    label = cohortLabel(active.division);
    showDivision = false;
    calendar = { division: active.division };
    sheet = choice;
    facultyFilter = null;
    watchedDivisions = new Set(choice ? [choice.division, ...choice.also] : [active.division]);
  } else if (active.kind === "faculty") {
    viewLectures = lectures.filter((lecture) => notBreak(lecture) && lectureMatchesFaculty(lecture.faculty, active.name));
    label = active.name;
    calendar = { faculty: active.name };
    facultyFilter = active.name;
  }

  return {
    wide: true,
    label,
    badge: canSeeAll ? "All access" : "Coordinator",
    showDivision,
    lectures: viewLectures,
    calendar,
    sheet,
    facultyFilter,
    watchedDivisions,
    sections,
    activeId: lensId(active),
    signedInName: signed,
  };
}

export function signInFacultyLens(email: string, name: string, canSeeAll: boolean): FacultyLens {
  if (canSeeAll) return { kind: "all" };
  if (findCoordinator(email, name)) return { kind: "cohorts" };
  return { kind: "self" };
}

export function lensFromScopeId(id: string): FacultyLens {
  if (id === "all") return { kind: "all" };
  if (id === "cohorts") return { kind: "cohorts" };
  if (id.startsWith("cohort:")) return { kind: "cohort", division: id.slice("cohort:".length) };
  if (id.startsWith("faculty:")) return { kind: "faculty", name: id.slice("faculty:".length) };
  return { kind: "self" };
}
