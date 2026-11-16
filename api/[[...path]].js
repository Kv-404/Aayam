"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/src/vercel.ts
var vercel_exports = {};
__export(vercel_exports, {
  default: () => vercel_default
});
module.exports = __toCommonJS(vercel_exports);
var import_functions = require("@vercel/functions");

// server/src/config.ts
function cleanSpreadsheetId(value) {
  if (!value) return "";
  const trimmed = value.trim();
  const match = trimmed.match(/\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return trimmed;
}
var COHORT_TEMPLATES = [
  {
    key: "btech-2026-30",
    course: "BTech",
    batch: "2026-30",
    divisions: ["Andrew NG", "Jerry Sanders", "Tim Cook"],
    fallbackId: "1o_sNayHt8v4WlyZUVcmPWhyjNQ6i8ONuX2zMo5czg0w",
    envKeys: [
      "SPREADSHEET_BTECH_2026_30",
      "SPREADSHEET_ID_BTECH_2026_30",
      "SPREADSHEET_URL_BTECH_2026_30",
      "SPREADSHEET_YEAR_1",
      "SPREADSHEET_ID_YEAR_1",
      "SPREADSHEET_Y1",
      "SPREADSHEET_ID_Y1"
    ]
  },
  {
    key: "btech-2025-29",
    course: "BTech",
    batch: "2025-29",
    divisions: ["Demis Hassabis 2025", "Jeff Bezos 2025", "Larry Page 2025", "Sam Altman 2025"],
    fallbackId: "1iglizdY-oldwwrpBDBy84EEYwtNhnv6mKkf9mFP8NZw",
    envKeys: [
      "SPREADSHEET_BTECH_2025_29",
      "SPREADSHEET_ID_BTECH_2025_29",
      "SPREADSHEET_URL_BTECH_2025_29",
      "SPREADSHEET_YEAR_2",
      "SPREADSHEET_ID_YEAR_2",
      "SPREADSHEET_Y2",
      "SPREADSHEET_ID_Y2"
    ]
  },
  {
    key: "btech-2024-28",
    course: "BTech",
    batch: "2024-28",
    divisions: ["Elon Musk 2024", "Jensen Huang 2024", "Mark Zuckerberg"],
    fallbackId: "1AviRCKbw1dOTh4WKnCXACr4qAgr8Nr4h6EhrRxyuBvc",
    envKeys: [
      "SPREADSHEET_BTECH_2024_28",
      "SPREADSHEET_ID_BTECH_2024_28",
      "SPREADSHEET_URL_BTECH_2024_28",
      "SPREADSHEET_YEAR_3",
      "SPREADSHEET_ID_YEAR_3",
      "SPREADSHEET_Y3",
      "SPREADSHEET_ID_Y3"
    ]
  },
  {
    key: "btech-2023-27",
    course: "BTech",
    batch: "2023-27",
    divisions: ["Steve Jobs (AI/DS)", "Steve Jobs (Cyber-Sec)", "Steve Jobs"],
    fallbackId: "1Wy0x2Gn-maOcdN3v4xFbatDzgEHZoqaVkpY9I2ui6fc",
    envKeys: [
      "SPREADSHEET_BTECH_2023_27",
      "SPREADSHEET_ID_BTECH_2023_27",
      "SPREADSHEET_URL_BTECH_2023_27",
      "SPREADSHEET_YEAR_4",
      "SPREADSHEET_ID_YEAR_4",
      "SPREADSHEET_Y4",
      "SPREADSHEET_ID_Y4"
    ]
  },
  {
    key: "mca-2026-28",
    course: "MCA",
    batch: "2026-28",
    divisions: ["Geoffrey Hinton"],
    fallbackId: "1iuT7IHBJ12mnlqwKIHZ_GgtQdV8G-TOfOKiBPIwCTb0",
    envKeys: [
      "SPREADSHEET_MCA_2026_28",
      "SPREADSHEET_ID_MCA_2026_28",
      "SPREADSHEET_URL_MCA_2026_28",
      "SPREADSHEET_MCA",
      "SPREADSHEET_ID_MCA"
    ]
  }
];
var WEEK_SHEETS = COHORT_TEMPLATES.map((tmpl) => ({
  id: tmpl.fallbackId,
  course: tmpl.course,
  batch: tmpl.batch,
  divisions: tmpl.divisions
}));
var PRIMARY_SHEET = "1iglizdY-oldwwrpBDBy84EEYwtNhnv6mKkf9mFP8NZw";
function sheetForScope(scope, sources = sheetSources()) {
  const division = scope.division?.trim().toLowerCase();
  const batch = scope.batch?.trim().toLowerCase();
  const course = scope.course?.trim().toLowerCase();
  if (division) {
    for (const source of sources) {
      if (source.divisions?.some((d) => {
        const dl = d.toLowerCase();
        return dl === division || dl.startsWith(division) || division.startsWith(dl) || dl.replace(/\s+20\d{2}$/, "") === division.replace(/\s+20\d{2}$/, "");
      })) {
        return source;
      }
    }
  }
  if (batch) {
    for (const source of sources) {
      if (source.batch && (source.batch.toLowerCase() === batch || source.batch.includes(batch))) {
        if (!course || source.course.toLowerCase() === course) return source;
      }
    }
  }
  if (course) {
    const matching = sources.filter((s) => s.course.toLowerCase() === course);
    if (matching.length === 1) return matching[0];
  }
  return void 0;
}
function parseSheetEntry(entry) {
  const trimmed = entry.trim();
  const urlMatch = trimmed.match(/(https?:\/\/[^\s:]+)/);
  if (urlMatch) {
    const id2 = cleanSpreadsheetId(urlMatch[1]);
    const remainder = trimmed.replace(urlMatch[1], "").replace(/^:/, "").trim();
    const parts2 = remainder ? remainder.split(":").map((p) => p.trim()).filter(Boolean) : [];
    let course2;
    let batch2;
    for (const part of parts2) {
      if (/\d{4}-\d{2,4}/.test(part)) batch2 = part;
      else course2 = part;
    }
    return { id: id2, course: course2, batch: batch2 };
  }
  const parts = trimmed.split(":").map((p) => p.trim()).filter(Boolean);
  const id = cleanSpreadsheetId(parts[0] ?? "");
  let course;
  let batch;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (/\d{4}-\d{2,4}/.test(part)) batch = part;
    else course = part;
  }
  return { id, course, batch };
}
function envIdForDivision(division) {
  const norm = division.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");
  const candidates = [
    `SPREADSHEET_${norm}`,
    `SPREADSHEET_ID_${norm}`,
    `SPREADSHEET_URL_${norm}`
  ];
  for (const key of candidates) {
    const val = process.env[key]?.trim();
    if (val) return cleanSpreadsheetId(val);
  }
  return void 0;
}
function sheetSources() {
  const listed = process.env.SPREADSHEET_IDS?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  if (listed.length > 0) {
    const fallback = process.env.COURSE_NAME?.trim() || "BTech";
    return listed.map((entry, index) => {
      const parsed = parseSheetEntry(entry);
      const matched = COHORT_TEMPLATES.find((t) => parsed.batch && t.batch === parsed.batch && (!parsed.course || t.course.toLowerCase() === parsed.course.toLowerCase())) || (listed.length === COHORT_TEMPLATES.length ? COHORT_TEMPLATES[index] : void 0) || COHORT_TEMPLATES.find((t) => parsed.course && t.course.toLowerCase() === parsed.course.toLowerCase());
      return {
        id: parsed.id,
        course: parsed.course || matched?.course || fallback,
        batch: parsed.batch || matched?.batch,
        divisions: matched?.divisions
      };
    }).filter((source) => source.id);
  }
  const sources = COHORT_TEMPLATES.map((tmpl) => {
    let customId;
    for (const key of tmpl.envKeys) {
      const val = process.env[key]?.trim();
      if (val) {
        customId = cleanSpreadsheetId(val);
        break;
      }
    }
    if (!customId) {
      for (const div of tmpl.divisions) {
        const val = envIdForDivision(div);
        if (val) {
          customId = val;
          break;
        }
      }
    }
    return {
      id: customId || tmpl.fallbackId,
      course: tmpl.course,
      batch: tmpl.batch,
      divisions: tmpl.divisions
    };
  });
  const single = process.env.SPREADSHEET_ID?.trim();
  if (single) {
    const cleanSingle = cleanSpreadsheetId(single);
    const anyCustomCohort = COHORT_TEMPLATES.some(
      (t) => t.envKeys.some((k) => process.env[k]?.trim()) || t.divisions.some((d) => envIdForDivision(d))
    );
    const isKnownFallback = COHORT_TEMPLATES.some((t) => t.fallbackId === cleanSingle);
    if (!anyCustomCohort && !isKnownFallback) {
      return [{ id: cleanSingle, course: process.env.COURSE_NAME?.trim() || "BTech" }];
    }
    const matched = sources.find((s) => s.id === cleanSingle || s.batch === "2025-29");
    if (matched) {
      matched.id = cleanSingle;
    }
  }
  return sources;
}
function integer(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
function getConfig() {
  const dateOrder = process.env.DATE_ORDER === "MDY" ? "MDY" : "DMY";
  const spreadsheets = sheetSources();
  return {
    // The sheet link falls back to the 2025-29 workbook. Sync reads every source.
    spreadsheets,
    spreadsheetId: process.env.SPREADSHEET_ID ? cleanSpreadsheetId(process.env.SPREADSHEET_ID) : spreadsheets.find((sheet) => sheet.batch === "2025-29")?.id ?? spreadsheets[0]?.id ?? PRIMARY_SHEET,
    spreadsheetTitle: process.env.SPREADSHEET_TITLE?.trim() || "BTech Cohort Planning weekly | 16th Nov to 21st Nov 2026",
    collegeName: process.env.COLLEGE_NAME?.trim() || "ITM Skills University",
    schoolName: process.env.SCHOOL_NAME?.trim() || "School of FutureTech, Kharghar",
    courseName: process.env.COURSE_NAME?.trim() || "BTech",
    timezone: process.env.TIMEZONE?.trim() || "Asia/Kolkata",
    dateOrder,
    port: integer(process.env.PORT, 8787, 1, 65535),
    syncIntervalSeconds: integer(process.env.SYNC_INTERVAL_SECONDS, 300, 15, 3600),
    highlightHours: integer(process.env.HIGHLIGHT_HOURS, 72, 1, 24 * 30),
    databasePath: process.env.DATABASE_PATH?.trim() || "./data/timetable.sqlite",
    clientOrigin: process.env.CLIENT_ORIGIN?.trim() || null
  };
}
function spreadsheetUrl(id) {
  const clean = cleanSpreadsheetId(id);
  return `https://docs.google.com/spreadsheets/d/${clean}/edit`;
}
function spreadsheetExportUrl(id) {
  const clean = cleanSpreadsheetId(id);
  return `https://docs.google.com/spreadsheets/d/${clean}/export?format=xlsx`;
}

// server/src/db.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_sqlite = require("node:sqlite");
function openDatabase(file) {
  if (file !== ":memory:") {
    import_node_fs.default.mkdirSync(import_node_path.default.dirname(import_node_path.default.resolve(file)), { recursive: true });
  }
  const db2 = new import_node_sqlite.DatabaseSync(file);
  db2.exec("PRAGMA journal_mode = WAL;");
  db2.exec(`
    CREATE TABLE IF NOT EXISTS lectures (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS change_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupe_key TEXT NOT NULL UNIQUE,
      detected_at TEXT NOT NULL,
      type TEXT NOT NULL,
      lecture_id TEXT,
      division TEXT,
      course TEXT,
      semester TEXT,
      tab_name TEXT,
      date TEXT,
      weekday TEXT,
      summary TEXT NOT NULL,
      previous_json TEXT,
      next_json TEXT,
      fields_json TEXT
    );

    CREATE TABLE IF NOT EXISTS week_backups (
      id TEXT PRIMARY KEY,
      course TEXT NOT NULL,
      batch TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      lectures_json TEXT NOT NULL,
      changes_json TEXT NOT NULL DEFAULT '[]',
      hydrated INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_success_at TEXT,
      last_attempt_at TEXT,
      last_error TEXT,
      bootstrapped INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT,
      tab_names_json TEXT NOT NULL DEFAULT '[]',
      parse_issues_json TEXT NOT NULL DEFAULT '[]',
      spreadsheet_title TEXT
    );
  `);
  const existing = db2.prepare("SELECT id FROM sync_state WHERE id = 1").get();
  if (!existing) {
    db2.prepare("INSERT INTO sync_state (id, bootstrapped) VALUES (1, 0)").run();
  }
  const weekColumns = db2.prepare("PRAGMA table_info(week_backups)").all();
  if (!weekColumns.some((column) => column.name === "changes_json")) {
    db2.exec("ALTER TABLE week_backups ADD COLUMN changes_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!weekColumns.some((column) => column.name === "hydrated")) {
    db2.exec("ALTER TABLE week_backups ADD COLUMN hydrated INTEGER NOT NULL DEFAULT 1");
  }
  return db2;
}
function readSyncState(db2) {
  const row = db2.prepare(`
    SELECT last_success_at, last_attempt_at, last_error, bootstrapped, content_hash,
           tab_names_json, parse_issues_json, spreadsheet_title
    FROM sync_state WHERE id = 1
  `).get();
  return {
    lastSuccessAt: row.last_success_at,
    lastAttemptAt: row.last_attempt_at,
    lastError: row.last_error,
    bootstrapped: row.bootstrapped === 1,
    contentHash: row.content_hash,
    tabNames: JSON.parse(row.tab_names_json),
    parseIssues: JSON.parse(row.parse_issues_json),
    spreadsheetTitle: row.spreadsheet_title
  };
}
function writeSyncState(db2, state) {
  db2.prepare(`
    UPDATE sync_state SET
      last_success_at = ?,
      last_attempt_at = ?,
      last_error = ?,
      bootstrapped = ?,
      content_hash = ?,
      tab_names_json = ?,
      parse_issues_json = ?,
      spreadsheet_title = ?
    WHERE id = 1
  `).run(
    state.lastSuccessAt,
    state.lastAttemptAt,
    state.lastError,
    state.bootstrapped ? 1 : 0,
    state.contentHash,
    JSON.stringify(state.tabNames),
    JSON.stringify(state.parseIssues),
    state.spreadsheetTitle
  );
}
function readWeekSummaries(db2) {
  const rows = db2.prepare(`
    SELECT id, course, batch, start_date, end_date
    FROM week_backups
    ORDER BY end_date DESC, start_date DESC
  `).all();
  return rows.map((row) => ({
    id: row.id,
    course: row.course,
    batch: row.batch,
    start: row.start_date,
    end: row.end_date
  }));
}
function readWeekBackupsByIds(db2, ids) {
  if (ids.length === 0) return [];
  const marks = ids.map(() => "?").join(", ");
  const rows = db2.prepare(`
    SELECT id, course, batch, start_date, end_date, lectures_json, changes_json
    FROM week_backups
    WHERE id IN (${marks})
  `).all(...ids);
  return rows.map((row) => ({
    id: row.id,
    course: row.course,
    batch: row.batch,
    start: row.start_date,
    end: row.end_date,
    lectures: JSON.parse(row.lectures_json),
    changes: row.changes_json ? JSON.parse(row.changes_json) : []
  }));
}
function readWeekBackups(db2) {
  const rows = db2.prepare(`
    SELECT id, course, batch, start_date, end_date, lectures_json, changes_json
    FROM week_backups
    ORDER BY end_date DESC, start_date DESC
  `).all();
  return rows.map((row) => ({
    id: row.id,
    course: row.course,
    batch: row.batch,
    start: row.start_date,
    end: row.end_date,
    lectures: JSON.parse(row.lectures_json),
    changes: row.changes_json ? JSON.parse(row.changes_json) : []
  }));
}
function readUnhydratedWeekIds(db2, ids) {
  if (ids.length === 0) return [];
  const marks = ids.map(() => "?").join(", ");
  const rows = db2.prepare(`
    SELECT id, hydrated FROM week_backups WHERE id IN (${marks})
  `).all(...ids);
  const hydratedMap = new Map(rows.map((r) => [r.id, r.hydrated !== 0]));
  return ids.filter((id) => !hydratedMap.get(id));
}
function readHydratedWeekIds(db2) {
  const rows = db2.prepare("SELECT id FROM week_backups WHERE hydrated = 1").all();
  return new Set(rows.map((r) => r.id));
}
function upsertWeekBackups(db2, weeks, hydrated = true) {
  if (weeks.length === 0) return;
  const upsert = db2.prepare(`
    INSERT INTO week_backups (id, course, batch, start_date, end_date, lectures_json, changes_json, hydrated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      course = excluded.course,
      batch = excluded.batch,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      lectures_json = excluded.lectures_json,
      changes_json = excluded.changes_json,
      hydrated = excluded.hydrated
  `);
  for (const week of weeks) {
    upsert.run(
      week.id,
      week.course,
      week.batch,
      week.start,
      week.end,
      JSON.stringify(week.lectures),
      JSON.stringify(week.changes ?? []),
      hydrated ? 1 : 0
    );
  }
}
function replaceWeekBackups(db2, weeks, unhydratedIds) {
  const priorUnhydrated = new Set(
    db2.prepare("SELECT id FROM week_backups WHERE hydrated = 0").all().map((r) => r.id)
  );
  db2.exec("DELETE FROM week_backups");
  const insert = db2.prepare(`
    INSERT INTO week_backups (id, course, batch, start_date, end_date, lectures_json, changes_json, hydrated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const week of weeks) {
    const isUnhydrated = unhydratedIds?.has(week.id) || priorUnhydrated.has(week.id) && week.lectures.length === 0;
    insert.run(
      week.id,
      week.course,
      week.batch,
      week.start,
      week.end,
      JSON.stringify(week.lectures),
      JSON.stringify(week.changes ?? []),
      isUnhydrated ? 0 : 1
    );
  }
}
function readLectures(db2) {
  const rows = db2.prepare("SELECT json FROM lectures").all();
  return rows.map((row) => JSON.parse(row.json));
}
function replaceLectures(db2, lectures) {
  db2.exec("DELETE FROM lectures");
  const insert = db2.prepare("INSERT INTO lectures (id, json) VALUES (?, ?)");
  for (const lecture of lectures) insert.run(lecture.id, JSON.stringify(lecture));
}
function insertChanges(db2, drafts) {
  const insert = db2.prepare(`
    INSERT OR IGNORE INTO change_events (
      dedupe_key, detected_at, type, lecture_id, division, course, semester, tab_name,
      date, weekday, summary, previous_json, next_json, fields_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const draft2 of drafts) {
    insert.run(
      draft2.dedupeKey,
      draft2.detectedAt,
      draft2.type,
      draft2.lectureId,
      draft2.division,
      draft2.course,
      draft2.semester,
      draft2.tabName,
      draft2.date,
      draft2.weekday,
      draft2.summary,
      draft2.previous ? JSON.stringify(draft2.previous) : null,
      draft2.next ? JSON.stringify(draft2.next) : null,
      JSON.stringify(draft2.fields)
    );
  }
}
function readAllChanges(db2) {
  const rows = db2.prepare(`
    SELECT id, dedupe_key, detected_at, type, lecture_id, division, course, semester, tab_name,
           date, weekday, summary, previous_json, next_json, fields_json
    FROM change_events
    ORDER BY id ASC
  `).all();
  return rows.map((row) => ({
    id: row.id,
    dedupeKey: row.dedupe_key,
    detectedAt: row.detected_at,
    type: row.type,
    lectureId: row.lecture_id,
    division: row.division,
    course: row.course,
    semester: row.semester,
    tabName: row.tab_name,
    date: row.date,
    weekday: row.weekday,
    summary: row.summary,
    previous: row.previous_json ? JSON.parse(row.previous_json) : null,
    next: row.next_json ? JSON.parse(row.next_json) : null,
    fields: row.fields_json ? JSON.parse(row.fields_json) : []
  }));
}
function replaceChangeRows(db2, rows) {
  const used = /* @__PURE__ */ new Set();
  let nextId = rows.reduce((highest, row) => Math.max(highest, row.id || 0), 0);
  const unique = rows.map((row) => {
    if (row.id > 0 && !used.has(row.id)) {
      used.add(row.id);
      return row;
    }
    nextId += 1;
    used.add(nextId);
    return { ...row, id: nextId };
  });
  db2.exec("DELETE FROM change_events");
  const insert = db2.prepare(`
    INSERT INTO change_events (
      id, dedupe_key, detected_at, type, lecture_id, division, course, semester, tab_name,
      date, weekday, summary, previous_json, next_json, fields_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of unique) {
    insert.run(
      row.id,
      row.dedupeKey,
      row.detectedAt,
      row.type,
      row.lectureId,
      row.division,
      row.course,
      row.semester,
      row.tabName,
      row.date,
      row.weekday,
      row.summary,
      row.previous ? JSON.stringify(row.previous) : null,
      row.next ? JSON.stringify(row.next) : null,
      JSON.stringify(row.fields)
    );
  }
  const max = unique.reduce((highest, row) => Math.max(highest, row.id), 0);
  const updated = db2.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'change_events'").run(max);
  if (updated.changes === 0 && max > 0) {
    db2.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('change_events', ?)").run(max);
  }
}
function readChanges(db2, limit = 50) {
  const rows = db2.prepare(`
    SELECT id, detected_at, type, lecture_id, division, course, semester, tab_name,
           date, weekday, summary, previous_json, next_json, fields_json
    FROM change_events
    ORDER BY detected_at DESC, id DESC
    LIMIT ?
  `).all(limit);
  return rows.map((row) => ({
    id: row.id,
    detectedAt: row.detected_at,
    type: row.type,
    lectureId: row.lecture_id,
    division: row.division,
    course: row.course,
    semester: row.semester,
    tabName: row.tab_name,
    date: row.date,
    weekday: row.weekday,
    summary: row.summary,
    previous: row.previous_json ? JSON.parse(row.previous_json) : null,
    next: row.next_json ? JSON.parse(row.next_json) : null,
    fields: row.fields_json ? JSON.parse(row.fields_json) : []
  }));
}

// server/src/env.ts
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
var import_node_url = require("node:url");
var import_meta = {};
function applyEnvFile(file) {
  if (!import_node_fs2.default.existsSync(file)) return;
  const text3 = import_node_fs2.default.readFileSync(file, "utf8");
  for (const line of text3.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === void 0) process.env[key] = value;
  }
}
function loadEnvFiles() {
  if (!import_meta.url) return;
  const here = import_node_path2.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url));
  applyEnvFile(import_node_path2.default.resolve(here, "../../.env"));
  applyEnvFile(import_node_path2.default.resolve(here, "../../.env.local"));
  applyEnvFile(import_node_path2.default.resolve(here, "../.env"));
}

// server/src/app.ts
var import_node_crypto8 = __toESM(require("node:crypto"), 1);
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var import_node_url2 = require("node:url");
var import_cors = __toESM(require("cors"), 1);
var import_express3 = __toESM(require("express"), 1);

// shared/cohort.ts
function cohortName(division) {
  const trimmed = division.trim();
  if (/^andrew(\s+ng)?$/i.test(trimmed)) return "Andrew";
  return trimmed.replace(/\s+20\d{2}\s*$/, "").trim() || trimmed;
}
function cohortTrack(division) {
  const match = division.match(/^(.*)\s+\(([^)]+)\)\s*$/);
  if (!match?.[1] || !match[2]) return { base: division.trim(), track: null };
  return { base: match[1].trim(), track: match[2].trim() };
}
function cohortLabel(division) {
  const { base, track } = cohortTrack(division);
  const name = cohortName(base);
  return track ? `${name} \xB7 ${track}` : name;
}
function cohortChoices(lectures) {
  const groups = /* @__PURE__ */ new Map();
  for (const lecture of lectures) {
    if (!lecture.division) continue;
    const key = `${lecture.course}\0${lecture.batch}`;
    const group = groups.get(key) ?? { course: lecture.course, batch: lecture.batch, semester: lecture.semester, divisions: /* @__PURE__ */ new Set() };
    group.divisions.add(lecture.division);
    if (!group.semester && lecture.semester) group.semester = lecture.semester;
    groups.set(key, group);
  }
  const choices = [];
  for (const group of groups.values()) {
    const names = [...group.divisions];
    const shared = new Set(names.filter((name) => names.some((other) => cohortTrack(other).track && cohortTrack(other).base === name)));
    for (const name of names) {
      if (shared.has(name)) continue;
      const track = cohortTrack(name);
      choices.push({
        division: name,
        course: group.course,
        batch: group.batch,
        semester: group.semester,
        also: track.track && names.includes(track.base) ? [track.base] : []
      });
    }
  }
  return choices.sort((a, b) => {
    const course = a.course.localeCompare(b.course);
    if (course !== 0) return course;
    const year = batchYear(b.batch) - batchYear(a.batch);
    if (year !== 0) return year;
    const batch = b.batch.localeCompare(a.batch);
    if (batch !== 0) return batch;
    return cohortLabel(a.division).localeCompare(cohortLabel(b.division));
  });
}
function lectureInCohort(lecture, choice) {
  if (lecture.course !== choice.course || lecture.batch !== choice.batch) return false;
  if (lecture.division === choice.division) return true;
  return (choice.also ?? []).includes(lecture.division);
}
function batchYear(batch) {
  const match = batch.match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}
var DEFAULT_COHORT_CHOICES = [
  { division: "Andrew NG", course: "BTech", batch: "2026-30", semester: "1", also: [] },
  { division: "Jerry Sanders", course: "BTech", batch: "2026-30", semester: "1", also: [] },
  { division: "Tim Cook", course: "BTech", batch: "2026-30", semester: "1", also: [] },
  { division: "Demis Hassabis 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Jeff Bezos 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Larry Page 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Sam Altman 2025", course: "BTech", batch: "2025-29", semester: "3", also: [] },
  { division: "Elon Musk 2024", course: "BTech", batch: "2024-28", semester: "5", also: [] },
  { division: "Jensen Huang 2024", course: "BTech", batch: "2024-28", semester: "5", also: [] },
  { division: "Mark Zuckerberg", course: "BTech", batch: "2024-28", semester: "5", also: [] },
  { division: "Steve Jobs (AI/DS)", course: "BTech", batch: "2023-27", semester: "7", also: ["Steve Jobs"] },
  { division: "Steve Jobs (Cyber-Sec)", course: "BTech", batch: "2023-27", semester: "7", also: ["Steve Jobs"] },
  { division: "Geoffrey Hinton", course: "MCA", batch: "2026-28", semester: "1", also: [] }
];

// shared/calendar.ts
function calendarFile(lectures, timeZone, calendarName = "Timetable", options) {
  const events = collapseFullOffDays(lectures).filter((lecture) => lecture.date && lecture.kind !== "break");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(calendarName)}`,
    `X-WR-TIMEZONE:${icsText(timeZone)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H"
  ];
  const stamp2 = formatUtc(/* @__PURE__ */ new Date());
  for (const lecture of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsText(lecture.id)}@timetable`,
      `DTSTAMP:${stamp2}`,
      `DTSTART:${googleStamp(lecture.date, lecture.startMinutes, timeZone)}`,
      `DTEND:${googleStamp(lecture.date, lecture.endMinutes, timeZone)}`,
      `SUMMARY:${icsText(options?.includeCohort ? `${eventTitle(lecture)} \xB7 ${cohortName(lecture.division)}` : eventTitle(lecture))}`,
      `DESCRIPTION:${icsText(eventDetails(lecture))}`,
      `STATUS:${lecture.displayStatus === "cancelled" ? "CANCELLED" : "CONFIRMED"}`
    );
    if (lecture.room) lines.push(`LOCATION:${icsText(lecture.room)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
function eventTitle(lecture) {
  const name = cohortName(lecture.division);
  if (lecture.subject === "OFF" || lecture.kind === "off") return `OFF \u2014 ${name}`;
  if (lecture.displayStatus === "cancelled") return `Cancelled: ${lecture.subject}`;
  return lecture.subject;
}
function eventDetails(lecture) {
  return [cohortName(lecture.division), lecture.faculty ? `Faculty: ${lecture.faculty}` : "", lecture.reason ? `Reason: ${lecture.reason}` : "", lecture.changeSummary ?? ""].filter(Boolean).join("\n");
}
function collapseFullOffDays(lectures) {
  const collapsed = lectures.filter((lecture) => lecture.kind === "break");
  const groups = /* @__PURE__ */ new Map();
  for (const lecture of lectures) {
    if (lecture.kind === "break") continue;
    const key = `${lecture.date ?? lecture.weekday}|${lecture.division}`;
    const list = groups.get(key) ?? [];
    list.push(lecture);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    const slots = group.filter((lecture) => lecture.kind !== "break");
    const fullOff = slots.length > 0 && slots.every((lecture) => lecture.subject === "OFF" && lecture.displayStatus === "cancelled");
    if (!fullOff) {
      collapsed.push(...group);
      continue;
    }
    const ordered = [...group].sort((a, b) => a.startMinutes - b.startMinutes);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    collapsed.push({
      ...first,
      id: `${first.division}-${first.date ?? first.weekday}-off`,
      endMinutes: last.endMinutes,
      endLabel: last.endLabel,
      reason: "The official timetable marks this whole day OFF."
    });
  }
  return collapsed;
}
function googleStamp(dateIso, minutes, timeZone) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const guess = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour, minute);
  const utc = guess - offsetMinutes(new Date(guess), timeZone) * 6e4;
  const refined = guess - offsetMinutes(new Date(utc), timeZone) * 6e4;
  return formatUtc(new Date(refined));
}
function offsetMinutes(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(instant);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
  return Math.round((asUtc - instant.getTime()) / 6e4);
}
function formatUtc(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
}
function icsText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// shared/faculty.ts
function facultyParts(value) {
  return value.split(/\s*(?:&|,|\/|\band\b)\s*/i).map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
}
var titles = /* @__PURE__ */ new Set(["dr", "prof", "mr", "mrs", "ms", "miss", "sir"]);
function personWords(value) {
  const words = value.toLowerCase().replace(/\(.*?\)/g, " ").replace(/\./g, " ").split(/\s+/).filter(Boolean);
  const title = titles.has(words[0] ?? "") ? words.shift() : "";
  return { title, words };
}
function personMatch(a, b) {
  const left = personWords(a);
  const right = personWords(b);
  if (left.words.length === 0 || right.words.length === 0) return false;
  if (left.title && right.title && left.title !== right.title) return false;
  if (left.words[0] !== right.words[0]) return false;
  for (let i = 1; i < Math.min(left.words.length, right.words.length); i++) {
    const x = left.words[i];
    const y = right.words[i];
    const initial = x.length === 1 && y.startsWith(x) || y.length === 1 && x.startsWith(y);
    if (x !== y && !initial) return false;
  }
  return true;
}
function lectureMatchesFaculty(cell, selected) {
  const wanted = facultyParts(selected);
  const present = facultyParts(cell);
  if (wanted.length === 0 || present.length === 0) return false;
  return wanted.some((name) => present.some((part) => personMatch(name, part)));
}
function listFacultyNames(values) {
  const names = [];
  for (const part of values.flatMap((value) => facultyParts(value))) {
    const index = names.findIndex((name) => personMatch(name, part));
    if (index === -1) names.push(part);
    else if (part.length > names[index].length) names[index] = part;
  }
  return names.sort((a, b) => a.localeCompare(b));
}
function changeMatchesFaculty(change, name, lectureIds) {
  if (change.lectureId && lectureIds.has(change.lectureId)) return true;
  return [change.previous?.faculty, change.next?.faculty].some((value) => Boolean(value && lectureMatchesFaculty(value, name)));
}
var DEFAULT_FACULTY_NAMES = [
  "Dr. Aarti P",
  "Dr. Arti Awasthi",
  "Dr. Dipanjan",
  "Mr. Dishant (VF)",
  "Mr. Hitesh Duseja",
  "Mr. Kushal (VF)",
  "Mr. Lokesh (VF)",
  "Mr. Lovesh (VF)",
  "Mr. Prashant (VF)",
  "Mr. Prashant C (VF)",
  "Mr. Sahil Gupta",
  "Mr. Sonal Sinha (VF)",
  "Mr. Suraj Sahani (VF)",
  "Mr. Vivekanand Jha",
  "Mr. Yatender Singh",
  "Mr. Zahir Mulani (VF)",
  "Ms. Shabnam (VF)",
  "Placement Team",
  "Prof. Amaan",
  "Prof. Anushree V",
  "Prof. Chandrika",
  "Prof. Harshal",
  "Prof. Karan",
  "Prof. Poonam",
  "Prof. Prasad",
  "Prof. Ricky",
  "Prof. Rohan",
  "Prof. Shreya",
  "Prof. Sneha",
  "Prof. Vinaya",
  "Rahul Gupta (VF)",
  "Sanjay Sahu (VF)"
];

// server/src/auth.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);

// server/src/services/postgres.ts
var import_postgres = __toESM(require("postgres"), 1);
var client = null;
var clientUrl = "";
function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}
function getSql() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not configured.");
  if (!client || clientUrl !== url) {
    const previous = client;
    client = (0, import_postgres.default)(url, {
      ssl: "require",
      max: process.env.VERCEL ? 1 : 4,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 20,
      onnotice: (notice) => {
        if (notice.code === "42P07") return;
        console.log(notice.message);
      }
    });
    clientUrl = url;
    if (previous) void previous.end({ timeout: 1 });
  }
  return client;
}
var lastCheck = null;
var inflightCheck = null;
async function checkDatabaseConnection(options = {}) {
  const { force = false, timeoutMs = 3e3 } = options;
  const now = Date.now();
  if (!force && lastCheck && now - lastCheck.checkedAt < 3e3) {
    return lastCheck.status;
  }
  if (!force && inflightCheck) {
    return inflightCheck;
  }
  const runCheck = async () => {
    const url = databaseUrl();
    if (!url) {
      return { connected: false, error: "DATABASE_URL is not configured." };
    }
    const start = performance.now();
    let timer;
    try {
      const sql = getSql();
      const queryPromise = sql`SELECT 1 as alive`;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database check timed out")), timeoutMs);
        timer.unref?.();
      });
      await Promise.race([queryPromise, timeoutPromise]);
      const latencyMs = Math.round(performance.now() - start);
      return { connected: true, latencyMs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        connected: false,
        error: message || "Database connection failed"
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  inflightCheck = runCheck();
  try {
    const status = await inflightCheck;
    lastCheck = { status, checkedAt: Date.now() };
    return status;
  } finally {
    inflightCheck = null;
  }
}

// server/src/services/redis.ts
var import_node_zlib = require("node:zlib");
var import_redis = require("@upstash/redis");
var import_ioredis = __toESM(require("ioredis"), 1);
var GZ_PREFIX = "gz:";
var DEFAULT_COMPRESS_BYTES = 4096;
function redisPrefix() {
  const raw = (process.env.REDIS_PREFIX || "tt:v2:").trim();
  return raw.endsWith(":") ? raw : `${raw}:`;
}
function prefixed(key) {
  const prefix = redisPrefix();
  return key.startsWith(prefix) ? key : `${prefix}${key}`;
}
function encodeJson(value, compressAboveBytes) {
  const json2 = JSON.stringify(value);
  if (Buffer.byteLength(json2, "utf8") >= compressAboveBytes) {
    const gz = (0, import_node_zlib.gzipSync)(Buffer.from(json2, "utf8"), { level: 6 }).toString("base64");
    return `${GZ_PREFIX}${gz}`;
  }
  return json2;
}
function decodeJson(raw) {
  if (!raw) return null;
  try {
    if (raw.startsWith(GZ_PREFIX)) {
      const buf = (0, import_node_zlib.gunzipSync)(Buffer.from(raw.slice(GZ_PREFIX.length), "base64"));
      return JSON.parse(buf.toString("utf8"));
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
var MemoryRedisStore = class {
  mode = "memory";
  isShared;
  map = /* @__PURE__ */ new Map();
  maxKeys;
  constructor(maxKeys = 1e4, isShared = false) {
    this.maxKeys = maxKeys;
    this.isShared = isShared;
  }
  readEntry(fullKey) {
    const entry = this.map.get(fullKey);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.map.delete(fullKey);
      return null;
    }
    return entry;
  }
  prune() {
    if (this.map.size <= this.maxKeys) return;
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expiresAt !== null && now >= entry.expiresAt) this.map.delete(key);
    }
    while (this.map.size > this.maxKeys) {
      const oldest = this.map.keys().next().value;
      if (!oldest) break;
      this.map.delete(oldest);
    }
  }
  async get(key) {
    return this.readEntry(prefixed(key))?.value ?? null;
  }
  async set(key, value, ttlSeconds) {
    const fullKey = prefixed(key);
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1e3 : null;
    this.map.set(fullKey, { value, expiresAt });
    this.prune();
  }
  async setNx(key, value, ttlSeconds) {
    const fullKey = prefixed(key);
    if (this.readEntry(fullKey)) return false;
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1e3 : null;
    this.map.set(fullKey, { value, expiresAt });
    this.prune();
    return true;
  }
  async del(...keys) {
    let removed = 0;
    for (const key of keys) {
      if (this.map.delete(prefixed(key))) removed += 1;
    }
    return removed;
  }
  async incrWindow(key, windowSeconds) {
    const fullKey = prefixed(key);
    const now = Date.now();
    const existing = this.readEntry(fullKey);
    if (!existing) {
      const expiresAt2 = now + Math.max(1, windowSeconds) * 1e3;
      this.map.set(fullKey, { value: "1", expiresAt: expiresAt2 });
      this.prune();
      return { count: 1, ttlSeconds: Math.max(1, windowSeconds) };
    }
    const nextCount = (Number.parseInt(existing.value, 10) || 0) + 1;
    const expiresAt = existing.expiresAt ?? now + Math.max(1, windowSeconds) * 1e3;
    this.map.set(fullKey, { value: String(nextCount), expiresAt });
    return {
      count: nextCount,
      ttlSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1e3))
    };
  }
  async getJson(key) {
    return decodeJson(await this.get(key));
  }
  async setJson(key, value, ttlSeconds, compressAboveBytes = DEFAULT_COMPRESS_BYTES) {
    await this.set(key, encodeJson(value, compressAboveBytes), ttlSeconds);
  }
  async close() {
    this.map.clear();
  }
};
var UpstashRedisStore = class {
  mode = "upstash-rest";
  isShared = true;
  client;
  constructor(url, token) {
    this.client = new import_redis.Redis({
      url,
      token,
      automaticDeserialization: false
    });
  }
  async get(key) {
    const value = await this.client.get(prefixed(key));
    return typeof value === "string" ? value : value == null ? null : String(value);
  }
  async set(key, value, ttlSeconds) {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(prefixed(key), value, { ex: Math.ceil(ttlSeconds) });
      return;
    }
    await this.client.set(prefixed(key), value);
  }
  async setNx(key, value, ttlSeconds) {
    const res = await this.client.set(prefixed(key), value, {
      nx: true,
      ex: Math.max(1, Math.ceil(ttlSeconds))
    });
    return res === "OK";
  }
  async del(...keys) {
    if (keys.length === 0) return 0;
    return await this.client.del(...keys.map(prefixed));
  }
  async incrWindow(key, windowSeconds) {
    const fullKey = prefixed(key);
    const window = Math.max(1, Math.ceil(windowSeconds));
    const count = await this.client.incr(fullKey);
    let ttl = await this.client.ttl(fullKey);
    if (count === 1 || ttl < 0) {
      await this.client.expire(fullKey, window);
      ttl = window;
    }
    return { count, ttlSeconds: Math.max(1, ttl) };
  }
  async getJson(key) {
    return decodeJson(await this.get(key));
  }
  async setJson(key, value, ttlSeconds, compressAboveBytes = DEFAULT_COMPRESS_BYTES) {
    await this.set(key, encodeJson(value, compressAboveBytes), ttlSeconds);
  }
  async close() {
  }
};
var IoRedisStore = class {
  mode = "ioredis";
  isShared = true;
  client;
  constructor(url) {
    this.client = new import_ioredis.default(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      connectTimeout: 3e3
    });
    this.client.on("error", (err) => {
      console.error("[redis] ioredis error:", err.message);
    });
  }
  async get(key) {
    return await this.client.get(prefixed(key));
  }
  async set(key, value, ttlSeconds) {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(prefixed(key), value, "EX", Math.ceil(ttlSeconds));
      return;
    }
    await this.client.set(prefixed(key), value);
  }
  async setNx(key, value, ttlSeconds) {
    const res = await this.client.set(prefixed(key), value, "EX", Math.max(1, Math.ceil(ttlSeconds)), "NX");
    return res === "OK";
  }
  async del(...keys) {
    if (keys.length === 0) return 0;
    return await this.client.del(...keys.map(prefixed));
  }
  async incrWindow(key, windowSeconds) {
    const fullKey = prefixed(key);
    const window = Math.max(1, Math.ceil(windowSeconds));
    const count = await this.client.incr(fullKey);
    let ttl = await this.client.ttl(fullKey);
    if (count === 1 || ttl < 0) {
      await this.client.expire(fullKey, window);
      ttl = window;
    }
    return { count, ttlSeconds: Math.max(1, ttl) };
  }
  async getJson(key) {
    return decodeJson(await this.get(key));
  }
  async setJson(key, value, ttlSeconds, compressAboveBytes = DEFAULT_COMPRESS_BYTES) {
    await this.set(key, encodeJson(value, compressAboveBytes), ttlSeconds);
  }
  async close() {
    await this.client.quit().catch(() => {
      this.client.disconnect();
    });
  }
};
var cachedStore = null;
var cachedSignature = "";
var testOverrideStore = null;
function envRedisSignature() {
  const restUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim();
  const restToken = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim();
  if (restUrl && restToken) {
    return { mode: "upstash-rest", sig: `rest:${restUrl}:${restToken.slice(-8)}`, restUrl, restToken };
  }
  const tcpUrl = (process.env.REDIS_URL || process.env.KV_URL || "").trim();
  if (tcpUrl) {
    return { mode: "ioredis", sig: `tcp:${tcpUrl}`, tcpUrl };
  }
  return { mode: "memory", sig: "memory" };
}
function getRedis() {
  if (testOverrideStore) return testOverrideStore;
  const spec = envRedisSignature();
  if (cachedStore && cachedSignature === spec.sig) {
    return cachedStore;
  }
  if (cachedStore) {
    void cachedStore.close();
  }
  if (spec.mode === "upstash-rest" && spec.restUrl && spec.restToken) {
    cachedStore = new UpstashRedisStore(spec.restUrl, spec.restToken);
  } else if (spec.mode === "ioredis" && spec.tcpUrl) {
    cachedStore = new IoRedisStore(spec.tcpUrl);
  } else {
    cachedStore = new MemoryRedisStore();
  }
  cachedSignature = spec.sig;
  return cachedStore;
}

// server/src/auth.ts
var COOKIE_NAME = "timetable_faculty_session";
var DEV_AUTH_SECRET = "timetable-insecure-dev-secret-replace-in-production";
function isProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}
function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim() || "";
  if (secret.length >= 32) return secret;
  if (isProduction()) return null;
  return DEV_AUTH_SECRET;
}
function getDatabaseUrl() {
  return databaseUrl();
}
function getAllowedDomains() {
  const raw = `${process.env.ALLOWED_EMAIL_DOMAINS || ""} ${process.env.ALLOWED_EMAIL_DOMAIN || ""} itm.edu isu.ac.in`;
  const set = /* @__PURE__ */ new Set();
  for (const part of raw.split(/[,\s]+/)) {
    const clean = part.toLowerCase().trim().replace(/^@/, "");
    if (clean) set.add(clean);
  }
  return [...set];
}
function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
}
function getGoogleClientSecret() {
  return (process.env.GOOGLE_CLIENT_SECRET || "").trim();
}
function signSession(payload, expiresInDays = 7) {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }
  const fullPayload = {
    ...payload,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1e3
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = import_node_crypto.default.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}
function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const secret = getAuthSecret();
  if (!secret) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expectedSignature = import_node_crypto.default.createHmac("sha256", secret).update(data).digest("base64url");
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !import_node_crypto.default.timingSafeEqual(actual, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const item of cookieHeader.split(";")) {
    const parts = item.trim().split("=");
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  }
  return cookies;
}
function bearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== "string") return "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? "";
}
function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[COOKIE_NAME];
  if (cookieToken) {
    const session = verifySession(cookieToken);
    if (session) return session;
  }
  const headerToken = bearerToken(req);
  if (!headerToken) return null;
  return verifySession(headerToken);
}
async function verifyGoogleCredential(credential) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Invalid Google token or token expired.");
  }
  const data = await response.json();
  const email = (typeof data.email === "string" ? data.email : "").toLowerCase().trim();
  const emailVerified = data.email_verified === "true" || data.email_verified === true;
  const name = typeof data.name === "string" ? data.name : "";
  const aud = typeof data.aud === "string" ? data.aud : "";
  if (!email || !emailVerified) {
    throw new Error("Google account email is not verified.");
  }
  const expectedClientId = getGoogleClientId();
  if (!expectedClientId) {
    if (isProduction()) throw new Error("Google sign-in is not configured.");
  } else if (aud !== expectedClientId) {
    throw new Error("Google token was not issued for this application.");
  }
  const issuer = typeof data.iss === "string" ? data.iss : "";
  if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") {
    throw new Error("Google token issuer was not accepted.");
  }
  const allowedDomains = getAllowedDomains();
  const domainMatches = allowedDomains.some((d) => email.endsWith(`@${d}`));
  if (!domainMatches) {
    throw new Error(`Only accounts from [${allowedDomains.join(", ")}] are allowed.`);
  }
  return { email, name };
}
function sha256Hex(value) {
  return import_node_crypto.default.createHash("sha256").update(value).digest("hex");
}
async function lookupFacultyByEmail(email, options) {
  const normalizedEmail = email.toLowerCase().trim();
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const redis = getRedis();
  const cacheKey = `auth:faculty:${sha256Hex(normalizedEmail)}`;
  let faculty = null;
  try {
    const cached = await redis.getJson(cacheKey);
    if (cached) {
      if (!cached.found) {
        throw new Error(`The account ${email} is not registered in the authorized faculty directory.`);
      }
      if (cached.id && cached.email && cached.faculty_name) {
        faculty = {
          id: cached.id,
          email: cached.email,
          faculty_name: cached.faculty_name,
          can_see_all_faculty: Boolean(cached.can_see_all_faculty),
          is_active: Boolean(cached.is_active)
        };
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("not registered in the authorized faculty directory")) {
      throw err;
    }
  }
  if (!faculty) {
    let rows;
    try {
      const sql = getSql();
      rows = await sql`
        SELECT id, email, faculty_name, can_see_all_faculty, is_active
        FROM faculty_directory
        WHERE LOWER(email) = ${normalizedEmail} AND is_active = true
        LIMIT 1
      `;
    } catch (err) {
      console.error("[auth] Faculty lookup error:", err);
      throw new Error("Faculty directory service is temporarily unavailable.");
    }
    if (!rows || rows.length === 0) {
      try {
        await redis.setJson(cacheKey, { found: false }, 60);
      } catch {
      }
      throw new Error(`The account ${email} is not registered in the authorized faculty directory.`);
    }
    const row = rows[0];
    faculty = {
      id: Number(row.id),
      email: String(row.email),
      faculty_name: String(row.faculty_name),
      can_see_all_faculty: Boolean(row.can_see_all_faculty),
      is_active: Boolean(row.is_active)
    };
    try {
      await redis.setJson(cacheKey, { found: true, ...faculty }, 600);
    } catch {
    }
  }
  if (options?.touchLastLogin !== false) {
    try {
      const shouldTouch = await redis.setNx(`auth:login-touch:${faculty.id}`, "1", 3600);
      if (shouldTouch) {
        const sql = getSql();
        await sql`UPDATE faculty_directory SET last_login_at = NOW() WHERE id = ${faculty.id}`;
      }
    } catch (err) {
      console.error("Failed to update last_login_at:", err);
    }
  }
  return {
    id: faculty.id,
    email: faculty.email,
    faculty_name: faculty.faculty_name,
    can_see_all_faculty: Boolean(faculty.can_see_all_faculty)
  };
}
async function authenticateFacultyWithNeon(email) {
  return lookupFacultyByEmail(email, { touchLastLogin: true });
}
async function listFacultyDirectoryWithCache() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) return [];
  const redis = getRedis();
  const cacheKey = "auth:faculty_directory:all";
  try {
    const cached = await redis.getJson(cacheKey);
    if (Array.isArray(cached)) return cached;
  } catch {
  }
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, faculty_name, can_see_all_faculty, is_active, last_login_at::text AS last_login_at
    FROM faculty_directory
    ORDER BY faculty_name ASC, id ASC
  `;
  const records = rows.map((row) => ({
    id: Number(row.id),
    email: String(row.email),
    faculty_name: String(row.faculty_name),
    can_see_all_faculty: Boolean(row.can_see_all_faculty),
    is_active: Boolean(row.is_active),
    last_login_at: row.last_login_at ? String(row.last_login_at) : null
  }));
  try {
    await redis.setJson(cacheKey, records, 300);
  } catch {
  }
  return records;
}
var PinRateLimiter = class {
  attempts = /* @__PURE__ */ new Map();
  maxAttempts;
  windowMs;
  constructor(maxAttempts = 5, windowMs = 5 * 60 * 1e3) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }
  check(ip, now = Date.now()) {
    const rawTimestamps = this.attempts.get(ip) || [];
    const validTimestamps = rawTimestamps.filter((t) => now - t < this.windowMs);
    if (validTimestamps.length !== rawTimestamps.length) {
      if (validTimestamps.length === 0) {
        this.attempts.delete(ip);
      } else {
        this.attempts.set(ip, validTimestamps);
      }
    }
    this.prune(ip);
    if (validTimestamps.length >= this.maxAttempts) {
      const oldest = validTimestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1e3));
      return {
        limited: true,
        remainingAttempts: 0,
        retryAfterSeconds
      };
    }
    return {
      limited: false,
      remainingAttempts: this.maxAttempts - validTimestamps.length,
      retryAfterSeconds: 0
    };
  }
  recordFailure(ip, now = Date.now()) {
    const rawTimestamps = this.attempts.get(ip) || [];
    const validTimestamps = rawTimestamps.filter((t) => now - t < this.windowMs);
    validTimestamps.push(now);
    this.attempts.set(ip, validTimestamps);
    this.prune(ip);
  }
  prune(ip) {
    if (this.attempts.size <= 5e3) return;
    if (this.attempts.has(ip)) {
      const first = this.attempts.keys().next().value;
      if (first && first !== ip) this.attempts.delete(first);
      return;
    }
    const oldest = this.attempts.keys().next().value;
    if (oldest) this.attempts.delete(oldest);
  }
  reset(ip) {
    this.attempts.delete(ip);
  }
  clear() {
    this.attempts.clear();
  }
};
var pinRateLimiter = new PinRateLimiter(5, 5 * 60 * 1e3);
var loginRateLimiter = new PinRateLimiter(8, 10 * 60 * 1e3);
function createDistributedRateLimiter(namespace, fallback, maxAttempts, windowSeconds) {
  const keyFor = (ip) => `ratelimit:${namespace}:${sha256Hex(ip)}`;
  return {
    async check(ip) {
      const redis = getRedis();
      if (!redis.isShared) return fallback.check(ip);
      try {
        const raw = await redis.get(keyFor(ip));
        const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
        if (count >= maxAttempts) {
          return { limited: true, remainingAttempts: 0, retryAfterSeconds: windowSeconds };
        }
        return {
          limited: false,
          remainingAttempts: Math.max(0, maxAttempts - count),
          retryAfterSeconds: 0
        };
      } catch {
        return fallback.check(ip);
      }
    },
    async recordFailure(ip) {
      fallback.recordFailure(ip);
      const redis = getRedis();
      if (!redis.isShared) return;
      try {
        await redis.incrWindow(keyFor(ip), windowSeconds);
      } catch {
      }
    },
    async reset(ip) {
      fallback.reset(ip);
      const redis = getRedis();
      if (!redis.isShared) return;
      try {
        await redis.del(keyFor(ip));
      } catch {
      }
    }
  };
}
var distributedPinRateLimiter = createDistributedRateLimiter("pin", pinRateLimiter, 5, 5 * 60);
var distributedLoginRateLimiter = createDistributedRateLimiter("login", loginRateLimiter, 8, 10 * 60);
function getClientIp(req) {
  const trustProxy = Boolean(process.env.VERCEL) || process.env.TRUST_PROXY === "1";
  if (trustProxy && req.ip) return req.ip;
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(",")[0]?.trim();
    if (first) return first;
  } else if (typeof forwarded === "string" && forwarded.trim()) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}
