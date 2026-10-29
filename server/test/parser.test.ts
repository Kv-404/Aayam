import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { normalizeWorkbook } from "../src/services/timetableNormalizer.ts";
import { parseTimetableSource } from "../src/services/timetableParser.ts";

const fixture = path.join(import.meta.dirname, "../fixtures/cohort-week.xlsx");

async function loadFixture() {
  const parsed = await parseTimetableSource(fs.readFileSync(fixture), { dateOrder: "DMY" });
  return normalizeWorkbook(parsed, { courseFallback: "BTech" });
}

function find(lectures: Awaited<ReturnType<typeof loadFixture>>["lectures"], query: { division: string; date: string; start: number }) {
  return lectures.find((lecture) => lecture.division === query.division && lecture.date === query.date && lecture.startMinutes === query.start && lecture.kind !== "break");
}

describe("college workbook parser", () => {
  it("reads every day tab, cohort column, and merged cell from the real sheet", async () => {
    const { lectures, issues } = await loadFixture();
    assert.deepEqual([...new Set(lectures.map((lecture) => lecture.tabName))], [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);

    const tuesday = find(lectures, { division: "Sam Altman 2025", date: "2026-10-13", start: 600 });
    assert.equal(tuesday?.subject, "Software Engineering & Project Management");
    assert.equal(tuesday?.faculty, "Mr. Sahil Gupta");
    assert.equal(tuesday?.room, "Classroom - 39");
    assert.equal(tuesday?.semester, "3");
    assert.equal(tuesday?.course, "BTech");
    assert.match(tuesday?.batch ?? "", /2025/);

    assert.equal(find(lectures, { division: "Sam Altman 2025", date: "2026-10-13", start: 540 }), undefined);
    const early = find(lectures, { division: "Jeff Bezos 2025", date: "2026-10-13", start: 540 });
    assert.match(early?.subject ?? "", /Software Engineering/);
    assert.equal(early?.faculty, "Mr. Lokesh (VF)");

    const lunch = lectures.filter((lecture) => lecture.date === "2026-10-13" && lecture.kind === "break");
    assert.equal(lunch.length, 4);
    assert.ok(lunch.every((lecture) => lecture.subject === "Lunch break"));

    const tutorial = lectures.filter((lecture) => lecture.date === "2026-10-13" && lecture.startMinutes === 990);
    assert.equal(tutorial.length, 4);
    assert.match(tutorial[0]?.subject ?? "", /Tutorial/);

    const mondayOff = lectures.filter((lecture) => lecture.date === "2026-10-12" && lecture.kind === "off");
    assert.ok(mondayOff.length >= 16);
    assert.ok(mondayOff.every((lecture) => lecture.sourceStatus === "cancelled"));
    assert.equal(find(lectures, { division: "Demis Hassabis 2025", date: "2026-10-12", start: 600 })?.subject, "OFF");

    const shared = find(lectures, { division: "Demis Hassabis 2025", date: "2026-10-14", start: 920 });
    assert.equal(shared?.subject, "Interactive Session");
    assert.match(shared?.faculty ?? "", /Kashmira/);
    assert.equal(shared?.room, "Classroom - 38");
    assert.equal(find(lectures, { division: "Jeff Bezos 2025", date: "2026-10-14", start: 920 }), undefined);

    const friday = lectures.find((lecture) => lecture.date === "2026-10-16" && lecture.subject === "Intractive Session");
    assert.ok(friday, "the sheet's spelling is preserved");
    assert.equal(issues.filter((issue) => issue.severity === "error").length, 0);
  });
});

describe("messy and alternate tabs", () => {
  it("keeps readable lectures, reports odd rows, and ignores empty cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Tuesday");
    sheet.getCell("A1").value = "SEMESTER - 3";
    sheet.getCell("A2").value = "13/10/2026 (Tuesday)";
    sheet.getCell("A3").value = "Timing";
    sheet.getCell("B3").value = "Sam Altman 2025";
    sheet.getCell("C3").value = "Jeff Bezos 2025";
    sheet.getCell("A4").value = "10:00 AM - 11:00 AM";
    sheet.getCell("B4").value = "Data Structures and Algorithm - II";
    sheet.getCell("C4").value = "";
    sheet.getCell("A5").value = "Faculty";
    sheet.getCell("B5").value = "Dr. Aarti P";
    sheet.getCell("A6").value = "Classroom No";
    sheet.getCell("B6").value = "Classroom - 18";
    sheet.getCell("A7").value = "Bring laptops for the lab";
    sheet.getCell("A8").value = "11:10 AM - 12:10 PM";
    sheet.getCell("B8").value = "Operating Systems (Cancelled: Faculty unavailable)";
    sheet.getCell("A9").value = "Faculty";
    sheet.getCell("B9").value = "Prof. Karan";
    sheet.getCell("A10").value = "Classroom No";
    sheet.getCell("B10").value = "Room 201";

    const parsed = await parseTimetableSource(workbook, { dateOrder: "DMY" });
    const normalized = normalizeWorkbook(parsed, { courseFallback: "BTech" });
    const sam = normalized.lectures.filter((lecture) => lecture.division === "Sam Altman 2025");
    assert.equal(sam.length, 2);
    assert.equal(sam[0]?.subject, "Data Structures and Algorithm - II");
    assert.equal(sam[1]?.sourceStatus, "cancelled");
    assert.equal(sam[1]?.subject, "Operating Systems");
    assert.equal(sam[1]?.reason, "Faculty unavailable");
    assert.equal(normalized.lectures.some((lecture) => lecture.division === "Jeff Bezos 2025" && lecture.kind === "lecture"), false);
    assert.ok(normalized.issues.some((issue) => issue.snippet?.includes("Bring laptops")));
  });

  it("reads a newly added row-based division tab", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("BCA-A");
    sheet.addRow(["Subject", "Faculty", "Time", "Room", "Status", "Reason", "Division", "Date"]);
    sheet.addRow(["Java", "Prof. Amaan", "12:00 PM - 1:00 PM", "Lab 2", "SCHEDULED", "", "BCA-A", "14/10/2026"]);
    sheet.addRow(["DBMS", "Prof. Arti", "2:00 PM - 3:00 PM", "Room 12", "CANCELLED", "Faculty unavailable", "BCA-A", "14/10/2026"]);
    const parsed = await parseTimetableSource(workbook);
    const normalized = normalizeWorkbook(parsed, { courseFallback: "BTech" });
    assert.equal(normalized.lectures.length, 2);
    const java = normalized.lectures.find((lecture) => lecture.subject === "Java");
    assert.equal(java?.division, "BCA-A");
    assert.equal(java?.date, "2026-10-14");
    assert.equal(java?.weekday, "Wednesday");
    assert.equal(java?.startLabel, "12:00 PM");
    assert.equal(normalized.lectures.find((lecture) => lecture.subject === "DBMS")?.sourceStatus, "cancelled");
  });

  it("treats an empty cell with yellow background fill as a lunch break", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Monday");
    sheet.getCell("A1").value = "ITM SKILLS UNIVERSITY";
    sheet.getCell("A2").value = "SEMESTER - 5";
    sheet.getCell("A3").value = "BTECH BATCH 2024 - 28";
    sheet.getCell("A4").value = "26/10/2026 (Monday)";
    sheet.getCell("A5").value = "Timing";
    sheet.getCell("B5").value = "Mark Zuckerberg";
    sheet.getCell("A7").value = "01:00 PM - 02:00 PM";
    // Empty cell with solid yellow fill
    const yellowCell = sheet.getCell("B7");
    yellowCell.value = null;
    yellowCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
      bgColor: { argb: "FFFFFF00" },
    };
    const parsed = await parseTimetableSource(workbook, { dateOrder: "DMY" });
    const normalized = normalizeWorkbook(parsed, { courseFallback: "BTech" });
    const breakSlot = normalized.lectures.find((lecture) => lecture.division === "Mark Zuckerberg");
    assert.equal(breakSlot?.kind, "break");
    assert.equal(breakSlot?.subject, "Lunch break");
    assert.equal(breakSlot?.startMinutes, 780);
    assert.equal(breakSlot?.endMinutes, 840);
  });
});

