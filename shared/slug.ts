import { cohortName, cohortTrack, type CohortChoice } from "./cohort.ts";

/**
 * Converts division strings (e.g. "Larry Page 2025") to URL slugs (e.g. "larry-page").
 * Supports tracks e.g. "Steve Jobs (AI/DS)" -> "steve-jobs-ai-ds", "Andrew NG" -> "andrew", etc.
 */
export function cohortToSlug(division: string): string {
  if (!division) return "";
  const trimmed = division.trim();
  if (!trimmed) return "";

  // Andrew NG canonical slug is "andrew"
  if (/^andrew(\s+ng)?$/i.test(trimmed)) {
    return "andrew";
  }

  const { base, track } = cohortTrack(trimmed);
  const cleanBase = cohortName(base);
  const raw = track ? `${cleanBase} ${track}` : cleanBase;

  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Maps a URL slug back to the matching CohortChoice.
 * Case-insensitive, handles dashes, underscores, slashes, and legacy / alias slugs.
 */
export function slugToCohort(
  slug: string,
  choices: CohortChoice[]
): CohortChoice | undefined {
  if (!slug || !choices || choices.length === 0) return undefined;

  const clean = slug
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!clean) return undefined;

  // 1. Exact canonical match
  const exact = choices.find((c) => cohortToSlug(c.division) === clean);
  if (exact) return exact;

  // 2. Andrew special aliases ("andrew" and "andrew-ng")
  if (clean === "andrew" || clean === "andrew-ng") {
    const andrew = choices.find((c) => /^andrew(\s+ng)?$/i.test(c.division.trim()));
    if (andrew) return andrew;
  }

  // 3. Match against full division name slug without stripping trailing year (e.g. "larry-page-2025")
  const fullDivisionMatch = choices.find((c) => {
    const raw = c.division
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return raw === clean;
  });
  if (fullDivisionMatch) return fullDivisionMatch;

  // 4. Base name match without track (e.g., "steve-jobs" -> matches first Steve Jobs track)
  const baseMatch = choices.find((c) => {
    const { base } = cohortTrack(c.division);
    return cohortToSlug(base) === clean;
  });
  if (baseMatch) return baseMatch;

  // 5. Match against choice.also aliases (e.g., Steve Jobs in also)
  const alsoMatch = choices.find((c) =>
    (c.also ?? []).some((alt) => {
      const altSlug = alt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return altSlug === clean || cohortToSlug(alt) === clean;
    })
  );
  if (alsoMatch) return alsoMatch;

  return undefined;
}