async function verifyBatchPinWithNeon(pin) {
  const cleanPin = typeof pin === "string" ? pin.trim() : "";
  if (!/^\d{6}$/.test(cleanPin)) return null;
  const dbUrl = getDatabaseUrl();
  if (dbUrl) {
    const redis = getRedis();
    const cacheKey = `auth:pin:${sha256Hex(cleanPin)}`;
    try {
      const cached = await redis.getJson(cacheKey);
      if (cached) {
        return cached.ok && cached.course && cached.batch ? { ok: true, course: cached.course, batch: cached.batch } : null;
      }
    } catch {
    }
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT course, batch, pin 
        FROM batch_access_codes 
        WHERE pin = ${cleanPin} 
        LIMIT 1
      `;
      if (rows && rows.length > 0 && rows[0]?.course && rows[0]?.batch) {
        const result = {
          ok: true,
          course: String(rows[0].course),
          batch: String(rows[0].batch)
        };
        try {
          await redis.setJson(cacheKey, result, 600);
        } catch {
        }
        return result;
      }
      try {
        await redis.setJson(cacheKey, { ok: false }, 60);
      } catch {
      }
      return null;
    } catch (err) {
      console.error("[pin] Verification error:", err);
      throw err;
    }
  }
  if (isProduction()) return null;
  for (const entry of (process.env.DEV_BATCH_PINS ?? "").split(",")) {
    const [course, batch, code] = entry.split(":").map((part) => part.trim());
    if (course && batch && code === cleanPin) return { ok: true, course, batch };
  }
  return null;
}
function setSessionCookie(res, token) {
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const expires = new Date(Date.now() + maxAgeSeconds * 1e3).toUTCString();
  const cookieString = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; Expires=${expires}; HttpOnly; SameSite=Lax${isProduction() ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", cookieString);
}
function clearSessionCookie(res) {
  const cookieString = `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${isProduction() ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", cookieString);
}

// server/src/services/adminAuth.ts
var import_node_crypto2 = __toESM(require("node:crypto"), 1);

// server/src/services/adminSchema.ts
var pending = null;
function ensureAdminSchema() {
  if (pending) return pending;
  const work = (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS admin_password (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        password_hash TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS timetable_sheet_links (
        course TEXT NOT NULL,
        batch TEXT NOT NULL,
        spreadsheet_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (course, batch)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS student_notices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        course TEXT,
        batch TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL,
        auth_key TEXT NOT NULL,
        course TEXT,
        batch TEXT,
        division TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS push_vapid (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL
      )
    `;
    await sql`ALTER TABLE admin_password ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE timetable_sheet_links ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE student_notices ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE push_vapid ENABLE ROW LEVEL SECURITY`;
    await sql`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON TABLE admin_password FROM anon;
          REVOKE ALL ON TABLE admin_sessions FROM anon;
          REVOKE ALL ON TABLE push_vapid FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON TABLE admin_password FROM authenticated;
          REVOKE ALL ON TABLE admin_sessions FROM authenticated;
          REVOKE ALL ON TABLE push_vapid FROM authenticated;
        END IF;
      END $$;
    `;
  })().catch((error) => {
    pending = null;
    throw error;
  });
  pending = work;
  return work;
}

// server/src/services/adminAuth.ts
var SCRYPT_N = 16384;
var SCRYPT_R = 8;
var SCRYPT_P = 1;
var KEY_LEN = 32;
var COOKIE = "aayam_admin";
var SESSION_SECONDS = 12 * 60 * 60;
var adminLoginLimiter = new PinRateLimiter(5, 15 * 60 * 1e3);
function scrypt(password, salt, keylen, params) {
  return new Promise((resolve, reject) => {
    import_node_crypto2.default.scrypt(password, salt, keylen, params, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
async function hashPassword(password) {
  const salt = import_node_crypto2.default.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
function parseHash(stored) {
  if (!stored) return null;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N < 16384 || N > 262144 || r < 8 || r > 16 || p < 1 || p > 2) return null;
  let salt;
  let key;
  try {
    salt = Buffer.from(parts[4] ?? "", "base64url");
    key = Buffer.from(parts[5] ?? "", "base64url");
  } catch {
    return null;
  }
  if (salt.length < 16 || key.length < 16) return null;
  return { params: { N, r, p }, salt, key };
}
var dummyHash = null;
function dummyPasswordHash() {
  dummyHash ??= hashPassword(import_node_crypto2.default.randomBytes(32).toString("hex"));
  return dummyHash;
}
async function verifyPassword(password, stored) {
  const parsed = parseHash(stored);
  const target = parsed ?? parseHash(await dummyPasswordHash());
  if (!target) return false;
  let actual;
  try {
    actual = await scrypt(password, target.salt, target.key.length, target.params);
  } catch {
    return false;
  }
  const same = actual.length === target.key.length && import_node_crypto2.default.timingSafeEqual(actual, target.key);
  return Boolean(parsed) && same;
}
async function readAdminPasswordHash() {
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT password_hash FROM admin_password WHERE id = 1
  `;
  const value = rows[0]?.password_hash;
  return typeof value === "string" && value.length > 0 ? value : null;
}
async function setAdminPasswordHash(passwordHash) {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`
    INSERT INTO admin_password (id, password_hash, updated_at)
    VALUES (1, ${passwordHash}, now())
    ON CONFLICT (id) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, updated_at = now()
  `;
}
async function bootstrapAdminPasswordFromEnv() {
  const existing = await readAdminPasswordHash();
  if (existing) return;
  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (password.length < 12 || password.length > 200) return;
  await setAdminPasswordHash(await hashPassword(password));
}
async function passwordMatches(password) {
  if (password.length < 1 || password.length > 200) return false;
  const stored = await readAdminPasswordHash();
  return verifyPassword(password, stored);
}
async function createAdminSession() {
  await ensureAdminSchema();
  const token = import_node_crypto2.default.randomBytes(32).toString("base64url");
  const tokenHash = import_node_crypto2.default.createHash("sha256").update(token).digest("hex");
  const sql = getSql();
  await sql`
    INSERT INTO admin_sessions (token_hash, expires_at)
    VALUES (${tokenHash}, now() + interval '12 hours')
  `;
  return token;
}
async function adminSessionValid(token) {
  if (!token || token.length < 20 || token.length > 200) return false;
  await ensureAdminSchema();
  const tokenHash = import_node_crypto2.default.createHash("sha256").update(token).digest("hex");
  const sql = getSql();
  const rows = await sql`
    SELECT expires_at FROM admin_sessions WHERE token_hash = ${tokenHash}
  `;
  const expires = rows[0]?.expires_at;
  if (!expires) return false;
  if (new Date(expires).getTime() <= Date.now()) {
    await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
    return false;
  }
  return true;
}
async function deleteAdminSession(token) {
  if (!token) return;
  await ensureAdminSchema();
  const tokenHash = import_node_crypto2.default.createHash("sha256").update(token).digest("hex");
  const sql = getSql();
  await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
}
async function deleteAdminSessions() {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`DELETE FROM admin_sessions`;
}
function secureSuffix() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
}
function setAdminCookie(res, token) {
  const expires = new Date(Date.now() + SESSION_SECONDS * 1e3).toUTCString();
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_SECONDS}; Expires=${expires}; HttpOnly; SameSite=Strict${secureSuffix()}`
  );
}
function clearAdminCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict${secureSuffix()}`
  );
}
function adminTokenFromRequest(req) {
  return parseCookies(req.headers.cookie)[COOKIE] ?? "";
}
function hasAdminHeader(req) {
  return req.get("x-aayam-admin") === "1";
}

// server/src/services/notices.ts
var import_node_crypto3 = __toESM(require("node:crypto"), 1);
function subscriptionMatches(sub, notice) {
  const wantCourse = notice.course?.trim().toLowerCase() ?? "";
  const wantBatch = notice.batch?.trim().toLowerCase() ?? "";
  const gotCourse = sub.course?.trim().toLowerCase() ?? "";
  const gotBatch = sub.batch?.trim().toLowerCase() ?? "";
  if (wantCourse && gotCourse !== wantCourse) return false;
  if (wantBatch && gotBatch !== wantBatch) return false;
  return true;
}
function stamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? (/* @__PURE__ */ new Date()).toISOString() : date.toISOString();
}
async function listMatchingNotices(course, batch) {
  if (!databaseUrl()) return [];
  const redis = getRedis();
  const ver = await redis.get("notices:version").catch(() => null) || "0";
  const cacheKey = `notices:list:${ver}:${course.trim().toLowerCase()}:${batch.trim().toLowerCase()}`;
  try {
    const cached = await redis.getJson(cacheKey);
    if (Array.isArray(cached)) return cached;
  } catch {
  }
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, title, body, created_at
    FROM student_notices
    WHERE created_at > now() - interval '14 days'
      AND (course IS NULL OR lower(course) = lower(${course}))
      AND (batch IS NULL OR lower(batch) = lower(${batch}))
    ORDER BY created_at DESC
    LIMIT 5
  `;
  const result = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: stamp(row.created_at)
  }));
  await redis.setJson(cacheKey, result, 120).catch(() => {
  });
  return result;
}
async function noticesForScope(scope, choices) {
  if (scope.faculty) return [];
  let course = scope.course?.trim() ?? "";
  let batch = scope.batch?.trim() ?? "";
  if (scope.division) {
    const match = choices.find((choice) => choice.division === scope.division);
    if (match) {
      course = match.course;
      batch = match.batch;
    }
  }
  if (!course && !batch) return [];
  try {
    return await listMatchingNotices(course, batch);
  } catch {
    return [];
  }
}
async function listRecentNotices() {
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, title, body, course, batch, created_at
    FROM student_notices
    ORDER BY created_at DESC
    LIMIT 8
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    course: row.course,
    batch: row.batch,
    createdAt: stamp(row.created_at)
  }));
}
async function insertNotice(title, body, audience) {
  await ensureAdminSchema();
  const sql = getSql();
  const id = import_node_crypto3.default.randomUUID();
  await sql`
    INSERT INTO student_notices (id, title, body, course, batch)
    VALUES (${id}, ${title}, ${body}, ${audience.course}, ${audience.batch})
  `;
  await sql`DELETE FROM student_notices WHERE created_at < now() - interval '30 days'`;
  await getRedis().set("notices:version", `${Date.now().toString(36)}`, 24 * 60 * 60).catch(() => {
  });
  return id;
}
async function vapidPair() {
  if (!databaseUrl()) return null;
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT public_key, private_key FROM push_vapid WHERE id = 1
  `;
  const existing = rows[0];
  if (existing?.public_key && existing.private_key) {
    return { publicKey: existing.public_key, privateKey: existing.private_key };
  }
  const webpush = await import("web-push");
  const keys = webpush.generateVAPIDKeys();
  await sql`
    INSERT INTO push_vapid (id, public_key, private_key)
    VALUES (1, ${keys.publicKey}, ${keys.privateKey})
    ON CONFLICT (id) DO NOTHING
  `;
  const again = await sql`
    SELECT public_key, private_key FROM push_vapid WHERE id = 1
  `;
  const saved = again[0];
  if (!saved?.public_key || !saved.private_key) return null;
  return { publicKey: saved.public_key, privateKey: saved.private_key };
}
async function pushPublicKey() {
  try {
    const pair = await vapidPair();
    return pair?.publicKey ?? null;
  } catch {
    return null;
  }
}
async function savePushSubscription(row) {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth_key, course, batch, division)
    VALUES (${row.endpoint}, ${row.p256dh}, ${row.authKey}, ${row.course}, ${row.batch}, ${row.division})
    ON CONFLICT (endpoint) DO UPDATE
      SET p256dh = EXCLUDED.p256dh,
          auth_key = EXCLUDED.auth_key,
          course = EXCLUDED.course,
          batch = EXCLUDED.batch,
          division = EXCLUDED.division
  `;
}
async function listSubscriptions() {
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT endpoint, p256dh, auth_key, course, batch FROM push_subscriptions
  `;
  return rows.map((row) => ({
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    authKey: row.auth_key,
    course: row.course,
    batch: row.batch,
    division: null
  }));
}
async function sendStudentPush(title, body, audience) {
  const pair = await vapidPair();
  if (!pair) return 0;
  const webpush = await import("web-push");
  webpush.setVapidDetails("https://aayam.kv404.dev", pair.publicKey, pair.privateKey);
  const subs = (await listSubscriptions()).filter((sub) => subscriptionMatches(sub, audience));
  let delivered = 0;
  const sql = getSql();
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
        JSON.stringify({ title, body, tag: "aayam-notice" })
      );
      delivered += 1;
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
      }
    }
  }
  return delivered;
}

