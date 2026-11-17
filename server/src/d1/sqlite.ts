import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SqlDb } from "./sql.ts";

const MIGRATIONS = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../migrations");

/** Apply every migrations/*.sql file in name order. Tests and local tools use this; D1 uses wrangler. */
export function applyMigrations(db: DatabaseSync) {
  for (const file of fs.readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"));
  }
}

const bindable = (value: unknown) =>
  value === undefined ? null : typeof value === "boolean" ? (value ? 1 : 0) : (value as null | number | string);

/** node:sqlite behind the SqlDb interface. Pass a file path, or nothing for a fresh migrated in-memory DB. */
export function sqliteDb(file?: string | DatabaseSync): SqlDb & { raw: DatabaseSync } {
  const db = file instanceof DatabaseSync ? file : new DatabaseSync(file ?? ":memory:");
  if (!(file instanceof DatabaseSync) && (file === undefined || file === ":memory:")) applyMigrations(db);
  return {
    raw: db,
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...params.map(bindable)) as T[];
    },
    async run(statements) {
      db.exec("BEGIN");
      try {
        for (const statement of statements) db.prepare(statement.sql).run(...(statement.params ?? []).map(bindable));
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
