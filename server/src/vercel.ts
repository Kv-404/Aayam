import { waitUntil } from "@vercel/functions";
import { getConfig } from "./config.ts";
import { openDatabase } from "./db.ts";
import { loadEnvFiles } from "./env.ts";
import { createApp } from "./app.ts";
import { fetchSheetSources, fetchSpreadsheet } from "./services/googleSheetsService.ts";

// Vercel entry. The process is not always on, so a request starts a sync when its
// sheets are older than the interval. It answers from the saved copy, and waitUntil
// keeps the function alive until that sync ends. /tmp is wiped on a cold start.
// The Blob archive is loaded first, so a removed lecture is still there to compare.
loadEnvFiles();
const config = getConfig();
const databasePath = process.env.VERCEL ? "/tmp/timetable.sqlite" : config.databasePath;
const db = openDatabase(databasePath);
const app = createApp(db, { ...config, databasePath }, () => fetchSpreadsheet(config), {
  syncOnRead: Boolean(process.env.VERCEL),
  loadAll: () => fetchSheetSources(config.spreadsheets),
  runInBackground: waitUntil,
});

export default app;