// server/src/services/sheetOverrides.ts
var SHEET_ID = /^[a-zA-Z0-9-_]{20,80}$/;
function acceptSpreadsheetId(input) {
  const id = cleanSpreadsheetId(input);
  if (!SHEET_ID.test(id)) return null;
  return id;
}
function mergeSheetOverrides(sources, overrides) {
  return sources.map((source) => {
    const hit = overrides.find(
      (row) => row.course.trim().toLowerCase() === source.course.trim().toLowerCase() && (source.batch ?? "").trim().toLowerCase() === row.batch.trim().toLowerCase() && acceptSpreadsheetId(row.spreadsheetId)
    );
    if (!hit) return source;
    return { ...source, id: hit.spreadsheetId };
  });
}
var cache = null;
var SHEET_OVERRIDES_CACHE_KEY = "admin:sheet-overrides";
function clearSheetSourceCache() {
  cache = null;
  void getRedis().del(SHEET_OVERRIDES_CACHE_KEY).catch(() => {
  });
}
async function readSheetOverrides() {
  if (!databaseUrl()) return [];
  const redis = getRedis();
  try {
    const cached = await redis.getJson(SHEET_OVERRIDES_CACHE_KEY);
    if (Array.isArray(cached)) return cached;
  } catch {
  }
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT course, batch, spreadsheet_id FROM timetable_sheet_links
  `;
  const overrides = rows.filter((row) => row.course && row.batch && acceptSpreadsheetId(row.spreadsheet_id)).map((row) => ({ course: row.course, batch: row.batch, spreadsheetId: row.spreadsheet_id }));
  await redis.setJson(SHEET_OVERRIDES_CACHE_KEY, overrides, 120).catch(() => {
  });
  return overrides;
}
async function resolveSheetSources(fallback) {
  const now = Date.now();
  if (cache && now - cache.at < 3e3) return cache.sources;
  let sources = fallback;
  try {
    const overrides = await readSheetOverrides();
    sources = mergeSheetOverrides(fallback, overrides);
  } catch {
    sources = fallback;
  }
  cache = { at: now, sources };
  return sources;
}
async function writeSheetOverride(course, batch, spreadsheetId) {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`
    INSERT INTO timetable_sheet_links (course, batch, spreadsheet_id, updated_at)
    VALUES (${course}, ${batch}, ${spreadsheetId}, now())
    ON CONFLICT (course, batch) DO UPDATE
      SET spreadsheet_id = EXCLUDED.spreadsheet_id, updated_at = now()
  `;
  clearSheetSourceCache();
}
async function deleteSheetOverride(course, batch) {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`
    DELETE FROM timetable_sheet_links
    WHERE lower(course) = lower(${course}) AND lower(batch) = lower(${batch})
  `;
  clearSheetSourceCache();
}

// server/src/adminRoutes.ts
function text(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}
function templateFor(course, batch) {
  return COHORT_TEMPLATES.find(
    (item) => item.course.toLowerCase() === course.toLowerCase() && item.batch.toLowerCase() === batch.toLowerCase()
  );
}
function audienceFrom(body) {
  const course = text(body.course, 40);
  const batch = text(body.batch, 40);
  if (!course && !batch) return { course: null, batch: null };
  if (!course || !batch) {
    const courseOnly = COHORT_TEMPLATES.some((item) => item.course.toLowerCase() === course.toLowerCase());
    if (course && !batch && courseOnly) return { course, batch: null };
    return null;
  }
  if (!templateFor(course, batch)) return null;
  return { course, batch };
}
async function requireAdmin(req, res) {
  if (!hasAdminHeader(req)) {
    res.status(401).json({ ok: false, error: "Sign in again." });
    return false;
  }
  try {
    const ok = await adminSessionValid(adminTokenFromRequest(req));
    if (!ok) {
      res.status(401).json({ ok: false, error: "Sign in again." });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ ok: false, error: "Admin sign-in is unavailable." });
    return false;
  }
}
function sheetRows(fallback, overrides) {
  return fallback.map((source) => {
    const hit = overrides.find(
      (row) => row.course.toLowerCase() === source.course.toLowerCase() && row.batch.toLowerCase() === (source.batch ?? "").toLowerCase()
    );
    const id = hit?.spreadsheetId || source.id;
    return {
      course: source.course,
      batch: source.batch ?? "",
      spreadsheetUrl: spreadsheetUrl(id)
    };
  });
}
function registerAdminRoutes(app2, deps) {
  app2.get("/api/push/public-key", async (_req, res) => {
    const publicKey = await pushPublicKey();
    res.json({ publicKey });
  });
  app2.post("/api/push/subscribe", async (req, res) => {
    const endpoint = text(req.body?.endpoint, 2e3);
    const p256dh = text(req.body?.keys?.p256dh, 200);
    const authKey = text(req.body?.keys?.auth, 200);
    const course = text(req.body?.course, 40);
    const batch = text(req.body?.batch, 40);
    const division = text(req.body?.division, 80);
    const local = endpoint.startsWith("http://localhost") || endpoint.startsWith("http://127.0.0.1");
    if (!endpoint.startsWith("https://") && !local || !p256dh || !authKey) {
      res.status(400).json({ ok: false });
      return;
    }
    try {
      await savePushSubscription({
        endpoint,
        p256dh,
        authKey,
        course: course || null,
        batch: batch || null,
        division: division || null
      });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  app2.get("/api/admin/session", async (req, res) => {
    try {
      const signedIn = await adminSessionValid(adminTokenFromRequest(req));
      if (!signedIn) {
        res.json({ signedIn: false });
        return;
      }
      const overrides = await readSheetOverrides();
      const notices = await listRecentNotices();
      res.json({ signedIn: true, sheets: sheetRows(deps.fallbackSheets, overrides), notices });
    } catch {
      res.json({ signedIn: false });
    }
  });
  app2.post("/api/admin/login", async (req, res) => {
    const ip = getClientIp(req);
    const rate = adminLoginLimiter.check(ip);
    if (rate.limited) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      res.status(429).json({ ok: false, error: `Too many tries. Wait ${rate.retryAfterSeconds} seconds.` });
      return;
    }
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password || password.length > 200) {
      adminLoginLimiter.recordFailure(ip);
      res.status(401).json({ ok: false, error: "That password is not right." });
      return;
    }
    try {
      await bootstrapAdminPasswordFromEnv();
      const match = await passwordMatches(password);
      if (!match) {
        adminLoginLimiter.recordFailure(ip);
        res.status(401).json({ ok: false, error: "That password is not right." });
        return;
      }
      adminLoginLimiter.reset(ip);
      const token = await createAdminSession();
      setAdminCookie(res, token);
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: "Admin sign-in is unavailable." });
    }
  });
  app2.post("/api/admin/logout", async (req, res) => {
    try {
      await deleteAdminSession(adminTokenFromRequest(req));
    } catch {
    }
    clearAdminCookie(res);
    res.json({ ok: true });
  });
  app2.post("/api/admin/password", async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const current = typeof req.body?.current === "string" ? req.body.current : "";
    const next = typeof req.body?.next === "string" ? req.body.next : "";
    if (next.length < 12 || next.length > 200) {
      res.status(400).json({ ok: false, error: "Use at least 12 characters." });
      return;
    }
    try {
      const match = await passwordMatches(current);
      if (!match) {
        res.status(401).json({ ok: false, error: "That password is not right." });
        return;
      }
      await setAdminPasswordHash(await hashPassword(next));
      await deleteAdminSessions();
      const token = await createAdminSession();
      setAdminCookie(res, token);
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: "The password could not be changed." });
    }
  });
  app2.post("/api/admin/sheets", async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const course = text(req.body?.course, 40);
    const batch = text(req.body?.batch, 40);
    const template = templateFor(course, batch);
    const spreadsheetId = acceptSpreadsheetId(text(req.body?.url, 300));
    if (!template || !spreadsheetId) {
      res.status(400).json({ ok: false, error: "Paste a Google Sheet link for one of the batches." });
      return;
    }
    const previous = (await readSheetOverrides()).find(
      (row) => row.course.toLowerCase() === course.toLowerCase() && row.batch.toLowerCase() === batch.toLowerCase()
    );
    try {
      await writeSheetOverride(template.course, template.batch, spreadsheetId);
      const outcome = await deps.syncSheet({
        id: spreadsheetId,
        course: template.course,
        batch: template.batch,
        divisions: template.divisions
      });
      if (!outcome.ok) {
        if (previous) await writeSheetOverride(template.course, template.batch, previous.spreadsheetId);
        else await deleteSheetOverride(template.course, template.batch);
        res.status(400).json({ ok: false, error: outcome.error ?? "That sheet could not be read." });
        return;
      }
      const overrides = await readSheetOverrides();
      res.json({ ok: true, sheets: sheetRows(deps.fallbackSheets, overrides) });
    } catch {
      res.status(503).json({ ok: false, error: "The sheet link could not be saved." });
    }
  });
  app2.post("/api/admin/notices", async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const title = text(req.body?.title, 80);
    const body = text(req.body?.body, 280).replace(/\s+/g, " ");
    const audience = audienceFrom(req.body ?? {});
    if (!title || !body || !audience) {
      res.status(400).json({ ok: false, error: "Write a title, a message, and who should see it." });
      return;
    }
    try {
      await insertNotice(title, body, audience);
      const delivered = await sendStudentPush(title, body, audience).catch(() => 0);
      const notices = await listRecentNotices();
      res.json({ ok: true, delivered, notices });
    } catch {
      res.status(503).json({ ok: false, error: "The message could not be sent." });
    }
  });
}

// server/src/services/changeHistoryService.ts
function recordChanges(db2, drafts) {
  insertChanges(db2, drafts);
}
function listChanges(db2, limit = 50) {
  return readChanges(db2, limit);
}

// server/src/services/presentLecture.ts
function highlightVisible(lecture, now, highlightHours) {
  const highlight = lecture.highlight;
  if (!highlight) return false;
  if (highlight.displayStatus === "cancelled") return true;
  const detected = Date.parse(highlight.detectedAt);
  if (!Number.isFinite(detected)) return false;
  return now.getTime() - detected <= highlightHours * 60 * 60 * 1e3;
}
function presentLecture(lecture, now, highlightHours) {
  const visible = highlightVisible(lecture, now, highlightHours);
  const highlight = visible ? lecture.highlight : null;
  let displayStatus = "scheduled";
  if (lecture.kind === "break") displayStatus = "scheduled";
  else if (lecture.sourceStatus === "cancelled" || lecture.kind === "off") displayStatus = "cancelled";
  else if (highlight?.displayStatus === "rescheduled" || lecture.explicitMark === "rescheduled") displayStatus = "rescheduled";
  else if (highlight?.displayStatus === "changed" || lecture.explicitMark === "changed") displayStatus = "changed";
  const showPrevious = displayStatus !== "scheduled";
  return {
    id: lecture.id,
    slotKey: lecture.slotKey,
    tabName: lecture.tabName,
    course: lecture.course,
    semester: lecture.semester,
    batch: lecture.batch,
    division: lecture.division,
    date: lecture.date,
    weekday: lecture.weekday,
    startMinutes: lecture.startMinutes,
    endMinutes: lecture.endMinutes,
    startLabel: lecture.startLabel,
    endLabel: lecture.endLabel,
    subject: lecture.subject,
    faculty: lecture.faculty,
    room: lecture.room,
    kind: lecture.kind,
    sourceStatus: lecture.sourceStatus,
    displayStatus,
    reason: lecture.reason,
    previous: showPrevious ? highlight?.previous ?? null : null,
    changeDetectedAt: showPrevious ? highlight?.detectedAt ?? null : null,
    changeSummary: showPrevious ? highlight?.summary ?? null : null,
    explicitMark: lecture.explicitMark,
    recurring: lecture.recurring
  };
}

// server/src/program.ts
function programKey(course, batch) {
  const years = batch.replace(/[–—]/g, "-").replace(/\s+/g, "");
  return `${course.trim().toLowerCase()}\0${years.toLowerCase()}`;
}

// server/src/services/weekBackup.ts
var CAP = 8;
function daySpan(start, end) {
  const startMs = Date.parse(`${start}T12:00:00Z`);
  const endMs = Date.parse(`${end}T12:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.round((endMs - startMs) / 864e5);
}
function weekMonday(iso) {
  const date = /* @__PURE__ */ new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
function preferOneWeekCopies(weeks) {
  return weeks.filter((week) => {
    if (daySpan(week.start, week.end) <= 6) return true;
    const monday = weekMonday(week.start);
    return !weeks.some(
      (other) => other.id !== week.id && programKey(other.course, other.batch) === programKey(week.course, week.batch) && weekMonday(other.start) === monday && daySpan(other.start, other.end) <= 6
    );
  });
}
function dated(lectures) {
  return lectures.map((lecture) => lecture.date).filter((date) => Boolean(date)).sort();
}
function replacedWeeks(previous, next) {
  const previousGroups = /* @__PURE__ */ new Map();
  for (const lecture of previous) {
    const key = programKey(lecture.course, lecture.batch);
    const group = previousGroups.get(key) ?? [];
    group.push(lecture);
    previousGroups.set(key, group);
  }
  const nextDates = /* @__PURE__ */ new Map();
  for (const lecture of next) {
    if (!lecture.date) continue;
    const key = programKey(lecture.course, lecture.batch);
    const dates = nextDates.get(key) ?? /* @__PURE__ */ new Set();
    dates.add(lecture.date);
    nextDates.set(key, dates);
  }
  const backups = [];
  for (const [key, lectures] of previousGroups) {
    const previousDates = dated(lectures);
    const incoming = nextDates.get(key);
    if (previousDates.length === 0 || !incoming || incoming.size === 0) continue;
    if (previousDates.some((date) => incoming.has(date))) continue;
    const sample = lectures[0];
    if (!sample) continue;
    const start = previousDates[0];
    const end = previousDates[previousDates.length - 1];
    backups.push({
      id: `${sample.course}|${sample.batch}|${start}|${end}`,
      course: sample.course,
      batch: sample.batch,
      start,
      end,
      lectures,
      changes: []
    });
  }
  return backups;
}
function weeksFromLectures(lectures) {
  const groups = /* @__PURE__ */ new Map();
  for (const lecture of lectures) {
    const key = programKey(lecture.course, lecture.batch);
    const group = groups.get(key) ?? [];
    group.push(lecture);
    groups.set(key, group);
  }
  const weeks = [];
  for (const group of groups.values()) {
    const dates = dated(group);
    const sample = group[0];
    if (!sample || dates.length === 0) continue;
    const start = dates[0];
    const end = dates[dates.length - 1];
    weeks.push({
      id: `${sample.course}|${sample.batch}|${start}|${end}`,
      course: sample.course,
      batch: sample.batch,
      start,
      end,
      lectures: group,
      changes: []
    });
  }
  return weeks;
}
function changesForWeek(week, changes, weeks) {
  const divisions = new Set(week.lectures.map((lecture) => lecture.division));
  const dates = new Set(dated(week.lectures));
  return changes.filter((change) => {
    if (change.date) {
      if (!dates.has(change.date)) return false;
      return !change.division || divisions.has(change.division);
    }
    if (change.division) return divisions.has(change.division);
    if (change.course && change.course.toLowerCase() !== week.course.toLowerCase()) return false;
    const siblings = weeks.filter((item) => programKey(item.course, item.batch) === programKey(week.course, week.batch));
    return siblings.length <= 1 || siblings[0]?.id === week.id;
  });
}
function capWeeks(weeks, currentIds) {
  const byProgram = /* @__PURE__ */ new Map();
  for (const week of weeks) {
    const key = programKey(week.course, week.batch);
    const list = byProgram.get(key) ?? [];
    list.push(week);
    byProgram.set(key, list);
  }
  const kept = [];
  for (const list of byProgram.values()) {
    const current = list.filter((week) => currentIds.has(week.id));
    const past = list.filter((week) => !currentIds.has(week.id));
    past.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
    kept.push(...current, ...past.slice(0, CAP));
  }
  return kept;
}
function rememberReplacedWeeks(db2, previous, next, changes = []) {
  const fresh = replacedWeeks(previous, next);
  if (fresh.length === 0) return;
  for (const week of fresh) week.changes = changesForWeek(week, changes, fresh);
  const merged = new Map(readWeekBackups(db2).map((week) => [week.id, week]));
  for (const week of fresh) merged.set(week.id, week);
  replaceWeekBackups(db2, capWeeks([...merged.values()], /* @__PURE__ */ new Set()));
}
function rememberPublishedWeeks(db2, lectures) {
  const current = weeksFromLectures(lectures);
  if (current.length === 0) return;
  const merged = new Map(readWeekBackups(db2).map((week) => [week.id, week]));
  for (const week of current) {
    const existing = merged.get(week.id);
    merged.set(week.id, existing ? { ...week, changes: existing.changes } : week);
  }
  replaceWeekBackups(db2, capWeeks([...merged.values()], new Set(current.map((week) => week.id))));
}

// server/src/services/timetableSnapshotService.ts
function loadSnapshot(db2) {
  return readLectures(db2);
}
function saveSnapshot(db2, lectures) {
  replaceLectures(db2, lectures);
}
function toNormalized(lecture) {
  return {
    id: lecture.id,
    slotKey: lecture.slotKey,
    tabName: lecture.tabName,
    course: lecture.course,
    semester: lecture.semester,
    batch: lecture.batch,
    division: lecture.division,
    date: lecture.date,
    weekday: lecture.weekday,
    startMinutes: lecture.startMinutes,
    endMinutes: lecture.endMinutes,
    startLabel: lecture.startLabel,
    endLabel: lecture.endLabel,
    subject: lecture.subject,
    faculty: lecture.faculty,
    room: lecture.room,
    kind: lecture.kind,
    sourceStatus: lecture.sourceStatus,
    reason: lecture.reason,
    explicitMark: lecture.explicitMark,
    recurring: lecture.recurring,
    spreadsheetId: lecture.spreadsheetId
  };
}

// server/src/time.ts
var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function canon(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
function sameText(a, b) {
  return canon(a).toLowerCase() === canon(b).toLowerCase();
}
function formatMinutes(minutes) {
  const h24 = (Math.floor(minutes / 60) % 24 + 24) % 24;
  const minute = (minutes % 60 + 60) % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const hour = h24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}
function parseTimeToken(token) {
  const match = canon(token).match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const suffix = match[3]?.toUpperCase();
  if (hour > 23 || minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "PM" && hour < 12) hour += 12;
    if (suffix === "AM" && hour === 12) hour = 0;
  }
  return hour * 60 + minute;
}
function parseTimeRange(label) {
  const text3 = canon(label);
  const match = text3.match(/^(.+?)\s*(?:-|–|—|\bto\b)\s*(.+)$/i);
  if (!match) return null;
  const start = parseTimeToken(match[1] ?? "");
  const end = parseTimeToken(match[2] ?? "");
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}
function parseDateLabel(input, order = "DMY") {
  const text3 = canon(input);
  const match = text3.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  const day = order === "DMY" ? first : second;
  const month = order === "DMY" ? second : first;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const named = text3.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  const computed = WEEKDAYS[date.getUTCDay()] ?? "Monday";
  const weekday = named ? named[1].charAt(0).toUpperCase() + named[1].slice(1).toLowerCase() : computed;
  return { iso, weekday, computedWeekday: computed };
}
function weekdayFromName(name) {
  const text3 = canon(name).toLowerCase();
  const found = WEEKDAYS.find((day) => text3 === day.toLowerCase() || text3.startsWith(`${day.toLowerCase()} `));
  return found ?? null;
}
function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "long"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return {
    iso,
    minutes,
    weekday: parts.weekday ?? "Monday"
  };
}

// server/src/services/restoreRemoved.ts
function slotMinutes(id) {
  const match = /\|(\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}
function restoreRemovedLectures(lectures, changes) {
  const ids = new Set(lectures.map((lecture) => lecture.id));
  const days = new Set(
    lectures.filter((lecture) => lecture.kind !== "break" && lecture.date).map((lecture) => `${lecture.tabName}|${lecture.date}`)
  );
  const restoredIds = /* @__PURE__ */ new Set();
  const restored = [];
  const rewritten = [];
  for (const change of changes) {
    if (change.type !== "removed" || !change.lectureId || !change.tabName || !change.date) continue;
    if (ids.has(change.lectureId) || !days.has(`${change.tabName}|${change.date}`)) continue;
    const previous = change.previous;
    const subject = previous?.subject;
    const minutes = slotMinutes(change.lectureId);
    if (!subject || !minutes) continue;
    const sibling = lectures.find((lecture) => lecture.division === change.division) ?? lectures[0];
    const startLabel = previous.startLabel || formatMinutes(minutes.start);
    const endLabel = previous.endLabel || formatMinutes(minutes.end);
    restored.push({
      id: change.lectureId,
      slotKey: change.lectureId,
      tabName: change.tabName,
      course: change.course || sibling?.course || "",
      semester: change.semester || sibling?.semester || "",
      batch: sibling?.batch || "",
      division: change.division || "",
      date: change.date,
      weekday: change.weekday || "",
      startMinutes: minutes.start,
      endMinutes: minutes.end,
      startLabel,
      endLabel,
      subject,
      faculty: previous.faculty || "",
      room: previous.room || "",
      kind: "lecture",
      sourceStatus: "cancelled",
      reason: "Removed from the official timetable.",
      explicitMark: "cancelled",
      recurring: false,
      anchor: {
        subject,
        faculty: previous.faculty || "",
        room: previous.room || "",
        startMinutes: minutes.start,
        endMinutes: minutes.end,
        startLabel,
        endLabel,
        sourceStatus: "scheduled",
        reason: "",
        kind: "lecture",
        explicitMark: null
      },
      highlight: {
        displayStatus: "cancelled",
        type: "cancelled",
        summary: `${subject} lecture cancelled.`,
        detectedAt: change.detectedAt,
        previous,
        reason: null
      }
    });
    ids.add(change.lectureId);
    restoredIds.add(change.lectureId);
    rewritten.push({ id: change.id, summary: `${subject} lecture cancelled.` });
  }
  return { lectures: [...lectures, ...restored], restoredIds, rewritten };
}

// server/src/services/persistCancelled.ts
function persistCancelledRemovals(db2) {
  const restored = restoreRemovedLectures(loadSnapshot(db2), readChanges(db2, 500));
  if (restored.restoredIds.size === 0) return restored;
  const update = db2.prepare("UPDATE change_events SET type = 'cancelled', summary = ? WHERE id = ? AND type = 'removed'");
  db2.exec("BEGIN");
  try {
    saveSnapshot(db2, restored.lectures);
    for (const row of restored.rewritten) update.run(row.summary, row.id);
    db2.exec("COMMIT");
  } catch (error) {
    db2.exec("ROLLBACK");
    throw error;
  }
  return restored;
}

// server/src/services/neonRows.ts
var LIVE = "live";
var schemaReady = false;
function neonUrl() {
  return databaseUrl();
}
function chunks(rows, size) {
  const groups = [];
  for (let index = 0; index < rows.length; index += size) groups.push(rows.slice(index, index + size));
  return groups;
}
function lectureRow(lecture, weekId) {
  return {
    week_id: weekId,
    id: lecture.id,
    slot_key: lecture.slotKey,
    tab_name: lecture.tabName,
    course: lecture.course,
    semester: lecture.semester,
    batch: lecture.batch,
    division: lecture.division,
    date: lecture.date,
    weekday: lecture.weekday,
    start_minutes: lecture.startMinutes,
    end_minutes: lecture.endMinutes,
    start_label: lecture.startLabel,
    end_label: lecture.endLabel,
    subject: lecture.subject,
    faculty: lecture.faculty,
    room: lecture.room,
    kind: lecture.kind,
    source_status: lecture.sourceStatus,
    reason: lecture.reason,
    explicit_mark: lecture.explicitMark,
    recurring: lecture.recurring,
    spreadsheet_id: lecture.spreadsheetId ?? null,
    anchor: lecture.anchor,
    highlight: lecture.highlight
  };
}
function changeRow(change, weekId) {
  return {
    id: change.id,
    week_id: weekId,
    dedupe_key: change.dedupeKey,
    detected_at: change.detectedAt,
    type: change.type,
    lecture_id: change.lectureId,
    division: change.division,
    course: change.course,
    semester: change.semester,
    tab_name: change.tabName,
    date: change.date,
    weekday: change.weekday,
    summary: change.summary,
    previous: change.previous,
    next: change.next,
    fields: change.fields ?? []
  };
}
function uniqueChangeRows(rows) {
  const seenKeys = /* @__PURE__ */ new Set();
  const seenIds = /* @__PURE__ */ new Set();
  let nextId = rows.reduce((highest, row) => Math.max(highest, row.id || 0), 0);
  const unique = [];
  for (const row of rows) {
    const key = `${row.week_id}\0${row.dedupe_key}`;
    if (seenKeys.has(key)) continue;
    let id = row.id;
    if (id <= 0 || seenIds.has(`${row.week_id}\0${id}`)) {
      nextId += 1;
      id = nextId;
    }
    seenKeys.add(key);
    seenIds.add(`${row.week_id}\0${id}`);
    unique.push({ ...row, id });
  }
  return unique;
}
function uniqueLectureRows(rows) {
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const row of rows) {
    const key = `${row.week_id}\0${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}
function archiveToRows(archive) {
  const lectures = archive.lectures.map((lecture) => lectureRow(lecture, LIVE));
  const changes = archive.changes.map((change) => changeRow(change, LIVE));
  const weeks = [];
  for (const week of archive.weeks ?? []) {
    weeks.push({ id: week.id, course: week.course, batch: week.batch, start_date: week.start, end_date: week.end });
    for (const lecture of week.lectures) lectures.push(lectureRow(lecture, week.id));
    for (const change of week.changes ?? []) changes.push(changeRow(change, week.id));
  }
  return {
    lectures: uniqueLectureRows(lectures),
    changes: uniqueChangeRows(changes),
    weeks
  };
}
function text2(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  return raw ? raw.slice(0, 10) : null;
}
function json(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}
function lectureFromRow(row) {
  return {
    id: row.id,
    slotKey: row.slot_key,
    tabName: row.tab_name,
    course: row.course,
    semester: row.semester,
    batch: row.batch,
    division: row.division,
    date: text2(row.date),
    weekday: row.weekday,
    startMinutes: Number(row.start_minutes),
    endMinutes: Number(row.end_minutes),
    startLabel: row.start_label,
    endLabel: row.end_label,
    subject: row.subject,
    faculty: row.faculty,
    room: row.room,
    kind: row.kind,
    sourceStatus: row.source_status === "cancelled" ? "cancelled" : "scheduled",
    reason: row.reason,
    explicitMark: row.explicit_mark ?? null,
    recurring: Boolean(row.recurring),
    spreadsheetId: row.spreadsheet_id ?? void 0,
    anchor: json(row.anchor, {
      subject: row.subject,
      faculty: row.faculty,
      room: row.room,
      startMinutes: Number(row.start_minutes),
      endMinutes: Number(row.end_minutes),
      startLabel: row.start_label,
      endLabel: row.end_label,
      sourceStatus: row.source_status === "cancelled" ? "cancelled" : "scheduled",
      reason: row.reason ?? "",
      kind: row.kind,
      explicitMark: null
    }),
    highlight: row.highlight ? json(row.highlight, null) : null
  };
}
function changeFromRow(row) {
  return {
    id: Number(row.id),
    dedupeKey: row.dedupe_key,
    detectedAt: row.detected_at,
    type: row.type,
    lectureId: row.lecture_id,
    division: row.division,
    course: row.course,
    semester: row.semester,
    tabName: row.tab_name,
    date: text2(row.date),
    weekday: row.weekday,
    summary: row.summary,
    previous: row.previous ? json(row.previous, null) : null,
    next: row.next ? json(row.next, null) : null,
    fields: json(row.fields, [])
  };
}
function rowsToArchive(savedAt, sync, rows) {
  const weeks = new Map(rows.weeks.map((week) => [week.id, {
    id: week.id,
    course: week.course,
    batch: week.batch,
    start: text2(week.start_date) ?? week.start_date,
    end: text2(week.end_date) ?? week.end_date,
    lectures: [],
    changes: []
  }]));
  const liveLectures = [];
  for (const row of rows.lectures) {
    const lecture = lectureFromRow(row);
    if (row.week_id === LIVE) {
      liveLectures.push(lecture);
      continue;
    }
    weeks.get(row.week_id)?.lectures.push(lecture);
  }
  const liveChanges = [];
  for (const row of rows.changes) {
    const change = changeFromRow(row);
    if (row.week_id === LIVE) {
      liveChanges.push(change);
      continue;
    }
    weeks.get(row.week_id)?.changes.push(change);
  }
  return {
    version: 1,
    savedAt,
    lectures: liveLectures,
    changes: liveChanges.sort((a, b) => a.id - b.id),
    sync,
    weeks: [...weeks.values()]
  };
}
async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS timetable_sync (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      saved_at TEXT NOT NULL,
      last_success_at TEXT,
      last_attempt_at TEXT,
      last_error TEXT,
      bootstrapped BOOLEAN NOT NULL,
      content_hash TEXT,
      tab_names JSONB NOT NULL,
      parse_issues JSONB NOT NULL,
      spreadsheet_title TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS timetable_changes (
      id INTEGER NOT NULL,
      week_id TEXT NOT NULL DEFAULT 'live',
      dedupe_key TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      type TEXT NOT NULL,
      lecture_id TEXT,
      division TEXT,
      course TEXT,
      semester TEXT,
      tab_name TEXT,
      date TEXT,
      weekday TEXT,
      summary TEXT NOT NULL,
      previous JSONB,
      next JSONB,
      fields JSONB NOT NULL DEFAULT '[]'::jsonb,
      PRIMARY KEY (week_id, id),
      UNIQUE (week_id, dedupe_key)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS timetable_weeks (
      id TEXT PRIMARY KEY,
      course TEXT NOT NULL,
      batch TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS timetable_lectures (
      week_id TEXT NOT NULL,
      id TEXT NOT NULL,
      slot_key TEXT NOT NULL,
      tab_name TEXT NOT NULL,
      course TEXT NOT NULL,
      semester TEXT NOT NULL,
      batch TEXT NOT NULL,
      division TEXT NOT NULL,
      date TEXT,
      weekday TEXT NOT NULL,
      start_minutes INTEGER NOT NULL,
      end_minutes INTEGER NOT NULL,
      start_label TEXT NOT NULL,
      end_label TEXT NOT NULL,
      subject TEXT NOT NULL,
      faculty TEXT NOT NULL,
      room TEXT NOT NULL,
      kind TEXT NOT NULL,
      source_status TEXT NOT NULL,
      reason TEXT,
      explicit_mark TEXT,
      recurring BOOLEAN NOT NULL,
      spreadsheet_id TEXT,
      anchor JSONB NOT NULL,
      highlight JSONB,
      PRIMARY KEY (week_id, id)
    )
  `;
  schemaReady = true;
}
function insertLectures(sql, rows) {
  const payload = JSON.stringify(rows);
  return sql`
    INSERT INTO timetable_lectures (
      week_id, id, slot_key, tab_name, course, semester, batch, division, date, weekday,
      start_minutes, end_minutes, start_label, end_label, subject, faculty, room, kind,
      source_status, reason, explicit_mark, recurring, spreadsheet_id, anchor, highlight
    )
    SELECT
      week_id, id, slot_key, tab_name, course, semester, batch, division, date, weekday,
      start_minutes, end_minutes, start_label, end_label, subject, faculty, room, kind,
      source_status, reason, explicit_mark, recurring, spreadsheet_id, anchor, highlight
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(
      week_id text, id text, slot_key text, tab_name text, course text, semester text, batch text,
      division text, date text, weekday text, start_minutes int, end_minutes int, start_label text,
      end_label text, subject text, faculty text, room text, kind text, source_status text,
      reason text, explicit_mark text, recurring boolean, spreadsheet_id text, anchor jsonb, highlight jsonb
    )
  `;
}
function insertChanges2(sql, rows) {
  const payload = JSON.stringify(rows);
  return sql`
    INSERT INTO timetable_changes (
      id, week_id, dedupe_key, detected_at, type, lecture_id, division, course, semester,
      tab_name, date, weekday, summary, previous, next, fields
    )
    SELECT
      id, week_id, dedupe_key, detected_at, type, lecture_id, division, course, semester,
      tab_name, date, weekday, summary, previous, next, fields
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(
      id int, week_id text, dedupe_key text, detected_at text, type text, lecture_id text,
      division text, course text, semester text, tab_name text, date text, weekday text,
      summary text, previous jsonb, next jsonb, fields jsonb
    )
  `;
}
async function readNeonMeta() {
  const url = neonUrl();
  if (!url) return null;
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const syncRows = await sql`
      SELECT saved_at, last_success_at, last_attempt_at, last_error, bootstrapped, content_hash,
             tab_names, parse_issues, spreadsheet_title
      FROM timetable_sync WHERE id = 1
    `;
    const sync = syncRows[0];
    if (!sync?.bootstrapped) return null;
    return {
      savedAt: sync.saved_at,
      sync: {
        lastSuccessAt: sync.last_success_at,
        lastAttemptAt: sync.last_attempt_at,
        lastError: sync.last_error,
        bootstrapped: true,
        contentHash: sync.content_hash,
        tabNames: json(sync.tab_names, []),
        parseIssues: json(sync.parse_issues, []),
        spreadsheetTitle: sync.spreadsheet_title
      }
    };
  } catch (error) {
    console.error("[archive] meta read error:", error);
    return null;
  }
}
async function readNeonLiveRows() {
  const url = neonUrl();
  if (!url) return null;
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const meta = await readNeonMeta();
    if (!meta) return null;
    const [lectures, changes, weeks] = await Promise.all([
      sql`SELECT * FROM timetable_lectures WHERE week_id = ${LIVE}`,
      sql`SELECT * FROM timetable_changes WHERE week_id = ${LIVE} ORDER BY id`,
      sql`SELECT id, course, batch, start_date, end_date FROM timetable_weeks`
    ]);
    const archive = rowsToArchive(meta.savedAt, meta.sync, { lectures, changes, weeks });
    return {
      archive,
      unhydratedWeekIds: new Set(weeks.map((w) => w.id))
    };
  } catch (error) {
    console.error("[archive] live row read error:", error);
    return null;
  }
}
async function readNeonWeeksByIds(weekIds) {
  const url = neonUrl();
  if (!url || weekIds.length === 0) return [];
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const [weeks, lectures, changes] = await Promise.all([
      sql`SELECT id, course, batch, start_date, end_date FROM timetable_weeks WHERE id = ANY(${weekIds})`,
      sql`SELECT * FROM timetable_lectures WHERE week_id = ANY(${weekIds})`,
      sql`SELECT * FROM timetable_changes WHERE week_id = ANY(${weekIds}) ORDER BY id`
    ]);
    const restored = rowsToArchive(
      (/* @__PURE__ */ new Date()).toISOString(),
      {
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastError: null,
        bootstrapped: true,
        contentHash: null,
        tabNames: [],
        parseIssues: [],
        spreadsheetTitle: null
      },
      { lectures, changes, weeks }
    );
    return restored.weeks ?? [];
  } catch (error) {
    console.error("[archive] week row read error:", error);
    return [];
  }
}
async function readNeonRows() {
  const url = neonUrl();
  if (!url) return null;
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const meta = await readNeonMeta();
    if (!meta) return null;
    const [lectures, changes, weeks] = await Promise.all([
      sql`SELECT * FROM timetable_lectures`,
      sql`SELECT * FROM timetable_changes ORDER BY id`,
      sql`SELECT id, course, batch, start_date, end_date FROM timetable_weeks`
    ]);
    return rowsToArchive(meta.savedAt, meta.sync, { lectures, changes, weeks });
  } catch (error) {
    console.error("[archive] row read error:", error);
    return null;
  }
}
async function writeNeonRows(archive, hydratedWeekIds) {
  const url = neonUrl();
  if (!url) return false;
  const sql = getSql();
  await ensureSchema(sql);
  const rows = archiveToRows(archive);
  const weekPayload = JSON.stringify(rows.weeks);
  const tabNames = JSON.stringify(archive.sync.tabNames);
  const parseIssues = JSON.stringify(archive.sync.parseIssues);
  const keptWeekIds = rows.weeks.map((w) => w.id);
  await sql.begin(async (tx) => {
    if (!hydratedWeekIds) {
      await tx`DELETE FROM timetable_lectures`;
      await tx`DELETE FROM timetable_changes`;
      await tx`DELETE FROM timetable_weeks`;
      for (const chunk of chunks(rows.lectures, 200)) await insertLectures(tx, chunk);
      for (const chunk of chunks(rows.changes, 200)) await insertChanges2(tx, chunk);
    } else {
      const targetWeeks = [LIVE, ...hydratedWeekIds];
      await tx`DELETE FROM timetable_lectures WHERE week_id = ANY(${targetWeeks})`;
      await tx`DELETE FROM timetable_changes WHERE week_id = ANY(${targetWeeks})`;
      if (keptWeekIds.length > 0) {
        await tx`DELETE FROM timetable_lectures WHERE week_id <> ${LIVE} AND NOT (week_id = ANY(${keptWeekIds}))`;
        await tx`DELETE FROM timetable_changes WHERE week_id <> ${LIVE} AND NOT (week_id = ANY(${keptWeekIds}))`;
        await tx`DELETE FROM timetable_weeks WHERE NOT (id = ANY(${keptWeekIds}))`;
      } else {
        await tx`DELETE FROM timetable_lectures WHERE week_id <> ${LIVE}`;
        await tx`DELETE FROM timetable_changes WHERE week_id <> ${LIVE}`;
        await tx`DELETE FROM timetable_weeks`;
      }
      const targetSet = new Set(targetWeeks);
      const lecturesToInsert = rows.lectures.filter((r) => targetSet.has(r.week_id));
      const changesToInsert = rows.changes.filter((r) => targetSet.has(r.week_id));
      for (const chunk of chunks(lecturesToInsert, 200)) await insertLectures(tx, chunk);
      for (const chunk of chunks(changesToInsert, 200)) await insertChanges2(tx, chunk);
    }
    await tx`DELETE FROM timetable_sync`;
    await tx`
      INSERT INTO timetable_weeks (id, course, batch, start_date, end_date)
      SELECT id, course, batch, start_date, end_date
      FROM jsonb_to_recordset(${weekPayload}::jsonb) AS x(
        id text, course text, batch text, start_date text, end_date text
      )
      ON CONFLICT (id) DO UPDATE SET
        course = EXCLUDED.course,
        batch = EXCLUDED.batch,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date
    `;
    await tx`
      INSERT INTO timetable_sync (
        id, saved_at, last_success_at, last_attempt_at, last_error, bootstrapped,
        content_hash, tab_names, parse_issues, spreadsheet_title
      ) VALUES (
        1, ${archive.savedAt}, ${archive.sync.lastSuccessAt}, ${archive.sync.lastAttemptAt},
        ${archive.sync.lastError}, ${archive.sync.bootstrapped}, ${archive.sync.contentHash},
        ${tabNames}::jsonb, ${parseIssues}::jsonb, ${archive.sync.spreadsheetTitle}
      )
    `;
  });
  return true;
}

