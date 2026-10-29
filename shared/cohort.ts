export function cohortName(division: string) {
  const trimmed = division.trim();
  if (/^andrew(\s+ng)?$/i.test(trimmed)) return "Andrew";
  return trimmed.replace(/\s+20\d{2}\s*$/, "").trim() || trimmed;
}

/** "Steve Jobs (AI/DS)" is the AI/DS track of the shared "Steve Jobs" column. */
export function cohortTrack(division: string) {
  const match = division.match(/^(.*)\s+\(([^)]+)\)\s*$/);
  if (!match?.[1] || !match[2]) return { base: division.trim(), track: null as string | null };
  return { base: match[1].trim(), track: match[2].trim() };
}

export function cohortLabel(division: string) {
  const { base, track } = cohortTrack(division);
  const name = cohortName(base);
  return track ? `${name} · ${track}` : name;
}

export interface CohortChoice {
  division: string;
  course: string;
  batch: string;
  semester: string;
  /** Shared column for a specialization, such as "Steve Jobs" beside "Steve Jobs (AI/DS)". */
  also: string[];
}

export function cohortChoices(
  lectures: Array<{ division: string; course: string; batch: string; semester: string }>,
): CohortChoice[] {
  const groups = new Map<string, { course: string; batch: string; semester: string; divisions: Set<string> }>();
  for (const lecture of lectures) {
    if (!lecture.division) continue;
    const key = `${lecture.course}\0${lecture.batch}`;
    const group = groups.get(key) ?? { course: lecture.course, batch: lecture.batch, semester: lecture.semester, divisions: new Set<string>() };
    group.divisions.add(lecture.division);
    if (!group.semester && lecture.semester) group.semester = lecture.semester;
    groups.set(key, group);
  }

  const choices: CohortChoice[] = [];
  for (const group of groups.values()) {
    const names = [...group.divisions];
    const shared = new Set(names.filter((name) => names.some((other) => cohortTrack(other).track && cohortTrack(other).base === name)));
    for (const name of names) {
      if (shared.has(name)) continue;
      const track = cohortTrack(name);
      choices.push({
        division: name,
        course: group.course,
        batch: group.batch,
        semester: group.semester,
        also: track.track && names.includes(track.base) ? [track.base] : [],
      });
    }
  }

  return choices.sort((a, b) => {
    const course = a.course.localeCompare(b.course);
    if (course !== 0) return course;
    const year = batchYear(b.batch) - batchYear(a.batch);
    if (year !== 0) return year;
    const batch = b.batch.localeCompare(a.batch);
    if (batch !== 0) return batch;
    return cohortLabel(a.division).localeCompare(cohortLabel(b.division));
  });
}

export function cohortGroups(choices: CohortChoice[]) {
  const groups: Array<{ key: string; label: string; choices: CohortChoice[] }> = [];
  for (const choice of choices) {
    const key = `${choice.course}\0${choice.batch}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.choices.push(choice);
    else groups.push({ key, label: `${choice.course} · ${choice.batch}`, choices: [choice] });
  }
  return groups;
}

export function cohortPrograms(choices: CohortChoice[]) {
  const programs: string[] = [];
  for (const choice of choices) {
    if (!programs.includes(choice.course)) programs.push(choice.course);
  }
  return programs;
}

/** Batches of one program, newest first, with no other program mixed in. */
export function cohortYears(choices: CohortChoice[], course: string) {
  const years: string[] = [];
  for (const choice of choices) {
    if (choice.course === course && !years.includes(choice.batch)) years.push(choice.batch);
  }
  return years;
}

/** Named cohorts for one program and batch. Other years are not included. */
export function cohortsInYear(choices: CohortChoice[], course: string, batch: string) {
  return choices.filter((choice) => choice.course === course && choice.batch === batch);
}

export function lectureInCohort(
  lecture: { division: string; course: string; batch: string },
  choice: { division: string; course: string; batch: string; also?: string[] },
) {
  if (lecture.course !== choice.course || lecture.batch !== choice.batch) return false;
  if (lecture.division === choice.division) return true;
  return (choice.also ?? []).includes(lecture.division);
}

export function batchYear(batch: string) {
  const match = batch.match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}

export const DEFAULT_COHORT_CHOICES: CohortChoice[] = [
  { division: "Andrew NG", course: "BTech", batch: "2026-30", semester: "1", also: [] },
  { division: "Jerry Sanders", course: "BTech", batch: "2026-30", semester: "1", also: [] },
  { division: "Tim Cook", course: "BTech", batch: "2026-30", semester: "1", also: [] },
  { division: "Demis Hassabis 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Jeff Bezos 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Larry Page 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Sam Altman 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Elon Musk 2024", course: "BTech", batch: "2024-28", semester: "5", also: [] },
  { division: "Jensen Huang 2024", course: "BTech", batch: "2024-28", semester: "5", also: [] },
  { division: "Mark Zuckerberg", course: "BTech", batch: "2024-28", semester: "5", also: [] },
  { division: "Steve Jobs (AI/DS)", course: "BTech", batch: "2023-27", semester: "7", also: ["Steve Jobs"] },
  { division: "Steve Jobs (Cyber-Sec)", course: "BTech", batch: "2023-27", semester: "7", also: ["Steve Jobs"] },
  { division: "Geoffrey Hinton", course: "MCA", batch: "2026-28", semester: "1", also: [] },
];
