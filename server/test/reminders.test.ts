import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dueReminder, reminderText } from "../../shared/reminders.ts";

describe("lecture reminders", () => {
  const start = 10 * 60;
  const end = 11 * 60;

  it("announces ten minutes, then five, then the start, and stays quiet otherwise", () => {
    assert.equal(dueReminder(start, end, start - 11), null);
    assert.equal(dueReminder(start, end, start - 10), "10");
    assert.equal(dueReminder(start, end, start - 6), "10");
    assert.equal(dueReminder(start, end, start - 5), "5");
    assert.equal(dueReminder(start, end, start - 1), "5");
    assert.equal(dueReminder(start, end, start), "start");
    assert.equal(dueReminder(start, end, start + 1), "start");
    assert.equal(dueReminder(start, end, start + 2), null);
    assert.equal(dueReminder(start, end, end - 1), null);
    assert.equal(dueReminder(start, end, end), null);
  });

  it("does not call a finished or timeless slot started", () => {
    assert.equal(dueReminder(start, start + 1, start), "start");
    assert.equal(dueReminder(start, start, start), null);
    assert.equal(dueReminder(-1, end, start), null);
  });

  it("phrases the three notices", () => {
    assert.equal(reminderText("DSA", "10"), "DSA starting in 10 mins");
    assert.equal(reminderText("DSA", "5"), "DSA starting in 5 mins");
    assert.equal(reminderText("DSA", "start"), "DSA started");
    assert.equal(reminderText("DSA", "10", "Sam Altman"), "DSA · Sam Altman starting in 10 mins");
  });
});