// server/src/services/timetableArchive.ts
function archiveSignature(archive) {
  const lectures = archive.lectures.map((lecture) => `${lecture.id}	${lecture.sourceStatus}	${lecture.subject}	${lecture.faculty}	${lecture.room}	${lecture.startMinutes}`).sort().join("\n");
  const changes = archive.changes.map((change) => `${change.dedupeKey}	${change.type}	${change.summary}`).sort().join("\n");
  const weeks = (archive.weeks ?? []).map((week) => week.id).sort().join("\n");
  return `${archive.sync.contentHash ?? ""}
${lectures}
${changes}
${weeks}`;
}
function mergeWeeks(newer, older) {
  const byId = /* @__PURE__ */ new Map();
  for (const week of older.weeks ?? []) byId.set(week.id, week);
  for (const week of newer.weeks ?? []) byId.set(week.id, week);
  const byProgram = /* @__PURE__ */ new Map();
  for (const week of byId.values()) {
    const key = `${week.course}\0${week.batch}`;
    const list = byProgram.get(key) ?? [];
    list.push(week);
    byProgram.set(key, list);
  }
  const kept = [];
  for (const list of byProgram.values()) {
    list.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
    kept.push(...list.slice(0, 8));
  }
  return kept;
}
function dayKey(lecture) {
  return `${lecture.tabName}|${lecture.date ?? ""}`;
}
function publishedDates(archive) {
  return new Set(archive.lectures.map((lecture) => lecture.date).filter((date) => Boolean(date)));
}
function mergeArchives(left, right) {
  const leftAt = left.sync.lastSuccessAt ?? "";
  const rightAt = right.sync.lastSuccessAt ?? "";
  const newer = rightAt >= leftAt ? right : left;
  const older = newer === right ? left : right;
  const newerDates = publishedDates(newer);
  const olderDates = publishedDates(older);
  const sameWeek = newerDates.size === 0 || olderDates.size === 0 || [...newerDates].some((date) => olderDates.has(date));
  if (!sameWeek) {
    return {
      ...newer,
      changes: newer.changes.filter((change) => !change.date || newerDates.has(change.date)),
      weeks: mergeWeeks(newer, older)
    };
  }
  const ids = new Set(newer.lectures.map((lecture) => lecture.id));
  const days = new Set(newer.lectures.filter((lecture) => lecture.kind !== "break" && lecture.date).map(dayKey));
  const kept = older.lectures.filter(
    (lecture) => lecture.kind === "lecture" && lecture.sourceStatus === "cancelled" && !ids.has(lecture.id) && days.has(dayKey(lecture))
  );
  const changes = /* @__PURE__ */ new Map();
  const keep = (change) => newerDates.size === 0 || !change.date || newerDates.has(change.date);
  for (const change of newer.changes) {
    if (keep(change)) changes.set(change.dedupeKey, change);
  }
  for (const change of older.changes) {
    if (!keep(change)) continue;
    const current = changes.get(change.dedupeKey);
    if (!current) {
      changes.set(change.dedupeKey, change);
      continue;
    }
    if (current.type === "removed" && change.type === "cancelled") {
      changes.set(change.dedupeKey, { ...change, id: current.id });
    }
  }
  return {
    version: 1,
    savedAt: newer.savedAt >= older.savedAt ? newer.savedAt : older.savedAt,
    lectures: [...newer.lectures, ...kept],
    changes: uniqueChangeIds([...changes.values()]),
    sync: newer.sync,
    weeks: mergeWeeks(newer, older)
  };
}
function uniqueChangeIds(changes) {
  const used = /* @__PURE__ */ new Set();
  let nextId = changes.reduce((highest, change) => Math.max(highest, change.id || 0), 0);
  return changes.map((change) => {
    if (change.id > 0 && !used.has(change.id)) {
      used.add(change.id);
      return change;
    }
    nextId += 1;
    used.add(nextId);
    return { ...change, id: nextId };
  });
}

// server/src/services/durableState.ts
var lastSignature = "";
var hydrating = /* @__PURE__ */ new WeakMap();
var ARCHIVE_LIVE_KEY = "archive:live";
var ARCHIVE_SIG_KEY = "archive:sig";
var ARCHIVE_VERSION_KEY = "archive:version";
var ARCHIVE_TTL_SECONDS = 24 * 60 * 60;
function weekKey(id) {
  return `archive:week:${id}`;
}
function neonUrl2() {
  return databaseUrl();
}
function exportArchive(db2) {
  return {
    version: 1,
    savedAt: (/* @__PURE__ */ new Date()).toISOString(),
    lectures: readLectures(db2),
    changes: readAllChanges(db2),
    sync: readSyncState(db2),
    weeks: readWeekBackups(db2)
  };
}
function importArchive(db2, archive, unhydratedWeekIds) {
  db2.exec("BEGIN");
  try {
    replaceLectures(db2, archive.lectures);
    replaceChangeRows(db2, archive.changes);
    replaceWeekBackups(db2, archive.weeks ?? [], unhydratedWeekIds);
    writeSyncState(db2, { ...archive.sync, bootstrapped: true });
    db2.exec("COMMIT");
  } catch (error) {
    db2.exec("ROLLBACK");
    throw error;
  }
}
function isArchive(value) {
  if (!value || typeof value !== "object") return false;
  const archive = value;
  return archive.version === 1 && Array.isArray(archive.lectures) && Array.isArray(archive.changes) && Boolean(archive.sync);
}
function withWeekChanges(archive) {
  return {
    ...archive,
    weeks: (archive.weeks ?? []).map((week) => ({ ...week, changes: week.changes ?? [] }))
  };
}
async function readBlobUpdatedAt() {
  const dbUrl = neonUrl2();
  if (!dbUrl) return null;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT updated_at::text AS updated_at FROM timetable_archive WHERE id = 'latest' LIMIT 1
    `;
    return rows?.[0]?.updated_at ? String(rows[0].updated_at) : null;
  } catch {
    return null;
  }
}
async function readBlob() {
  const dbUrl = neonUrl2();
  if (!dbUrl) return null;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT archive FROM timetable_archive WHERE id = 'latest' LIMIT 1
    `;
    if (rows && rows.length > 0 && rows[0]?.archive) {
      const raw = rows[0].archive;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (isArchive(parsed)) return withWeekChanges(parsed);
    }
  } catch (err) {
    console.error("[archive] read error:", err);
  }
  return null;
}
async function readRemoteForColdStart() {
  const [meta, blobUpdatedAt] = await Promise.all([readNeonMeta(), readBlobUpdatedAt()]);
  const metaTime = meta ? Date.parse(meta.sync.lastSuccessAt || meta.savedAt) : 0;
  const blobTime = blobUpdatedAt ? Date.parse(blobUpdatedAt) : 0;
  if (meta && (!blobUpdatedAt || metaTime >= blobTime || Number.isNaN(blobTime))) {
    const live = await readNeonLiveRows();
    if (live) return live;
  }
  const blob = await readBlob();
  if (blob) {
    return { archive: blob, unhydratedWeekIds: /* @__PURE__ */ new Set() };
  }
  const fullRows = await readNeonRows();
  if (fullRows) {
    return { archive: fullRows, unhydratedWeekIds: /* @__PURE__ */ new Set() };
  }
  return null;
}
async function writeBlob(archive) {
  const dbUrl = neonUrl2();
  if (!dbUrl) return;
  const sql = getSql();
  const payload = JSON.stringify(archive);
  await sql`
    INSERT INTO timetable_archive (id, archive, updated_at)
    VALUES ('latest', ${payload}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
    SET archive = EXCLUDED.archive, updated_at = NOW()
  `;
}
async function writeArchiveToRedis(archive, unhydratedWeekIds) {
  const redis = getRedis();
  try {
    const hydratedWeeks = (archive.weeks ?? []).filter((w) => !unhydratedWeekIds.has(w.id) && w.lectures.length > 0);
    const liveArchive = {
      ...archive,
      weeks: (archive.weeks ?? []).map((w) => ({
        id: w.id,
        course: w.course,
        batch: w.batch,
        start: w.start,
        end: w.end,
        lectures: [],
        changes: []
      }))
    };
    await Promise.all([
      redis.setJson(
        ARCHIVE_LIVE_KEY,
        {
          archive: liveArchive,
          unhydratedWeekIds: (archive.weeks ?? []).map((w) => w.id)
        },
        ARCHIVE_TTL_SECONDS
      ),
      redis.set(ARCHIVE_SIG_KEY, archiveSignature(archive), ARCHIVE_TTL_SECONDS),
      ...hydratedWeeks.map((week) => redis.setJson(weekKey(week.id), week, ARCHIVE_TTL_SECONDS))
    ]);
  } catch (err) {
    console.error("[redis] archive write failed:", err);
  }
}
async function bumpArchiveVersion() {
  const version = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await getRedis().set(ARCHIVE_VERSION_KEY, version, ARCHIVE_TTL_SECONDS);
  } catch {
  }
  return version;
}
function hydrateArchive(db2) {
  if (!neonUrl2() || readSyncState(db2).bootstrapped) return Promise.resolve(false);
  const running = hydrating.get(db2);
  if (running) return running;
  const pending2 = loadRemoteArchive(db2).finally(() => hydrating.delete(db2));
  hydrating.set(db2, pending2);
  return pending2;
}
async function loadRemoteArchive(db2) {
  const redis = getRedis();
  try {
    const cached = await redis.getJson(ARCHIVE_LIVE_KEY);
    if (cached?.archive?.sync?.bootstrapped) {
      const unhydrated = new Set(cached.unhydratedWeekIds ?? []);
      importArchive(db2, cached.archive, unhydrated);
      lastSignature = archiveSignature(cached.archive);
      return true;
    }
  } catch (err) {
    console.error("[redis] archive read failed, falling back to Postgres:", err);
  }
  const loaded = await readRemoteForColdStart();
  if (!loaded?.archive?.sync.bootstrapped) return false;
  importArchive(db2, loaded.archive, loaded.unhydratedWeekIds);
  lastSignature = archiveSignature(loaded.archive);
  await writeArchiveToRedis(loaded.archive, loaded.unhydratedWeekIds);
  console.log("[sync] loaded saved timetable history");
  return true;
}
async function ensureWeeksHydrated(db2, weekIds) {
  if (weekIds.length === 0) return;
  const missing = readUnhydratedWeekIds(db2, weekIds);
  if (missing.length === 0) return;
  const redis = getRedis();
  const stillMissing = [];
  const resolved = [];
  await Promise.all(
    missing.map(async (id) => {
      try {
        const cached = await redis.getJson(weekKey(id));
        if (cached && Array.isArray(cached.lectures)) {
          resolved.push({ ...cached, changes: cached.changes ?? [] });
          return;
        }
      } catch {
      }
      stillMissing.push(id);
    })
  );
  if (stillMissing.length > 0 && neonUrl2()) {
    let fromRows = await readNeonWeeksByIds(stillMissing);
    const foundIds = new Set(fromRows.map((w) => w.id));
    const unresolvedIds = stillMissing.filter((id) => !foundIds.has(id));
    if (unresolvedIds.length > 0) {
      const blob = await readBlob();
      const fromBlob = (blob?.weeks ?? []).filter((w) => unresolvedIds.includes(w.id));
      fromRows = [...fromRows, ...fromBlob];
    }
    for (const week of fromRows) {
      resolved.push(week);
      try {
        await redis.setJson(weekKey(week.id), week, ARCHIVE_TTL_SECONDS);
      } catch {
      }
    }
  }
  if (resolved.length > 0) {
    upsertWeekBackups(db2, resolved, true);
  }
}
async function resolveAllWeeksForBlob(archive, hydratedIds) {
  const weeks = archive.weeks ?? [];
  const missingIds = weeks.filter((w) => !hydratedIds.has(w.id) && w.lectures.length === 0).map((w) => w.id);
  if (missingIds.length === 0) return weeks;
  const redis = getRedis();
  const byId = new Map(weeks.map((w) => [w.id, w]));
  const fetchFromPg = [];
  await Promise.all(
    missingIds.map(async (id) => {
      try {
        const cached = await redis.getJson(weekKey(id));
        if (cached && cached.lectures.length > 0) {
          byId.set(id, { ...cached, changes: cached.changes ?? [] });
          return;
        }
      } catch {
      }
      fetchFromPg.push(id);
    })
  );
  if (fetchFromPg.length > 0 && neonUrl2()) {
    const pgWeeks = await readNeonWeeksByIds(fetchFromPg);
    for (const week of pgWeeks) {
      byId.set(week.id, week);
      try {
        await redis.setJson(weekKey(week.id), week, ARCHIVE_TTL_SECONDS);
      } catch {
      }
    }
  }
  return [...byId.values()];
}
async function publishArchive(db2) {
  if (!neonUrl2() || !readSyncState(db2).bootstrapped) return false;
  const local = exportArchive(db2);
  const localSig = archiveSignature(local);
  if (localSig === lastSignature) return false;
  const redis = getRedis();
  try {
    const cachedSig = await redis.get(ARCHIVE_SIG_KEY);
    if (cachedSig && cachedSig === localSig) {
      lastSignature = localSig;
      return false;
    }
  } catch {
  }
  let merged = local;
  const remoteMeta = await readNeonMeta();
  const remoteNewer = remoteMeta && (remoteMeta.sync.lastSuccessAt ?? "") > (local.sync.lastSuccessAt ?? "") && remoteMeta.sync.contentHash !== local.sync.contentHash;
  if (remoteNewer) {
    const remoteLive = await readNeonLiveRows();
    if (remoteLive) {
      merged = mergeArchives(remoteLive.archive, local);
      if (archiveSignature(merged) !== localSig) {
        importArchive(db2, merged, remoteLive.unhydratedWeekIds);
      }
    }
  }
  const signature = archiveSignature(merged);
  merged.savedAt = (/* @__PURE__ */ new Date()).toISOString();
  const hydratedIds = readHydratedWeekIds(db2);
  const unhydratedSet = new Set(
    (merged.weeks ?? []).filter((w) => !hydratedIds.has(w.id) && w.lectures.length === 0).map((w) => w.id)
  );
  await writeArchiveToRedis(merged, unhydratedSet);
  await bumpArchiveVersion();
  try {
    await writeNeonRows(merged, hydratedIds);
  } catch (err) {
    console.error("[archive] row write error:", err);
  }
  try {
    const fullWeeks = await resolveAllWeeksForBlob(merged, hydratedIds);
    await writeBlob({ ...merged, weeks: fullWeeks });
    console.log("[sync] saved timetable history");
  } catch (err) {
    console.error("[archive] write error:", err);
  }
  lastSignature = signature;
  return true;
}

// server/src/services/changeDetectionService.ts
var import_node_crypto4 = require("node:crypto");
function coreOf(lecture) {
  return {
    subject: canon(lecture.subject),
    faculty: canon(lecture.faculty),
    room: canon(lecture.room),
    startMinutes: lecture.startMinutes,
    endMinutes: lecture.endMinutes,
    startLabel: lecture.startLabel,
    endLabel: lecture.endLabel,
    sourceStatus: lecture.sourceStatus,
    reason: canon(lecture.reason ?? ""),
    kind: lecture.kind,
    explicitMark: lecture.explicitMark
  };
}
function coresEqual(a, b) {
  return sameText(a.subject, b.subject) && sameText(a.faculty, b.faculty) && sameText(a.room, b.room) && a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes && a.sourceStatus === b.sourceStatus && sameText(a.reason, b.reason) && a.kind === b.kind && a.explicitMark === b.explicitMark;
}
function previousOf(core, fields) {
  const previous = {};
  if (fields.includes("subject") || fields.includes("status")) previous.subject = core.subject;
  if (fields.includes("faculty")) previous.faculty = core.faculty;
  if (fields.includes("room")) previous.room = core.room;
  if (fields.includes("time") || fields.includes("status")) {
    previous.startLabel = core.startLabel;
    previous.endLabel = core.endLabel;
  }
  if (fields.includes("status")) previous.status = core.sourceStatus;
  return previous;
}
function nextOf(lecture, fields) {
  const next = {};
  if (fields.includes("subject") || fields.includes("status")) next.subject = lecture.subject;
  if (fields.includes("faculty")) next.faculty = lecture.faculty;
  if (fields.includes("room")) next.room = lecture.room;
  if (fields.includes("time") || fields.includes("status")) {
    next.startLabel = lecture.startLabel;
    next.endLabel = lecture.endLabel;
  }
  if (fields.includes("status")) next.status = lecture.sourceStatus;
  return next;
}
function dedupeKey(parts) {
  return (0, import_node_crypto4.createHash)("sha256").update(JSON.stringify(parts)).digest("hex");
}
function rangeLabel(lecture) {
  return `${lecture.startLabel}\u2013${lecture.endLabel}`;
}
function draft(input) {
  const { dedupeParts, ...rest } = input;
  return { ...rest, dedupeKey: dedupeKey(dedupeParts) };
}
function contextOf(lecture, tabName) {
  return {
    lectureId: lecture?.id ?? null,
    division: lecture?.division ?? null,
    course: lecture?.course ?? null,
    semester: lecture?.semester ?? null,
    tabName: lecture?.tabName ?? tabName ?? null,
    date: lecture?.date ?? null,
    weekday: lecture?.weekday ?? null
  };
}
function changedFields(prev, next) {
  const fields = [];
  if (!sameText(prev.subject, next.subject)) fields.push("subject");
  if (!sameText(prev.faculty, next.faculty)) fields.push("faculty");
  if (!sameText(prev.room, next.room)) fields.push("room");
  if (prev.startMinutes !== next.startMinutes || prev.endMinutes !== next.endMinutes) fields.push("time");
  if (prev.sourceStatus !== next.sourceStatus || prev.kind !== next.kind) fields.push("status");
  if (!sameText(prev.reason, next.reason ?? "")) fields.push("reason");
  if (prev.explicitMark !== next.explicitMark) fields.push("status");
  return [...new Set(fields)];
}
function describeFieldChange(prev, next, fields) {
  const subject = next.kind === "off" ? prev.subject : next.subject;
  if (fields.length === 1 && fields[0] === "room") {
    return `${next.subject} moved from ${prev.room || "an unassigned room"} to ${next.room || "an unassigned room"}.`;
  }
  if (fields.length === 1 && fields[0] === "faculty") {
    return `${next.subject} faculty changed from ${prev.faculty || "unassigned"} to ${next.faculty || "unassigned"}.`;
  }
  if (fields.length === 1 && fields[0] === "subject") {
    return `${prev.subject} was replaced by ${next.subject} at ${rangeLabel(next)}.`;
  }
  if (fields.length === 1 && fields[0] === "time") {
    return `${subject} moved from ${rangeLabel(prev)} to ${rangeLabel(next)}.`;
  }
  const bits = [];
  if (fields.includes("subject")) bits.push(`subject is now ${next.subject} (was ${prev.subject})`);
  if (fields.includes("time")) bits.push(`time is now ${rangeLabel(next)} (was ${rangeLabel(prev)})`);
  if (fields.includes("room")) bits.push(`room is now ${next.room || "unassigned"} (was ${prev.room || "unassigned"})`);
  if (fields.includes("faculty")) bits.push(`faculty is now ${next.faculty || "unassigned"} (was ${prev.faculty || "unassigned"})`);
  if (fields.includes("reason")) bits.push("the note was updated");
  return `${next.subject} was updated: ${bits.join("; ")}.`;
}
function canPair(removed, added) {
  if (removed.tabName !== added.tabName || removed.date !== added.date || removed.division !== added.division) return false;
  if (removed.kind === "break" || added.kind === "break") return false;
  if (removed.sourceStatus === "cancelled" || added.sourceStatus === "cancelled") return false;
  if (!sameText(removed.subject, added.subject)) return false;
  const facultyRemoved = canon(removed.faculty).toLowerCase();
  const facultyAdded = canon(added.faculty).toLowerCase();
  const roomRemoved = canon(removed.room).toLowerCase();
  const roomAdded = canon(added.room).toLowerCase();
  const facultyDiffers = Boolean(facultyRemoved && facultyAdded && facultyRemoved !== facultyAdded);
  const roomDiffers = Boolean(roomRemoved && roomAdded && roomRemoved !== roomAdded);
  if (facultyDiffers && roomDiffers) return false;
  return true;
}
function pairMoves(removed, added) {
  const pairs = [];
  const usedRemoved = /* @__PURE__ */ new Set();
  const usedAdded = /* @__PURE__ */ new Set();
  const groupKey = (lecture) => [lecture.tabName, lecture.date ?? "", lecture.division, canon(lecture.subject).toLowerCase()].join("|");
  const keys = /* @__PURE__ */ new Set([...removed.map(groupKey), ...added.map(groupKey)]);
  for (const key of keys) {
    const groupRemoved = removed.filter((lecture) => !usedRemoved.has(lecture.id) && groupKey(lecture) === key && added.some((candidate) => canPair(lecture, candidate)));
    const groupAdded = added.filter((lecture) => !usedAdded.has(lecture.slotKey) && groupKey(lecture) === key && removed.some((candidate) => canPair(candidate, lecture)));
    if (groupRemoved.length === 0 || groupAdded.length === 0) continue;
    const allCross = groupRemoved.every((left) => groupAdded.every((right) => canPair(left, right)));
    if (allCross) {
      const orderedRemoved = [...groupRemoved].sort((a, b) => a.startMinutes - b.startMinutes);
      const orderedAdded = [...groupAdded].sort((a, b) => a.startMinutes - b.startMinutes);
      const count = Math.min(orderedRemoved.length, orderedAdded.length);
      for (let index = 0; index < count; index += 1) {
        const left = orderedRemoved[index];
        const right = orderedAdded[index];
        usedRemoved.add(left.id);
        usedAdded.add(right.slotKey);
        pairs.push({ removed: left, added: right });
      }
      continue;
    }
    const pool = [...groupAdded];
    for (const left of [...groupRemoved].sort((a, b) => a.startMinutes - b.startMinutes)) {
      const matchIndex = pool.findIndex((right2) => canPair(left, right2));
      if (matchIndex === -1) continue;
      const right = pool.splice(matchIndex, 1)[0];
      usedRemoved.add(left.id);
      usedAdded.add(right.slotKey);
      pairs.push({ removed: left, added: right });
    }
  }
  return { pairs, usedRemoved, usedAdded };
}
function highlightFor(displayStatus, type, summary, detectedAt, previous, reason) {
  return { displayStatus, type, summary, detectedAt, previous, reason };
}
function initialSnapshot(lectures) {
  return lectures.map((lecture) => ({
    ...lecture,
    anchor: coreOf(lecture),
    highlight: null
  }));
}
function compareSnapshots(previous, next, options) {
  const detectedAt = options.now.toISOString();
  const events = [];
  const output = [];
  const previousBySlot = new Map(previous.map((lecture) => [lecture.slotKey, lecture]));
  const matched = /* @__PURE__ */ new Set();
  const unmatchedNext = [];
  for (const lecture of next) {
    const prior = previousBySlot.get(lecture.slotKey);
    if (!prior) {
      unmatchedNext.push(lecture);
      continue;
    }
    matched.add(prior.id);
    const priorCore = coreOf(prior);
    const nextCore = coreOf(lecture);
    if (coresEqual(priorCore, nextCore)) {
      output.push({
        ...lecture,
        id: prior.id,
        anchor: prior.anchor,
        highlight: prior.highlight
      });
      continue;
    }
    if (coresEqual(nextCore, prior.anchor)) {
      const restored = prior.sourceStatus === "cancelled" && lecture.sourceStatus === "scheduled";
      const summary2 = restored ? `${lecture.subject} is back on the timetable.` : `${lecture.subject} change was reverted.`;
      events.push(draft({
        ...contextOf({ ...lecture, id: prior.id }),
        detectedAt,
        type: restored ? "restored" : "reverted",
        summary: summary2,
        previous: previousOf(priorCore, ["subject", "faculty", "room", "time", "status"]),
        next: nextOf(lecture, ["subject", "faculty", "room", "time", "status"]),
        fields: changedFields(priorCore, lecture),
        dedupeParts: [prior.id, restored ? "restored" : "reverted", priorCore, nextCore]
      }));
      output.push({ ...lecture, id: prior.id, anchor: nextCore, highlight: null });
      continue;
    }
    if (prior.kind !== "break" && lecture.kind === "break") {
      const summary2 = `${prior.subject} at ${rangeLabel(prior)} is no longer listed. The slot is now a break, and it was not marked cancelled.`;
      events.push(draft({
        ...contextOf(prior),
        detectedAt,
        type: "removed",
        summary: summary2,
        previous: previousOf(priorCore, ["subject", "time", "room", "faculty"]),
        next: null,
        fields: ["status"],
        dedupeParts: [prior.id, "removed", priorCore]
      }));
      output.push({ ...lecture, id: lecture.slotKey, anchor: nextCore, highlight: null });
      continue;
    }
    if (prior.kind === "break" && lecture.kind !== "break") {
      const summary2 = `${lecture.subject} added at ${rangeLabel(lecture)}${lecture.room ? ` in ${lecture.room}` : ""}.`;
      events.push(draft({
        ...contextOf({ ...lecture, id: prior.id }),
        detectedAt,
        type: "added",
        summary: summary2,
        previous: null,
        next: nextOf(lecture, ["subject", "time", "room", "faculty"]),
        fields: ["subject"],
        dedupeParts: [prior.id, "added", nextCore]
      }));
      output.push({ ...lecture, id: prior.id, anchor: nextCore, highlight: null });
      continue;
    }
    const fields = changedFields(priorCore, lecture);
    const becameCancelled = lecture.sourceStatus === "cancelled" && prior.sourceStatus !== "cancelled";
    const leftCancelled = prior.sourceStatus === "cancelled" && lecture.sourceStatus !== "cancelled";
    let type = "details_changed";
    let displayStatus = "changed";
    let summary = describeFieldChange(priorCore, lecture, fields);
    if (becameCancelled) {
      type = "cancelled";
      displayStatus = "cancelled";
      summary = lecture.kind === "off" ? `${prior.kind === "off" ? rangeLabel(prior) : prior.subject} is marked OFF.` : `${prior.subject} lecture cancelled.`;
    } else if (leftCancelled && !sameText(prior.subject, lecture.subject) && !/^off$/i.test(prior.subject)) {
      type = "replaced";
      displayStatus = "changed";
      summary = `${lecture.subject} replaces the cancelled ${prior.subject} lecture.`;
    } else if (leftCancelled) {
      type = "restored";
      displayStatus = "changed";
      summary = /^off$/i.test(prior.subject) ? `${rangeLabel(lecture)} is no longer OFF. ${lecture.subject} is scheduled.` : `${lecture.subject} is back on the timetable.`;
    } else if (lecture.explicitMark === "rescheduled" || fields.includes("time")) {
      type = "rescheduled";
      displayStatus = "rescheduled";
      summary = `${lecture.subject} moved from ${rangeLabel(prior)} to ${rangeLabel(lecture)}.`;
    } else if (fields.length === 1 && fields[0] === "room") type = "room_change";
    else if (fields.length === 1 && fields[0] === "faculty") type = "faculty_change";
    else if (fields.length === 1 && fields[0] === "subject") type = "subject_change";
    const shownFields = becameCancelled ? ["subject", "time", "room", "faculty", "status"] : fields;
    events.push(draft({
      ...contextOf({ ...lecture, id: prior.id }),
      detectedAt,
      type,
      summary,
      previous: previousOf(priorCore, shownFields),
      next: nextOf(lecture, shownFields),
      fields,
      dedupeParts: [prior.id, type, priorCore, nextCore]
    }));
    output.push({
      ...lecture,
      id: prior.id,
      anchor: priorCore,
      highlight: highlightFor(displayStatus, type, summary, detectedAt, previousOf(priorCore, shownFields), lecture.reason)
    });
  }
  const unmatchedPrevious = previous.filter((lecture) => !matched.has(lecture.id));
  const { pairs, usedRemoved, usedAdded } = pairMoves(
    unmatchedPrevious.filter((lecture) => lecture.kind !== "break"),
    unmatchedNext.filter((lecture) => lecture.kind !== "break")
  );
  for (const pair of pairs) {
    const removedCore = coreOf(pair.removed);
    const addedCore = coreOf(pair.added);
    const fields = changedFields(removedCore, pair.added);
    if (!fields.includes("time")) fields.push("time");
    if (coresEqual(addedCore, pair.removed.anchor)) {
      const summary2 = `${pair.added.subject} change was reverted.`;
      events.push(draft({
        ...contextOf({ ...pair.added, id: pair.removed.id }),
        detectedAt,
        type: "reverted",
        summary: summary2,
        previous: previousOf(removedCore, ["time", "room", "faculty", "subject"]),
        next: nextOf(pair.added, ["time", "room", "faculty", "subject"]),
        fields,
        dedupeParts: [pair.removed.id, "reverted", removedCore, addedCore]
      }));
      output.push({ ...pair.added, id: pair.removed.id, anchor: addedCore, highlight: null });
      continue;
    }
    const summaryParts = [`${pair.added.subject} moved from ${rangeLabel(pair.removed)} to ${rangeLabel(pair.added)}.`];
    if (!sameText(pair.removed.room, pair.added.room)) {
      summaryParts.push(`Room is now ${pair.added.room || "unassigned"} (was ${pair.removed.room || "unassigned"}).`);
    }
    const summary = summaryParts.join(" ");
    events.push(draft({
      ...contextOf({ ...pair.added, id: pair.removed.id }),
      detectedAt,
      type: "rescheduled",
      summary,
      previous: previousOf(removedCore, fields),
      next: nextOf(pair.added, fields),
      fields,
      dedupeParts: [pair.removed.id, "rescheduled", removedCore, addedCore]
    }));
    output.push({
      ...pair.added,
      id: pair.removed.id,
      anchor: removedCore,
      highlight: highlightFor("rescheduled", "rescheduled", summary, detectedAt, previousOf(removedCore, fields), pair.added.reason)
    });
  }
  for (const lecture of unmatchedNext) {
    if (usedAdded.has(lecture.slotKey)) continue;
    if (lecture.kind === "break") {
      output.push({ ...lecture, anchor: coreOf(lecture), highlight: null });
      continue;
    }
    const summary = `${lecture.subject} added at ${rangeLabel(lecture)}${lecture.room ? ` in ${lecture.room}` : ""}.`;
    events.push(draft({
      ...contextOf(lecture),
      detectedAt,
      type: "added",
      summary,
      previous: null,
      next: nextOf(lecture, ["subject", "time", "room", "faculty"]),
      fields: ["subject"],
      dedupeParts: [lecture.slotKey, "added", coreOf(lecture)]
    }));
    output.push({ ...lecture, anchor: coreOf(lecture), highlight: null });
  }
  for (const lecture of unmatchedPrevious) {
    if (usedRemoved.has(lecture.id) || lecture.kind === "break") continue;
    const dayRemains = next.some(
      (item) => item.tabName === lecture.tabName && item.date === lecture.date && programKey(item.course, item.batch) === programKey(lecture.course, lecture.batch) && item.kind !== "break"
    );
    if (dayRemains && lecture.kind === "lecture") {
      const summary2 = `${lecture.subject} lecture cancelled.`;
      const fields = ["subject", "time", "room", "faculty", "status"];
      const already = lecture.sourceStatus === "cancelled";
      if (!already) {
        events.push(draft({
          ...contextOf(lecture),
          detectedAt,
          type: "cancelled",
          summary: summary2,
          previous: previousOf(coreOf(lecture), fields),
          next: null,
          fields: ["status"],
          dedupeParts: [lecture.id, "cancelled", coreOf(lecture)]
        }));
      }
      output.push({
        ...lecture,
        sourceStatus: "cancelled",
        explicitMark: "cancelled",
        reason: lecture.reason || "Removed from the official timetable.",
        anchor: lecture.anchor,
        highlight: already && lecture.highlight?.displayStatus === "cancelled" ? lecture.highlight : highlightFor("cancelled", "cancelled", summary2, detectedAt, previousOf(coreOf(lecture), fields), lecture.reason)
      });
      continue;
    }
    const summary = `${lecture.subject} at ${rangeLabel(lecture)} is no longer listed. It was not marked cancelled.`;
    events.push(draft({
      ...contextOf(lecture),
      detectedAt,
      type: "removed",
      summary,
      previous: previousOf(coreOf(lecture), ["subject", "time", "room", "faculty"]),
      next: null,
      fields: ["subject"],
      dedupeParts: [lecture.id, "removed", coreOf(lecture)]
    }));
  }
  if (options.bootstrapped) {
    const before = new Set(options.previousTabs);
    const after = new Set(options.nextTabs);
    for (const tab of options.nextTabs) {
      if (before.has(tab)) continue;
      const count = next.filter((lecture) => lecture.tabName === tab && lecture.kind === "lecture").length;
      events.push(draft({
        ...contextOf(null, tab),
        detectedAt,
        type: "tab_added",
        summary: count > 0 ? `Tab \u201C${tab}\u201D was added with ${count} lecture${count === 1 ? "" : "s"}.` : `Tab \u201C${tab}\u201D was added.`,
        previous: null,
        next: null,
        fields: ["tab"],
        dedupeParts: ["tab_added", tab, next.filter((lecture) => lecture.tabName === tab).map((lecture) => lecture.slotKey).sort()]
      }));
    }
    for (const tab of options.previousTabs) {
      if (after.has(tab)) continue;
      events.push(draft({
        ...contextOf(null, tab),
        detectedAt,
        type: "tab_removed",
        summary: `Tab \u201C${tab}\u201D is no longer in the spreadsheet. Its classes were removed from the portal and were not marked cancelled.`,
        previous: null,
        next: null,
        fields: ["tab"],
        dedupeParts: ["tab_removed", tab]
      }));
    }
  }
  return { lectures: output, events };
}

