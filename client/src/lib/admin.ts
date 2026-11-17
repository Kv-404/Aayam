export interface AdminSheet {
  course: string;
  batch: string;
  spreadsheetUrl: string;
}

export interface AdminNotice {
  id: string;
  title: string;
  body: string;
  course: string | null;
  batch: string | null;
  createdAt: string;
}

export interface AdminSession {
  signedIn: boolean;
  sheets: AdminSheet[];
  notices: AdminNotice[];
}

async function send(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json", "X-Aayam-Admin": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; signedIn?: boolean; sheets?: AdminSheet[]; notices?: AdminNotice[]; delivered?: number; syncing?: boolean; queued?: boolean };
  if (!response.ok) throw new Error(payload.error || "That did not work.");
  return payload;
}

export function fetchAdminSession() {
  return send("/api/admin/session").then(
    (payload): AdminSession => ({
      signedIn: Boolean(payload.signedIn),
      sheets: payload.sheets ?? [],
      notices: payload.notices ?? [],
    }),
  );
}

export function loginAdmin(password: string) {
  return send("/api/admin/login", { password });
}

export function logoutAdmin() {
  return send("/api/admin/logout", {});
}

export function saveAdminSheet(course: string, batch: string, url: string) {
  return send("/api/admin/sheets", { course, batch, url });
}

export function sendAdminNotice(title: string, body: string, course: string, batch: string) {
  return send("/api/admin/notices", { title, body, course, batch });
}

export function changeAdminPassword(current: string, next: string) {
  return send("/api/admin/password", { current, next });
}
