import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "../config.ts";
import { d1RestDb } from "../d1/rest.ts";
import type { SqlDb } from "../d1/sql.ts";
import { sqliteDb } from "../d1/sqlite.ts";
import { loadEnvFiles } from "../env.ts";
import { openWorkingDb, runJob } from "./pipeline.ts";

/**
 * Sync job entry.
 *
 *   npx tsx server/src/job/run.ts                       # D1 over REST: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID
 *   npx tsx server/src/job/run.ts --local <file.sqlite> # a local SQLite file (migrated) instead of D1
 *   npx tsx server/src/job/run.ts --local-auto          # the single wrangler dev D1 file under .wrangler/state/v3/d1/
 *   ... --watch 60                                      # repeat every 60 s (local dev)
 *   ... --data-dir <dir>                                # working DB cache, default server/data
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

function flag(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
  return value;
}

function findWranglerD1() {
  const dir = path.join(repoRoot, ".wrangler/state/v3/d1");
  const found: string[] = [];
  const walk = (at: string) => {
    if (!fs.existsSync(at)) return;
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".sqlite") && entry.name !== "metadata.sqlite") found.push(full);
    }
  };
  walk(dir);
  if (found.length !== 1) {
    throw new Error(`--local-auto expects one .sqlite under ${dir}, found ${found.length}. Run \`npx wrangler d1 migrations apply timetable --local\` first, or pass --local <file>.`);
  }
  return found[0]!;
}

function database(args: string[]): { sql: SqlDb; key: string } {
  const local = args.includes("--local-auto") ? findWranglerD1() : flag(args, "--local");
  if (local) {
    const file = path.resolve(local);
    if (!fs.existsSync(file)) throw new Error(`No such database file: ${file}`);
    return { sql: sqliteDb(file), key: `file:${file}` };
  }
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const databaseId = process.env.D1_DATABASE_ID?.trim();
  if (!accountId || !apiToken || !databaseId) {
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and D1_DATABASE_ID, or pass --local <file.sqlite>.");
  }
  return { sql: d1RestDb({ accountId, apiToken, databaseId }), key: `d1:${databaseId}` };
}

async function main() {
  loadEnvFiles();
  const args = process.argv.slice(2);
  const { sql, key } = database(args);
  const dataDir = path.resolve(flag(args, "--data-dir") ?? path.join(repoRoot, "server/data"));
  const watch = Number(flag(args, "--watch") ?? 0);
  const reason = process.env.SYNC_REASON?.trim();
  if (reason) console.log(`[job] reason: ${reason}`);
  const workingDb = openWorkingDb(dataDir);
  for (;;) {
    const result = await runJob({ sql, databaseKey: key, config: getConfig(), dataDir, workingDb });
    if (!watch) {
      if (!result.ok) process.exitCode = 1;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, watch * 1000));
  }
}

main().catch((error) => {
  console.error(`[job] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
