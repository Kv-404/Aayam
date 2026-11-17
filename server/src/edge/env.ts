import { fromD1, type D1Like, type SqlDb } from "../d1/sql.ts";

/** Worker bindings and vars. Secrets: AUTH_SECRET, ADMIN_PASSWORD, GITHUB_TOKEN, GOOGLE_CLIENT_SECRET. */
export interface Env {
  DB: D1Like;
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** At least 32 characters. Signs faculty sessions and keys the admin password hash. */
  AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  /** MCP OAuth only: Google authorization code exchange. Without it, MCP sign-in reuses the site's faculty session. */
  GOOGLE_CLIENT_SECRET?: string;
  /** MCP OAuth only: the public origin used as issuer and resource (such as `https://aayam.kv404.dev`). Default: the request origin. */
  MCP_PUBLIC_URL?: string;
  ALLOWED_EMAIL_DOMAINS: string;
  /** Seeds `admin_password` when the table is empty. */
  ADMIN_PASSWORD?: string;
  /** Fine-grained token with Actions: write on GITHUB_REPO. Without it a sync is only recorded. */
  GITHUB_TOKEN?: string;
  /** `owner/repo` */
  GITHUB_REPO: string;
  /** Workflow file name, such as `sync.yml`. */
  GITHUB_WORKFLOW: string;
  COLLEGE_NAME: string;
  TIMEZONE: string;
  /** Comma-separated origins allowed to call the API with credentials. */
  CLIENT_ORIGIN?: string;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Ctx {
  request: Request;
  url: URL;
  env: Env;
  db: SqlDb;
  exec: ExecutionContextLike;
}

const wrapped = new WeakMap<object, SqlDb>();

/** One SqlDb per binding object. */
export function database(env: Env): SqlDb {
  let db = wrapped.get(env.DB);
  if (!db) {
    db = fromD1(env.DB);
    wrapped.set(env.DB, db);
  }
  return db;
}

/** Signing secret, or null when it is missing or too short to trust. */
export function authSecret(env: Env) {
  const secret = env.AUTH_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : null;
}
