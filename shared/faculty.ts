/** Sheet cells sometimes name two people, such as "Dr. Aarti & Ms. Kashmira". */

export function facultyParts(value: string) {
  return value
    .split(/\s*(?:&|,|\/|\band\b)\s*/i)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function norm(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase();
}

/** Same person, including a trailing initial: "Dr. Aarti P" matches "Dr. Aarti". */
export function personMatch(a: string, b: string) {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const longer = left.length >= right.length ? left : right;
  const shorter = left.length >= right.length ? right : left;
  if (!shorter.includes(" ")) return false;
  if (!longer.startsWith(shorter)) return false;
  const rest = longer.slice(shorter.length).trim();
  return /^[a-z]\.?$/.test(rest);
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
