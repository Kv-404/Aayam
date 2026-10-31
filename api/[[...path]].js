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
    fallbackId: "1cG7UflUTUPVpVL3BliSYFqDkOs-QzsGyo3azE1qd3js",
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
    fallbackId: "1qInzB5I0deY7jAKgFFFgBsd4fkSFLGqg-Fyh7Q3nXUM",
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
    fallbackId: "1Z8WWsv0yhiMmfZQqzzYBYrYgxq-FcDd_kbQeGcF5eDI",
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
    fallbackId: "1nbdHdLvtlcrhClzfcKA7bBuNXQI1q61qs-sg2RK0ra4",
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
    fallbackId: "15mPKkE6CWnHRTEH2RCg1HDAwL0cTgC9AqECpv_GRt1o",
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
var PRIMARY_SHEET = "1qInzB5I0deY7jAKgFFFgBsd4fkSFLGqg-Fyh7Q3nXUM";
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
  const norm2 = division.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");
  const candidates = [
    `SPREADSHEET_${norm2}`,
    `SPREADSHEET_ID_${norm2}`,
    `SPREADSHEET_URL_${norm2}`
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
    spreadsheetTitle: process.env.SPREADSHEET_TITLE?.trim() || "BTech Cohort Planning weekly | 2nd Nov to 7th Nov 2026",
    collegeName: process.env.COLLEGE_NAME?.trim() || "ITM Skills University",
    schoolName: process.env.SCHOOL_NAME?.trim() || "School of FutureTech, Kharghar",
    courseName: process.env.COURSE_NAME?.trim() || "BTech",
    timezone: process.env.TIMEZONE?.trim() || "Asia/Kolkata",
    dateOrder,
    port: integer(process.env.PORT, 8787, 1, 65535),
    syncIntervalSeconds: integer(process.env.SYNC_INTERVAL_SECONDS, 45, 15, 3600),
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
      changes_json TEXT NOT NULL DEFAULT '[]'
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
function replaceWeekBackups(db2, weeks) {
  db2.exec("DELETE FROM week_backups");
  const insert = db2.prepare(`
    INSERT INTO week_backups (id, course, batch, start_date, end_date, lectures_json, changes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const week of weeks) {
    insert.run(
      week.id,
      week.course,
      week.batch,
      week.start,
      week.end,
      JSON.stringify(week.lectures),
      JSON.stringify(week.changes ?? [])
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
  const text2 = import_node_fs2.default.readFileSync(file, "utf8");
  for (const line of text2.split("\n")) {
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
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var import_node_url2 = require("node:url");
var import_cors = __toESM(require("cors"), 1);
var import_express = __toESM(require("express"), 1);

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
  const stamp = formatUtc(/* @__PURE__ */ new Date());
  for (const lecture of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsText(lecture.id)}@timetable`,
      `DTSTAMP:${stamp}`,
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
function norm(value) {
  return value.replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase();
}
function personMatch(a, b) {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const longer = left.length >= right.length ? left : right;
  const shorter = left.length >= right.length ? right : left;
  if (!shorter.includes(" ")) return false;
  if (!longer.startsWith(shorter)) return false;
  const rest = longer.slice(shorter.length).trim();
  return /^[a-z]\.?$/.test(rest);
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
var import_serverless = require("@neondatabase/serverless");
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
  return process.env.DATABASE_URL || "";
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
async function authenticateFacultyWithNeon(email) {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  let rows;
  try {
    const sql = (0, import_serverless.neon)(dbUrl);
    rows = await sql`
      SELECT id, email, faculty_name, can_see_all_faculty, is_active 
      FROM faculty_directory 
      WHERE LOWER(email) = ${email.toLowerCase()} AND is_active = true 
      LIMIT 1
    `;
  } catch (err) {
    console.error("[auth] Neon faculty lookup error:", err);
    throw new Error("Faculty directory service is temporarily unavailable.");
  }
  if (!rows || rows.length === 0) {
    throw new Error(`The account ${email} is not registered in the authorized faculty directory.`);
  }
  const faculty = rows[0];
  try {
    const sql = (0, import_serverless.neon)(dbUrl);
    await sql`UPDATE faculty_directory SET last_login_at = NOW() WHERE id = ${faculty.id}`;
  } catch (err) {
    console.error("Failed to update last_login_at:", err);
  }
  return {
    id: faculty.id,
    email: faculty.email,
    faculty_name: faculty.faculty_name,
    can_see_all_faculty: Boolean(faculty.can_see_all_faculty)
  };
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
    try {
      const sql = (0, import_serverless.neon)(dbUrl);
      const rows = await sql`
        SELECT course, batch, pin 
        FROM batch_access_codes 
        WHERE pin = ${cleanPin} 
        LIMIT 1
      `;
      if (rows && rows.length > 0 && rows[0]?.course && rows[0]?.batch) {
        return {
          ok: true,
          course: String(rows[0].course),
          batch: String(rows[0].batch)
        };
      }
      return null;
    } catch (err) {
      console.error("[pin] Neon verification error:", err);
      return null;
    }
  }
  if (isProduction()) return null;
  const fallbackBatches = [
    { course: "BTech", batch: "2026-30", pin: "481920" },
    { course: "BTech", batch: "2025-29", pin: "739154" },
    { course: "BTech", batch: "2024-28", pin: "628401" },
    { course: "BTech", batch: "2023-27", pin: "315972" },
    { course: "MCA", batch: "2026-28", pin: "852039" }
  ];
  const found = fallbackBatches.find((b) => b.pin === cleanPin);
  if (found) {
    return { ok: true, course: found.course, batch: found.batch };
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
  const text2 = canon(label);
  const match = text2.match(/^(.+?)\s*(?:-|–|—|\bto\b)\s*(.+)$/i);
  if (!match) return null;
  const start = parseTimeToken(match[1] ?? "");
  const end = parseTimeToken(match[2] ?? "");
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}
function parseDateLabel(input, order = "DMY") {
  const text2 = canon(input);
  const match = text2.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
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
  const named = text2.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  const computed = WEEKDAYS[date.getUTCDay()] ?? "Monday";
  const weekday = named ? named[1].charAt(0).toUpperCase() + named[1].slice(1).toLowerCase() : computed;
  return { iso, weekday, computedWeekday: computed };
}
function weekdayFromName(name) {
  const text2 = canon(name).toLowerCase();
  const found = WEEKDAYS.find((day) => text2 === day.toLowerCase() || text2.startsWith(`${day.toLowerCase()} `));
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

// server/src/services/changeDetectionService.ts
var import_node_crypto2 = require("node:crypto");

// server/src/program.ts
function programKey(course, batch) {
  const years = batch.replace(/[–—]/g, "-").replace(/\s+/g, "");
  return `${course.trim().toLowerCase()}\0${years.toLowerCase()}`;
}

// server/src/services/changeDetectionService.ts
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
  return (0, import_node_crypto2.createHash)("sha256").update(JSON.stringify(parts)).digest("hex");
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
var import_node_crypto3 = require("node:crypto");
function normalizeMark(word) {
  const value = word.toLowerCase();
  if (value === "canceled" || value === "cancelled" || value === "holiday") return "cancelled";
  if (value === "off") return "off";
  if (value === "rescheduled") return "rescheduled";
  return "changed";
}
function parseStatusToken(status) {
  const text2 = canon(status).toLowerCase();
  if (!text2 || text2 === "scheduled" || text2 === "confirmed") return null;
  if (/^(cancelled|canceled|holiday)$/.test(text2)) return "cancelled";
  if (text2 === "off") return "off";
  if (text2 === "rescheduled") return "rescheduled";
  if (text2 === "changed") return "changed";
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
  return (0, import_node_crypto3.createHash)("sha256").update(JSON.stringify({ tabs: [...tabs].sort(), lines, issueLines })).digest("hex");
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
      const text2 = cellText(master.value);
      if (!text2) return null;
      return { row: Number(master.row), col: columnIndex(master), text: text2 };
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
  const text2 = canon(label).toLowerCase();
  if (!text2) return "empty";
  if (parseTimeRange(label)) return "time";
  if (text2 === "timing" || text2 === "time") return "header";
  if (text2 === "faculty" || text2 === "teacher" || text2 === "professor" || text2 === "faculty name") return "faculty";
  if (/^(classroom no\.?|classroom|class room|room no\.?|room|venue|lab|laboratory)$/.test(text2)) return "room";
  if (text2 === "status") return "status";
  if (/^(reason|remarks|remark|note|notes)$/.test(text2)) return "reason";
  if (/^(semester|sem)\b/.test(text2) || /\bbatch\b/.test(text2) || parseDateLabel(label)) return "meta";
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
  const text2 = canon(raw).replace(/[–—]/g, "-").replace(/\s*-\s*/g, "-");
  const match = text2.match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (!match?.[1] || !match[2]) return text2;
  const end = match[2].length === 4 ? match[2].slice(-2) : match[2];
  return `${match[1]}-${end}`;
}
function readProgramBatch(text2) {
  const match = canon(text2).match(/^(?:(b\.?\s*tech|m\.?\s*c\.?\s*a)\s+)?batch\b(?:\s*[-–:]?\s*(.+))?$/i);
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
    const text2 = labelAt(matrix, row);
    if (!text2) continue;
    const semesterMatch = text2.match(/^(?:semester|sem)\s*[-–:]?\s*([0-9]+)/i);
    const named = readProgramBatch(text2);
    const parsedDate = parseDateLabel(text2, dateOrder);
    if (semesterMatch) semester = semesterMatch[1] ?? semester;
    else if (named) {
      if (named.course) course = named.course;
      if (named.batch) batch = named.batch;
    } else if (parsedDate) {
      date = parsedDate.iso;
      weekday = parsedDate.computedWeekday;
      if (parsedDate.weekday !== parsedDate.computedWeekday) {
        notes.push(`Date ${text2} says ${parsedDate.weekday}, which does not match ${parsedDate.computedWeekday}. The calendar date was used.`);
      }
    } else if (!collegeName && text2.length > 3) collegeName = canon(text2);
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
    const text2 = canon(matrix.own(row, col) || matrix.masterOf(row, col)?.text || "").toLowerCase();
    if (!text2) continue;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(text2) && !map.has(field)) map.set(field, col);
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

// server/src/services/durableState.ts
var import_serverless3 = require("@neondatabase/serverless");

// server/src/services/neonRows.ts
var import_serverless2 = require("@neondatabase/serverless");
var LIVE = "live";
var schemaReady = false;
function neonUrl() {
  return process.env.DATABASE_URL?.trim() || "";
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
function text(value) {
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
    date: text(row.date),
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
    date: text(row.date),
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
    start: text(week.start_date) ?? week.start_date,
    end: text(week.end_date) ?? week.end_date,
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
async function readNeonRows() {
  const url = neonUrl();
  if (!url) return null;
  try {
    const sql = (0, import_serverless2.neon)(url);
    await ensureSchema(sql);
    const syncRows = await sql`
      SELECT saved_at, last_success_at, last_attempt_at, last_error, bootstrapped, content_hash,
             tab_names, parse_issues, spreadsheet_title
      FROM timetable_sync WHERE id = 1
    `;
    const sync = syncRows[0];
    if (!sync?.bootstrapped) return null;
    const lectures = await sql`SELECT * FROM timetable_lectures`;
    const changes = await sql`SELECT * FROM timetable_changes ORDER BY id`;
    const weeks = await sql`SELECT id, course, batch, start_date, end_date FROM timetable_weeks`;
    return rowsToArchive(
      sync.saved_at,
      {
        lastSuccessAt: sync.last_success_at,
        lastAttemptAt: sync.last_attempt_at,
        lastError: sync.last_error,
        bootstrapped: true,
        contentHash: sync.content_hash,
        tabNames: json(sync.tab_names, []),
        parseIssues: json(sync.parse_issues, []),
        spreadsheetTitle: sync.spreadsheet_title
      },
      { lectures, changes, weeks }
    );
  } catch (error) {
    console.error("[archive] Neon row read error:", error);
    return null;
  }
}
async function writeNeonRows(archive) {
  const url = neonUrl();
  if (!url) return false;
  const sql = (0, import_serverless2.neon)(url);
  await ensureSchema(sql);
  const rows = archiveToRows(archive);
  const weekPayload = JSON.stringify(rows.weeks);
  const tabNames = JSON.stringify(archive.sync.tabNames);
  const parseIssues = JSON.stringify(archive.sync.parseIssues);
  await sql.transaction([
    sql`DELETE FROM timetable_lectures`,
    sql`DELETE FROM timetable_changes`,
    sql`DELETE FROM timetable_weeks`,
    sql`DELETE FROM timetable_sync`,
    ...chunks(rows.lectures, 200).map((chunk) => insertLectures(sql, chunk)),
    ...chunks(rows.changes, 200).map((chunk) => insertChanges2(sql, chunk)),
    sql`
      INSERT INTO timetable_weeks (id, course, batch, start_date, end_date)
      SELECT id, course, batch, start_date, end_date
      FROM jsonb_to_recordset(${weekPayload}::jsonb) AS x(
        id text, course text, batch text, start_date text, end_date text
      )
    `,
    sql`
      INSERT INTO timetable_sync (
        id, saved_at, last_success_at, last_attempt_at, last_error, bootstrapped,
        content_hash, tab_names, parse_issues, spreadsheet_title
      ) VALUES (
        1, ${archive.savedAt}, ${archive.sync.lastSuccessAt}, ${archive.sync.lastAttemptAt},
        ${archive.sync.lastError}, ${archive.sync.bootstrapped}, ${archive.sync.contentHash},
        ${tabNames}::jsonb, ${parseIssues}::jsonb, ${archive.sync.spreadsheetTitle}
      )
    `
  ]);
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
function neonUrl2() {
  return process.env.DATABASE_URL?.trim() || "";
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
function importArchive(db2, archive) {
  db2.exec("BEGIN");
  try {
    replaceLectures(db2, archive.lectures);
    replaceChangeRows(db2, archive.changes);
    replaceWeekBackups(db2, archive.weeks ?? []);
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
async function readBlob() {
  const dbUrl = neonUrl2();
  if (!dbUrl) return null;
  try {
    const sql = (0, import_serverless3.neon)(dbUrl);
    const rows = await sql`
      SELECT archive FROM timetable_archive WHERE id = 'latest' LIMIT 1
    `;
    if (rows && rows.length > 0 && rows[0]?.archive) {
      const raw = rows[0].archive;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (isArchive(parsed)) return withWeekChanges(parsed);
    }
  } catch (err) {
    console.error("[archive] Neon read error:", err);
  }
  return null;
}
async function readRemote() {
  const [blob, rows] = await Promise.all([readBlob(), readNeonRows()]);
  if (!blob) return rows;
  if (!rows) return blob;
  return mergeArchives(blob, rows);
}
async function writeBlob(archive) {
  const dbUrl = neonUrl2();
  if (!dbUrl) return;
  const sql = (0, import_serverless3.neon)(dbUrl);
  const payload = JSON.stringify(archive);
  await sql`
    INSERT INTO timetable_archive (id, archive, updated_at)
    VALUES ('latest', ${payload}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
    SET archive = EXCLUDED.archive, updated_at = NOW()
  `;
}
async function hydrateArchive(db2) {
  if (!neonUrl2() || readSyncState(db2).bootstrapped) return false;
  const archive = await readRemote();
  if (!archive?.sync.bootstrapped) return false;
  importArchive(db2, archive);
  lastSignature = archiveSignature(archive);
  console.log("[sync] loaded saved timetable history from Neon");
  return true;
}
async function publishArchive(db2) {
  if (!neonUrl2() || !readSyncState(db2).bootstrapped) return false;
  const local = exportArchive(db2);
  if (archiveSignature(local) === lastSignature) return false;
  const remote = await readRemote();
  const merged = remote ? mergeArchives(remote, local) : local;
  if (archiveSignature(merged) !== archiveSignature(local)) importArchive(db2, merged);
  const signature = archiveSignature(merged);
  if (remote && signature === archiveSignature(remote)) {
    lastSignature = signature;
    return false;
  }
  merged.savedAt = (/* @__PURE__ */ new Date()).toISOString();
  try {
    await writeNeonRows(merged);
  } catch (err) {
    console.error("[archive] Neon row write error:", err);
  }
  try {
    await writeBlob(merged);
    console.log("[sync] saved timetable history to Neon");
  } catch (err) {
    console.error("[archive] Neon write error:", err);
  }
  lastSignature = signature;
  return true;
}

// server/src/services/weekBackup.ts
var CAP = 8;
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
    const stored = current.bootstrapped && !freshWeek ? compareSnapshots(previous, retained.lectures, {
      now,
      previousTabs: current.tabNames,
      nextTabs: tabNames,
      bootstrapped: true
    }) : { lectures: initialSnapshot(retained.lectures), events: [] };
    const events = dropFreshProgramAdditions(previous, stored.lectures, stored.events);
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
function runSync(ctx) {
  const existing = inflight.get(ctx.db);
  if (existing) return existing;
  const pending = performSync(ctx).finally(() => {
    inflight.delete(ctx.db);
  });
  inflight.set(ctx.db, pending);
  return pending;
}

// server/src/services/googleSheetsService.ts
var import_node_crypto4 = require("node:crypto");
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
  const hash = (0, import_node_crypto4.createHash)("sha256").update(buffer).digest("hex");
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

// server/src/app.ts
var import_meta2 = {};
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
  const parsedFaculties = listFacultyNames(allLectures.filter((lecture) => lecture.kind !== "break").map((lecture) => lecture.faculty));
  const seenFaculties = new Set(parsedFaculties.map((f) => f.toLowerCase()));
  const faculties = [
    ...parsedFaculties,
    ...DEFAULT_FACULTY_NAMES.filter((f) => !seenFaculties.has(f.toLowerCase()))
  ].sort((a, b) => a.localeCompare(b));
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
  const savedWeeks = readWeekBackups(db2).filter((week) => !liveKeys.has(`${week.course}\0${week.batch}\0${week.start}\0${week.end}`)).map((week) => {
    const weekLectures = scopeOf(week.lectures.map((lecture) => presentLecture(lecture, now, config2.highlightHours)).sort(byLecture));
    const lectureIds = new Set(weekLectures.map((lecture) => lecture.id));
    const divisions = new Set(weekLectures.map((lecture) => lecture.division));
    const weekChanges = (week.changes ?? []).filter((change) => {
      if (weekLectures.length === 0) return false;
      if (change.lectureId && lectureIds.has(change.lectureId)) return true;
      if (change.division) return divisions.has(change.division);
      return true;
    }).map((change) => {
      const cancelled = Boolean(change.lectureId && restored.restoredIds.has(change.lectureId) && change.type === "removed");
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
    return {
      id: week.id,
      course: week.course,
      batch: week.batch,
      start: week.start,
      end: week.end,
      lectures: weekLectures,
      changes: weekChanges
    };
  }).filter((week) => week.lectures.length > 0).sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
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
function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
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
  const app2 = (0, import_express.default)();
  app2.disable("x-powered-by");
  if (process.env.VERCEL || process.env.TRUST_PROXY === "1") {
    app2.set("trust proxy", 1);
  }
  const origins = allowedOrigins(config2);
  app2.use(
    (0, import_cors.default)({
      credentials: true,
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    })
  );
  app2.use(securityHeaders);
  app2.use(import_express.default.json({ limit: "16kb" }));
  if (process.env.VERCEL) {
    app2.use((req, _res, next) => {
      const url = req.url || "/";
      if (url === "/api" || url.startsWith("/api/") || url.startsWith("/api?")) {
        next();
        return;
      }
      req.url = url.startsWith("/") ? `/api${url}` : `/api/${url}`;
      next();
    });
  }
  const lastSyncBySheet = /* @__PURE__ */ new Map();
  async function syncIfStale(filter) {
    if (!options?.syncOnRead) return;
    const now = Date.now();
    const intervalMs = config2.syncIntervalSeconds * 1e3;
    if (filter?.faculty) {
      const state2 = readSyncState(db2);
      const age2 = state2.lastSuccessAt ? now - new Date(state2.lastSuccessAt).getTime() : Number.POSITIVE_INFINITY;
      if (age2 > intervalMs) {
        await runSync({ db: db2, config: config2, load, loadAll: options?.loadAll });
        for (const sheet of config2.spreadsheets) lastSyncBySheet.set(sheet.id, now);
      }
      return;
    }
    const target = sheetForScope(filter ?? {}, config2.spreadsheets);
    if (target) {
      const last = lastSyncBySheet.get(target.id) ?? 0;
      const snapshot = loadSnapshot(db2);
      const hasLectures = snapshot.some(
        (l) => l.spreadsheetId === target.id || target.batch && l.batch === target.batch
      );
      if (hasLectures && now - last < intervalMs) {
        return;
      }
      await runSync({
        db: db2,
        config: { ...config2, spreadsheetId: target.id },
        load: () => fetchSpreadsheet({ spreadsheetId: target.id }),
        loadAll: async () => [
          {
            ...await fetchSpreadsheet({ spreadsheetId: target.id }),
            course: target.course,
            spreadsheetId: target.id
          }
        ]
      });
      lastSyncBySheet.set(target.id, now);
      return;
    }
    const primary = config2.spreadsheets.find((s) => s.id === config2.spreadsheetId) ?? config2.spreadsheets[0];
    if (primary) {
      const last = lastSyncBySheet.get(primary.id) ?? 0;
      const snapshot = loadSnapshot(db2);
      const hasLectures = snapshot.some((l) => l.spreadsheetId === primary.id);
      if (hasLectures && now - last < intervalMs) {
        return;
      }
      await runSync({
        db: db2,
        config: { ...config2, spreadsheetId: primary.id },
        load: () => fetchSpreadsheet({ spreadsheetId: primary.id }),
        loadAll: async () => [
          {
            ...await fetchSpreadsheet({ spreadsheetId: primary.id }),
            course: primary.course,
            spreadsheetId: primary.id
          }
        ]
      });
      lastSyncBySheet.set(primary.id, now);
      return;
    }
    const state = readSyncState(db2);
    const age = state.lastSuccessAt ? now - new Date(state.lastSuccessAt).getTime() : Number.POSITIVE_INFINITY;
    if (age > intervalMs) {
      await runSync({ db: db2, config: config2, load, loadAll: options?.loadAll });
    }
  }
  app2.get("/api/health", (_req, res) => {
    const state = readSyncState(db2);
    res.status(state.lastSuccessAt ? 200 : 503).json({
      ok: Boolean(state.lastSuccessAt),
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError
    });
  });
  app2.get("/api/bootstrap", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    await syncIfStale({ division, faculty, course, batch });
    res.json(buildBootstrap(db2, config2, /* @__PURE__ */ new Date(), { division, faculty, course, batch }));
  });
  app2.get("/api/calendar.ics", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    await syncIfStale({ division, faculty });
    const snapshot = buildBootstrap(db2, config2);
    const choice = division ? cohortChoices(snapshot.lectures).find((item) => item.division === division) : void 0;
    const lectures = faculty ? snapshot.lectures.filter((lecture) => lectureMatchesFaculty(lecture.faculty, faculty)) : choice ? snapshot.lectures.filter((lecture) => lectureInCohort(lecture, choice)) : division ? snapshot.lectures.filter((lecture) => lecture.division === division) : [];
    if (!faculty && !division || lectures.length === 0) {
      res.status(404).type("text/plain").send(faculty ? "No lectures for that faculty." : "Unknown cohort.");
      return;
    }
    const name = faculty || cohortLabel(division);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (req.query.download === "1") {
      const file = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "timetable"}.ics`;
      res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    }
    res.send(calendarFile(lectures, config2.timezone, name, { includeCohort: Boolean(faculty) }));
  });
  app2.get("/api/changes", (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 80));
    res.json({ changes: listChanges(db2, limit) });
  });
  let lastForcedSync = 0;
  app2.post("/api/sync", async (req, res) => {
    const division = (typeof req.query.division === "string" ? req.query.division : typeof req.query.cohort === "string" ? req.query.cohort : "").trim();
    const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
    const course = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const batch = typeof req.query.batch === "string" ? req.query.batch.trim() : "";
    const target = !faculty ? sheetForScope({ division, course, batch }, config2.spreadsheets) : void 0;
    const minGapMs = Math.min(config2.syncIntervalSeconds, 15) * 1e3;
    if (Date.now() - lastForcedSync < minGapMs) {
      res.setHeader("Retry-After", String(Math.ceil(minGapMs / 1e3)));
      res.json(buildBootstrap(db2, config2, /* @__PURE__ */ new Date(), { division, faculty, course, batch }));
      return;
    }
    lastForcedSync = Date.now();
    if (target) {
      await runSync({
        db: db2,
        config: { ...config2, spreadsheetId: target.id },
        load: () => fetchSpreadsheet({ spreadsheetId: target.id }),
        loadAll: async () => [
          {
            ...await fetchSpreadsheet({ spreadsheetId: target.id }),
            course: target.course,
            spreadsheetId: target.id
          }
        ]
      });
      lastSyncBySheet.set(target.id, Date.now());
    } else {
      await runSync({ db: db2, config: config2, load, loadAll: options?.loadAll });
      for (const s of config2.spreadsheets) lastSyncBySheet.set(s.id, Date.now());
    }
    res.json(buildBootstrap(db2, config2, /* @__PURE__ */ new Date(), { division, faculty, course, batch }));
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
    const rateCheck = loginRateLimiter.check(ip);
    if (rateCheck.limited) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
      res.status(429).json({ ok: false, error: `Too many sign-in attempts. Try again in ${rateCheck.retryAfterSeconds} seconds.` });
      return;
    }
    loginRateLimiter.recordFailure(ip);
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
      loginRateLimiter.reset(ip);
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
    const rateCheck = pinRateLimiter.check(ip);
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
      pinRateLimiter.recordFailure(ip);
      res.status(400).json({ ok: false, error: "Invalid PIN format. PIN must be exactly 6 digits." });
      return;
    }
    try {
      const result = await verifyBatchPinWithNeon(rawPin);
      if (result && result.ok) {
        pinRateLimiter.reset(ip);
        res.json({ ok: true, course: result.course, batch: result.batch });
      } else {
        pinRateLimiter.recordFailure(ip);
        res.status(401).json({ ok: false, error: "Invalid PIN. Please check with your class representative." });
      }
    } catch (err) {
      console.error("[pin-verify] Unexpected verification failure:", err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred while verifying PIN. Please try again." });
    }
  });
  app2.post("/api/auth/batch-verify", (req, res) => {
    const ip = getClientIp(req);
    const rateCheck = pinRateLimiter.check(ip);
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
      pinRateLimiter.recordFailure(ip);
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
        pinRateLimiter.reset(ip);
        res.json({ ok: true, course, batch });
      } else {
        pinRateLimiter.recordFailure(ip);
        res.status(401).json({ ok: false, error: `Invalid access code for ${course} ${batch}.` });
      }
    } catch (err) {
      console.error("[batch-verify] Unexpected verification failure:", err);
      res.status(500).json({ ok: false, error: "An unexpected error occurred while verifying access code." });
    }
  });
  if (!process.env.VERCEL) {
    const clientDist = import_node_path3.default.resolve(import_node_path3.default.dirname((0, import_node_url2.fileURLToPath)(import_meta2.url)), "../../client/dist");
    if (import_node_fs3.default.existsSync(clientDist)) {
      app2.use(import_express.default.static(clientDist));
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
  loadAll: () => fetchSheetSources(config.spreadsheets)
});
var vercel_default = app;
module.exports = module.exports.default || module.exports;
