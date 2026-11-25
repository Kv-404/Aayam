import { cohortTrack } from "../../../shared/cohort.ts";
import { changeMatchesFaculty, lectureMatchesFaculty } from "../../../shared/faculty.ts";

/** A subscription receives a notice when its course and batch agree, or the notice is for everyone. */
export function subscriptionMatches(
  sub: { course?: string | null; batch?: string | null },
  notice: { course?: string | null; batch?: string | null },
) {
  const wantCourse = notice.course?.trim().toLowerCase() ?? "";
  const wantBatch = notice.batch?.trim().toLowerCase() ?? "";
  const gotCourse = sub.course?.trim().toLowerCase() ?? "";
  const gotBatch = sub.batch?.trim().toLowerCase() ?? "";
  if (wantCourse && gotCourse !== wantCourse) return false;
  if (wantBatch && gotBatch !== wantBatch) return false;
  return true;
}

export interface AppDevice {
  token: string;
  role: string;
  course: string | null;
  batch: string | null;
  division: string | null;
  faculty: string | null;
}

export interface PushableChange {
  lectureId: string | null;
  division: string | null;
  previous: { faculty?: string } | null;
  next: { faculty?: string } | null;
}

/** A student's cohort, or the shared column it belongs to ("Steve Jobs" for "Steve Jobs (AI/DS)"). */
function sameCohort(device: string, change: string) {
  if (device === change) return true;
  return cohortTrack(device).base === change || cohortTrack(change).base === device;
}

/**
 * Who gets a timetable change on the phone. Students: their cohort. Faculty: `changeMatchesFaculty`,
 * the same rule the site uses, with `lectureFaculty` telling whose lecture the change touched.
 */
export function deviceWantsChange(device: AppDevice, change: PushableChange, lectureFaculty: Map<string, string>) {
  if (device.role === "faculty") {
    if (!device.faculty) return false;
    const owner = change.lectureId ? lectureFaculty.get(change.lectureId) : undefined;
    const ids = new Set<string>(owner && lectureMatchesFaculty(owner, device.faculty) && change.lectureId ? [change.lectureId] : []);
    return changeMatchesFaculty(change, device.faculty, ids);
  }
  return Boolean(device.division && change.division && sameCohort(device.division, change.division));
}
