/** Sheet cells sometimes name two people, such as "Dr. Aarti & Ms. Kashmira". */

export function facultyParts(value: string) {
  return value
    .split(/\s*(?:&|,|\/|\band\b)\s*/i)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const titles = new Set(["dr", "prof", "mr", "mrs", "ms", "miss", "sir"]);

/** Title and name words, without "(VF)" tags or full stops. */
function personWords(value: string) {
  const words = value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\./g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const title = titles.has(words[0] ?? "") ? words.shift()! : "";
  return { title, words };
}

/**
 * Same person across sheets, which spell names differently: "Dr. Aarti", "Dr. Aarti P", and
 * "Dr. Aarti Pardesi". The first name must be written out, and later words must agree or be an initial.
 */
export function personMatch(a: string, b: string) {
  const left = personWords(a);
  const right = personWords(b);
  if (left.words.length === 0 || right.words.length === 0) return false;
  if (left.title && right.title && left.title !== right.title) return false;
  if (left.words[0] !== right.words[0]) return false;
  for (let i = 1; i < Math.min(left.words.length, right.words.length); i++) {
    const x = left.words[i]!;
    const y = right.words[i]!;
    const initial = (x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y));
    if (x !== y && !initial) return false;
  }
  return true;
}

export function lectureMatchesFaculty(cell: string, selected: string) {
  const wanted = facultyParts(selected);
  const present = facultyParts(cell);
  if (wanted.length === 0 || present.length === 0) return false;
  return wanted.some((name) => present.some((part) => personMatch(name, part)));
}

/** One row per person. A longer form wins, so "Dr. Aarti P" replaces "Dr. Aarti". */
export function listFacultyNames(values: string[]) {
  const names: string[] = [];
  for (const part of values.flatMap((value) => facultyParts(value))) {
    const index = names.findIndex((name) => personMatch(name, part));
    if (index === -1) names.push(part);
    else if (part.length > names[index]!.length) names[index] = part;
  }
  return names.sort((a, b) => a.localeCompare(b));
}

export function changeMatchesFaculty(
  change: { lectureId: string | null; previous: { faculty?: string } | null; next: { faculty?: string } | null },
  name: string,
  lectureIds: Set<string>,
) {
  if (change.lectureId && lectureIds.has(change.lectureId)) return true;
  return [change.previous?.faculty, change.next?.faculty].some((value) => Boolean(value && lectureMatchesFaculty(value, name)));
}

export const DEFAULT_FACULTY_NAMES: string[] = [
  "Dr. Aarti P",
  "Dr. Arti Awasthi",
  "Dr. Dipanjan",
  "Mr. Dishant (VF)",
  "Mr. Hitesh Duseja",
  "Mr. Kushal (VF)",
  "Mr. Lokesh (VF)",
  "Mr. Lovesh (VF)",
  "Mr. Prashant (VF)",
  "Mr. Prashant C (VF)",
  "Mr. Sahil Gupta",
  "Mr. Sonal Sinha (VF)",
  "Mr. Suraj Sahani (VF)",
  "Mr. Vivekanand Jha",
  "Mr. Yatender Singh",
  "Mr. Zahir Mulani (VF)",
  "Ms. Shabnam (VF)",
  "Placement Team",
  "Prof. Amaan",
  "Prof. Anushree V",
  "Prof. Chandrika",
  "Prof. Harshal",
  "Prof. Karan",
  "Prof. Poonam",
  "Prof. Prasad",
  "Prof. Ricky",
  "Prof. Rohan",
  "Prof. Shreya",
  "Prof. Sneha",
  "Prof. Vinaya",
  "Rahul Gupta (VF)",
  "Sanjay Sahu (VF)",
];
