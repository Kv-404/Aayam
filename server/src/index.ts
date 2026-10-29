import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.ts";
import { openDatabase } from "./db.ts";
import { loadEnvFiles } from "./env.ts";
import { createApp } from "./app.ts";
import { fetchSheetSources, fetchSpreadsheet } from "./services/googleSheetsService.ts";
import { startScheduler } from "./services/syncScheduler.ts";

loadEnvFiles();
const config = getConfig();
const databasePath = path.isAbsolute(config.databasePath)
  ? config.databasePath
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", config.databasePath);
const db = openDatabase(databasePath);
const load = () => fetchSpreadsheet(config);
const loadAll = () => fetchSheetSources(config.spreadsheets);
const app = createApp(db, config, load, { loadAll, syncOnRead: true });
startScheduler({ db, config, load, loadAll });

app.listen(config.port, () => {
  console.log(`Timetable portal API listening on http://localhost:${config.port}`);
});
