/**
 * The one database interface. The Worker wraps its D1 binding, the sync job wraps the D1 REST API,
 * and tests wrap node:sqlite. Keep it this small: every implementation must be trivially correct.
 */
export interface SqlStatement {
  sql: string;
  params?: unknown[];
}

export interface SqlDb {
  /** Rows of one read. */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Writes, applied in order and atomically (D1 `batch`). */
  run(statements: SqlStatement[]): Promise<void>;
}

/** Minimal shape of a Cloudflare D1 binding, so this file needs no workers types. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> };
    all<T>(): Promise<{ results: T[] }>;
  };
  batch(statements: unknown[]): Promise<unknown[]>;
}

export function fromD1(binding: D1Like): SqlDb {
  const prepared = (sql: string, params?: unknown[]) => {
    const statement = binding.prepare(sql);
    return params && params.length > 0 ? statement.bind(...params) : statement;
  };
  return {
    async all<T>(sql: string, params?: unknown[]) {
      const result = await prepared(sql, params).all<T>();
      return result.results;
    },
    async run(statements) {
      if (statements.length === 0) return;
      await binding.batch(statements.map((statement) => prepared(statement.sql, statement.params)));
    },
  };
}
