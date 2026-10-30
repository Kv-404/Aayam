import { cohortName, cohortTrack, type CohortChoice } from "./cohort.ts";
import { personMatch } from "./faculty.ts";

/** One class coordinator and the cohorts they own. Years and tracks are matched, not stored. */
export interface Coordinator {
  name: string;
  email: string;
  cohorts: string[];
}

/**
 * Class coordinators. Hardik Kadam owns Mark Zuckerberg; his college email
 * was not in the list, so he matches by name until an email is added.
 */
export const COORDINATORS: Coordinator[] = [
  { name: "Harshita Deshmukh", email: "harshitad@itm.edu", cohorts: ["Andrew NG", "Sam Altman"] },
  { name: "Kashmira Thakur", email: "kashmirat@itm.edu", cohorts: ["Jerry Sanders", "Larry Page"] },
  { name: "Vyoma Amravat", email: "avyoma@itm.edu", cohorts: ["Jeff Bezos", "Steve Jobs"] },
  { name: "Apeksha Phapale", email: "apekshap@itm.edu", cohorts: ["Tim Cook", "Elon Musk"] },
  { name: "Gaurav Deshmukh", email: "gauravd@itm.edu", cohorts: ["Demis Hassabis", "Jensen Huang"] },
  { name: "Hardik Kadam", email: "", cohorts: ["Mark Zuckerberg"] },
];

const titles = new Set(["mr", "ms", "mrs", "dr", "prof", "sir", "mam", "maam"]);

function nameWords(value: string) {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !titles.has(word));
}

/** Directory names can carry a title. Lecture matching stays in faculty.ts. */
export function coordinatorNamesMatch(a: string, b: string) {
  if (personMatch(a, b)) return true;
  const left = nameWords(a);
  const right = nameWords(b);
  if (left.length < 2 || right.length < 2) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.every((word) => longer.includes(word));
}

export function findCoordinator(email?: string, facultyName?: string) {
  const mail = email?.trim().toLowerCase();
  if (mail) {
    const byEmail = COORDINATORS.find((person) => person.email && person.email.toLowerCase() === mail);
    if (byEmail) return byEmail;
  }
  const name = facultyName?.trim();
  if (!name) return undefined;
  const lowered = name.toLowerCase();
  if (lowered === "all" || lowered === "all faculty" || lowered === "all classes") return undefined;
  return COORDINATORS.find((person) => coordinatorNamesMatch(person.name, name));
}

/** "Sam Altman" matches "Sam Altman 2025". "Steve Jobs" matches both tracks. */
export function divisionMatchesAssigned(division: string, assigned: string) {
  const key = (value: string) => cohortName(cohortTrack(value).base).toLowerCase();
  return key(division) === key(assigned);
}

export function coordinatorChoices(choices: CohortChoice[], person: Coordinator) {
  return choices.filter((choice) => person.cohorts.some((assigned) => divisionMatchesAssigned(choice.division, assigned)));
}

export interface CoordinatorPreview {
  id: string;
  name: string;
  email: string;
  canSeeAllFaculty: boolean;
}

/** Local sign-in stand-ins. Production builds never read this. */
export function coordinatorPreviews(): CoordinatorPreview[] {
  return [
    ...COORDINATORS.map((person) => ({
      id: person.name.split(" ")[0]?.toLowerCase() ?? person.name,
      name: person.name,
      email: person.email || `${person.name.split(" ")[0]?.toLowerCase()}@preview.local`,
      canSeeAllFaculty: false,
    })),
    { id: "all", name: "All faculty", email: "all-faculty@preview.local", canSeeAllFaculty: true },
  ];
}

export function coordinatorPreview(id: string) {
  const key = id.trim().toLowerCase();
  return coordinatorPreviews().find((person) => person.id === key || person.email.toLowerCase() === key);
}
