import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changeMatchesFaculty, lectureMatchesFaculty, listFacultyNames } from "../../shared/faculty.ts";

describe("faculty names", () => {
  it("lists each person once and keeps the longer name", () => {
    const names = listFacultyNames(["Dr. Aarti P", "Dr. Aarti & Ms. Kashmira", "Prof. Shreya", "Prof. Shreya"]);
    assert.deepEqual(names, ["Dr. Aarti P", "Ms. Kashmira", "Prof. Shreya"]);
  });

  it("matches a shared lecture to either person, including a trailing initial", () => {
    assert.equal(lectureMatchesFaculty("Dr. Aarti & Ms. Kashmira", "Dr. Aarti P"), true);
    assert.equal(lectureMatchesFaculty("Dr. Aarti & Ms. Kashmira", "Ms. Kashmira"), true);
    assert.equal(lectureMatchesFaculty("Dr. Aarti P", "Dr. Aarti P"), true);
    assert.equal(lectureMatchesFaculty("Dr. Arti Awasthi", "Dr. Aarti P"), false);
    assert.equal(lectureMatchesFaculty("Prof. Harshal", "Prof. H"), false);
  });

  it("finds one teacher across sheets that spell the name differently", () => {
    for (const cell of ["Dr. Aarti", "Dr. Aarti P", "Dr. Aarti Pardesi", "Aarti Pardesi", "Dr. Aarti P (VF)"]) {
      assert.equal(lectureMatchesFaculty(cell, "Dr. Aarti Pardesi"), true, cell);
    }
    assert.equal(lectureMatchesFaculty("Prof. Harshal Juikar", "Prof. Harshal"), true);
    assert.equal(lectureMatchesFaculty("Mr. Rahul G (VF)", "Rahul Gupta (VF)"), true);
  });

  it("keeps different people apart", () => {
    assert.equal(lectureMatchesFaculty("Dr. Aarti Pardesi", "Dr. Aarti Kulkarni"), false);
    assert.equal(lectureMatchesFaculty("Dr. Aarti P", "Dr. Aarti K"), false);
    assert.equal(lectureMatchesFaculty("Mr. Kumar", "Ms. Kumar"), false);
    assert.equal(lectureMatchesFaculty("Prof. Shreya", "Prof. Sneha"), false);
  });

  it("lists one row per person with the longest spelling", () => {
    assert.deepEqual(listFacultyNames(["Prof. Harshal", "Prof. Harshal Juikar", "Dr. Dipanjan", "Dr. Dipanjan Biswas"]), [
      "Dr. Dipanjan Biswas",
      "Prof. Harshal Juikar",
    ]);
  });

  it("keeps a faculty change when the lecture id now belongs to someone else", () => {
    const ids = new Set(["still-theirs"]);
    assert.equal(
      changeMatchesFaculty(
        { lectureId: "moved-away", previous: { faculty: "Prof. Shreya" }, next: { faculty: "Prof. Karan" } },
        "Prof. Shreya",
        ids,
      ),
      true,
    );
    assert.equal(
      changeMatchesFaculty({ lectureId: "other", previous: { faculty: "Prof. Karan" }, next: null }, "Prof. Shreya", ids),
      false,
    );
    assert.equal(changeMatchesFaculty({ lectureId: "still-theirs", previous: null, next: null }, "Prof. Shreya", ids), true);
  });
});