describe("program and batch lines", () => {
  async function lectureFrom(batchLine: string) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Monday");
    sheet.getCell("A1").value = "ITM SKILLS UNIVERSITY";
    sheet.getCell("A2").value = "SEMESTER - 1";
    sheet.getCell("A3").value = batchLine;
    sheet.getCell("A4").value = "26/10/2026 (Monday)";
    sheet.getCell("A5").value = "Timing";
    sheet.getCell("B5").value = "Geoffrey Hinton";
    sheet.getCell("A7").value = "09:00 AM - 10:00 AM";
    sheet.getCell("B7").value = "Data Structures & Algorithms";
    sheet.getCell("A8").value = "Faculty";
    sheet.getCell("B8").value = "Prof. Shreya";
    sheet.getCell("A9").value = "Classroom No";
    sheet.getCell("B9").value = "Classroom No. - 38";
    const parsed = await parseTimetableSource(workbook, { dateOrder: "DMY" });
    const normalized = normalizeWorkbook(parsed, { courseFallback: "BTech" });
    return normalized.lectures.find((lecture) => lecture.kind === "lecture");
  }

  it("reads MCA and BTech from the batch line, and falls back when the line has no program", async () => {
    const mca = await lectureFrom(" MCA BATCH 2026 - 28");
    assert.equal(mca?.course, "MCA");
    assert.equal(mca?.batch, "2026-28");
    assert.equal(mca?.semester, "1");
    assert.equal(mca?.division, "Geoffrey Hinton");

    const btech = await lectureFrom("BTECH BATCH 2024 - 28");
    assert.equal(btech?.course, "BTech");
    assert.equal(btech?.batch, "2024-28");

    const plain = await lectureFrom("BATCH 2026-30");
    assert.equal(plain?.course, "BTech");
    assert.equal(plain?.batch, "2026-30");
  });
});

describe("merged time cell without explicit faculty or room labels", () => {
  it("extracts faculty from the second row and room from the third row when time cell is merged", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Tuesday");
    sheet.getCell("A1").value = "ITM SKILLS UNIVERSITY";
    sheet.getCell("A2").value = "SEMESTER - 1";
    sheet.getCell("A3").value = "BTECH BATCH 2024 - 28";
    sheet.getCell("A4").value = "27/10/2026 (Tuesday)";
    sheet.getCell("A5").value = "Timing";
    sheet.getCell("B5").value = "Mark Zuckerberg";
    sheet.mergeCells("A7:A9");
    sheet.getCell("A7").value = "12:20 PM - 01:00 PM";
    sheet.getCell("B7").value = "LLMs, RAG & Agentic AI";
    sheet.getCell("B8").value = "Mr. Dishant (VF)";
    sheet.getCell("B9").value = "Classroom No. - 39";

    const parsed = await parseTimetableSource(workbook, { dateOrder: "DMY" });
    const normalized = normalizeWorkbook(parsed, { courseFallback: "BTech" });
    const lecture = normalized.lectures.find((l) => l.kind === "lecture");
    assert.equal(lecture?.subject, "LLMs, RAG & Agentic AI");
    assert.equal(lecture?.faculty, "Mr. Dishant (VF)");
    assert.equal(lecture?.room, "Classroom No. - 39");
  });
});

