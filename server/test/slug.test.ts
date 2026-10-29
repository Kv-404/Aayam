import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_COHORT_CHOICES } from "../../shared/cohort.ts";
import { cohortToSlug, slugToCohort } from "../../shared/slug.ts";

test("cohortToSlug converts division strings to clean url slugs", () => {
  assert.equal(cohortToSlug("Larry Page 2025"), "larry-page");
  assert.equal(cohortToSlug("Demis Hassabis 2025"), "demis-hassabis");
  assert.equal(cohortToSlug("Jeff Bezos 2025"), "jeff-bezos");
  assert.equal(cohortToSlug("Sam Altman 2025"), "sam-altman");
  assert.equal(cohortToSlug("Elon Musk 2024"), "elon-musk");
  assert.equal(cohortToSlug("Jensen Huang 2024"), "jensen-huang");
  assert.equal(cohortToSlug("Mark Zuckerberg"), "mark-zuckerberg");
  assert.equal(cohortToSlug("Jerry Sanders"), "jerry-sanders");
  assert.equal(cohortToSlug("Tim Cook"), "tim-cook");
  assert.equal(cohortToSlug("Geoffrey Hinton"), "geoffrey-hinton");
});

test("cohortToSlug handles special tracks and Andrew NG", () => {
  assert.equal(cohortToSlug("Steve Jobs (AI/DS)"), "steve-jobs-ai-ds");
  assert.equal(cohortToSlug("Steve Jobs (Cyber-Sec)"), "steve-jobs-cyber-sec");
  assert.equal(cohortToSlug("Andrew NG"), "andrew");
  assert.equal(cohortToSlug("Andrew"), "andrew");
  assert.equal(cohortToSlug(""), "");
  assert.equal(cohortToSlug("   "), "");
});

test("slugToCohort maps url slug back to matching CohortChoice", () => {
  const choices = DEFAULT_COHORT_CHOICES;

  const larry = slugToCohort("larry-page", choices);
  assert.ok(larry);
  assert.equal(larry?.division, "Larry Page 2025");
  assert.equal(larry?.batch, "2025-29");

  const elon = slugToCohort("elon-musk", choices);
  assert.ok(elon);
  assert.equal(elon?.division, "Elon Musk 2024");
  assert.equal(elon?.batch, "2024-28");

  const steveAi = slugToCohort("steve-jobs-ai-ds", choices);
  assert.ok(steveAi);
  assert.equal(steveAi?.division, "Steve Jobs (AI/DS)");

  const steveCyber = slugToCohort("steve-jobs-cyber-sec", choices);
  assert.ok(steveCyber);
  assert.equal(steveCyber?.division, "Steve Jobs (Cyber-Sec)");
});

test("slugToCohort handles edge cases (slashes, case, dashes, underscores)", () => {
  const choices = DEFAULT_COHORT_CHOICES;

  assert.equal(slugToCohort("/larry-page/", choices)?.division, "Larry Page 2025");
  assert.equal(slugToCohort("/LARRY-PAGE", choices)?.division, "Larry Page 2025");
  assert.equal(slugToCohort("  larry_page  ", choices)?.division, "Larry Page 2025");
  assert.equal(slugToCohort("larry-page-2025", choices)?.division, "Larry Page 2025");

  // Andrew NG aliases
  assert.equal(slugToCohort("andrew", choices)?.division, "Andrew NG");
  assert.equal(slugToCohort("andrew-ng", choices)?.division, "Andrew NG");
  assert.equal(slugToCohort("/andrew/", choices)?.division, "Andrew NG");

  // Non-matching
  assert.equal(slugToCohort("unknown-cohort", choices), undefined);
  assert.equal(slugToCohort("", choices), undefined);
  assert.equal(slugToCohort("   ", choices), undefined);
  assert.equal(slugToCohort("larry-page", []), undefined);
});
