import type { SqlDb, SqlStatement } from "./sql.ts";

/**
 * SqlDb over the Cloudflare D1 REST API, for the sync job.
 * `POST /accounts/{account}/d1/database/{database}/query` takes `{sql, params}` or `{batch: [{sql, params}]}`.
 * Limits: 100 bound parameters and 100 KB of SQL per statement, 2 MB per value, 30 s per call.
 * A large `run` is split into several calls, so it is atomic per call only. Callers order writes so a
 * partial run is safe to repeat.
 */
export interface D1RestOptions {
  accountId: string;
  databaseId: string;
  apiToken: string;
  /** Request body budget per call. One statement larger than this still goes alone. */
  maxBatchBytes?: number;
  maxBatchStatements?: number;
  fetch?: typeof fetch;
}

interface QueryResult<T> {
  results?: T[];
  success?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<QueryResult<T>>;
}

const MAX_PARAMS = 100;
const MAX_SQL_BYTES = 100_000;

export class D1RestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const bindable = (value: unknown) =>
  value === undefined ? null : typeof value === "boolean" ? (value ? 1 : 0) : value;

function check(statement: SqlStatement) {
  if ((statement.params?.length ?? 0) > MAX_PARAMS) throw new Error(`D1 allows ${MAX_PARAMS} bound parameters per statement.`);
  if (Buffer.byteLength(statement.sql) > MAX_SQL_BYTES) throw new Error("D1 statement is longer than 100 KB.");
}

function body(statement: SqlStatement) {
  return { sql: statement.sql, params: (statement.params ?? []).map(bindable) };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function d1RestDb(options: D1RestOptions): SqlDb & { calls: number } {
  const url = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/d1/database/${options.databaseId}/query`;
  const doFetch = options.fetch ?? fetch;
  const maxBytes = options.maxBatchBytes ?? 1_000_000;
  const maxStatements = options.maxBatchStatements ?? 500;
  const db = {
    calls: 0,
    async all<T>(sql: string, params?: unknown[]) {
      const statement = { sql, params };
      check(statement);
      const result = await call<T>(body(statement));
      return result[0]?.results ?? [];
    },
    async run(statements: SqlStatement[]) {
      for (const group of batches(statements)) {
        await call(group.length === 1 ? group[0] : { batch: group });
      }
    },
  };

  function batches(statements: SqlStatement[]) {
    const groups: Array<Array<ReturnType<typeof body>>> = [];
    let current: Array<ReturnType<typeof body>> = [];
    let bytes = 0;
    for (const statement of statements) {
      check(statement);
      const item = body(statement);
      const size = JSON.stringify(item).length;
      if (current.length > 0 && (bytes + size > maxBytes || current.length >= maxStatements)) {
        groups.push(current);
        current = [];
        bytes = 0;
      }
      current.push(item);
      bytes += size;
    }
    if (current.length > 0) groups.push(current);
    return groups;
  }

  async function call<T>(payload: unknown): Promise<Array<QueryResult<T>>> {
    const text = JSON.stringify(payload);
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await pause(Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.random() * 250);
      db.calls += 1;
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiToken}`, "Content-Type": "application/json" },
          body: text,
          signal: AbortSignal.timeout(45_000),
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
      const raw = await response.text();
      let parsed: ApiResponse<T> | null = null;
      try {
        parsed = JSON.parse(raw) as ApiResponse<T>;
      } catch {
        parsed = null;
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new D1RestError(`D1 ${response.status}: ${raw.slice(0, 300)}`, response.status);
        continue;
      }
      if (!response.ok || !parsed?.success) {
        const message = parsed?.errors?.map((error) => error.message).filter(Boolean).join("; ") || raw.slice(0, 300);
        throw new D1RestError(`D1 query failed (${response.status}): ${message}`, response.status);
      }
      return parsed.result ?? [];
    }
    throw lastError ?? new Error("D1 query failed.");
  }

  return db;
}