// server/src/services/timetableNormalizer.ts
var import_node_crypto5 = require("node:crypto");
function normalizeMark(word) {
  const value = word.toLowerCase();
  if (value === "canceled" || value === "cancelled" || value === "holiday") return "cancelled";
  if (value === "off") return "off";
  if (value === "rescheduled") return "rescheduled";
  return "changed";
}
function parseStatusToken(status) {
  const text3 = canon(status).toLowerCase();
  if (!text3 || text3 === "scheduled" || text3 === "confirmed") return null;
  if (/^(cancelled|canceled|holiday)$/.test(text3)) return "cancelled";
  if (text3 === "off") return "off";
  if (text3 === "rescheduled") return "rescheduled";
  if (text3 === "changed") return "changed";
  return null;
}
function parseMarkedSubject(subject) {
  const paren = subject.match(/^(.*?)\s*[([]\s*(cancelled|canceled|rescheduled|changed|off|holiday)\b\s*[:\-–]?\s*([^)\]]*)[)\]]\s*$/i);
  if (paren) {
    return {
      subject: canon(paren[1]) || subject,
      mark: normalizeMark(paren[2] ?? ""),
      reason: canon(paren[3]) || null
    };
  }
  const trail = subject.match(/^(.*?)\s*[|–]\s*(cancelled|canceled|rescheduled|changed|off|holiday)\b\s*[:\-–]?\s*(.*)$/i);
  if (trail && canon(trail[1])) {
    return {
      subject: canon(trail[1]),
      mark: normalizeMark(trail[2] ?? ""),
      reason: canon(trail[3]) || null
    };
  }
  if (/^(cancelled|canceled|off|holiday|rescheduled|changed)$/i.test(subject)) {
    return { subject, mark: normalizeMark(subject), reason: null };
  }
  return { subject, mark: null, reason: null };
}
function slotKeyFor(slot) {
  const when = slot.startMinutes >= 0 ? `${slot.startMinutes}-${slot.endMinutes}` : `row-${slot.row}`;
  return [slot.tabName, slot.date ?? "weekly", slot.division, when].join("|");
}
function normalizeWorkbook(parsed, options) {
  const lectures = [];
  const issues = [...parsed.issues];
  for (const tab of parsed.tabs) {
    for (const slot of tab.slots) {
      const lecture = normalizeSlot(slot, options);
      if (lecture) lectures.push(lecture);
    }
  }
  return { lectures, issues, collegeName: parsed.collegeName, semester: parsed.semester, batch: parsed.batch };
}
function normalizeSlot(slot, options) {
  const courseFallback = options.courseFallback;
  const marked = parseMarkedSubject(canon(slot.subject));
  const statusMark = parseStatusToken(slot.statusText);
  const mark = statusMark ?? marked.mark;
  const reason = canon(slot.reasonText) || marked.reason;
  let subject = marked.subject;
  let kind = "lecture";
  let sourceStatus = "scheduled";
  let explicitMark = null;
  let finalReason = reason || null;
  if (/^(lunch(\s*break)?|short\s*break|break|recess)$/i.test(subject) && !mark) {
    kind = "break";
    subject = /lunch/i.test(subject) ? "Lunch break" : "Break";
  } else if (mark === "off" || mark === "cancelled") {
    sourceStatus = "cancelled";
    explicitMark = "cancelled";
    if (mark === "off" || /^off$/i.test(subject)) {
      kind = "off";
      subject = "OFF";
      finalReason = finalReason || "Marked OFF on the official timetable.";
    } else if (/^(cancelled|canceled|holiday)$/i.test(subject)) {
      subject = /^holiday$/i.test(subject) ? "Holiday" : "Cancelled";
      finalReason = finalReason || (subject === "Holiday" ? "Marked as a holiday on the official timetable." : null);
    }
  } else if (mark === "rescheduled" || mark === "changed") {
    explicitMark = mark;
    if (!subject || /^(rescheduled|changed)$/i.test(subject)) subject = "Rescheduled class";
  }
  if (!subject) return null;
  if (kind === "lecture" && !canon(slot.subject) && !canon(slot.statusText)) return null;
  const startMinutes = slot.startMinutes ?? -1;
  const endMinutes = slot.endMinutes ?? -1;
  const weekday = slot.weekday ?? weekdayFromName(slot.tabName) ?? "";
  const key = slotKeyFor({
    tabName: slot.tabName,
    date: slot.date,
    division: slot.division,
    startMinutes,
    endMinutes,
    row: slot.row
  });
  return {
    id: key,
    slotKey: key,
    tabName: slot.tabName,
    course: canon(slot.course) || courseFallback,
    semester: canon(slot.semester),
    batch: canon(slot.batch),
    division: canon(slot.division) || slot.tabName,
    date: slot.date,
    weekday,
    startMinutes,
    endMinutes,
    startLabel: startMinutes >= 0 ? formatMinutes(startMinutes) : "Time not listed",
    endLabel: endMinutes >= 0 ? formatMinutes(endMinutes) : "Time not listed",
    subject,
    faculty: kind === "break" ? "" : canon(slot.faculty),
    room: kind === "break" ? "" : canon(slot.room),
    kind,
    sourceStatus,
    reason: finalReason,
    explicitMark,
    recurring: !slot.date,
    spreadsheetId: options.spreadsheetId
  };
}
function contentFingerprint(lectures, tabs, issues) {
  const lines = lectures.map(
    (lecture) => [
      lecture.slotKey,
      lecture.subject,
      lecture.faculty,
      lecture.room,
      lecture.kind,
      lecture.sourceStatus,
      lecture.reason ?? "",
      lecture.explicitMark ?? "",
      lecture.date ?? "",
      lecture.division,
      lecture.course,
      lecture.semester,
      lecture.batch,
      lecture.startMinutes,
      lecture.endMinutes,
      lecture.tabName,
      lecture.weekday
    ].join("")
  ).sort();
  const issueLines = issues.map((item) => `${item.severity}|${item.tabName}|${item.row ?? ""}|${item.message}`).sort();
  return (0, import_node_crypto5.createHash)("sha256").update(JSON.stringify({ tabs: [...tabs].sort(), lines, issueLines })).digest("hex");
}

// server/src/services/timetableParser.ts
var import_exceljs = __toESM(require("exceljs"), 1);
function fillRgb(fill) {
  if (!fill || typeof fill !== "object") return null;
  const argb = fill.fgColor?.argb || fill.bgColor?.argb;
  if (!argb || typeof argb !== "string") return null;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((part) => Number.isNaN(part))) return null;
  return { r, g, b };
}
function matchesFill(cell, test) {
  const master = cell.master ?? cell;
  for (const fill of [cell.fill, master.fill]) {
    const rgb = fillRgb(fill);
    if (rgb && test(rgb)) return true;
  }
  return false;
}
function isYellowCell(cell) {
  return matchesFill(cell, ({ r, g, b }) => r >= 180 && g >= 180 && b <= 120);
}
function isRedCell(cell) {
  return matchesFill(cell, ({ r, g, b }) => r >= 170 && g <= 80 && b <= 80 && r - g >= 100 && r - b >= 100);
}
function isBreakSubject(subject) {
  return /^(lunch(\s*break)?|short\s*break|break|recess)$/i.test(canon(subject));
}
var HEADER_ALIASES = {
  subject: ["subject", "course name", "module", "paper", "lecture"],
  faculty: ["faculty", "faculty name", "teacher", "professor", "instructor"],
  room: ["room", "classroom", "classroom no", "class room", "venue", "lab", "laboratory"],
  status: ["status"],
  reason: ["reason", "remarks", "remark", "note", "notes"],
  division: ["division", "class", "cohort", "section"],
  date: ["date"],
  day: ["day", "weekday"],
  time: ["time", "timing", "slot", "time slot"],
  start: ["start", "start time", "from"],
  end: ["end", "end time", "to"],
  semester: ["semester", "sem"],
  course: ["course", "programme", "program"]
};
function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return canon(String(value));
  }
  if (typeof value === "object") {
    const record = value;
    if (Array.isArray(record.richText)) {
      return canon(record.richText.map((part) => part.text ?? "").join(""));
    }
    if (typeof record.text === "string") return canon(record.text);
    if ("result" in record) return cellText(record.result);
  }
  return canon(String(value));
}
function columnIndex(cell) {
  const col = cell.col;
  if (typeof col === "number") return col;
  let index = 0;
  for (const char of String(col).toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
  return index;
}
function loadMatrix(worksheet) {
  const rowCount = Math.min(worksheet.rowCount || worksheet.actualRowCount || 0, 400);
  const colCount = Math.min(Math.max(worksheet.columnCount || worksheet.actualColumnCount || 1, 1), 40);
  return {
    rowCount,
    colCount,
    own(row, col) {
      const cell = worksheet.getCell(row, col);
      const master = cell.master ?? cell;
      if (cell.isMerged && master.address !== cell.address) return "";
      return cellText(cell.value);
    },
    masterOf(row, col) {
      const cell = worksheet.getCell(row, col);
      const master = cell.master ?? cell;
      const text3 = cellText(master.value);
      if (!text3) return null;
      return { row: Number(master.row), col: columnIndex(master), text: text3 };
    },
    isYellow(row, col) {
      return isYellowCell(worksheet.getCell(row, col));
    },
    isRed(row, col) {
      return isRedCell(worksheet.getCell(row, col));
    }
  };
}
function labelAt(matrix, row) {
  const own = matrix.own(row, 1);
  if (own) return own;
  const master = matrix.masterOf(row, 1);
  if (master && master.col === 1) return master.text;
  return "";
}
function classify(label) {
  const text3 = canon(label).toLowerCase();
  if (!text3) return "empty";
  if (parseTimeRange(label)) return "time";
  if (text3 === "timing" || text3 === "time") return "header";
  if (text3 === "faculty" || text3 === "teacher" || text3 === "professor" || text3 === "faculty name") return "faculty";
  if (/^(classroom no\.?|classroom|class room|room no\.?|room|venue|lab|laboratory)$/.test(text3)) return "room";
  if (text3 === "status") return "status";
  if (/^(reason|remarks|remark|note|notes)$/.test(text3)) return "reason";
  if (/^(semester|sem)\b/.test(text3) || /\bbatch\b/.test(text3) || parseDateLabel(label)) return "meta";
  return "other";
}
function valueAt(matrix, row, col, allowTimeMerge) {
  const own = matrix.own(row, col);
  if (own) return own;
  const master = matrix.masterOf(row, col);
  if (!master?.text) return "";
  if (master.row === row) return master.text;
  if (!allowTimeMerge) return "";
  if (classify(labelAt(matrix, master.row)) === "time") return master.text;
  return "";
}
function issue(tabName, message, severity, row, snippet) {
  return { tabName, message, severity, row, snippet };
}
function canonCourse(raw) {
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (key === "btech") return "BTech";
  if (key === "mca") return "MCA";
  return canon(raw);
}
function canonBatch(raw) {
  const text3 = canon(raw).replace(/[–—]/g, "-").replace(/\s*-\s*/g, "-");
  const match = text3.match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (!match?.[1] || !match[2]) return text3;
  const end = match[2].length === 4 ? match[2].slice(-2) : match[2];
  return `${match[1]}-${end}`;
}
function readProgramBatch(text3) {
  const match = canon(text3).match(/^(?:(b\.?\s*tech|m\.?\s*c\.?\s*a)\s+)?batch\b(?:\s*[-–:]?\s*(.+))?$/i);
  if (!match) return null;
  const course = match[1] ? canonCourse(match[1]) : null;
  const batch = match[2] ? canonBatch(match[2]) : null;
  if (!course && !batch) return null;
  return { course, batch };
}
function readMeta(matrix, headerRow, dateOrder) {
  let collegeName = null;
  let course = null;
  let semester = null;
  let batch = null;
  let date = null;
  let weekday = null;
  const notes = [];
  for (let row = 1; row < headerRow; row += 1) {
    const text3 = labelAt(matrix, row);
    if (!text3) continue;
    const semesterMatch = text3.match(/^(?:semester|sem)\s*[-–:]?\s*([0-9]+)/i);
    const named = readProgramBatch(text3);
    const parsedDate = parseDateLabel(text3, dateOrder);
    if (semesterMatch) semester = semesterMatch[1] ?? semester;
    else if (named) {
      if (named.course) course = named.course;
      if (named.batch) batch = named.batch;
    } else if (parsedDate) {
      date = parsedDate.iso;
      weekday = parsedDate.computedWeekday;
      if (parsedDate.weekday !== parsedDate.computedWeekday) {
        notes.push(`Date ${text3} says ${parsedDate.weekday}, which does not match ${parsedDate.computedWeekday}. The calendar date was used.`);
      }
    } else if (!collegeName && text3.length > 3) collegeName = canon(text3);
  }
  return { collegeName, course, semester, batch, date, weekday, notes };
}
function divisionsOn(matrix, headerRow) {
  const divisions = [];
  for (let col = 2; col <= matrix.colCount; col += 1) {
    let name = matrix.own(headerRow, col);
    const master = matrix.masterOf(headerRow, col);
    if (!name && master && master.row === headerRow) name = master.text;
    name = canon(name);
    if (!name || name.toLowerCase() === "timing") continue;
    if (master && master.col !== col && divisions.some((division) => division.col === master.col)) continue;
    divisions.push({ col, name });
  }
  return divisions;
}
function parseGrid(matrix, tabName, dateOrder) {
  let headerRow = 0;
  for (let row2 = 1; row2 <= Math.min(matrix.rowCount, 40); row2 += 1) {
    if (canon(labelAt(matrix, row2)).toLowerCase() === "timing") {
      headerRow = row2;
      break;
    }
  }
  if (!headerRow) return null;
  const issues = [];
  const meta = readMeta(matrix, headerRow, dateOrder);
  for (const note of meta.notes) issues.push(issue(tabName, note, "warning"));
  const tabWeekday = weekdayFromName(tabName);
  const weekday = meta.weekday ?? tabWeekday;
  if (meta.weekday && tabWeekday && meta.weekday !== tabWeekday) {
    issues.push(issue(tabName, `Tab name \u201C${tabName}\u201D does not match the date's weekday ${meta.weekday}.`, "warning"));
  }
  const divisions = divisionsOn(matrix, headerRow);
  if (divisions.length === 0) {
    issues.push(issue(tabName, "The Timing header has no cohort or division columns, so no lectures were read from this tab.", "error", headerRow));
    return { name: tabName, collegeName: meta.collegeName, semester: meta.semester, batch: meta.batch, date: meta.date, weekday, slots: [], issues };
  }
  const slots = [];
  let row = headerRow + 1;
  while (row <= matrix.rowCount) {
    const master = matrix.masterOf(row, 1);
    if (master && master.col === 1 && master.row === headerRow) {
      row += 1;
      continue;
    }
    const label = labelAt(matrix, row);
    const role = classify(label);
    if (role === "empty" || role === "header" || role === "meta") {
      row += 1;
      continue;
    }
    if (role !== "time") {
      if (role === "other") {
        issues.push(issue(tabName, "This row is not a time slot, faculty row, or classroom row, so it was left out of the timetable.", "warning", row, label.slice(0, 180)));
      }
      row += 1;
      continue;
    }
    const range = parseTimeRange(label);
    const blockRow = row;
    const extras = [];
    const continuedRows = [];
    let cursor = row + 1;
    while (cursor <= matrix.rowCount) {
      const continued = matrix.masterOf(cursor, 1);
      if (continued && continued.col === 1 && continued.row === blockRow) {
        continuedRows.push(cursor);
        cursor += 1;
        continue;
      }
      const nextLabel = labelAt(matrix, cursor);
      const nextRole = classify(nextLabel);
      if (nextRole === "time" || nextRole === "header" || nextRole === "empty" || nextRole === "meta") break;
      if (nextRole === "faculty" || nextRole === "room" || nextRole === "status" || nextRole === "reason") {
        extras.push({ role: nextRole, row: cursor });
        cursor += 1;
        continue;
      }
      issues.push(issue(tabName, "This row sits inside a time block but does not match a known field, so its text was not attached to a lecture.", "warning", cursor, nextLabel.slice(0, 180)));
      cursor += 1;
    }
    if (!range) {
      issues.push(issue(tabName, `Could not parse the time \u201C${label}\u201D.`, "warning", blockRow, label));
    }
    const facultyRow = extras.find((extra) => extra.role === "faculty")?.row ?? continuedRows[0];
    const roomRow = extras.find((extra) => extra.role === "room")?.row ?? continuedRows[1];
    const statusRow = extras.find((extra) => extra.role === "status")?.row;
    const reasonRow = extras.find((extra) => extra.role === "reason")?.row;
    for (const division of divisions) {
      let subject = valueAt(matrix, blockRow, division.col, true);
      const faculty = facultyRow ? valueAt(matrix, facultyRow, division.col, false) : "";
      const room = roomRow ? valueAt(matrix, roomRow, division.col, false) : "";
      let statusText = statusRow ? valueAt(matrix, statusRow, division.col, false) : "";
      const reasonText = reasonRow ? valueAt(matrix, reasonRow, division.col, false) : "";
      if (!canon(subject) && matrix.isYellow(blockRow, division.col)) {
        subject = "LUNCH BREAK";
      }
      if (canon(subject) && !isBreakSubject(subject) && matrix.isRed(blockRow, division.col)) {
        if (!canon(statusText) || /^(scheduled|confirmed)$/i.test(canon(statusText))) statusText = "cancelled";
      }
      if (!canon(subject) && !canon(statusText)) continue;
      slots.push({
        tabName,
        course: meta.course,
        semester: meta.semester,
        batch: meta.batch,
        division: division.name,
        date: meta.date,
        weekday,
        startMinutes: range?.start ?? null,
        endMinutes: range?.end ?? null,
        subject,
        faculty,
        room,
        statusText,
        reasonText,
        row: blockRow
      });
    }
    row = cursor;
  }
  return { name: tabName, collegeName: meta.collegeName, semester: meta.semester, batch: meta.batch, date: meta.date, weekday, slots, issues };
}
function headerMap(matrix, row) {
  const map = /* @__PURE__ */ new Map();
  for (let col = 1; col <= matrix.colCount; col += 1) {
    const text3 = canon(matrix.own(row, col) || matrix.masterOf(row, col)?.text || "").toLowerCase();
    if (!text3) continue;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(text3) && !map.has(field)) map.set(field, col);
    }
  }
  return map;
}
function looksLikeRowHeader(map) {
  const hasSubject = map.has("subject");
  const hasWhen = map.has("time") || map.has("start");
  const signals = ["subject", "faculty", "room", "time", "start", "status"].filter((field) => map.has(field)).length;
  return hasSubject && hasWhen && signals >= 2;
}
function parseRowTable(matrix, tabName, dateOrder) {
  let headerRow = 0;
  let columns = /* @__PURE__ */ new Map();
  for (let row = 1; row <= Math.min(matrix.rowCount, 40); row += 1) {
    const map = headerMap(matrix, row);
    if (looksLikeRowHeader(map)) {
      headerRow = row;
      columns = map;
      break;
    }
  }
  if (!headerRow) return null;
  const issues = [];
  const meta = readMeta(matrix, headerRow, dateOrder);
  const slots = [];
  const tabWeekday = weekdayFromName(tabName);
  for (let row = headerRow + 1; row <= matrix.rowCount; row += 1) {
    const read = (field) => {
      const col = columns.get(field);
      if (!col) return "";
      return valueAt(matrix, row, col, false);
    };
    const values = ["subject", "faculty", "room", "status", "time", "start", "date", "division"].map(read);
    if (values.every((value) => !canon(value))) continue;
    let subject = read("subject");
    const subjectCol = columns.get("subject");
    if (!canon(subject) && subjectCol && matrix.isYellow(row, subjectCol)) {
      subject = "LUNCH BREAK";
    }
    let statusText = read("status");
    if (canon(subject) && !isBreakSubject(subject) && subjectCol && matrix.isRed(row, subjectCol)) {
      if (!canon(statusText) || /^(scheduled|confirmed)$/i.test(canon(statusText))) statusText = "cancelled";
    }
    const timeText = read("time");
    const startText = read("start");
    const endText = read("end");
    const range = timeText ? parseTimeRange(timeText) : null;
    const start = range?.start ?? (startText ? parseTimeTokenSafe(startText) : null);
    const end = range?.end ?? (endText ? parseTimeTokenSafe(endText) : null);
    if ((timeText || startText) && (start === null || end === null)) {
      issues.push(issue(tabName, "This lecture row has a time that could not be parsed. It is still listed.", "warning", row, timeText || `${startText} ${endText}`));
    } else if (start === null || end === null) {
      issues.push(issue(tabName, "This lecture row has no usable time. It is still listed so the information is not dropped.", "warning", row, subject || statusText));
    }
    const dateText = read("date");
    const parsedDate = dateText ? parseDateLabel(dateText, dateOrder) : null;
    const dayText = read("day");
    const division = canon(read("division")) || tabName;
    slots.push({
      tabName,
      course: canon(read("course")) || null,
      semester: canon(read("semester")) || meta.semester,
      batch: meta.batch,
      division,
      date: parsedDate?.iso ?? meta.date,
      weekday: parsedDate?.computedWeekday ?? weekdayFromName(dayText) ?? meta.weekday ?? tabWeekday,
      startMinutes: start,
      endMinutes: end,
      subject,
      faculty: read("faculty"),
      room: read("room"),
      statusText,
      reasonText: read("reason"),
      row
    });
  }
  return {
    name: tabName,
    collegeName: meta.collegeName,
    semester: meta.semester,
    batch: meta.batch,
    date: meta.date,
    weekday: meta.weekday ?? tabWeekday,
    slots,
    issues
  };
}
function parseTimeTokenSafe(token) {
  if (!canon(token)) return null;
  if (!/(AM|PM)/i.test(token) && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(canon(token))) return null;
  return parseTimeToken(token);
}
async function workbookFrom(source) {
  if (!Buffer.isBuffer(source)) return source;
  const workbook = new import_exceljs.default.Workbook();
  await workbook.xlsx.load(source);
  return workbook;
}
async function parseTimetableSource(source, options = {}) {
  const dateOrder = options.dateOrder ?? "DMY";
  const workbook = await workbookFrom(source);
  const tabs = [];
  workbook.eachSheet((worksheet) => {
    const tabName = canon(worksheet.name) || "Untitled";
    const matrix = loadMatrix(worksheet);
    if (matrix.rowCount === 0) {
      tabs.push({
        name: tabName,
        collegeName: null,
        semester: null,
        batch: null,
        date: null,
        weekday: weekdayFromName(tabName),
        slots: [],
        issues: [issue(tabName, "This tab is empty.", "warning")]
      });
      return;
    }
    const grid = parseGrid(matrix, tabName, dateOrder);
    const parsed = grid ?? parseRowTable(matrix, tabName, dateOrder);
    if (!parsed) {
      tabs.push({
        name: tabName,
        collegeName: null,
        semester: null,
        batch: null,
        date: null,
        weekday: weekdayFromName(tabName),
        slots: [],
        issues: [issue(tabName, "This tab does not match a cohort grid or a lecture table. No rows were imported from it.", "error")]
      });
      return;
    }
    tabs.push(parsed);
  });
  const issues = tabs.flatMap((tab) => tab.issues);
  return {
    tabs,
    issues,
    collegeName: tabs.find((tab) => tab.collegeName)?.collegeName ?? null,
    semester: tabs.find((tab) => tab.semester)?.semester ?? null,
    batch: tabs.find((tab) => tab.batch)?.batch ?? null
  };
}

