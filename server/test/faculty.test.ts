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
