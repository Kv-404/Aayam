import { gunzipSync, gzipSync } from "node:zlib";
import { Redis as UpstashRedis } from "@upstash/redis";
import IoRedis from "ioredis";

export type RedisMode = "upstash-rest" | "ioredis" | "memory";

export interface RedisStore {
  readonly mode: RedisMode;
  readonly isShared: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(...keys: string[]): Promise<number>;
  incrWindow(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }>;
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown, ttlSeconds?: number, compressAboveBytes?: number): Promise<void>;
  close(): Promise<void>;
}

const GZ_PREFIX = "gz:";
const DEFAULT_COMPRESS_BYTES = 4096;

export function redisPrefix(): string {
  const raw = (process.env.REDIS_PREFIX || "tt:v2:").trim();
  return raw.endsWith(":") ? raw : `${raw}:`;
}

function prefixed(key: string): string {
  const prefix = redisPrefix();
  return key.startsWith(prefix) ? key : `${prefix}${key}`;
}

function encodeJson(value: unknown, compressAboveBytes: number): string {
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") >= compressAboveBytes) {
    const gz = gzipSync(Buffer.from(json, "utf8"), { level: 6 }).toString("base64");
    return `${GZ_PREFIX}${gz}`;
  }
  return json;
}

function decodeJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    if (raw.startsWith(GZ_PREFIX)) {
      const buf = gunzipSync(Buffer.from(raw.slice(GZ_PREFIX.length), "base64"));
      return JSON.parse(buf.toString("utf8")) as T;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

export class MemoryRedisStore implements RedisStore {
  public readonly mode: RedisMode = "memory";
  public readonly isShared: boolean;
  private readonly map = new Map<string, MemoryEntry>();
  private readonly maxKeys: number;

  constructor(maxKeys = 10_000, isShared = false) {
    this.maxKeys = maxKeys;
    this.isShared = isShared;
  }

  private readEntry(fullKey: string): MemoryEntry | null {
    const entry = this.map.get(fullKey);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.map.delete(fullKey);
      return null;
    }
    return entry;
  }

  private prune() {
    if (this.map.size <= this.maxKeys) return;
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expiresAt !== null && now >= entry.expiresAt) this.map.delete(key);
    }
    while (this.map.size > this.maxKeys) {
      const oldest = this.map.keys().next().value;
      if (!oldest) break;
      this.map.delete(oldest);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.readEntry(prefixed(key))?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const fullKey = prefixed(key);
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.map.set(fullKey, { value, expiresAt });
    this.prune();
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const fullKey = prefixed(key);
    if (this.readEntry(fullKey)) return false;
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.map.set(fullKey, { value, expiresAt });
    this.prune();
    return true;
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.map.delete(prefixed(key))) removed += 1;
    }
    return removed;
  }

  async incrWindow(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    const fullKey = prefixed(key);
    const now = Date.now();
    const existing = this.readEntry(fullKey);
    if (!existing) {
      const expiresAt = now + Math.max(1, windowSeconds) * 1000;
      this.map.set(fullKey, { value: "1", expiresAt });
      this.prune();
      return { count: 1, ttlSeconds: Math.max(1, windowSeconds) };
    }
    const nextCount = (Number.parseInt(existing.value, 10) || 0) + 1;
    const expiresAt = existing.expiresAt ?? now + Math.max(1, windowSeconds) * 1000;
    this.map.set(fullKey, { value: String(nextCount), expiresAt });
    return {
      count: nextCount,
      ttlSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
    };
  }

  async getJson<T>(key: string): Promise<T | null> {
    return decodeJson<T>(await this.get(key));
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number, compressAboveBytes = DEFAULT_COMPRESS_BYTES): Promise<void> {
    await this.set(key, encodeJson(value, compressAboveBytes), ttlSeconds);
  }

  async close(): Promise<void> {
    this.map.clear();
  }
}

class UpstashRedisStore implements RedisStore {
  public readonly mode: RedisMode = "upstash-rest";
  public readonly isShared = true;
  private readonly client: UpstashRedis;

  constructor(url: string, token: string) {
    this.client = new UpstashRedis({
      url,
      token,
      automaticDeserialization: false,
    });
  }

