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