// server/src/services/syncScheduler.ts
var inflight = /* @__PURE__ */ new WeakMap();
function dropChangesFromOtherWeeks(db2, lectures) {
  const dates = new Set(lectures.map((lecture) => lecture.date).filter((date) => Boolean(date)));
  if (dates.size === 0) return;
  const changes = readAllChanges(db2);
  const kept = changes.filter((change) => !change.date || dates.has(change.date));
  if (kept.length === changes.length) return;
  replaceChangeRows(db2, kept);
}
function dropFreshProgramAdditions(previous, lectures, events) {
  const known = new Set(previous.map((lecture) => programKey(lecture.course, lecture.batch)));
  if (known.size === 0) return events;
  const fresh = new Set(lectures.filter((lecture) => !known.has(programKey(lecture.course, lecture.batch))).map((lecture) => lecture.id));
  if (fresh.size === 0) return events;
  return events.filter((event) => event.type !== "added" || !event.lectureId || !fresh.has(event.lectureId));
}
function replacesPublishedWeek(previous, next) {
  const previousDates = new Set(previous.map((lecture) => lecture.date).filter((date) => Boolean(date)));
  const nextDates = new Set(next.map((lecture) => lecture.date).filter((date) => Boolean(date)));
  if (previousDates.size === 0 || nextDates.size === 0) return false;
  for (const date of nextDates) {
    if (previousDates.has(date)) return false;
  }
  return true;
}
function withCarriedTabs(previous, lectures, issues) {
  const counts = /* @__PURE__ */ new Map();
  for (const lecture of lectures) counts.set(lecture.tabName, (counts.get(lecture.tabName) ?? 0) + 1);
  const fatalTabs = new Set(issues.filter((issue2) => issue2.severity === "error").map((issue2) => issue2.tabName));
  const carried = [...lectures];
  const notes = [];
  for (const tabName of fatalTabs) {
    if ((counts.get(tabName) ?? 0) > 0) continue;
    const prior = previous.filter((lecture) => lecture.tabName === tabName);
    if (prior.length === 0) continue;
    carried.push(...prior.map(toNormalized));
    notes.push({
      tabName,
      severity: "warning",
      message: "Showing the last good copy of this tab because the latest version could not be parsed."
    });
  }
  return { lectures: carried, issues: [...issues, ...notes] };
}
async function performSync(ctx) {
  const now = ctx.now ?? /* @__PURE__ */ new Date();
  const attemptAt = now.toISOString();
  try {
    await hydrateArchive(ctx.db);
    const current = readSyncState(ctx.db);
    const files = ctx.loadAll ? await ctx.loadAll() : [{ ...await ctx.load(), course: ctx.config.courseName, spreadsheetId: ctx.config.spreadsheetId ?? "" }];
    const groups = [];
    for (const file of files) {
      const parsed = await parseTimetableSource(file.buffer, { dateOrder: ctx.config.dateOrder });
      const normalized = normalizeWorkbook(parsed, { courseFallback: file.course, spreadsheetId: file.spreadsheetId || void 0 });
      groups.push({ file, parsed, normalized });
    }
    const replaceKey = ctx.replaceProgram ? programKey(ctx.replaceProgram.course, ctx.replaceProgram.batch) : "";
    if (ctx.replaceProgram) {
      for (const group of groups) {
        group.normalized.batch = ctx.replaceProgram.batch;
        for (const lecture of group.normalized.lectures) {
          lecture.course = ctx.replaceProgram.course;
          lecture.batch = ctx.replaceProgram.batch;
        }
      }
    }
    persistCancelledRemovals(ctx.db);
    const previous = loadSnapshot(ctx.db);
    const retainedLectures = [];
    const retainedIssues = [];
    const tabNames = [];
    for (const group of groups) {
      const course = group.normalized.lectures[0]?.course || group.file.course;
      const batch = group.normalized.batch || group.normalized.lectures.find((lecture) => lecture.batch)?.batch || "";
      const key = programKey(course, batch);
      const prior = previous.filter(
        (lecture) => group.file.spreadsheetId ? lecture.spreadsheetId === group.file.spreadsheetId || !lecture.spreadsheetId && programKey(lecture.course, lecture.batch) === key : programKey(lecture.course, lecture.batch) === key
      );
      const carried = withCarriedTabs(prior, group.normalized.lectures, group.normalized.issues);
      const label = [course, batch].filter(Boolean).join(" ");
      retainedLectures.push(...carried.lectures);
      retainedIssues.push(
        ...carried.issues.map((issue2) => files.length > 1 && label ? { ...issue2, message: `${label}: ${issue2.message}` } : issue2)
      );
      for (const tab of group.parsed.tabs) {
        if (!tabNames.includes(tab.name)) tabNames.push(tab.name);
      }
    }
    const syncedSheetIds = new Set(files.map((file) => file.spreadsheetId).filter(Boolean));
    const syncedKeys = new Set(
      groups.map((group) => {
        const course = group.normalized.lectures[0]?.course || group.file.course;
        const batch = group.normalized.batch || group.normalized.lectures.find((l) => l.batch)?.batch || "";
        return programKey(course, batch);
      })
    );
    const untouched = previous.filter((lecture) => {
      if (lecture.spreadsheetId && syncedSheetIds.has(lecture.spreadsheetId)) return false;
      if (syncedKeys.has(programKey(lecture.course, lecture.batch))) return false;
      return true;
    });
    for (const lecture of untouched) {
      retainedLectures.push(toNormalized(lecture));
      if (!tabNames.includes(lecture.tabName)) tabNames.push(lecture.tabName);
    }
    const retained = { lectures: retainedLectures, issues: retainedIssues };
    const contentHash = contentFingerprint(retained.lectures, tabNames, retained.issues);
    const changesBeforeTrim = readAllChanges(ctx.db);
    dropChangesFromOtherWeeks(ctx.db, retained.lectures);
    if (current.bootstrapped && current.contentHash === contentHash) {
      rememberPublishedWeeks(ctx.db, previous);
      writeSyncState(ctx.db, successState(current, attemptAt, contentHash, tabNames, retained.issues, ctx.config.spreadsheetTitle));
      await publishArchive(ctx.db);
      return { ok: true, unchanged: true, changeCount: 0, error: null };
    }
    const freshWeek = current.bootstrapped && replacesPublishedWeek(previous, retained.lectures);
    const previousForDiff = replaceKey ? previous.filter((lecture) => programKey(lecture.course, lecture.batch) !== replaceKey) : previous;
    const stored = current.bootstrapped && !freshWeek ? compareSnapshots(previousForDiff, retained.lectures, {
      now,
      previousTabs: current.tabNames,
      nextTabs: tabNames,
      bootstrapped: true
    }) : { lectures: initialSnapshot(retained.lectures), events: [] };
    const freshIds = replaceKey ? new Set(retained.lectures.filter((lecture) => programKey(lecture.course, lecture.batch) === replaceKey).map((lecture) => lecture.id)) : null;
    const events = dropFreshProgramAdditions(previous, stored.lectures, stored.events).filter((event) => {
      if (!freshIds || event.type !== "added" || !event.lectureId) return true;
      return !freshIds.has(event.lectureId);
    });
    ctx.db.exec("BEGIN");
    try {
      rememberReplacedWeeks(ctx.db, previous, retained.lectures, changesBeforeTrim);
      if (freshWeek) replaceChangeRows(ctx.db, []);
      saveSnapshot(ctx.db, stored.lectures);
      recordChanges(ctx.db, events);
      rememberPublishedWeeks(ctx.db, stored.lectures);
      writeSyncState(ctx.db, {
        ...successState(current, attemptAt, contentHash, tabNames, retained.issues, ctx.config.spreadsheetTitle),
        bootstrapped: true
      });
      ctx.db.exec("COMMIT");
    } catch (error) {
      ctx.db.exec("ROLLBACK");
      throw error;
    }
    await publishArchive(ctx.db);
    return { ok: true, unchanged: false, changeCount: events.length, error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The spreadsheet could not be read.";
    console.error("[sync]", detail);
    const message = "The timetable could not be refreshed. The last copy is still shown.";
    writeSyncState(ctx.db, {
      ...readSyncState(ctx.db),
      lastAttemptAt: attemptAt,
      lastError: message
    });
    return { ok: false, unchanged: false, changeCount: 0, error: message };
  }
}
function successState(current, attemptAt, contentHash, tabNames, parseIssues, title) {
  return {
    ...current,
    lastAttemptAt: attemptAt,
    lastSuccessAt: attemptAt,
    lastError: null,
    contentHash,
    tabNames,
    parseIssues,
    spreadsheetTitle: title
  };
}
function syncInFlight(db2) {
  return inflight.has(db2);
}
function runSync(ctx) {
  const existing = inflight.get(ctx.db);
  if (existing) return existing;
  const pending2 = performSync(ctx).finally(() => {
    inflight.delete(ctx.db);
  });
  inflight.set(ctx.db, pending2);
  return pending2;
}

// server/src/services/googleSheetsService.ts
var import_node_crypto6 = require("node:crypto");
async function fetchSpreadsheet(config2) {
  if (!config2.spreadsheetId) {
    throw new Error("SPREADSHEET_ID is not configured.");
  }
  const response = await fetch(spreadsheetExportUrl(config2.spreadsheetId), {
    redirect: "follow",
    signal: AbortSignal.timeout(2e4),
    headers: { "User-Agent": "itm-timetable-portal" }
  });
  if (!response.ok) {
    throw new Error(`Google Sheets export failed (${response.status}). The sheet may be private or temporarily unavailable.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 4 || buffer[0] !== 80 || buffer[1] !== 75) {
    throw new Error("The spreadsheet export was not an Excel file. Share the sheet as \u201CAnyone with the link can view\u201D.");
  }
  const hash = (0, import_node_crypto6.createHash)("sha256").update(buffer).digest("hex");
  return { buffer, hash };
}
async function fetchSheetSources(sources) {
  return Promise.all(
    sources.map(async (source) => {
      try {
        const file = await fetchSpreadsheet({ spreadsheetId: source.id });
        return { buffer: file.buffer, course: source.course, spreadsheetId: source.id };
      } catch (error) {
        const message = error instanceof Error ? error.message : "The spreadsheet could not be read.";
        throw new Error(`${source.course}: ${message}`);
      }
    })
  );
}

// server/src/mcp/oauth.ts
var import_express = __toESM(require("express"), 1);

// shared/coordinators.ts
var COORDINATORS = [
  { name: "Harshita Deshmukh", email: "harshitad@itm.edu", cohorts: ["Andrew NG", "Sam Altman"] },
  { name: "Kashmira Thakur", email: "kashmirat@itm.edu", cohorts: ["Jerry Sanders", "Larry Page"] },
  { name: "Vyoma Amravat", email: "avyoma@itm.edu", cohorts: ["Jeff Bezos", "Steve Jobs"] },
  { name: "Apeksha Phapale", email: "apekshap@itm.edu", cohorts: ["Tim Cook", "Elon Musk"] },
  { name: "Gaurav Deshmukh", email: "gauravd@itm.edu", cohorts: ["Demis Hassabis", "Jensen Huang"] },
  { name: "Hardik Kadam", email: "", cohorts: ["Mark Zuckerberg"] }
];
var titles2 = /* @__PURE__ */ new Set(["mr", "ms", "mrs", "dr", "prof", "sir", "mam", "maam"]);
function nameWords(value) {
  return value.toLowerCase().replace(/\./g, "").split(/\s+/).filter((word) => word.length > 1 && !titles2.has(word));
}
function coordinatorNamesMatch(a, b) {
  if (personMatch(a, b)) return true;
  const left = nameWords(a);
  const right = nameWords(b);
  if (left.length < 2 || right.length < 2) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.every((word) => longer.includes(word));
}
function findCoordinator(email, facultyName) {
  const mail = email?.trim().toLowerCase();
  if (mail) {
    const byEmail = COORDINATORS.find((person) => person.email && person.email.toLowerCase() === mail);
    if (byEmail) return byEmail;
  }
  const name = facultyName?.trim();
  if (!name) return void 0;
  const lowered = name.toLowerCase();
  if (lowered === "all" || lowered === "all faculty" || lowered === "all classes") return void 0;
  return COORDINATORS.find((person) => coordinatorNamesMatch(person.name, name));
}
function divisionMatchesAssigned(division, assigned) {
  const key = (value) => cohortName(cohortTrack(value).base).toLowerCase();
  return key(division) === key(assigned);
}

// server/src/mcp/oauthStore.ts
var import_node_crypto7 = __toESM(require("node:crypto"), 1);
var import_promises = __toESM(require("node:dns/promises"), 1);
var import_node_net = __toESM(require("node:net"), 1);

// server/src/mcp/types.ts
var MCP_SCOPES = [
  "timetable:read",
  "faculty:self",
  "coordinator:read",
  "faculty:all",
  "faculty:directory"
];

// server/src/mcp/oauthStore.ts
var CLIENT_TTL_SECONDS = 30 * 24 * 60 * 60;
var CIMD_TTL_SECONDS = 10 * 60;
var TX_TTL_SECONDS = 10 * 60;
var CODE_TTL_SECONDS = 90;
var ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
var REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
function sha256Hex2(value) {
  return import_node_crypto7.default.createHash("sha256").update(value).digest("hex");
}
function sha256Base64Url(value) {
  return import_node_crypto7.default.createHash("sha256").update(value).digest("base64url");
}
function randomToken(bytes = 32) {
  return import_node_crypto7.default.randomBytes(bytes).toString("base64url");
}
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return import_node_crypto7.default.timingSafeEqual(bufA, bufB);
}
function getMcpSigningKey() {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured for MCP OAuth.");
  }
  return import_node_crypto7.default.createHmac("sha256", secret).update("aayam-mcp-oauth-v1").digest();
}
function isPrivateOrReservedIp(ip) {
  const cleaned = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (cleaned.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(cleaned.slice(7));
  }
  const version = import_node_net.default.isIP(cleaned);
  if (version === 4) {
    const parts = cleaned.split(".").map((n) => Number.parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    if (cleaned === "::" || cleaned === "::1") return true;
    if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) return true;
    if (cleaned.startsWith("fe8") || cleaned.startsWith("fe9") || cleaned.startsWith("fea") || cleaned.startsWith("feb")) return true;
    if (cleaned.startsWith("ff")) return true;
    return false;
  }
  return true;
}
async function assertSafePublicHttpsUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid client_id URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("CIMD client_id URL must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("CIMD client_id URL must not contain credentials.");
  }
  if (parsed.port && parsed.port !== "443") {
    throw new Error("CIMD client_id URL must use standard HTTPS port 443.");
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("CIMD client_id hostname is not allowed.");
  }
  if (import_node_net.default.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error("CIMD client_id IP address is private or reserved.");
    }
    return parsed;
  }
  const records = await import_promises.default.lookup(host, { all: true }).catch(() => []);
  if (records.length === 0) {
    throw new Error("CIMD client_id hostname could not be resolved.");
  }
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error("CIMD client_id resolves to a private or reserved network address.");
    }
  }
  return parsed;
}
function isValidRedirectUri(rawUri) {
  try {
    const parsed = new URL(rawUri);
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol === "http:") {
      const host = parsed.hostname.toLowerCase();
      return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
    }
    return false;
  } catch {
    return false;
  }
}
async function defaultCimdFetch(url) {
  const parsed = await assertSafePublicHttpsUrl(url);
  const response = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(5e3),
    headers: { Accept: "application/json", "User-Agent": "aayam-mcp-oauth" }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch client metadata document (${response.status}).`);
  }
  const text3 = await response.text();
  if (Buffer.byteLength(text3, "utf8") > 64 * 1024) {
    throw new Error("Client metadata document exceeds 64KB limit.");
  }
  return JSON.parse(text3);
}
async function resolveOAuthClient(clientId, cimdFetcher = defaultCimdFetch) {
  const cleanId = clientId.trim();
  if (!cleanId) return null;
  const redis = getRedis();
  if (cleanId.startsWith("https://")) {
    const cacheKey = `oauth:cimd:${sha256Hex2(cleanId)}`;
    const cached = await redis.getJson(cacheKey).catch(() => null);
    if (cached) return cached;
    const doc = await cimdFetcher(cleanId);
    if (!doc || typeof doc !== "object") {
      throw new Error("Invalid client metadata document.");
    }
    if (doc.client_id !== cleanId) {
      throw new Error("CIMD client_id does not match document URL.");
    }
    if (!Array.isArray(doc.redirect_uris) || doc.redirect_uris.length === 0) {
      throw new Error("CIMD redirect_uris must be a non-empty array.");
    }
    const redirectUris = doc.redirect_uris.filter((u) => typeof u === "string" && isValidRedirectUri(u));
    if (redirectUris.length !== doc.redirect_uris.length) {
      throw new Error("CIMD contains invalid redirect_uris.");
    }
    const authMethod = typeof doc.token_endpoint_auth_method === "string" ? doc.token_endpoint_auth_method : "none";
    if (authMethod !== "none") {
      throw new Error("CIMD clients must use token_endpoint_auth_method 'none'.");
    }
    const client2 = {
      clientId: cleanId,
      clientName: typeof doc.client_name === "string" && doc.client_name.trim() ? doc.client_name.trim() : new URL(cleanId).hostname,
      clientUri: typeof doc.client_uri === "string" ? doc.client_uri : void 0,
      redirectUris,
      grantTypes: Array.isArray(doc.grant_types) ? doc.grant_types.filter((g) => typeof g === "string") : ["authorization_code", "refresh_token"],
      responseTypes: Array.isArray(doc.response_types) ? doc.response_types.filter((r) => typeof r === "string") : ["code"],
      tokenEndpointAuthMethod: "none",
      isCimd: true,
      createdAt: Date.now()
    };
    await redis.setJson(cacheKey, client2, CIMD_TTL_SECONDS).catch(() => {
    });
    return client2;
  }
  return await redis.getJson(`oauth:client:${cleanId}`).catch(() => null);
}
async function registerDcrClient(input) {
  if (!Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0 || input.redirect_uris.length > 10) {
    throw new Error("redirect_uris must be a non-empty array of at most 10 URIs.");
  }
  const redirectUris = input.redirect_uris.map((u) => typeof u === "string" ? u.trim() : "");
  if (redirectUris.some((u) => !isValidRedirectUri(u))) {
    throw new Error("Each redirect_uri must be HTTPS or http://localhost / http://127.0.0.1.");
  }
  const rawAuthMethod = typeof input.token_endpoint_auth_method === "string" ? input.token_endpoint_auth_method : "none";
  if (rawAuthMethod !== "none" && rawAuthMethod !== "client_secret_post" && rawAuthMethod !== "client_secret_basic") {
    throw new Error("Unsupported token_endpoint_auth_method.");
  }
  const grantTypes = Array.isArray(input.grant_types) ? input.grant_types.filter((g) => typeof g === "string") : ["authorization_code", "refresh_token"];
  if (!grantTypes.includes("authorization_code")) {
    throw new Error("grant_types must include authorization_code.");
  }
  const responseTypes = Array.isArray(input.response_types) ? input.response_types.filter((r) => typeof r === "string") : ["code"];
  if (!responseTypes.includes("code")) {
    throw new Error("response_types must include code.");
  }
  const clientId = `mcp_${randomToken(18)}`;
  const clientSecret = rawAuthMethod === "none" ? void 0 : `mcs_${randomToken(24)}`;
  const client2 = {
    clientId,
    clientName: typeof input.client_name === "string" && input.client_name.trim() ? input.client_name.trim().slice(0, 120) : "MCP Client",
    clientUri: typeof input.client_uri === "string" && isValidRedirectUri(input.client_uri) ? input.client_uri : void 0,
    redirectUris,
    grantTypes,
    responseTypes,
    tokenEndpointAuthMethod: rawAuthMethod,
    clientSecretHash: clientSecret ? sha256Hex2(clientSecret) : void 0,
    isCimd: false,
    createdAt: Date.now()
  };
  await getRedis().setJson(`oauth:client:${clientId}`, client2, CLIENT_TTL_SECONDS);
  return { client: client2, clientSecret };
}
async function saveAuthTransaction(tx) {
  await getRedis().setJson(`oauth:tx:${tx.txId}`, tx, TX_TTL_SECONDS);
}
async function getAuthTransaction(txId) {
  if (!txId) return null;
  return await getRedis().getJson(`oauth:tx:${txId}`);
}
async function consumeAuthTransaction(txId) {
  if (!txId) return null;
  const redis = getRedis();
  const tx = await redis.getJson(`oauth:tx:${txId}`);
  if (!tx) return null;
  await redis.del(`oauth:tx:${txId}`);
  return tx;
}
function allowedScopesForIdentity(faculty) {
  const allowed = ["timetable:read", "faculty:self"];
  if (faculty.canSeeAllFaculty || faculty.coordinatorCohorts.length > 0) {
    allowed.push("coordinator:read");
  }
  if (faculty.canSeeAllFaculty) {
    allowed.push("faculty:all", "faculty:directory");
  }
  return allowed;
}
function resolveGrantedScopes(requestedScope, faculty) {
  const allowed = allowedScopesForIdentity(faculty);
  const allowedSet = new Set(allowed);
  const tokens = requestedScope.split(/[\s,]+/).map((s) => s.trim()).filter((s) => MCP_SCOPES.includes(s));
  if (tokens.length === 0) return allowed;
  const intersection = [...new Set(tokens.filter((s) => allowedSet.has(s)))];
  return intersection.length > 0 ? intersection : ["timetable:read", "faculty:self"];
}
async function issueAuthorizationCode(input) {
  const code = `mc_${randomToken(24)}`;
  const codeHash = sha256Hex2(code);
  const record = {
    ...input,
    codeHash,
    createdAt: Date.now()
  };
  await getRedis().setJson(`oauth:code:${codeHash}`, record, CODE_TTL_SECONDS);
  return code;
}
async function consumeAuthorizationCode(code) {
  if (!code) return null;
  const codeHash = sha256Hex2(code);
  const redis = getRedis();
  const key = `oauth:code:${codeHash}`;
  const usedKey = `oauth:code:used:${codeHash}`;
  const firstUse = await redis.setNx(usedKey, "1", CODE_TTL_SECONDS);
  if (!firstUse) return null;
  const record = await redis.getJson(key);
  if (record) await redis.del(key);
  return record;
}
function signMcpAccessToken(input) {
  const nowSec = Math.floor(Date.now() / 1e3);
  const ttl = input.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
  const payload = {
    typ: "mcp_at",
    jti: `jti_${randomToken(18)}`,
    familyId: input.familyId,
    iss: input.iss,
    aud: input.aud,
    sub: input.faculty.email,
    faculty: input.faculty.facultyName,
    canSeeAllFaculty: input.faculty.canSeeAllFaculty,
    coordinatorCohorts: input.faculty.coordinatorCohorts,
    scopes: input.scopes,
    client_id: input.clientId,
    iat: nowSec,
    exp: nowSec + ttl
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = import_node_crypto7.default.createHmac("sha256", getMcpSigningKey()).update(encoded).digest("base64url");
  return { token: `${encoded}.${sig}`, payload };
}
function parseAndVerifyAccessTokenSignature(token) {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  try {
    const expectedSig = import_node_crypto7.default.createHmac("sha256", getMcpSigningKey()).update(encoded).digest("base64url");
    if (!timingSafeEqualStr(sig, expectedSig)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || payload.typ !== "mcp_at" || !payload.jti || !payload.sub || !payload.aud) return null;
    const nowSec = Math.floor(Date.now() / 1e3);
    if (typeof payload.exp !== "number" || nowSec >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
async function issueRefreshToken(input) {
  const refreshToken = `rt_${randomToken(32)}`;
  const tokenHash = sha256Hex2(refreshToken);
  const familyId = input.familyId || `fam_${randomToken(12)}`;
  const record = {
    tokenHash,
    familyId,
    clientId: input.clientId,
    scopes: input.scopes,
    resource: input.resource,
    faculty: input.faculty,
    used: false,
    createdAt: Date.now()
  };
  await getRedis().setJson(`oauth:rt:${tokenHash}`, record, REFRESH_TOKEN_TTL_SECONDS);
  return { refreshToken, familyId };
}
async function rotateRefreshToken(refreshToken, clientId) {
  if (!refreshToken) return { ok: false, reason: "Missing refresh token." };
  const tokenHash = sha256Hex2(refreshToken);
  const redis = getRedis();
  const key = `oauth:rt:${tokenHash}`;
  const record = await redis.getJson(key);
  if (!record) return { ok: false, reason: "Invalid or expired refresh token." };
  if (record.clientId !== clientId) return { ok: false, reason: "Refresh token client mismatch." };
  const familyRevoked = await redis.get(`oauth:rt-family-revoked:${record.familyId}`);
  if (familyRevoked) return { ok: false, reason: "Token family has been revoked." };
  if (record.used) {
    await redis.set(`oauth:rt-family-revoked:${record.familyId}`, "1", REFRESH_TOKEN_TTL_SECONDS);
    await redis.del(key);
    return { ok: false, reason: "Refresh token reuse detected." };
  }
  await redis.setJson(key, { ...record, used: true }, 300);
  return { ok: true, record };
}
async function revokeToken(token) {
  if (!token) return;
  const redis = getRedis();
  if (token.startsWith("rt_")) {
    const hash = sha256Hex2(token);
    const record = await redis.getJson(`oauth:rt:${hash}`);
    if (record) {
      await redis.set(`oauth:rt-family-revoked:${record.familyId}`, "1", REFRESH_TOKEN_TTL_SECONDS);
      await redis.del(`oauth:rt:${hash}`);
    }
    return;
  }
  const payload = parseAndVerifyAccessTokenSignature(token);
  if (payload) {
    const remaining = Math.max(1, payload.exp - Math.floor(Date.now() / 1e3));
    await redis.set(`oauth:revoked:${payload.jti}`, "1", remaining);
  }
}
async function isAccessTokenRevoked(payload) {
  const redis = getRedis();
  const revoked = await redis.get(`oauth:revoked:${payload.jti}`);
  if (revoked) return true;
  if (payload.familyId) {
    const familyRevoked = await redis.get(`oauth:rt-family-revoked:${payload.familyId}`);
    if (familyRevoked) return true;
  }
  return false;
}

// server/src/mcp/oauth.ts
var dcrRateLimiterFallback = new PinRateLimiter(12, 10 * 60 * 1e3);
var dcrRateLimiter = createDistributedRateLimiter("oauth_dcr", dcrRateLimiterFallback, 12, 10 * 60);
var tokenRateLimiterFallback = new PinRateLimiter(60, 5 * 60 * 1e3);
var tokenRateLimiter = createDistributedRateLimiter("oauth_token", tokenRateLimiterFallback, 60, 5 * 60);
function firstHeader(value) {
  if (Array.isArray(value)) return value[0]?.split(",")[0]?.trim() || "";
  if (typeof value === "string") return value.split(",")[0]?.trim() || "";
  return "";
}
function canonicalOrigin(req) {
  const configured = process.env.MCP_PUBLIC_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
    }
  }
  const trustProxy = Boolean(process.env.VERCEL) || process.env.TRUST_PROXY === "1";
  const forwardedProto = trustProxy ? firstHeader(req.headers["x-forwarded-proto"]) : "";
  const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : req.protocol || "http";
  const forwardedHost = trustProxy ? firstHeader(req.headers["x-forwarded-host"]) : "";
  const host = forwardedHost || req.get("host") || "localhost:8787";
  return `${proto}://${host}`;
}
function canonicalResourceUrl(req) {
  return `${canonicalOrigin(req)}/mcp`;
}
function normalizeResourceUri(raw) {
  try {
    const parsed = new URL(raw.trim());
    const pathname = parsed.pathname.replace(/\/+$/, "") || "";
    return `${parsed.origin}${pathname}`;
  } catch {
    return raw.trim().replace(/\/+$/, "");
  }
}
function acceptedResourceAudiences(req) {
  const origin = canonicalOrigin(req);
  const set = /* @__PURE__ */ new Set([`${origin}/mcp`, `${origin}/api/mcp`]);
  const configured = process.env.MCP_PUBLIC_URL?.trim();
  if (configured) {
    try {
      const configuredOrigin = new URL(configured).origin;
      set.add(`${configuredOrigin}/mcp`);
      set.add(`${configuredOrigin}/api/mcp`);
    } catch {
    }
  }
  return set;
}
function escapeHtml(text3) {
  return text3.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function renderHtmlPage(title, body, status = 200, res) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} \u2014 Aayam Timetable</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }
    .eyebrow {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      margin: 0 0 8px;
    }
    h1 { font-size: 20px; margin: 0 0 8px; line-height: 1.3; }
    p { font-size: 14px; line-height: 1.5; color: #475569; margin: 0 0 16px; }
    .identity {
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      margin-bottom: 16px;
    }
    .identity-name { font-weight: 600; font-size: 14px; color: #0f172a; }
    .identity-email { font-size: 12px; color: #64748b; margin-top: 2px; }
    .badge {
      display: inline-block;
      margin-top: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(16, 185, 129, 0.12);
      color: #047857;
    }
    .badge-elevated {
      background: rgba(245, 158, 11, 0.15);
      color: #b45309;
    }
    ul.scopes {
      list-style: none;
      padding: 0;
      margin: 0 0 20px;
      border-top: 1px solid #e2e8f0;
    }
    ul.scopes li {
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    ul.scopes strong { display: block; color: #0f172a; font-size: 13px; }
    ul.scopes span { color: #64748b; font-size: 12px; }
    .actions { display: flex; gap: 10px; }
    button {
      flex: 1;
      padding: 10px 14px;
      border-radius: 9px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn-primary { background: #0f172a; color: #ffffff; }
    .btn-secondary { background: #ffffff; color: #334155; border-color: #cbd5e1; }
    .meta { margin-top: 14px; font-size: 11px; color: #94a3b8; font-family: ui-monospace, monospace; }
    @media (prefers-color-scheme: dark) {
      body { background: #09090b; color: #f4f4f5; }
      .card { background: #18181b; border-color: #27272a; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4); }
      p { color: #a1a1aa; }
      .identity { background: #09090b; border-color: #27272a; }
      .identity-name, ul.scopes strong { color: #f4f4f5; }
      .identity-email, ul.scopes span, .eyebrow { color: #a1a1aa; }
      ul.scopes, ul.scopes li { border-color: #27272a; }
      .btn-primary { background: #f4f4f5; color: #09090b; }
      .btn-secondary { background: #18181b; color: #e4e4e7; border-color: #3f3f46; }
      .badge { color: #34d399; }
      .badge-elevated { color: #fbbf24; }
    }
  </style>
</head>
<body>
  <main class="card">${body}</main>
</body>
</html>`;
  if (res) {
    res.status(status);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"
    );
    res.send(html);
  }
  return html;
}
var SCOPE_LABELS = {
  "timetable:read": {
    title: "Read published timetables & room availability",
    detail: "Cohort schedules, weekly updates, cancellations, and free classrooms."
  },
  "faculty:self": {
    title: "Read your personal teaching schedule",
    detail: "Your upcoming classes, room assignments, and calendar feed URL."
  },
  "coordinator:read": {
    title: "Read your coordinated cohort schedules",
    detail: "Schedules and updates across the cohorts assigned to you."
  },
  "faculty:all": {
    title: "Read all faculty teaching schedules",
    detail: "Elevated access to look up any faculty member's teaching schedule."
  },
  "faculty:directory": {
    title: "Read confidential faculty directory",
    detail: "Staff emails, active status, and access permission flags."
  }
};
function renderConsentPage(res, params) {
  const roleLabel = params.faculty.canSeeAllFaculty ? "All-Access Faculty" : params.faculty.coordinatorCohorts.length > 0 ? "Class Coordinator" : "Faculty";
  const badgeClass = params.faculty.canSeeAllFaculty ? "badge badge-elevated" : "badge";
  const scopeList = params.scopes.map((scope) => {
    const info = SCOPE_LABELS[scope];
    return `<li><strong>${escapeHtml(info.title)}</strong><span>${escapeHtml(info.detail)} (${escapeHtml(scope)})</span></li>`;
  }).join("");
  const body = `
    <p class="eyebrow">Aayam MCP Authorization</p>
    <h1>Connect ${escapeHtml(params.clientName)}</h1>
    <p><strong>${escapeHtml(params.clientName)}</strong> is requesting permission to access your Aayam timetable account.</p>
    <div class="identity">
      <div class="identity-name">${escapeHtml(params.faculty.facultyName)}</div>
      <div class="identity-email">${escapeHtml(params.faculty.email)}</div>
      <span class="${badgeClass}">${escapeHtml(roleLabel)}</span>
    </div>
    <ul class="scopes">${scopeList}</ul>
    <form method="POST" action="/oauth/consent">
      <input type="hidden" name="txId" value="${escapeHtml(params.txId)}" />
      <input type="hidden" name="csrfToken" value="${escapeHtml(params.csrfToken)}" />
      <div class="actions">
        <button class="btn-secondary" type="submit" name="decision" value="deny">Deny</button>
        <button class="btn-primary" type="submit" name="decision" value="approve">Authorize Access</button>
      </div>
    </form>
    <div class="meta">Redirect target: ${escapeHtml(params.redirectHost)}</div>
  `;
  renderHtmlPage("Authorize MCP Client", body, 200, res);
}
function redirectWithError(res, redirectUri, error, description, state) {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  target.searchParams.set("error_description", description);
  if (state) target.searchParams.set("state", state);
  res.redirect(302, target.toString());
}
async function defaultExchangeGoogleCode(opts) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.");
  }
  const body = new URLSearchParams({
    code: opts.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
    code_verifier: opts.codeVerifier
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(1e4)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.id_token !== "string") {
    throw new Error("Failed to exchange Google authorization code.");
  }
  return { idToken: data.id_token };
}
async function defaultVerifyGoogleIdToken(idToken, expectedNonce) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(1e4) });
  if (!response.ok) {
    throw new Error("Invalid Google ID token.");
  }
  const data = await response.json();
  const email = (typeof data.email === "string" ? data.email : "").toLowerCase().trim();
  const emailVerified = data.email_verified === "true" || data.email_verified === true;
  const name = typeof data.name === "string" ? data.name : "";
  const aud = typeof data.aud === "string" ? data.aud : "";
  const iss = typeof data.iss === "string" ? data.iss : "";
  const nonce = typeof data.nonce === "string" ? data.nonce : "";
  if (!email || !emailVerified) {
    throw new Error("Google account email is not verified.");
  }
  const expectedClientId = getGoogleClientId();
  if (!expectedClientId || aud !== expectedClientId) {
    throw new Error("Google token was not issued for this application.");
  }
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw new Error("Google token issuer was not accepted.");
  }
  if (expectedNonce && nonce && !timingSafeEqualStr(nonce, expectedNonce)) {
    throw new Error("Google OAuth nonce mismatch.");
  }
  const allowedDomains = getAllowedDomains();
  if (!allowedDomains.some((d) => email.endsWith(`@${d}`))) {
    throw new Error(`Only accounts from [${allowedDomains.join(", ")}] are allowed.`);
  }
  return { email, name };
}
function toFacultyIdentity(row) {
  const coordinator = findCoordinator(row.email, row.faculty_name);
  return {
    id: row.id,
    email: row.email,
    facultyName: row.faculty_name,
    canSeeAllFaculty: Boolean(row.can_see_all_faculty),
    coordinatorCohorts: coordinator?.cohorts ?? []
  };
}
function parseClientCredentials(req) {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && /^Basic\s+/i.test(auth)) {
    try {
      const decoded = Buffer.from(auth.replace(/^Basic\s+/i, "").trim(), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      if (sep > 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, sep)),
          clientSecret: decodeURIComponent(decoded.slice(sep + 1))
        };
      }
    } catch {
    }
  }
  const body = req.body ?? {};
  return {
    clientId: typeof body.client_id === "string" ? body.client_id.trim() : "",
    clientSecret: typeof body.client_secret === "string" ? body.client_secret : void 0
  };
}
function authenticateClient(client2, presentedSecret) {
  if (client2.tokenEndpointAuthMethod === "none") return true;
  if (!client2.clientSecretHash || !presentedSecret) return false;
  return timingSafeEqualStr(sha256Hex2(presentedSecret), client2.clientSecretHash);
}
function setOAuthCors(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}
function createMcpAuthRouter(deps = {}) {
  const router = import_express.default.Router();
  const cimdFetcher = deps.cimdFetcher;
  const exchangeGoogleCode = deps.exchangeGoogleCode ?? defaultExchangeGoogleCode;
  const verifyGoogleIdToken = deps.verifyGoogleIdToken ?? defaultVerifyGoogleIdToken;
  const resolveFaculty = deps.resolveFaculty ?? ((email) => lookupFacultyByEmail(email, { touchLastLogin: true }));
  router.use("/.well-known", setOAuthCors);
  router.use(["/oauth/register", "/oauth/token", "/oauth/revoke"], setOAuthCors);
  router.use("/oauth", import_express.default.json({ limit: "32kb" }), import_express.default.urlencoded({ extended: false, limit: "32kb" }));
  const protectedResourceMetadata = (req, res) => {
    const origin = canonicalOrigin(req);
    const resource = req.path.endsWith("/api/mcp") ? `${origin}/api/mcp` : `${origin}/mcp`;
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      resource,
      authorization_servers: [origin],
      scopes_supported: [...MCP_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "Aayam Timetable MCP Server"
    });
  };
  router.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
  router.get("/.well-known/oauth-protected-resource/mcp", protectedResourceMetadata);
  router.get("/.well-known/oauth-protected-resource/api/mcp", protectedResourceMetadata);
  const authServerMetadata = (req, res) => {
    const origin = canonicalOrigin(req);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      revocation_endpoint: `${origin}/oauth/revoke`,
      scopes_supported: [...MCP_SCOPES],
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true
    });
  };
  router.get("/.well-known/oauth-authorization-server", authServerMetadata);
  router.get("/.well-known/openid-configuration", authServerMetadata);
  router.post("/oauth/register", async (req, res) => {
    const ip = getClientIp(req);
    const rate = await dcrRateLimiter.check(ip);
    if (rate.limited) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      res.status(429).json({ error: "too_many_requests", error_description: "Dynamic client registration rate limit exceeded." });
      return;
    }
    await dcrRateLimiter.recordFailure(ip);
    try {
      const { client: client2, clientSecret } = await registerDcrClient(req.body ?? {});
      res.status(201).json({
        client_id: client2.clientId,
        ...clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {},
        client_id_issued_at: Math.floor(client2.createdAt / 1e3),
        client_name: client2.clientName,
        ...client2.clientUri ? { client_uri: client2.clientUri } : {},
        redirect_uris: client2.redirectUris,
        grant_types: client2.grantTypes,
        response_types: client2.responseTypes,
        token_endpoint_auth_method: client2.tokenEndpointAuthMethod
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid client registration payload.";
      res.status(400).json({ error: "invalid_client_metadata", error_description: message });
    }
  });
  router.get("/oauth/authorize", async (req, res) => {
    const responseType = typeof req.query.response_type === "string" ? req.query.response_type.trim() : "";
    const clientId = typeof req.query.client_id === "string" ? req.query.client_id.trim() : "";
    const redirectUri = typeof req.query.redirect_uri === "string" ? req.query.redirect_uri.trim() : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const codeChallenge = typeof req.query.code_challenge === "string" ? req.query.code_challenge.trim() : "";
    const codeChallengeMethod = typeof req.query.code_challenge_method === "string" ? req.query.code_challenge_method.trim() : "";
    const requestedScope = typeof req.query.scope === "string" ? req.query.scope.trim() : "";
    const rawResource = typeof req.query.resource === "string" ? req.query.resource.trim() : "";
    let client2 = null;
    try {
      client2 = await resolveOAuthClient(clientId, cimdFetcher);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify client metadata.";
      renderHtmlPage("Invalid Client", `<p class="eyebrow">OAuth Error</p><h1>Client verification failed</h1><p>${escapeHtml(message)}</p>`, 400, res);
      return;
    }
    if (!client2) {
      renderHtmlPage("Unknown Client", `<p class="eyebrow">OAuth Error</p><h1>Unknown MCP client</h1><p>The requested client_id is not registered or valid.</p>`, 400, res);
      return;
    }
    if (!redirectUri || !client2.redirectUris.includes(redirectUri)) {
      renderHtmlPage("Invalid Redirect URI", `<p class="eyebrow">OAuth Error</p><h1>Redirect URI mismatch</h1><p>The redirect_uri does not match this client's registered redirect URIs.</p>`, 400, res);
      return;
    }
    if (responseType !== "code") {
      redirectWithError(res, redirectUri, "unsupported_response_type", "Only response_type=code is supported.", state);
      return;
    }
    if (!codeChallenge || codeChallenge.length < 43 || codeChallenge.length > 128 || codeChallengeMethod !== "S256") {
      redirectWithError(res, redirectUri, "invalid_request", "PKCE with code_challenge_method=S256 is required.", state);
      return;
    }
    const acceptedAudiences = acceptedResourceAudiences(req);
    const resource = rawResource ? normalizeResourceUri(rawResource) : canonicalResourceUrl(req);
    if (!acceptedAudiences.has(resource)) {
      redirectWithError(res, redirectUri, "invalid_target", "Requested resource does not match this MCP server.", state);
      return;
    }
    const googleClientId = getGoogleClientId();
    if (!googleClientId && !deps.exchangeGoogleCode) {
      redirectWithError(res, redirectUri, "server_error", "Google OAuth is not configured on this server.", state);
      return;
    }
    const txId = randomToken(24);
    const googleNonce = randomToken(18);
    const googleCodeVerifier = randomToken(32);
    const csrfToken = randomToken(24);
    await saveAuthTransaction({
      txId,
      clientId: client2.clientId,
      clientName: client2.clientName,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod: "S256",
      requestedScope,
      resource,
      googleNonce,
      googleCodeVerifier,
      csrfToken,
      createdAt: Date.now()
    });
    const origin = canonicalOrigin(req);
    const callbackUri = `${origin}/oauth/callback`;
    const googleAuth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuth.searchParams.set("client_id", googleClientId || "dev-google-client");
    googleAuth.searchParams.set("redirect_uri", callbackUri);
    googleAuth.searchParams.set("response_type", "code");
    googleAuth.searchParams.set("scope", "openid email profile");
    googleAuth.searchParams.set("state", txId);
    googleAuth.searchParams.set("nonce", googleNonce);
    googleAuth.searchParams.set("code_challenge", sha256Base64Url(googleCodeVerifier));
    googleAuth.searchParams.set("code_challenge_method", "S256");
    googleAuth.searchParams.set("prompt", "select_account");
    res.redirect(302, googleAuth.toString());
  });
  router.get("/oauth/callback", async (req, res) => {
    const txId = typeof req.query.state === "string" ? req.query.state.trim() : "";
    const googleError = typeof req.query.error === "string" ? req.query.error.trim() : "";
    const googleCode = typeof req.query.code === "string" ? req.query.code.trim() : "";
    const tx = await getAuthTransaction(txId);
    if (!tx) {
      renderHtmlPage("Session Expired", `<p class="eyebrow">OAuth Error</p><h1>Authorization session expired</h1><p>Please restart the connection from your AI assistant.</p>`, 400, res);
      return;
    }
    if (googleError) {
      await consumeAuthTransaction(txId);
      redirectWithError(res, tx.redirectUri, "access_denied", "Google sign-in was cancelled.", tx.state);
      return;
    }
    if (!googleCode) {
      await consumeAuthTransaction(txId);
      redirectWithError(res, tx.redirectUri, "access_denied", "Missing authorization code from Google.", tx.state);
      return;
    }
    try {
      const origin = canonicalOrigin(req);
      const { idToken } = await exchangeGoogleCode({
        code: googleCode,
        redirectUri: `${origin}/oauth/callback`,
        codeVerifier: tx.googleCodeVerifier
      });
      const verified = await verifyGoogleIdToken(idToken, tx.googleNonce);
      const directoryRow = await resolveFaculty(verified.email);
      const faculty = toFacultyIdentity(directoryRow);
      const scopes = resolveGrantedScopes(tx.requestedScope, faculty);
      await saveAuthTransaction({
        ...tx,
        authenticatedFaculty: faculty
      });
      renderConsentPage(res, {
        txId: tx.txId,
        csrfToken: tx.csrfToken,
        clientName: tx.clientName,
        redirectHost: new URL(tx.redirectUri).host,
        faculty,
        scopes
      });
    } catch (err) {
      await consumeAuthTransaction(txId);
      const message = err instanceof Error ? err.message : "Authentication failed.";
      renderHtmlPage(
        "Access Denied",
        `<p class="eyebrow">Faculty Verification</p><h1>Sign-in was refused</h1><p>${escapeHtml(message)}</p><p>Ask your timetable administrator to verify your account in the active faculty directory.</p>`,
        403,
        res
      );
    }
  });
  router.post("/oauth/consent", async (req, res) => {
    const body = req.body ?? {};
    const txId = typeof body.txId === "string" ? body.txId.trim() : "";
    const csrfToken = typeof body.csrfToken === "string" ? body.csrfToken.trim() : "";
    const decision = typeof body.decision === "string" ? body.decision.trim() : "";
    const tx = await consumeAuthTransaction(txId);
    if (!tx || !tx.authenticatedFaculty || !csrfToken || !timingSafeEqualStr(csrfToken, tx.csrfToken)) {
      renderHtmlPage("Invalid Consent", `<p class="eyebrow">OAuth Error</p><h1>Authorization request expired</h1><p>Please restart the connection from your MCP client.</p>`, 400, res);
      return;
    }
    if (decision !== "approve") {
      redirectWithError(res, tx.redirectUri, "access_denied", "The user denied the authorization request.", tx.state);
      return;
    }
    const scopes = resolveGrantedScopes(tx.requestedScope, tx.authenticatedFaculty);
    const code = await issueAuthorizationCode({
      clientId: tx.clientId,
      redirectUri: tx.redirectUri,
      codeChallenge: tx.codeChallenge,
      codeChallengeMethod: tx.codeChallengeMethod,
      scopes,
      resource: tx.resource,
      faculty: tx.authenticatedFaculty
    });
    const target = new URL(tx.redirectUri);
    target.searchParams.set("code", code);
    if (tx.state) target.searchParams.set("state", tx.state);
    res.redirect(302, target.toString());
  });
  router.post("/oauth/token", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const ip = getClientIp(req);
    const rate = await tokenRateLimiter.check(ip);
    if (rate.limited) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      res.status(429).json({ error: "too_many_requests", error_description: "Too many token requests." });
      return;
    }
    const body = req.body ?? {};
    const grantType = typeof body.grant_type === "string" ? body.grant_type.trim() : "";
    const creds = parseClientCredentials(req);
    if (!creds.clientId) {
      await tokenRateLimiter.recordFailure(ip);
      res.status(400).json({ error: "invalid_request", error_description: "Missing client_id." });
      return;
    }
    let client2 = null;
    try {
      client2 = await resolveOAuthClient(creds.clientId, cimdFetcher);
    } catch {
      client2 = null;
    }
    if (!client2 || !authenticateClient(client2, creds.clientSecret)) {
      await tokenRateLimiter.recordFailure(ip);
      res.status(401).json({ error: "invalid_client", error_description: "Client authentication failed." });
      return;
    }
    const origin = canonicalOrigin(req);
    if (grantType === "authorization_code") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : "";
      const codeVerifier = typeof body.code_verifier === "string" ? body.code_verifier.trim() : "";
      const rawResource = typeof body.resource === "string" ? body.resource.trim() : "";
      if (!code || !redirectUri || !codeVerifier) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_request", error_description: "Missing code, redirect_uri, or code_verifier." });
        return;
      }
      const record = await consumeAuthorizationCode(code);
      if (!record) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_grant", error_description: "Authorization code is invalid, expired, or already used." });
        return;
      }
      if (record.clientId !== client2.clientId || record.redirectUri !== redirectUri) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_grant", error_description: "Client or redirect_uri mismatch." });
        return;
      }
      if (!timingSafeEqualStr(sha256Base64Url(codeVerifier), record.codeChallenge)) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_grant", error_description: "PKCE code_verifier verification failed." });
        return;
      }
      if (rawResource && normalizeResourceUri(rawResource) !== record.resource) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_target", error_description: "Resource audience mismatch." });
        return;
      }
      const { refreshToken, familyId } = await issueRefreshToken({
        clientId: client2.clientId,
        scopes: record.scopes,
        resource: record.resource,
        faculty: record.faculty
      });
      const { token } = signMcpAccessToken({
        iss: origin,
        aud: record.resource,
        faculty: record.faculty,
        scopes: record.scopes,
        clientId: client2.clientId,
        familyId
      });
      await tokenRateLimiter.reset(ip);
      res.json({
        access_token: token,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: refreshToken,
        scope: record.scopes.join(" ")
      });
      return;
    }
    if (grantType === "refresh_token") {
      const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : "";
      const rawResource = typeof body.resource === "string" ? body.resource.trim() : "";
      const rotated = await rotateRefreshToken(refreshToken, client2.clientId);
      if (!rotated.ok) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_grant", error_description: rotated.reason });
        return;
      }
      const { record } = rotated;
      if (rawResource && normalizeResourceUri(rawResource) !== record.resource) {
        await tokenRateLimiter.recordFailure(ip);
        res.status(400).json({ error: "invalid_target", error_description: "Resource audience mismatch." });
        return;
      }
      let liveFaculty = record.faculty;
      if (databaseUrl() || deps.resolveFaculty) {
        try {
          const row = await resolveFaculty(record.faculty.email);
          liveFaculty = toFacultyIdentity(row);
        } catch {
          await tokenRateLimiter.recordFailure(ip);
          res.status(400).json({ error: "invalid_grant", error_description: "Faculty account is no longer active." });
          return;
        }
      }
      const liveAllowed = new Set(allowedScopesForIdentity(liveFaculty));
      const refreshedScopes = record.scopes.filter((s) => liveAllowed.has(s));
      const nextScopes = refreshedScopes.length > 0 ? refreshedScopes : ["timetable:read", "faculty:self"];
      const nextRt = await issueRefreshToken({
        familyId: record.familyId,
        clientId: client2.clientId,
        scopes: nextScopes,
        resource: record.resource,
        faculty: liveFaculty
      });
      const { token } = signMcpAccessToken({
        iss: origin,
        aud: record.resource,
        faculty: liveFaculty,
        scopes: nextScopes,
        clientId: client2.clientId,
        familyId: record.familyId
      });
      await tokenRateLimiter.reset(ip);
      res.json({
        access_token: token,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: nextRt.refreshToken,
        scope: nextScopes.join(" ")
      });
      return;
    }
    await tokenRateLimiter.recordFailure(ip);
    res.status(400).json({ error: "unsupported_grant_type", error_description: "Use authorization_code or refresh_token." });
  });
  router.post("/oauth/revoke", async (req, res) => {
    const body = req.body ?? {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token) {
      await revokeToken(token);
    }
    res.status(200).json({ ok: true });
  });
  return router;
}
function createRequireMcpAuth(deps = {}) {
  const resolveFaculty = deps.resolveFaculty ?? ((email) => lookupFacultyByEmail(email, { touchLastLogin: false }));
  return async function requireMcpAuth(req, res, next) {
    const origin = canonicalOrigin(req);
    const challenge = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="timetable:read faculty:self"`;
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== "string" || !/^Bearer\s+/i.test(authHeader)) {
      res.setHeader("WWW-Authenticate", challenge);
      res.status(401).json({ error: "unauthorized", error_description: "Bearer token required." });
      return;
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload = parseAndVerifyAccessTokenSignature(token);
    if (!payload) {
      res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
      res.status(401).json({ error: "invalid_token", error_description: "Access token is invalid or expired." });
      return;
    }
    const acceptedAudiences = acceptedResourceAudiences(req);
    if (!acceptedAudiences.has(normalizeResourceUri(payload.aud))) {
      res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
      res.status(401).json({ error: "invalid_token", error_description: "Access token audience mismatch." });
      return;
    }
    if (await isAccessTokenRevoked(payload)) {
      res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
      res.status(401).json({ error: "invalid_token", error_description: "Access token has been revoked." });
      return;
    }
    let liveIdentity = {
      id: 0,
      email: payload.sub,
      facultyName: payload.faculty,
      canSeeAllFaculty: payload.canSeeAllFaculty,
      coordinatorCohorts: payload.coordinatorCohorts ?? []
    };
    if (databaseUrl() || deps.resolveFaculty) {
      try {
        const row = await resolveFaculty(payload.sub);
        liveIdentity = toFacultyIdentity(row);
      } catch {
        res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
        res.status(401).json({ error: "invalid_token", error_description: "Faculty account is inactive or unauthorized." });
        return;
      }
    } else if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      res.setHeader("WWW-Authenticate", `${challenge}, error="invalid_token"`);
      res.status(401).json({ error: "invalid_token", error_description: "Faculty directory is unavailable." });
      return;
    }
    const liveAllowed = new Set(allowedScopesForIdentity(liveIdentity));
    const effectiveScopes = payload.scopes.filter((scope) => liveAllowed.has(scope));
    const authContext = {
      token,
      clientId: payload.client_id,
      scopes: effectiveScopes,
      expiresAt: payload.exp,
      resource: new URL(payload.aud),
      extra: {
        email: liveIdentity.email,
        facultyName: liveIdentity.facultyName,
        canSeeAllFaculty: liveIdentity.canSeeAllFaculty,
        coordinatorCohorts: liveIdentity.coordinatorCohorts,
        jti: payload.jti,
        familyId: payload.familyId
      }
    };
    req.auth = authContext;
    next();
  };
}

// server/src/mcp/server.ts
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");
var import_streamableHttp = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
var import_express2 = __toESM(require("express"), 1);
var import_zod = require("zod");
function mondayOf(iso) {
  const date = /* @__PURE__ */ new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
function plusDays(iso, days) {
  const date = /* @__PURE__ */ new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function sortLectures(a, b) {
  const date = (a.date ?? "").localeCompare(b.date ?? "");
  if (date !== 0) return date;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.division.localeCompare(b.division) || a.subject.localeCompare(b.subject);
}
function latestWeekWindow(lectures) {
  const dated2 = lectures.map((l) => l.date).filter((d) => Boolean(d)).sort();
  const latest = dated2[dated2.length - 1];
  if (!latest) return { start: null, end: null, lectures };
  const weekStart = mondayOf(latest);
  const weekEnd = plusDays(weekStart, 6);
  const filtered = lectures.filter((l) => l.date && l.date >= weekStart && l.date <= weekEnd);
  const filteredDates = filtered.map((l) => l.date).filter((d) => Boolean(d)).sort();
  return {
    start: filteredDates[0] ?? weekStart,
    end: filteredDates[filteredDates.length - 1] ?? weekEnd,
    lectures: filtered
  };
}
function filterByDateOrWeekday(lectures, date, weekday) {
  let out = lectures;
  if (date) {
    const clean = date.trim();
    out = out.filter((l) => l.date === clean);
  }
  if (weekday) {
    const clean = weekday.trim().toLowerCase();
    out = out.filter((l) => l.weekday.toLowerCase().startsWith(clean));
  }
  return out;
}
function compactLectureView(lecture) {
  return {
    id: lecture.id,
    date: lecture.date,
    weekday: lecture.weekday,
    startLabel: lecture.startLabel,
    endLabel: lecture.endLabel,
    startMinutes: lecture.startMinutes,
    endMinutes: lecture.endMinutes,
    subject: lecture.subject,
    faculty: lecture.faculty,
    room: lecture.room,
    course: lecture.course,
    batch: lecture.batch,
    semester: lecture.semester,
    division: lecture.division,
    kind: lecture.kind,
    displayStatus: lecture.displayStatus,
    reason: lecture.reason,
    changeSummary: lecture.changeSummary
  };
}
function jsonToolResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}
function toolError(message) {
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}
function getAuthFromExtra(extra) {
  const auth = extra.authInfo;
  return auth?.extra?.email ? auth : null;
}
function isAllowedOrigin(origin, req, config2) {
  try {
    const parsed = new URL(origin);
    const reqOrigin = canonicalOrigin(req);
    if (parsed.origin === reqOrigin) return true;
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol === "https:" && (host === "claude.ai" || host.endsWith(".claude.ai") || host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "platform.openai.com")) {
      return true;
    }
    const configured = (config2.clientOrigin || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (configured.includes(parsed.origin)) return true;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      const reqHost = (req.get("host") || "").toLowerCase();
      const runningLocally = reqHost.startsWith("localhost") || reqHost.startsWith("127.0.0.1");
      if (runningLocally || parsed.port === "6274") return true;
    }
    return false;
  } catch {
    return false;
  }
}
async function loadTimetableContext(db2, config2, monday) {
  await hydrateArchive(db2).catch(() => false);
  const now = /* @__PURE__ */ new Date();
  const snapshot = loadSnapshot(db2);
  const changes = listChanges(db2, 100);
  const restored = restoreRemovedLectures(snapshot, changes);
  const liveLectures = restored.lectures.map((l) => presentLecture(l, now, config2.highlightHours)).sort(sortLectures);
  if (monday) {
    const cleanMonday = monday.trim();
    const ids = readWeekSummaries(db2).filter((w) => mondayOf(w.start) === cleanMonday).map((w) => w.id);
    if (ids.length > 0) {
      await ensureWeeksHydrated(db2, ids);
      const weeks = readWeekBackupsByIds(db2, ids);
      const weekLectures = weeks.flatMap((w) => w.lectures).map((l) => presentLecture(l, now, config2.highlightHours)).sort(sortLectures);
      const weekChanges = weeks.flatMap((w) => w.changes ?? []);
      return {
        now,
        liveLectures,
        lectures: weekLectures,
        changes: weekChanges,
        weekStart: cleanMonday,
        weekEnd: plusDays(cleanMonday, 6),
        isPastWeek: true
      };
    }
  }
  const latest = latestWeekWindow(liveLectures);
  return {
    now,
    liveLectures,
    lectures: latest.lectures,
    changes,
    weekStart: latest.start,
    weekEnd: latest.end,
    isPastWeek: false
  };
}
function buildMcpServer(deps, origin) {
  const { db: db2, config: config2 } = deps;
  const listDirectory = deps.listDirectory ?? listFacultyDirectoryWithCache;
  const server = new import_mcp.McpServer(
    { name: "aayam-timetable", version: "1.0.0" },
    {
      instructions: "Aayam College Timetable MCP server. Call get_my_profile first to inspect the signed-in faculty member's permissions, get_my_schedule for their own classes, and list_cohorts_and_weeks before querying a specific cohort."
    }
  );
  server.registerTool(
    "get_my_profile",
    {
      title: "Get My Faculty Profile",
      description: "Return the OAuth-authenticated faculty member's name, verified email, role tier (faculty, coordinator, or all-access), assigned coordinator cohorts, and granted MCP scopes.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async (_args, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      return jsonToolResult({
        email: auth.extra.email,
        facultyName: auth.extra.facultyName,
        canSeeAllFaculty: auth.extra.canSeeAllFaculty,
        coordinatorCohorts: auth.extra.coordinatorCohorts,
        scopes: auth.scopes
      });
    }
  );
  server.registerTool(
    "get_my_schedule",
    {
      title: "Get My Teaching Schedule",
      description: "Return the authenticated faculty member's own classes for the current week or an optional date/weekday/past week. Does not return other faculty members' schedules \u2014 use get_faculty_schedule for that.",
      inputSchema: {
        date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional ISO date filter (YYYY-MM-DD)."),
        weekday: import_zod.z.string().optional().describe("Optional weekday filter such as Monday, Tue, Wednesday."),
        monday: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional past week Monday (YYYY-MM-DD) from list_cohorts_and_weeks."),
        includeCancelled: import_zod.z.boolean().default(true).describe("Include cancelled lectures (default true).")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ date, weekday, monday, includeCancelled }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      const ctx = await loadTimetableContext(db2, config2, monday);
      let lectures = ctx.lectures.filter(
        (l) => l.kind !== "break" && lectureMatchesFaculty(l.faculty, auth.extra.facultyName)
      );
      if (!includeCancelled) {
        lectures = lectures.filter((l) => l.displayStatus !== "cancelled");
      }
      lectures = filterByDateOrWeekday(lectures, date, weekday);
      return jsonToolResult({
        facultyName: auth.extra.facultyName,
        weekStart: ctx.weekStart,
        weekEnd: ctx.weekEnd,
        totalClasses: lectures.length,
        lectures: lectures.map(compactLectureView)
      });
    }
  );
  server.registerTool(
    "get_cohort_timetable",
    {
      title: "Get Cohort Timetable",
      description: "Return the published timetable for a specific student cohort/division (e.g. 'Sam Altman 2025' or 'Andrew NG'). Call list_cohorts_and_weeks if you need valid cohort names.",
      inputSchema: {
        division: import_zod.z.string().min(1).describe("Cohort or division name (e.g. 'Sam Altman 2025' or 'Andrew NG')."),
        date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional ISO date filter (YYYY-MM-DD)."),
        weekday: import_zod.z.string().optional().describe("Optional weekday filter (e.g. Monday)."),
        monday: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional past week Monday (YYYY-MM-DD)."),
        includeBreaks: import_zod.z.boolean().default(false).describe("Include lunch/short breaks (default false).")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ division, date, weekday, monday, includeBreaks }) => {
      const ctx = await loadTimetableContext(db2, config2, monday);
      const choices = cohortChoices(ctx.liveLectures);
      const target = division.trim().toLowerCase();
      const matched = choices.find(
        (c) => c.division.toLowerCase() === target || cohortLabel(c.division).toLowerCase() === target || c.division.toLowerCase().startsWith(target)
      );
      let lectures = matched ? ctx.lectures.filter((l) => lectureInCohort(l, matched)) : ctx.lectures.filter((l) => l.division.toLowerCase() === target);
      if (!includeBreaks) {
        lectures = lectures.filter((l) => l.kind !== "break");
      }
      lectures = filterByDateOrWeekday(lectures, date, weekday);
      if (lectures.length === 0 && !matched) {
        return toolError(`Cohort "${division}" was not found. Call list_cohorts_and_weeks to see available divisions.`);
      }
      return jsonToolResult({
        division: matched?.division ?? division,
        course: matched?.course ?? lectures[0]?.course ?? null,
        batch: matched?.batch ?? lectures[0]?.batch ?? null,
        weekStart: ctx.weekStart,
        weekEnd: ctx.weekEnd,
        totalSlots: lectures.length,
        lectures: lectures.map(compactLectureView)
      });
    }
  );
  server.registerTool(
    "list_cohorts_and_weeks",
    {
      title: "List Cohorts and Saved Weeks",
      description: "List active student cohorts (grouped by course and batch), the current published week range, and archived past weeks available for historical queries.",
      inputSchema: {
        course: import_zod.z.string().optional().describe("Optional course filter (e.g. BTech, MCA)."),
        batch: import_zod.z.string().optional().describe("Optional batch filter (e.g. 2025-29).")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ course, batch }) => {
      await hydrateArchive(db2).catch(() => false);
      const now = /* @__PURE__ */ new Date();
      const snapshot = loadSnapshot(db2);
      const live = snapshot.map((l) => presentLecture(l, now, config2.highlightHours));
      const latest = latestWeekWindow(live);
      let choices = cohortChoices(live);
      if (course) {
        choices = choices.filter((c) => c.course.toLowerCase() === course.trim().toLowerCase());
      }
      if (batch) {
        choices = choices.filter((c) => c.batch.toLowerCase() === batch.trim().toLowerCase());
      }
      const savedWeeks = readWeekSummaries(db2).filter((w) => (!course || w.course.toLowerCase() === course.trim().toLowerCase()) && (!batch || w.batch.toLowerCase() === batch.trim().toLowerCase())).map((w) => ({
        id: w.id,
        course: w.course,
        batch: w.batch,
        start: w.start,
        end: w.end,
        monday: mondayOf(w.start)
      }));
      const state = readSyncState(db2);
      return jsonToolResult({
        today: zonedParts(now, config2.timezone).iso,
        timezone: config2.timezone,
        currentWeek: { start: latest.start, end: latest.end },
        lastSyncedAt: state.lastSuccessAt,
        cohorts: choices.map((c) => ({
          division: c.division,
          label: cohortLabel(c.division),
          course: c.course,
          batch: c.batch,
          semester: c.semester
        })),
        savedWeeks
      });
    }
  );
  server.registerTool(
    "get_timetable_changes",
    {
      title: "Get Timetable Changes",
      description: "List recent timetable updates (cancellations, room changes, reschedules). Use scope='mine' for your own classes, 'cohort' for a division, or 'all' (requires coordinator or all-faculty access).",
      inputSchema: {
        scope: import_zod.z.enum(["mine", "cohort", "all"]).default("mine").describe("Which updates to return."),
        division: import_zod.z.string().optional().describe("Required when scope='cohort'."),
        limit: import_zod.z.number().int().min(1).max(100).default(25).describe("Maximum change events to return (1-100).")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ scope, division, limit }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      await hydrateArchive(db2).catch(() => false);
      const snapshot = loadSnapshot(db2);
      const changes = listChanges(db2, 100);
      if (scope === "mine") {
        const myIds = new Set(
          snapshot.filter((l) => l.kind !== "break" && lectureMatchesFaculty(l.faculty, auth.extra.facultyName)).map((l) => l.id)
        );
        const filtered = changes.filter((c) => changeMatchesFaculty(c, auth.extra.facultyName, myIds)).slice(0, limit);
        return jsonToolResult({ scope, count: filtered.length, changes: filtered });
      }
      if (scope === "cohort") {
        if (!division?.trim()) {
          return toolError("Parameter 'division' is required when scope='cohort'.");
        }
        const target = division.trim().toLowerCase();
        const filtered = changes.filter((c) => c.division?.toLowerCase() === target).slice(0, limit);
        return jsonToolResult({ scope, division, count: filtered.length, changes: filtered });
      }
      if (auth.extra.canSeeAllFaculty && auth.scopes.includes("faculty:all")) {
        const filtered = changes.slice(0, limit);
        return jsonToolResult({ scope: "all", count: filtered.length, changes: filtered });
      }
      if (auth.extra.coordinatorCohorts.length > 0 && auth.scopes.includes("coordinator:read")) {
        const filtered = changes.filter((c) => c.division && auth.extra.coordinatorCohorts.some((assigned) => divisionMatchesAssigned(c.division, assigned))).slice(0, limit);
        return jsonToolResult({ scope: "coordinator", cohorts: auth.extra.coordinatorCohorts, count: filtered.length, changes: filtered });
      }
      return toolError("Access denied: viewing all changes across every cohort requires coordinator or all-faculty privileges. Use scope='mine' or scope='cohort'.");
    }
  );
  server.registerTool(
    "find_free_rooms_or_slots",
    {
      title: "Find Free Classrooms",
      description: "Find classrooms that are unoccupied on a given date/weekday and optional time range across all published cohorts.",
      inputSchema: {
        date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("ISO date (YYYY-MM-DD). Defaults to today if neither date nor weekday is supplied."),
        weekday: import_zod.z.string().optional().describe("Weekday name (e.g. Monday, Tuesday)."),
        startTime: import_zod.z.string().optional().describe("Start time (e.g. '14:00' or '2:00 PM')."),
        endTime: import_zod.z.string().optional().describe("End time (e.g. '15:00' or '3:00 PM').")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ date, weekday, startTime, endTime }) => {
      const ctx = await loadTimetableContext(db2, config2);
      const targetDate = date || (!weekday ? zonedParts(ctx.now, config2.timezone).iso : void 0);
      const dayLectures = filterByDateOrWeekday(
        ctx.lectures.filter((l) => l.kind === "lecture" && l.displayStatus !== "cancelled"),
        targetDate,
        weekday
      );
      const allRooms = [
        ...new Set(
          ctx.liveLectures.filter((l) => l.kind === "lecture" && l.room && !/^https?:\/\//i.test(l.room)).map((l) => l.room.trim())
        )
      ].sort();
      const startMin = startTime ? parseTimeToken(startTime) : null;
      const endMin = endTime ? parseTimeToken(endTime) : startMin !== null ? startMin + 60 : null;
      if (startTime && startMin === null) {
        return toolError(`Could not parse startTime "${startTime}". Use formats like "14:00" or "2:00 PM".`);
      }
      const relevant = startMin !== null && endMin !== null ? dayLectures.filter((l) => l.startMinutes >= 0 && l.startMinutes < endMin && l.endMinutes > startMin) : dayLectures;
      const occupiedRooms = new Set(relevant.map((l) => l.room.trim()).filter(Boolean));
      const freeRooms = allRooms.filter((r) => !occupiedRooms.has(r));
      return jsonToolResult({
        date: targetDate ?? null,
        weekday: weekday ?? null,
        window: startTime ? { startTime, endTime: endTime ?? null } : null,
        freeRooms,
        occupiedRooms: [...occupiedRooms].sort(),
        totalKnownRooms: allRooms.length
      });
    }
  );
  server.registerTool(
    "get_faculty_schedule",
    {
      title: "Get Another Faculty Member's Schedule",
      description: "Confidential/privileged tool: look up a specific faculty member's teaching schedule. Regular faculty can only view their own schedule (prefer get_my_schedule); viewing other teachers requires can_see_all_faculty or coordinator scope.",
      inputSchema: {
        faculty: import_zod.z.string().min(1).describe("Faculty member name (e.g. 'Dr. Aarti P')."),
        date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional ISO date filter (YYYY-MM-DD)."),
        weekday: import_zod.z.string().optional().describe("Optional weekday filter."),
        monday: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional past week Monday (YYYY-MM-DD).")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ faculty, date, weekday, monday }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      const isSelf = personMatch(faculty, auth.extra.facultyName);
      const isAllAccess = auth.extra.canSeeAllFaculty && auth.scopes.includes("faculty:all");
      const isCoordinator = auth.extra.coordinatorCohorts.length > 0 && auth.scopes.includes("coordinator:read");
      if (!isSelf && !isAllAccess && !isCoordinator) {
        return toolError(
          "Access denied: viewing another faculty member's schedule requires can_see_all_faculty permission or coordinator ownership. Use get_my_schedule to view your own classes."
        );
      }
      const ctx = await loadTimetableContext(db2, config2, monday);
      let lectures = ctx.lectures.filter((l) => l.kind !== "break" && lectureMatchesFaculty(l.faculty, faculty));
      if (!isSelf && !isAllAccess && isCoordinator) {
        lectures = lectures.filter(
          (l) => auth.extra.coordinatorCohorts.some((assigned) => divisionMatchesAssigned(l.division, assigned))
        );
      }
      lectures = filterByDateOrWeekday(lectures, date, weekday);
      return jsonToolResult({
        facultyQuery: faculty,
        scopeApplied: isSelf ? "self" : isAllAccess ? "all_faculty" : "coordinator_cohorts",
        weekStart: ctx.weekStart,
        weekEnd: ctx.weekEnd,
        totalClasses: lectures.length,
        lectures: lectures.map(compactLectureView)
      });
    }
  );
  server.registerTool(
    "list_faculty_directory",
    {
      title: "List Confidential Faculty Directory",
      description: "Confidential tool: list registered faculty accounts from faculty_directory including emails, permission flags (can_see_all_faculty), active status, and last login timestamp. Strictly requires can_see_all_faculty permission.",
      inputSchema: {
        search: import_zod.z.string().optional().describe("Optional name or email substring filter."),
        activeOnly: import_zod.z.boolean().default(true).describe("Only return active directory accounts (default true).")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ search, activeOnly }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      if (!auth.extra.canSeeAllFaculty || !auth.scopes.includes("faculty:directory")) {
        return toolError(
          "Access denied: the faculty directory contains confidential staff emails and permission flags and strictly requires can_see_all_faculty privileges."
        );
      }
      let rows = await listDirectory();
      if (activeOnly) rows = rows.filter((r) => r.is_active);
      if (search?.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter((r) => r.faculty_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
      }
      return jsonToolResult({
        total: rows.length,
        directory: rows
      });
    }
  );
  server.registerTool(
    "get_calendar_subscription_info",
    {
      title: "Get Calendar Subscription URL",
      description: "Generate an iCalendar (.ics) subscription URL for the authenticated faculty member or a specific student cohort.",
      inputSchema: {
        target: import_zod.z.enum(["me", "cohort"]).default("me").describe("Whether to return your faculty feed or a cohort feed."),
        division: import_zod.z.string().optional().describe("Required when target='cohort'.")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ target, division }, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      if (target === "cohort") {
        if (!division?.trim()) {
          return toolError("Parameter 'division' is required when target='cohort'.");
        }
        const q2 = encodeURIComponent(division.trim());
        return jsonToolResult({
          target: "cohort",
          division: division.trim(),
          feedUrl: `${origin}/api/calendar.ics?division=${q2}`,
          downloadUrl: `${origin}/api/calendar.ics?division=${q2}&download=1`
        });
      }
      const q = encodeURIComponent(auth.extra.facultyName);
      return jsonToolResult({
        target: "faculty",
        facultyName: auth.extra.facultyName,
        feedUrl: `${origin}/api/calendar.ics?faculty=${q}`,
        downloadUrl: `${origin}/api/calendar.ics?faculty=${q}&download=1`
      });
    }
  );
  server.registerTool(
    "refresh_timetable_sync",
    {
      title: "Refresh Timetable Sync",
      description: "Privileged action: trigger an immediate sync from Google Sheets (rate-limited by Redis cooldown). Requires coordinator or all-faculty privileges.",
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (_args, extra) => {
      const auth = getAuthFromExtra(extra);
      if (!auth) return toolError("Authentication context missing.");
      if (!auth.extra.canSeeAllFaculty && auth.extra.coordinatorCohorts.length === 0) {
        return toolError("Access denied: triggering manual timetable sync requires coordinator or all-faculty access.");
      }
      const cooldownSec = Math.min(config2.syncIntervalSeconds, 15);
      const allowed = await getRedis().setNx("sync:manual:mcp-cooldown", "1", cooldownSec).catch(() => true);
      if (!allowed) {
        return jsonToolResult({
          ok: true,
          skipped: true,
          reason: `Sync recently ran. Try again after ${cooldownSec} seconds.`
        });
      }
      const outcome = await deps.triggerSync();
      return jsonToolResult({
        ok: outcome.ok,
        unchanged: outcome.unchanged,
        changeCount: outcome.changeCount,
        error: outcome.error
      });
    }
  );
  return server;
}
function createMcpRouter(deps) {
  const router = import_express2.default.Router();
  const requireAuth = createRequireMcpAuth(deps.oauth);
  const mcpOriginAndCors = (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (!isAllowedOrigin(origin, req, deps.config)) {
        res.status(403).json({ error: "forbidden_origin", error_description: "Origin is not permitted for MCP requests." });
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version"
    );
    res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
  const handleMcpPost = async (req, res) => {
    const accept = typeof req.headers.accept === "string" ? req.headers.accept : "";
    if (!accept.includes("text/event-stream")) {
      req.headers.accept = accept ? `${accept}, text/event-stream` : "application/json, text/event-stream";
    }
    const transport = new import_streamableHttp.StreamableHTTPServerTransport({
      sessionIdGenerator: void 0,
      enableJsonResponse: true
    });
    const server = buildMcpServer(deps, canonicalOrigin(req));
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[mcp] request error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal MCP server error." },
          id: null
        });
      }
    }
  };
  const handleMcpMethodNotAllowed = (_req, res) => {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32e3, message: "Method not allowed. Use POST for stateless Streamable HTTP MCP requests." },
      id: null
    });
  };
  for (const mountPath of ["/mcp", "/api/mcp"]) {
    router.use(mountPath, import_express2.default.json({ limit: "128kb" }), mcpOriginAndCors);
    router.post(mountPath, requireAuth, handleMcpPost);
    router.get(mountPath, requireAuth, handleMcpMethodNotAllowed);
    router.delete(mountPath, requireAuth, handleMcpMethodNotAllowed);
  }
  return router;
}

// server/src/app.ts
var import_meta2 = {};
function mondayOf2(iso) {
  const date = /* @__PURE__ */ new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
function plusDays2(iso, days) {
  const date = /* @__PURE__ */ new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function summaryInScope(week, filter, choices) {
  if (!filter || filter.faculty) return true;
  if (filter.division) {
    const choice = choices.find((item) => item.division === filter.division);
    if (!choice) return true;
    return week.course === choice.course && week.batch === choice.batch;
  }
  if (filter.course && week.course.toLowerCase() !== filter.course.toLowerCase()) return false;
  if (filter.batch && week.batch.toLowerCase() !== filter.batch.toLowerCase()) return false;
  return true;
}
function dominantSheetId(weeks) {
  const counts = /* @__PURE__ */ new Map();
  for (const week of weeks) {
    for (const lecture of week.lectures) {
      if (!lecture.spreadsheetId) continue;
      counts.set(lecture.spreadsheetId, (counts.get(lecture.spreadsheetId) ?? 0) + 1);
    }
  }
  let best = "";
  let count = 0;
  for (const [id, n] of counts) {
    if (n > count) {
      best = id;
      count = n;
    }
  }
  return best;
}
function withoutRepeatedCancels(lectures) {
  const kept = /* @__PURE__ */ new Set();
  for (const lecture of lectures) {
    if (lecture.kind !== "lecture" || lecture.displayStatus === "cancelled") continue;
    kept.add(`${lecture.date ?? ""}\0${lecture.division}\0${lecture.subject.trim().toLowerCase()}`);
  }
  return lectures.filter((lecture) => {
    if (lecture.kind !== "lecture" || lecture.displayStatus !== "cancelled") return true;
    return !kept.has(`${lecture.date ?? ""}\0${lecture.division}\0${lecture.subject.trim().toLowerCase()}`);
  });
}
function presentBackup(week, now, highlightHours, restoredIds) {
  const lectures = withoutRepeatedCancels(week.lectures.map((lecture) => presentLecture(lecture, now, highlightHours))).sort(byLecture);
  const lectureIds = new Set(lectures.map((lecture) => lecture.id));
  const divisions = new Set(lectures.map((lecture) => lecture.division));
  const changes = (week.changes ?? []).filter((change) => {
    if (lectures.length === 0) return false;
    if (change.lectureId && lectureIds.has(change.lectureId)) return true;
    if (change.division) return divisions.has(change.division);
    return true;
  }).map((change) => {
    const cancelled = Boolean(change.lectureId && restoredIds.has(change.lectureId) && change.type === "removed");
    const subject = change.previous?.subject || "A lecture";
    return {
      id: change.id,
      detectedAt: change.detectedAt,
      type: cancelled ? "cancelled" : change.type,
      lectureId: change.lectureId,
      division: change.division,
      course: change.course,
      semester: change.semester,
      tabName: change.tabName,
      date: change.date,
      weekday: change.weekday,
      summary: cancelled ? `${subject} lecture cancelled.` : change.summary,
      previous: change.previous,
      next: change.next,
      fields: change.fields ?? []
    };
  });
  return { id: week.id, course: week.course, batch: week.batch, start: week.start, end: week.end, lectures, changes };
}
function programLinkKey(course, batch) {
  return `${course.trim().toLowerCase()}\0${batch.trim().toLowerCase()}`;
}
function sheetLinks(lectures, sources) {
  const seen = /* @__PURE__ */ new Map();
  const put = (course, batch, id) => {
    const cleanCourse = course.trim();
    const cleanBatch = batch.trim();
    const cleanId = id.trim();
    if (!cleanCourse || !cleanBatch || !cleanId) return;
    const key = programLinkKey(cleanCourse, cleanBatch);
    if (seen.has(key)) return;
    seen.set(key, {
      spreadsheetId: cleanId,
      spreadsheetUrl: spreadsheetUrl(cleanId),
      course: cleanCourse,
      batch: cleanBatch
    });
  };
  for (const lecture of lectures) {
    if (lecture.spreadsheetId) put(lecture.course, lecture.batch, lecture.spreadsheetId);
  }
  for (const source of sources) {
    if (source.batch) put(source.course, source.batch, source.id);
  }
  return [...seen.values()];
}
function byLecture(a, b) {
  const date = (a.date ?? "").localeCompare(b.date ?? "");
  if (date !== 0) return date;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  const division = a.division.localeCompare(b.division);
  if (division !== 0) return division;
  return a.subject.localeCompare(b.subject);
}
function buildBootstrap(db2, config2, now = /* @__PURE__ */ new Date(), filter) {
  const state = readSyncState(db2);
  const zone = zonedParts(now, config2.timezone);
  persistCancelledRemovals(db2);
  const changes = listChanges(db2, 80);
  const restored = restoreRemovedLectures(loadSnapshot(db2), changes);
  const allLectures = restored.lectures.map((lecture) => presentLecture(lecture, now, config2.highlightHours)).sort(byLecture);
  const parsedChoices = cohortChoices(allLectures);
  const seenDivisions = new Set(parsedChoices.map((c) => c.division));
  const choices = [
    ...parsedChoices,
    ...DEFAULT_COHORT_CHOICES.filter((c) => !seenDivisions.has(c.division))
  ].sort((a, b) => {
    const course = a.course.localeCompare(b.course);
    if (course !== 0) return course;
    const year = batchYear(b.batch) - batchYear(a.batch);
    if (year !== 0) return year;
    const batch = b.batch.localeCompare(a.batch);
    if (batch !== 0) return batch;
    return cohortLabel(a.division).localeCompare(cohortLabel(b.division));
  });
  const faculties = listFacultyNames([
    ...allLectures.filter((lecture) => lecture.kind !== "break").map((lecture) => lecture.faculty),
    ...DEFAULT_FACULTY_NAMES
  ]);
  const scopeOf = (rows) => {
    if (filter?.faculty) {
      const faculty = filter.faculty;
      return rows.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, faculty));
    }
    if (filter?.division) {
      const division = filter.division;
      const choice = choices.find((item) => item.division === division);
      return choice ? rows.filter((lecture) => lectureInCohort(lecture, choice)) : rows.filter((lecture) => lecture.division === division);
    }
    if (filter?.course || filter?.batch) {
      return rows.filter(
        (lecture) => (!filter.course || lecture.course.toLowerCase() === filter.course.toLowerCase()) && (!filter.batch || lecture.batch.toLowerCase() === filter.batch.toLowerCase())
      );
    }
    return rows;
  };
  let lectures = allLectures;
  let relevantChanges = changes;
  if (filter?.faculty) {
    const targetFaculty = filter.faculty;
    const facultyPool = scopeOf(allLectures);
    lectures = facultyPool;
    const facultyIds = new Set(facultyPool.map((l) => l.id));
    relevantChanges = changes.filter((change) => changeMatchesFaculty(change, targetFaculty, facultyIds));
  } else if (filter?.division) {
    const targetDivision = filter.division;
    const choice = choices.find((item) => item.division === targetDivision);
    lectures = scopeOf(allLectures);
    const watchedDivisions = new Set(choice ? [choice.division, ...choice.also] : [targetDivision]);
    relevantChanges = changes.filter((change) => !change.division || watchedDivisions.has(change.division));
  } else if (filter?.course || filter?.batch) {
    lectures = scopeOf(allLectures);
    relevantChanges = changes.filter(
      (change) => !filter.course || change.course?.toLowerCase() === filter.course.toLowerCase()
    );
  }
  const dated2 = lectures.map((lecture) => lecture.date).filter((date) => Boolean(date)).sort();
  const latest = dated2[dated2.length - 1];
  if (latest) {
    const weekStartDate = mondayOf2(latest);
    const weekEndDate = plusDays2(weekStartDate, 6);
    lectures = lectures.filter((lecture) => lecture.date && lecture.date >= weekStartDate && lecture.date <= weekEndDate);
    relevantChanges = relevantChanges.filter((change) => !change.date || change.date >= weekStartDate && change.date <= weekEndDate);
  }
  const dates = lectures.map((lecture) => lecture.date).filter((date) => Boolean(date)).sort();
  const liveKeys = /* @__PURE__ */ new Set();
  const liveDates = /* @__PURE__ */ new Map();
  for (const lecture of allLectures) {
    if (!lecture.date) continue;
    const key = `${lecture.course}\0${lecture.batch}`;
    const list = liveDates.get(key) ?? [];
    list.push(lecture.date);
    liveDates.set(key, list);
  }
  for (const [key, list] of liveDates) {
    list.sort();
    liveKeys.add(`${key}\0${list[0]}\0${list[list.length - 1]}`);
  }
  const savedWeeks = readWeekSummaries(db2).filter((week) => !liveKeys.has(`${week.course}\0${week.batch}\0${week.start}\0${week.end}`)).filter((week) => summaryInScope(week, filter, choices)).map((week) => ({
    id: week.id,
    course: week.course,
    batch: week.batch,
    start: week.start,
    end: week.end,
    lectures: [],
    changes: []
  })).sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
  return {
    collegeName: config2.collegeName,
    schoolName: config2.schoolName,
    courseName: config2.courseName,
    spreadsheetId: config2.spreadsheetId,
    spreadsheetTitle: state.spreadsheetTitle || config2.spreadsheetTitle,
    spreadsheetUrl: spreadsheetUrl(config2.spreadsheetId),
    sheets: sheetLinks(restored.lectures, config2.spreadsheets),
    timezone: config2.timezone,
    today: zone.iso,
    now: now.toISOString(),
    weekStart: dates[0] ?? null,
    weekEnd: dates[dates.length - 1] ?? null,
    savedWeeks,
    sync: {
      lastSuccessAt: state.lastSuccessAt,
      lastAttemptAt: state.lastAttemptAt,
      lastError: state.lastError,
      stale: Boolean(state.lastError) || !state.lastSuccessAt,
      bootstrapped: state.bootstrapped,
      intervalSeconds: config2.syncIntervalSeconds,
      highlightHours: config2.highlightHours,
      tabNames: state.tabNames,
      contentHash: state.contentHash,
      source: "google-sheets-xlsx-export"
    },
    parseIssues: state.parseIssues,
    choices,
    faculties,
    lectures,
    changes: relevantChanges.map((change) => {
      if (!change.lectureId || !restored.restoredIds.has(change.lectureId) || change.type !== "removed") return change;
      const subject = change.previous?.subject || "A lecture";
      return { ...change, type: "cancelled", summary: `${subject} lecture cancelled.` };
    })
  };
}
var dbScopeIds = /* @__PURE__ */ new WeakMap();
var nextLocalScopeSeq = 0;
function cacheNamespace(db2) {
  if (databaseUrl()) return "shared";
  let id = dbScopeIds.get(db2);
  if (!id) {
    nextLocalScopeSeq += 1;
    id = `local_${nextLocalScopeSeq}`;
    dbScopeIds.set(db2, id);
  }
  return id;
}
function hashScope(value) {
  return import_node_crypto8.default.createHash("sha256").update(value).digest("hex").slice(0, 20);
}
function sendWithEtag(req, res, etagSeed, contentType, body, cacheControl = "public, max-age=0, must-revalidate") {
  const etag = `W/"${hashScope(etagSeed)}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", cacheControl);
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }
  if (contentType === "text/calendar") {
    res.send(body);
    return;
  }
  res.json(body);
}
function isMcpOrOAuthPath(url) {
  return url === "/mcp" || url.startsWith("/mcp/") || url.startsWith("/mcp?") || url === "/api/mcp" || url.startsWith("/api/mcp/") || url.startsWith("/api/mcp?") || url.startsWith("/.well-known/") || url.startsWith("/oauth/");
}
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!isMcpOrOAuthPath(req.url || "/")) {
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  next();
}
function allowedOrigins(config2) {
  const fromEnv = (config2.clientOrigin || "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) return [];
  return ["http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173"];
}
function createApp(db2, config2, load, options) {
  const app2 = (0, import_express3.default)();
  app2.disable("x-powered-by");
  if (process.env.VERCEL || process.env.TRUST_PROXY === "1") {
    app2.set("trust proxy", 1);
  }
  const origins = allowedOrigins(config2);
  const apiCors = (0, import_cors.default)({
    credentials: true,
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    }
  });
  app2.use((req, res, next) => {
    if (isMcpOrOAuthPath(req.url || "/")) {
      next();
      return;
    }
    apiCors(req, res, next);
  });
  app2.use(securityHeaders);
  app2.use((req, res, next) => {
    const url = req.url || "/";
    if (url === "/mcp" || url.startsWith("/mcp/") || url.startsWith("/mcp?") || url === "/api/mcp" || url.startsWith("/api/mcp/") || url.startsWith("/api/mcp?") || url.startsWith("/oauth/")) {
      next();
      return;
    }
    import_express3.default.json({ limit: "16kb" })(req, res, next);
  });
  if (process.env.VERCEL) {
    app2.use((req, _res, next) => {
      const url = req.url || "/";
      if (url === "/api" || url.startsWith("/api/") || url.startsWith("/api?") || isMcpOrOAuthPath(url)) {
        next();
        return;
      }
      req.url = url.startsWith("/") ? `/api${url}` : `/api/${url}`;
      next();
    });
  }
  const ns = cacheNamespace(db2);
  const redis = getRedis();
  const lastSyncBySheet = /* @__PURE__ */ new Map();
  async function triggerFullSync() {
    const outcome = await runSync({ db: db2, config: config2, load, loadAll: options?.loadAll });
    const nowMs = Date.now();
    for (const s of config2.spreadsheets) {
      lastSyncBySheet.set(s.id, nowMs);
      await redis.set(`${ns}:sync:sheet:${s.id}`, String(nowMs), config2.syncIntervalSeconds).catch(() => {
      });
    }
    return outcome;
  }
  app2.use(createMcpAuthRouter(options?.mcpOAuth));
  app2.use(
    createMcpRouter({
      db: db2,
      config: config2,
      triggerSync: triggerFullSync,
      oauth: options?.mcpOAuth,
      listDirectory: options?.listDirectory
    })
  );
  async function liveConfig() {
    const spreadsheets = await resolveSheetSources(config2.spreadsheets);
    const spreadsheetId = spreadsheets.find((sheet) => sheet.batch === "2025-29")?.id ?? spreadsheets[0]?.id ?? config2.spreadsheetId;
    return { ...config2, spreadsheets, spreadsheetId };
  }
  function syncPlan(filter, live) {
    const mark = (sheets) => {
      const startedAt = Date.now();
      for (const sheet2 of sheets) {
        lastSyncBySheet.set(sheet2.id, startedAt);
        void redis.set(`${ns}:sync:sheet:${sheet2.id}`, String(startedAt), config2.syncIntervalSeconds).catch(() => {
        });
      }
    };
    if (filter.faculty || filter.all) {
      const sheets = live.spreadsheets;
      if (sheets.length === 0) return null;
      const loadAll = options?.loadAll;
      return {
        sheets,
        everything: true,
        ctx: {
          db: db2,
          config: live,
          load: () => {
            mark(sheets);
            return load();
          },
          loadAll: loadAll ? () => {
            mark(sheets);
            return loadAll();
          } : void 0
        }
      };
    }
    const named = Boolean(filter.division || filter.batch || filter.course);
    const sheet = sheetForScope(filter, live.spreadsheets) ?? (named ? void 0 : live.spreadsheets.find((source) => source.id === live.spreadsheetId) ?? live.spreadsheets[0]);
    if (!sheet) return null;
    return {
      sheets: [sheet],
      everything: false,
      ctx: {
        db: db2,
        config: { ...live, spreadsheetId: sheet.id },
        load: () => {
          mark([sheet]);
          return fetchSpreadsheet({ spreadsheetId: sheet.id });
        },
        loadAll: async () => {
          mark([sheet]);
          return [
            {
              ...await fetchSpreadsheet({ spreadsheetId: sheet.id }),
              course: sheet.course,
              spreadsheetId: sheet.id
            }
          ];
        }
      }
    };
  }
  function storedSheetIsCurrent(sheet, lectures) {
    const rows = lectures.filter(
      (lecture) => sheet.batch ? lecture.course === sheet.course && lecture.batch === sheet.batch : lecture.spreadsheetId === sheet.id
    );
    if (rows.length === 0) return true;
    const ids = [...new Set(rows.map((lecture) => lecture.spreadsheetId).filter((id) => Boolean(id)))];
    if (ids.length === 0) return true;
    return ids.includes(sheet.id);
  }
  async function syncIfStale(filter = {}) {
    if (!options?.syncOnRead) return;
    await hydrateArchive(db2).catch(() => false);
    const live = await liveConfig();
    const plan = syncPlan(filter, live);
    if (!plan) {
      if (filter.faculty || filter.all) {
        const state = readSyncState(db2);
        const age = state.lastSuccessAt ? Date.now() - new Date(state.lastSuccessAt).getTime() : Number.POSITIVE_INFINITY;
        if (age > live.syncIntervalSeconds * 1e3) await runSync({ db: db2, config: live, load, loadAll: options.loadAll });
      }
      return;
    }
    const sheetFresh = async (sheetId) => {
      const localTs = lastSyncBySheet.get(sheetId) ?? 0;
      if (Date.now() - localTs < live.syncIntervalSeconds * 1e3) return true;
      if (redis.isShared || databaseUrl()) {
        const remoteTsRaw = await redis.get(`${ns}:sync:sheet:${sheetId}`).catch(() => null);
        const remoteTs = remoteTsRaw ? Number(remoteTsRaw) : 0;
        if (Number.isFinite(remoteTs) && Date.now() - remoteTs < live.syncIntervalSeconds * 1e3) {
          lastSyncBySheet.set(sheetId, remoteTs);
          return true;
        }
      }
      return false;
    };
    const isFresh = async () => {
      const flags = await Promise.all(plan.sheets.map((sheet) => sheetFresh(sheet.id)));
      return flags.every(Boolean);
    };
    const snapshot = loadSnapshot(db2);
    const currentSheets = plan.sheets.every((sheet) => storedSheetIsCurrent(sheet, snapshot));
    const saved = plan.everything ? readSyncState(db2).bootstrapped && snapshot.length > 0 && currentSheets : snapshot.some((lecture) => plan.sheets.some((sheet) => lecture.spreadsheetId === sheet.id || sheet.batch && lecture.course === sheet.course && lecture.batch === sheet.batch)) && currentSheets;
    if (await isFresh() && (saved || plan.everything)) return;
    if (saved) {
      const lockKey = `${ns}:sync:lock:${plan.everything ? "all" : plan.sheets.map((s) => s.id).join(",")}`;
      const acquired = await redis.setNx(lockKey, "1", Math.min(25, live.syncIntervalSeconds)).catch(() => true);
      if (!acquired) return;
      const running = runSync(plan.ctx).catch((err) => {
        console.error("[sync]", err instanceof Error ? err.message : err);
      }).finally(() => {
        void redis.del(lockKey).catch(() => {
        });
      });
      options.runInBackground?.(running);
      return;
    }
    await runSync(plan.ctx);
    if (!await isFresh()) await runSync(plan.ctx);
  }
  app2.get("/api/health", async (req, res) => {
    const state = readSyncState(db2);
    const checkDb = req.query.db === "1" || req.query.db === "true";
    let dbStatus;
    if (checkDb) {
      dbStatus = await checkDatabaseConnection();
    }
    res.status(state.lastSuccessAt ? 200 : 503).json({
      ok: Boolean(state.lastSuccessAt),
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
      ...dbStatus ? { db: dbStatus } : {}
    });
  });
  app2.get("/api/db-status", async (req, res) => {
    const force = req.query.fresh === "1" || req.query.fresh === "true";
    const status = await checkDatabaseConnection({ force });
    res.status(status.connected ? 200 : 503).json(status);
  });
  app2.get("/api/week", async (req, res) => {
    const monday = typeof req.query.monday === "string" ? req.query.monday.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(monday)) {
      res.status(400).json({ error: "Missing week." });
      return;
    }
    await hydrateArchive(db2).catch(() => false);
    const division = (typeof req.query.division === "string" ? req.query.division : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    const state = readSyncState(db2);
    const scopeKey = hashScope(`${monday}|${division}|${faculty}|${course}|${batch}`);
    const cacheKey = `${ns}:resp:week:${state.contentHash ?? "none"}:${scopeKey}`;
    const cached = await redis.getJson(cacheKey).catch(() => null);
    if (cached) {
      sendWithEtag(req, res, `${cacheKey}:${state.lastSuccessAt ?? "none"}`, "json", cached, "public, max-age=60, stale-while-revalidate=300");
      return;
    }
    const filter = { division, faculty, course, batch };
    const choices = cohortChoices(loadSnapshot(db2).map((lecture) => presentLecture(lecture, /* @__PURE__ */ new Date(), config2.highlightHours)));
    const ids = preferOneWeekCopies(readWeekSummaries(db2)).filter((week) => mondayOf2(week.start) === monday).filter((week) => summaryInScope(week, filter, choices)).map((week) => week.id);
    await ensureWeeksHydrated(db2, ids);
    const now = /* @__PURE__ */ new Date();
    const changes = listChanges(db2, 80);
    const restoredIds = restoreRemovedLectures(loadSnapshot(db2), changes).restoredIds;
    const records = preferOneWeekCopies(readWeekBackupsByIds(db2, ids));
    const opened = records.map((week) => presentBackup(week, now, config2.highlightHours, restoredIds));
    const lectures = opened.flatMap((week) => week.lectures);
    const weekChanges = opened.flatMap((week) => week.changes);
    const sheetId = dominantSheetId(records);
    const scopedLectures = faculty ? lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, faculty)) : division ? lectures.filter((lecture) => {
      const choice = choices.find((item) => item.division === division);
      return choice ? lectureInCohort(lecture, choice) : lecture.division === division;
    }) : lectures;
    const payload = {
      lectures: scopedLectures,
      changes: weekChanges,
      spreadsheetUrl: sheetId ? spreadsheetUrl(sheetId) : null
    };
    await redis.setJson(cacheKey, payload, 300).catch(() => {
    });
    sendWithEtag(req, res, `${cacheKey}:${state.lastSuccessAt ?? "none"}`, "json", payload, "public, max-age=60, stale-while-revalidate=300");
  });
  app2.get("/api/bootstrap", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    const scope = { division, faculty, course, batch, all: req.query.all === "1" };
    await syncIfStale(scope);
    const live = await liveConfig();
    const now = /* @__PURE__ */ new Date();
    const state = readSyncState(db2);
    const refreshing = syncInFlight(db2);
    const zone = zonedParts(now, live.timezone);
    const noticesVer = await redis.get("notices:version").catch(() => null) || "0";
    const sheetsSig = hashScope(live.spreadsheets.map((s) => s.id).join(","));
    const scopeKey = hashScope(`${division}|${faculty}|${course}|${batch}|${req.query.all === "1" ? "1" : "0"}`);
    const cacheKey = `${ns}:resp:bootstrap:${state.contentHash ?? "none"}:${state.lastSuccessAt ?? "none"}:${state.lastError ?? "ok"}:${zone.iso}:${sheetsSig}:${noticesVer}:${scopeKey}`;
    let payload = !refreshing ? await redis.getJson(cacheKey).catch(() => null) : null;
    if (!payload) {
      const base = buildBootstrap(db2, live, now, { division, faculty, course, batch });
      const notices = await noticesForScope({ division, faculty, course, batch }, base.choices ?? []);
      payload = { ...base, notices };
      if (!refreshing) {
        await redis.setJson(cacheKey, payload, Math.min(live.syncIntervalSeconds, 30)).catch(() => {
        });
      }
    } else {
      payload = { ...payload, now: now.toISOString() };
    }
    const etagSeed = `${cacheKey}:${refreshing ? "syncing" : "idle"}`;
    sendWithEtag(
      req,
      res,
      etagSeed,
      "json",
      { ...payload, sync: { ...payload.sync, refreshing } },
      "public, max-age=0, must-revalidate"
    );
  });
  app2.get("/api/calendar.ics", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    await syncIfStale({ division, faculty });
    const state = readSyncState(db2);
    const scopeKey = hashScope(`${division}|${faculty}`);
    const cacheKey = `${ns}:resp:ics:${state.contentHash ?? "none"}:${state.lastSuccessAt ?? "none"}:${scopeKey}`;
    const name = faculty || cohortLabel(division);
    let icsText2 = await redis.get(cacheKey).catch(() => null);
    if (!icsText2) {
      const snapshot = buildBootstrap(db2, config2);
      const choice = division ? cohortChoices(snapshot.lectures).find((item) => item.division === division) : void 0;
      const lectures = faculty ? snapshot.lectures.filter((lecture) => lectureMatchesFaculty(lecture.faculty, faculty)) : choice ? snapshot.lectures.filter((lecture) => lectureInCohort(lecture, choice)) : division ? snapshot.lectures.filter((lecture) => lecture.division === division) : [];
      if (!faculty && !division || lectures.length === 0) {
        res.status(404).type("text/plain").send(faculty ? "No lectures for that faculty." : "Unknown cohort.");
        return;
      }
      icsText2 = calendarFile(lectures, config2.timezone, name, { includeCohort: Boolean(faculty) });
      await redis.set(cacheKey, icsText2, 60).catch(() => {
      });
    }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    if (req.query.download === "1") {
      const file = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "timetable"}.ics`;
      res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    }
    sendWithEtag(req, res, cacheKey, "text/calendar", icsText2, "no-store");
  });
  app2.get("/api/changes", async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 80));
    const state = readSyncState(db2);
    const cacheKey = `${ns}:resp:changes:${state.contentHash ?? "none"}:${state.lastSuccessAt ?? "none"}:${limit}`;
    let changes = await redis.getJson(cacheKey).catch(() => null);
    if (!changes) {
      changes = listChanges(db2, limit);
      await redis.setJson(cacheKey, changes, 30).catch(() => {
      });
    }
    sendWithEtag(req, res, cacheKey, "json", { changes });
  });
  let lastForcedSync = 0;
  app2.post("/api/sync", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    const everySheet = Boolean(faculty) || req.query.all === "1";
    const live = await liveConfig();
    const target = everySheet ? void 0 : sheetForScope({ division, course, batch }, live.spreadsheets);
    const minGapMs = Math.min(config2.syncIntervalSeconds, 15) * 1e3;
    const cooldownAllowed = Date.now() - lastForcedSync >= minGapMs && await redis.setNx(`${ns}:sync:forced:${target?.id ?? "all"}`, "1", Math.ceil(minGapMs / 1e3)).catch(() => true);
    if (!cooldownAllowed) {
      res.setHeader("Retry-After", String(Math.ceil(minGapMs / 1e3)));
      const early = buildBootstrap(db2, live, /* @__PURE__ */ new Date(), { division, faculty, course, batch });
      const earlyNotices = await noticesForScope({ division, faculty, course, batch }, early.choices ?? []);
      res.json({ ...early, notices: earlyNotices });
      return;
    }
    lastForcedSync = Date.now();
    if (target) {
      await runSync({
        db: db2,
        config: { ...live, spreadsheetId: target.id },
        load: () => fetchSpreadsheet({ spreadsheetId: target.id }),
        loadAll: async () => [
          {
            ...await fetchSpreadsheet({ spreadsheetId: target.id }),
            course: target.course,
            spreadsheetId: target.id
          }
        ]
      });
      const nowMs = Date.now();
      lastSyncBySheet.set(target.id, nowMs);
      await redis.set(`${ns}:sync:sheet:${target.id}`, String(nowMs), live.syncIntervalSeconds).catch(() => {
      });
    } else if (everySheet) {
      await runSync({ db: db2, config: live, load, loadAll: options?.loadAll });
      const nowMs = Date.now();
      for (const s of live.spreadsheets) {
        lastSyncBySheet.set(s.id, nowMs);
        await redis.set(`${ns}:sync:sheet:${s.id}`, String(nowMs), live.syncIntervalSeconds).catch(() => {
        });
      }
    } else {
      await triggerFullSync();
    }
    const synced = buildBootstrap(db2, live, /* @__PURE__ */ new Date(), { division, faculty, course, batch });
    const syncedNotices = await noticesForScope({ division, faculty, course, batch }, synced.choices ?? []);
    res.json({ ...synced, notices: syncedNotices });
  });
  app2.get("/api/auth/config", (_req, res) => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    res.json({ clientId });
  });
  app2.get("/api/auth/me", (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      email: session.email,
      faculty: session.faculty,
      canSeeAllFaculty: Boolean(session.canSeeAllFaculty)
    });
  });
  app2.post("/api/auth/google", async (req, res) => {
    const ip = getClientIp(req);
    const rateCheck = await distributedLoginRateLimiter.check(ip);
    if (rateCheck.limited) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
      res.status(429).json({ ok: false, error: `Too many sign-in attempts. Try again in ${rateCheck.retryAfterSeconds} seconds.` });
      return;
    }
    await distributedLoginRateLimiter.recordFailure(ip);
    const credential = typeof req.body?.credential === "string" ? req.body.credential.trim() : "";
    if (!credential) {
      console.warn("[auth] Google login rejected: Missing credential payload.");
      res.status(400).json({ ok: false, error: "Missing credential." });
      return;
    }
    try {
      const { email } = await verifyGoogleCredential(credential);
      console.log(`[auth] Verified Google token for ${email}`);
      const faculty = await authenticateFacultyWithNeon(email);
      console.log(`[auth] Authenticated faculty ${faculty.faculty_name} (${faculty.email}) with all-access: ${faculty.can_see_all_faculty}`);
      const token = signSession({
        email: faculty.email,
        faculty: faculty.faculty_name,
        canSeeAllFaculty: faculty.can_see_all_faculty
      });
      await distributedLoginRateLimiter.reset(ip);
      setSessionCookie(res, token);
      res.json({
        ok: true,
        email: faculty.email,
        faculty: faculty.faculty_name,
        canSeeAllFaculty: faculty.can_see_all_faculty,
        token
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      console.error("[auth] Google auth failure:", message);
      res.status(403).json({ ok: false, error: "Sign-in was refused. Use an authorized faculty account." });
    }
  });
  app2.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  app2.post("/api/auth/pin-verify", async (req, res) => {
    const ip = getClientIp(req);
    const rateCheck = await distributedPinRateLimiter.check(ip);
    if (rateCheck.limited) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
      res.status(429).json({
        ok: false,
        error: `Too many failed attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`
      });
      return;
    }
    const rawPin = typeof req.body?.pin === "number" ? String(req.body.pin) : typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
    if (!rawPin) {
      res.status(400).json({ ok: false, error: "Missing PIN." });
      return;
    }
    if (!/^\d{6}$/.test(rawPin)) {
      await distributedPinRateLimiter.recordFailure(ip);
      res.status(400).json({ ok: false, error: "Invalid PIN format. PIN must be exactly 6 digits." });
      return;
    }
    try {
      const result = await verifyBatchPinWithNeon(rawPin);
      if (result && result.ok) {
        await distributedPinRateLimiter.reset(ip);
        res.json({ ok: true, course: result.course, batch: result.batch });
      } else {
        await distributedPinRateLimiter.recordFailure(ip);
        res.status(401).json({ ok: false, error: "Invalid PIN. Please check with your class representative." });
      }
    } catch (err) {
      console.error("[pin-verify] Unexpected verification failure:", err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred while verifying PIN. Please try again." });
    }
  });
  app2.post("/api/auth/batch-verify", async (req, res) => {
    const ip = getClientIp(req);
    const rateCheck = await distributedPinRateLimiter.check(ip);
    if (rateCheck.limited) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
      res.status(429).json({
        ok: false,
        error: `Too many failed attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`
      });
      return;
    }
    const course = typeof req.body?.course === "string" ? req.body.course.trim() : "";
    const batch = typeof req.body?.batch === "string" ? req.body.batch.trim() : "";
    const rawCode = typeof req.body?.code === "number" ? String(req.body.code) : typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!course || !batch || !rawCode) {
      res.status(400).json({ ok: false, error: "Missing course, batch, or code." });
      return;
    }
    if (!/^\d{6}$/.test(rawCode)) {
      await distributedPinRateLimiter.recordFailure(ip);
      res.status(400).json({ ok: false, error: "Invalid access code format. Must be exactly 6 digits." });
      return;
    }
    try {
      const envKey = `BATCH_CODE_${course.toUpperCase().replace(/\W+/g, "_")}_${batch.toUpperCase().replace(/\W+/g, "_")}`;
      const fallbackEnvKey = `BATCH_CODE_${batch.toUpperCase().replace(/\W+/g, "_")}`;
      const expected = (process.env[envKey] || process.env[fallbackEnvKey] || "").trim();
      if (!/^\d{6}$/.test(expected)) {
        res.status(403).json({ ok: false, error: "This batch has no access code configured." });
        return;
      }
      if (rawCode === expected) {
        await distributedPinRateLimiter.reset(ip);
        res.json({ ok: true, course, batch });
      } else {
        await distributedPinRateLimiter.recordFailure(ip);
        res.status(401).json({ ok: false, error: `Invalid access code for ${course} ${batch}.` });
      }
    } catch (err) {
      console.error("[batch-verify] Unexpected verification failure:", err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred while verifying access code." });
    }
  });
  registerAdminRoutes(app2, {
    fallbackSheets: config2.spreadsheets,
    syncSheet: async (source) => {
      clearSheetSourceCache();
      let file;
      try {
        file = await fetchSpreadsheet({ spreadsheetId: source.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "That sheet could not be read.";
        return { ok: false, error: message };
      }
      const outcome = await runSync({
        db: db2,
        config: { ...config2, spreadsheetId: source.id, courseName: source.course },
        load: async () => file,
        loadAll: async () => [{ ...file, course: source.course, spreadsheetId: source.id }],
        replaceProgram: source.batch ? { course: source.course, batch: source.batch } : void 0
      });
      if (outcome.ok) {
        const nowMs = Date.now();
        lastSyncBySheet.set(source.id, nowMs);
        await redis.set(`${ns}:sync:sheet:${source.id}`, String(nowMs), config2.syncIntervalSeconds).catch(() => {
        });
      }
      return { ok: outcome.ok, error: outcome.error };
    }
  });
  if (!process.env.VERCEL) {
    const clientDist = import_node_path3.default.resolve(import_node_path3.default.dirname((0, import_node_url2.fileURLToPath)(import_meta2.url)), "../../client/dist");
    if (import_node_fs3.default.existsSync(clientDist)) {
      app2.use(import_express3.default.static(clientDist));
      app2.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(import_node_path3.default.join(clientDist, "index.html"));
      });
    }
  }
  return app2;
}

// server/src/vercel.ts
loadEnvFiles();
var config = getConfig();
var databasePath = process.env.VERCEL ? "/tmp/timetable.sqlite" : config.databasePath;
var db = openDatabase(databasePath);
var app = createApp(db, { ...config, databasePath }, () => fetchSpreadsheet(config), {
  syncOnRead: Boolean(process.env.VERCEL),
  loadAll: () => resolveSheetSources(config.spreadsheets).then(fetchSheetSources),
  runInBackground: import_functions.waitUntil
});
var vercel_default = app;
module.exports = module.exports.default || module.exports;
