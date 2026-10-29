import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import type { AppConfig } from "../src/config.ts";
import { openDatabase, replaceLectures } from "../src/db.ts";
import type { StoredLecture } from "../src/model.ts";

const config: AppConfig = {
  spreadsheetId: "sheet-2025-29",
  spreadsheets: [
    { id: "sheet-2025-29", course: "BTech", batch: "2025-29" },
    { id: "sheet-2024-28", course: "BTech", batch: "2024-28" },
    { id: "sheet-mca", course: "MCA", batch: "2026-28" },
  ],
  spreadsheetTitle: "Test Timetable",
  collegeName: "College",
  schoolName: "School",
  courseName: "BTech",
  timezone: "Asia/Kolkata",
  dateOrder: "DMY",
  port: 0,
  syncIntervalSeconds: 60,
  highlightHours: 72,
  databasePath: ":memory:",
  clientOrigin: null,
};

function lecture(id: string, overrides: Partial<StoredLecture> = {}): StoredLecture {
  return {
    id,
    slotKey: id,
    tabName: "Monday",
    course: "BTech",
    semester: "5",
    batch: "2024-28",
    division: "Elon Musk 2024",
    date: "2026-10-26",
    weekday: "Monday",
    startMinutes: 540,
    endMinutes: 600,
    startLabel: "9:00 AM",
    endLabel: "10:00 AM",
    subject: "Networks",
    faculty: "Dr. Aarti",
    room: "Classroom - 12",
    kind: "lecture",
    sourceStatus: "scheduled",
    reason: null,
    explicitMark: null,
    recurring: false,
    anchor: {
      subject: "Networks",
      faculty: "Dr. Aarti",
      room: "Classroom - 12",
      startMinutes: 540,
      endMinutes: 600,
      startLabel: "9:00 AM",
      endLabel: "10:00 AM",
      sourceStatus: "scheduled",
      reason: "",
      kind: "lecture",
      explicitMark: null,
    },
    highlight: null,
    ...overrides,
  };
}

async function bootstrap(lectures: StoredLecture[]) {
  const db = openDatabase(":memory:");
  replaceLectures(db, lectures);
  const app = createApp(db, config, async () => ({ buffer: Buffer.from(""), spreadsheetTitle: "Test" }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/bootstrap`);
    assert.equal(response.status, 200);
    return await response.json() as { spreadsheetUrl: string; sheets: Array<{ course: string; batch: string; spreadsheetId: string; spreadsheetUrl: string }> };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("sheet links", () => {
  it("points each batch at its own workbook, including batches whose lectures dropped the spreadsheet id", async () => {
    const body = await bootstrap([
      lecture("y3", { spreadsheetId: "sheet-2024-28", course: "BTech", batch: "2024-28" }),
      lecture("y2", {
        spreadsheetId: "sheet-2025-29",
        course: "BTech",
        batch: "2025-29",
        division: "Sam Altman 2025",
        semester: "3",
      }),
      lecture("mca-unstamped", {
        course: "MCA",
        batch: "2026-28",
        division: "Geoffrey Hinton",
        semester: "1",
        spreadsheetId: undefined,
      }),
    ]);

    const byBatch = new Map(body.sheets.map((sheet) => [`${sheet.course} ${sheet.batch}`, sheet]));
    assert.equal(byBatch.get("BTech 2024-28")?.spreadsheetId, "sheet-2024-28");
    assert.equal(byBatch.get("BTech 2025-29")?.spreadsheetId, "sheet-2025-29");
    assert.equal(byBatch.get("MCA 2026-28")?.spreadsheetId, "sheet-mca");
    assert.match(byBatch.get("BTech 2024-28")?.spreadsheetUrl ?? "", /\/d\/sheet-2024-28\/edit$/);
    assert.match(body.spreadsheetUrl, /\/d\/sheet-2025-29\/edit$/);
  });
});
