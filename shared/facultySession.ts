import { findCoordinator } from "./coordinators.ts";

/** Where a saved faculty sign-in should open. Null means the public home page. */
export function scopeForSavedFaculty(input: {
  token: string;
  role: string;
  faculty: string;
  email?: string;
  canSeeAll: boolean;
}): { faculty: string; all?: boolean } | null {
  if (!input.token || input.role !== "faculty" || !input.faculty.trim()) return null;
  const wide = input.canSeeAll || Boolean(findCoordinator(input.email, input.faculty));
  return wide ? { all: true, faculty: input.faculty } : { faculty: input.faculty };
}