  async get(key: string): Promise<string | null> {
    const value = await this.client.get<string>(prefixed(key));
    return typeof value === "string" ? value : value == null ? null : String(value);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(prefixed(key), value, { ex: Math.ceil(ttlSeconds) });
      return;
    }
    await this.client.set(prefixed(key), value);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.client.set(prefixed(key), value, {
      nx: true,
      ex: Math.max(1, Math.ceil(ttlSeconds)),
    });
    return res === "OK";
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return await this.client.del(...keys.map(prefixed));
  }

  async incrWindow(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    const fullKey = prefixed(key);
    const window = Math.max(1, Math.ceil(windowSeconds));
    const count = await this.client.incr(fullKey);
    let ttl = await this.client.ttl(fullKey);
    if (count === 1 || ttl < 0) {
      await this.client.expire(fullKey, window);
      ttl = window;
    }
    return { count, ttlSeconds: Math.max(1, ttl) };
  }

  async getJson<T>(key: string): Promise<T | null> {
    return decodeJson<T>(await this.get(key));
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number, compressAboveBytes = DEFAULT_COMPRESS_BYTES): Promise<void> {
    await this.set(key, encodeJson(value, compressAboveBytes), ttlSeconds);
  }

  async close(): Promise<void> {}
}

class IoRedisStore implements RedisStore {
  public readonly mode: RedisMode = "ioredis";
  public readonly isShared = true;
  private readonly client: IoRedis;

  constructor(url: string) {
    this.client = new IoRedis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      connectTimeout: 3000,
    });
    this.client.on("error", (err) => {
      console.error("[redis] ioredis error:", err.message);
    });
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(prefixed(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(prefixed(key), value, "EX", Math.ceil(ttlSeconds));
      return;
    }
    await this.client.set(prefixed(key), value);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.client.set(prefixed(key), value, "EX", Math.max(1, Math.ceil(ttlSeconds)), "NX");
    return res === "OK";
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return await this.client.del(...keys.map(prefixed));
  }

  async incrWindow(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    const fullKey = prefixed(key);
    const window = Math.max(1, Math.ceil(windowSeconds));
    const count = await this.client.incr(fullKey);
    let ttl = await this.client.ttl(fullKey);
    if (count === 1 || ttl < 0) {
      await this.client.expire(fullKey, window);
      ttl = window;
    }
    return { count, ttlSeconds: Math.max(1, ttl) };
  }

  async getJson<T>(key: string): Promise<T | null> {
    return decodeJson<T>(await this.get(key));
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number, compressAboveBytes = DEFAULT_COMPRESS_BYTES): Promise<void> {
    await this.set(key, encodeJson(value, compressAboveBytes), ttlSeconds);
  }

  async close(): Promise<void> {
    await this.client.quit().catch(() => {
      this.client.disconnect();
    });
  }
}

let cachedStore: RedisStore | null = null;
let cachedSignature = "";
let testOverrideStore: RedisStore | null = null;

function envRedisSignature(): { mode: RedisMode; sig: string; restUrl?: string; restToken?: string; tcpUrl?: string } {
  const restUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim();
  const restToken = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim();
  if (restUrl && restToken) {
    return { mode: "upstash-rest", sig: `rest:${restUrl}:${restToken.slice(-8)}`, restUrl, restToken };
  }
  const tcpUrl = (process.env.REDIS_URL || process.env.KV_URL || "").trim();
  if (tcpUrl) {
    return { mode: "ioredis", sig: `tcp:${tcpUrl}`, tcpUrl };
  }
  return { mode: "memory", sig: "memory" };
}

export function getRedis(): RedisStore {
  if (testOverrideStore) return testOverrideStore;
  const spec = envRedisSignature();
  if (cachedStore && cachedSignature === spec.sig) {
    return cachedStore;
  }
  if (cachedStore) {
    void cachedStore.close();
  }
  if (spec.mode === "upstash-rest" && spec.restUrl && spec.restToken) {
    cachedStore = new UpstashRedisStore(spec.restUrl, spec.restToken);
  } else if (spec.mode === "ioredis" && spec.tcpUrl) {
    cachedStore = new IoRedisStore(spec.tcpUrl);
  } else {
    cachedStore = new MemoryRedisStore();
  }
  cachedSignature = spec.sig;
  return cachedStore;
}

export function setRedisForTests(store: RedisStore | null) {
  testOverrideStore = store;
}

export function resetRedisForTests() {
  testOverrideStore = null;
  if (cachedStore) {
    void cachedStore.close();
    cachedStore = null;
  }
  cachedSignature = "";
}
