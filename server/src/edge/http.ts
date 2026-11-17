/** Request and response helpers for the Worker. Web APIs only. */

export const MAX_BODY_BYTES = 16 * 1024;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return jsonText(JSON.stringify(body), status, headers);
}

/** A body that is already JSON text, such as a prebuilt snapshot. */
export function jsonText(body: string | null, status = 200, headers?: HeadersInit) {
  const response = new Response(body, { status, headers });
  if (body !== null) response.headers.set("Content-Type", "application/json; charset=utf-8");
  if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-cache");
  return response;
}

export function text(body: string, status = 200, headers?: HeadersInit) {
  const response = new Response(body, { status, headers });
  response.headers.set("Content-Type", "text/plain; charset=utf-8");
  return response;
}

export function errorJson(status: number, error: string, headers?: HeadersInit) {
  return json({ ok: false, error }, status, headers);
}

/** JSON body of a POST, at most 16 KB. Anything that is not JSON reads as an empty object, as before. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large.");
  const type = (request.headers.get("Content-Type") ?? "").toLowerCase();
  if (!type.includes("json") || !request.body) return {};
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large.");
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}

/** A trimmed string field, cut to `max` characters. Anything else is "". */
export function field(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const item of header.split(";")) {
    const parts = item.trim().split("=");
    if (parts.length < 2) continue;
    const raw = parts.slice(1).join("=").trim();
    try {
      cookies[parts[0]!.trim()] = decodeURIComponent(raw);
    } catch {
      cookies[parts[0]!.trim()] = raw;
    }
  }
  return cookies;
}

export function bearerToken(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec((request.headers.get("Authorization") ?? "").trim());
  return match?.[1]?.trim() ?? "";
}

/** Cloudflare sets CF-Connecting-IP. X-Forwarded-For only matters in local runs and tests. */
export function clientIp(request: Request) {
  const cf = request.headers.get("CF-Connecting-IP")?.trim();
  if (cf) return cf;
  const forwarded = request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/** `Secure` on every cookie unless this is a plain-http local run. */
export function secureSuffix(request: Request) {
  return new URL(request.url).protocol === "http:" ? "" : "; Secure";
}

export function cookie(name: string, value: string, maxAgeSeconds: number, sameSite: "Lax" | "Strict", request: Request) {
  const expires = new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; Expires=${expires}; HttpOnly; SameSite=${sameSite}${secureSuffix(request)}`;
}

export function clearedCookie(name: string, sameSite: "Lax" | "Strict", request: Request) {
  return `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=${sameSite}${secureSuffix(request)}`;
}

/** Security headers for every API response. MCP and OAuth responses are read cross-origin by AI clients. */
export function withSecurityHeaders(response: Response, request: Request, options: { crossOrigin?: boolean } = {}) {
  const headers = response.headers;
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!options.crossOrigin) headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export function allowedOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** What the `cors` package did with `credentials: true` and an allow-list. */
export function withCors(response: Response, request: Request, origins: string[]) {
  const origin = request.headers.get("Origin");
  response.headers.append("Vary", "Origin");
  if (origin && origins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}

export function preflight(request: Request) {
  const headers = new Headers({ "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE", "Content-Length": "0" });
  const requested = request.headers.get("Access-Control-Request-Headers");
  if (requested) {
    headers.set("Access-Control-Allow-Headers", requested);
    headers.append("Vary", "Access-Control-Request-Headers");
  }
  return new Response(null, { status: 204, headers });
}
