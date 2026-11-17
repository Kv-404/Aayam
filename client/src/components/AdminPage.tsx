import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  changeAdminPassword,
  fetchAdminSession,
  loginAdmin,
  logoutAdmin,
  saveAdminSheet,
  sendAdminNotice,
  type AdminNotice,
  type AdminSheet,
} from "@/lib/admin";

function programLabel(course: string) {
  return course.trim().toLowerCase() === "btech" ? "B.Tech" : course;
}

function batchLabel(batch: string) {
  return batch.replace("-", "–");
}

export function AdminPage({ onHome }: { onHome: () => void }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [sheets, setSheets] = useState<AdminSheet[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const session = await fetchAdminSession();
    setSignedIn(session.signedIn);
    setSheets(session.sheets);
    setNotices(session.notices);
    setReady(true);
  }

  useEffect(() => {
    void load().catch(() => setReady(true));
  }, []);

  async function signIn() {
    setError("");
    setBusy("signin");
    try {
      await loginAdmin(password);
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That password is not right.");
    } finally {
      setBusy("");
    }
  }

  async function signOut() {
    await logoutAdmin().catch(() => undefined);
    setSignedIn(false);
    setSheets([]);
    setNotices([]);
  }

  async function saveSheet(sheet: AdminSheet) {
    const key = `${sheet.course}\0${sheet.batch}`;
    const url = (drafts[key] ?? "").trim();
    if (!url) return;
    setError("");
    setNote("");
    setBusy(key);
    try {
      const result = await saveAdminSheet(sheet.course, sheet.batch, url);
      if (result.sheets) setSheets(result.sheets);
      setDrafts((prev) => ({ ...prev, [key]: "" }));
      const label = `${programLabel(sheet.course)} ${batchLabel(sheet.batch)}`;
      // The sheet is read by a background job, so the timetable catches up a little later.
      setNote(result.syncing ? `Saved ${label}. The timetable updates within about a minute.` : `Updated ${label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The sheet could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function sendNotice() {
    setError("");
    setNote("");
    setBusy("notice");
    const [course, batch] = audience === "all" ? ["", ""] : audience.split("|");
    try {
      const result = await sendAdminNotice(title.trim(), message.trim(), course ?? "", batch ?? "");
      if (result.notices) setNotices(result.notices as AdminNotice[]);
      setTitle("");
      setMessage("");
      const delivered = typeof result.delivered === "number" ? result.delivered : 0;
      // Push is sent by a background job. The notice itself is already live on the timetable.
      setNote(
        result.queued
          ? "Notice posted. Push notifications go out within a minute."
          : delivered > 0
            ? `Sent. ${delivered} phone${delivered === 1 ? "" : "s"} got it in the background.`
            : "Sent. Students see it the next time the timetable is open.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The message could not be sent.");
    } finally {
      setBusy("");
    }
  }

  async function changePassword() {
    setError("");
    setNote("");
    setBusy("password");
    try {
      await changeAdminPassword(currentPassword, nextPassword);
      setCurrentPassword("");
      setNextPassword("");
      setShowPassword(false);
      setNote("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The password could not be changed.");
    } finally {
      setBusy("");
    }
  }

  const courses = [...new Set(sheets.map((sheet) => sheet.course))];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onHome} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Home
        </button>
        {signedIn ? (
          <button type="button" onClick={() => void signOut()} className="text-xs text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        ) : null}
      </div>

      <h1 className="mt-8 text-3xl font-medium tracking-tight">Admin</h1>

      {!ready ? <p className="mt-6 text-sm text-muted-foreground">Checking the session…</p> : null}

      {ready && !signedIn ? (
        <form
          className="mt-8 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
        >
          <label className="grid gap-2 text-sm">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl border border-border bg-transparent px-4 py-3 outline-none focus:border-foreground"
            />
          </label>
          <button type="submit" disabled={!password || busy === "signin"} className="rounded-xl bg-foreground px-4 py-3 text-sm text-background disabled:opacity-40">
            Sign in
          </button>
        </form>
      ) : null}

      {ready && signedIn ? (
        <div className="mt-8 grid gap-10">
          <section className="grid gap-3">
            <h2 className="text-lg font-medium tracking-tight">Sheet links</h2>
            <p className="text-sm text-muted-foreground">Paste the Google Sheet for a year. The timetable reads that sheet from then on.</p>
            <ul className="grid gap-4">
              {sheets.map((sheet) => {
                const key = `${sheet.course}\0${sheet.batch}`;
                return (
                  <li key={key} className="grid gap-2 rounded-2xl border border-border p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium">{programLabel(sheet.course)} · {batchLabel(sheet.batch)}</p>
                    </div>
                    <a href={sheet.spreadsheetUrl} target="_blank" rel="noreferrer" className="truncate text-xs text-muted-foreground hover:text-foreground">
                      {sheet.spreadsheetUrl}
                    </a>
                    <input
                      value={drafts[key] ?? ""}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                      placeholder="Paste a new sheet link"
                      aria-label={`${programLabel(sheet.course)} ${batchLabel(sheet.batch)} sheet link`}
                      className="rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => void saveSheet(sheet)}
                      disabled={!(drafts[key] ?? "").trim() || busy === key}
                      className="justify-self-start rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-40"
                    >
                      Update
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="grid gap-3">
            <h2 className="text-lg font-medium tracking-tight">Notify students</h2>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              aria-label="Notification title"
              maxLength={80}
              className="rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none focus:border-foreground"
            />
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Message"
              aria-label="Notification message"
              maxLength={280}
              rows={3}
              className="resize-none rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none focus:border-foreground"
            />
            <label className="grid gap-2 text-sm">
              Who
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                className="rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none"
              >
                <option value="all">All students</option>
                {courses.map((course) => (
                  <option key={course} value={`${course}|`}>
                    {programLabel(course)}
                  </option>
                ))}
                {sheets.map((sheet) => (
                  <option key={`${sheet.course}-${sheet.batch}`} value={`${sheet.course}|${sheet.batch}`}>
                    {programLabel(sheet.course)} {batchLabel(sheet.batch)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void sendNotice()}
              disabled={!title.trim() || !message.trim() || busy === "notice"}
              className="justify-self-start rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-40"
            >
              Send
            </button>
            {notices.length > 0 ? (
              <ul className="mt-2 grid gap-2">
                {notices.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground">{item.body}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            {showPassword ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void changePassword();
                }}
              >
                <h2 className="text-lg font-medium tracking-tight">Change password</h2>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Current password"
                  aria-label="Current password"
                  className="rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none focus:border-foreground"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                  placeholder="New password, at least 12 characters"
                  aria-label="New password"
                  className="rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none focus:border-foreground"
                />
                <button type="submit" disabled={busy === "password"} className="justify-self-start rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-40">
                  Save password
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setShowPassword(true)} className="text-sm text-muted-foreground hover:text-foreground">
                Change password
              </button>
            )}
          </section>
        </div>
      ) : null}

      {error ? <p className="mt-6 text-sm text-danger" role="alert">{error}</p> : null}
      {note ? <p className="mt-6 text-sm text-muted-foreground" role="status">{note}</p> : null}
    </main>
  );
}
