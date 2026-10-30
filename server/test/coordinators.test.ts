import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_COHORT_CHOICES } from "../../shared/cohort.ts";
import {
  coordinatorChoices,
  coordinatorPreview,
  divisionMatchesAssigned,
  findCoordinator,
} from "../../shared/coordinators.ts";
import { scopeForSavedFaculty } from "../../shared/facultySession.ts";

describe("class coordinators", () => {
  it("matches each coordinator to the cohorts they were given", () => {
    const expect = [
      ["harshitad@itm.edu", ["Andrew NG", "Sam Altman 2025"]],
      ["kashmirat@itm.edu", ["Jerry Sanders", "Larry Page 2025"]],
      ["avyoma@itm.edu", ["Jeff Bezos 2025", "Steve Jobs (AI/DS)", "Steve Jobs (Cyber-Sec)"]],
      ["apekshap@itm.edu", ["Tim Cook", "Elon Musk 2024"]],
      ["gauravd@itm.edu", ["Demis Hassabis 2025", "Jensen Huang 2024"]],
    ] as const;

    for (const [email, divisions] of expect) {
      const person = findCoordinator(email, "");
      assert.ok(person, email);
      const owned = coordinatorChoices(DEFAULT_COHORT_CHOICES, person).map((choice) => choice.division);
      assert.deepEqual(owned, [...divisions]);
    }
  });

  it("matches Hardik by name when the directory adds a title", () => {
    const person = findCoordinator("", "Mr. Hardik Kadam");
    assert.equal(person?.name, "Hardik Kadam");
    const owned = coordinatorChoices(DEFAULT_COHORT_CHOICES, person!).map((choice) => choice.division);
    assert.deepEqual(owned, ["Mark Zuckerberg"]);
  });

  it("does not treat another Deshmukh as Harshita", () => {
    assert.equal(findCoordinator("gauravd@itm.edu", "Harshita Deshmukh")?.name, "Gaurav Deshmukh");
    assert.equal(findCoordinator("", "Prof. Harshal"), undefined);
    assert.equal(findCoordinator("student@itm.edu", "All faculty"), undefined);
  });

  it("folds a year and a track into the assigned cohort", () => {
    assert.equal(divisionMatchesAssigned("Sam Altman 2025", "Sam Altman"), true);
    assert.equal(divisionMatchesAssigned("Steve Jobs (AI/DS)", "Steve Jobs"), true);
    assert.equal(divisionMatchesAssigned("Andrew NG", "Andrew NG"), true);
    assert.equal(divisionMatchesAssigned("Jerry Sanders", "Tim Cook"), false);
  });

  it("reopens a saved faculty sign-in instead of the public home page", () => {
    assert.deepEqual(
      scopeForSavedFaculty({ token: "signed", role: "faculty", faculty: "Prof. Amaan", canSeeAll: false }),
      { faculty: "Prof. Amaan" },
    );
    assert.deepEqual(
      scopeForSavedFaculty({
        token: "signed",
        role: "faculty",
        faculty: "Kashmira Thakur",
        email: "kashmirat@itm.edu",
        canSeeAll: false,
      }),
      { all: true, faculty: "Kashmira Thakur" },
    );
    assert.deepEqual(
      scopeForSavedFaculty({ token: "signed", role: "faculty", faculty: "Karamveer", canSeeAll: true }),
      { all: true, faculty: "Karamveer" },
    );
    assert.equal(scopeForSavedFaculty({ token: "", role: "faculty", faculty: "Prof. Amaan", canSeeAll: false }), null);
    assert.equal(scopeForSavedFaculty({ token: "signed", role: "student", faculty: "Prof. Amaan", canSeeAll: false }), null);
  });

  it("resolves a local preview id", () => {
    assert.equal(coordinatorPreview("kashmira")?.email, "kashmirat@itm.edu");
    assert.equal(coordinatorPreview("all")?.canSeeAllFaculty, true);
    assert.equal(coordinatorPreview("nobody"), undefined);
  });
});
