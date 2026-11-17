import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { D1Like } from "../../src/d1/sql.ts";
import { sqliteDb } from "../../src/d1/sqlite.ts";

const bindable = (value: unknown) =>
  value === undefined ? null : typeof value === "boolean" ? (value ? 1 : 0) : (value as null | number | string);

class Statement {
  constructor(
    private db: DatabaseSync,
    readonly sql: string,
    readonly params: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.db, this.sql, values);
  }
  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...this.params.map(bindable)) as T[], success: true };
  }
  async first<T>() {
    return (this.db.prepare(this.sql).get(...this.params.map(bindable)) ?? null) as T | null;
  }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.params.map(bindable));
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

/** A D1 binding over a fresh migrated in-memory node:sqlite database. */
export function d1Binding() {
  const db = sqliteDb();
  const raw = db.raw;
  const binding: D1Like & { raw: DatabaseSync; queries: number } = {
    raw,
    queries: 0,
    prepare(sql: string) {
      binding.queries += 1;
      return new Statement(raw, sql);
    },
    async batch(statements: unknown[]) {
      raw.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements as Statement[]) results.push(await statement.all());
        raw.exec("COMMIT");
        return results;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return binding;
}

export function hashOf(body: string) {
  return crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
}

export function putSnapshot(raw: DatabaseSync, key: string, body: string, updatedAt = new Date().toISOString()) {
  raw
    .prepare(
      "INSERT INTO snapshots (key, body, hash, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET body = excluded.body, hash = excluded.hash, updated_at = excluded.updated_at",
    )
    .run(key, body, hashOf(body), updatedAt);
}
