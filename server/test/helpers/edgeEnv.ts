import worker, { type Env } from "../../src/edge/index.ts";
import { d1Binding, putSnapshot } from "./d1.ts";

export const SECRET = "test-auth-secret-that-is-at-least-32-chars";

export function makeEnv(overrides: Partial<Env> = {}) {
  const binding = d1Binding();
  const env: Env = {
    DB: binding,
    ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
    AUTH_SECRET: SECRET,
    GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com",
    ALLOWED_EMAIL_DOMAINS: "itm.edu",
    GITHUB_REPO: "owner/repo",
    GITHUB_WORKFLOW: "sync.yml",
    COLLEGE_NAME: "College",
    TIMEZONE: "Asia/Kolkata",
    ...overrides,
  };
  const pending: Promise<unknown>[] = [];
  const exec = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };
  return {
    env,
    raw: binding.raw,
    binding,
    pending,
    put: (key: string, body: string, updatedAt?: string) => putSnapshot(binding.raw, key, body, updatedAt),
    async call(path: string, init?: RequestInit & { base?: string }) {
      const response = await worker.fetch(new Request(`${init?.base ?? "https://timetable.test"}${path}`, init), env, exec);
      return response;
    },
    async settle() {
      await Promise.all(pending.splice(0));
    },
  };
}

export type TestEnv = ReturnType<typeof makeEnv>;

interface FetchCall {
  url: string;
  init?: RequestInit;
}

/** Replace global fetch for one test. The handler sees every outbound request. */
export function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

export function json(body: unknown, headers: Record<string, string> = {}) {
  return { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) };
}
