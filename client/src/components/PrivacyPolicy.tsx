import { ArrowLeft, ShieldCheck } from "lucide-react";

export function PrivacyPolicy({ onBack }: { onBack?: () => void }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
          <button
            type="button"
            onClick={onBack || (() => { window.location.href = "/"; })}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Aayam</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
            <span>Last updated: 16 November 2026</span>
          </div>
        </div>

        <article className="max-w-none space-y-6 text-sm leading-relaxed">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Privacy Policy</h1>
            <p className="mt-2 text-muted-foreground">
              Aayam (आयाम) at <a href="https://aayam.kv404.dev" className="text-primary underline">aayam.kv404.dev</a> shows the college timetable. This page says what the service reads, what it stores, and what it does not collect.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. The timetable comes from the college sheets</h2>
            <p className="text-muted-foreground">
              The original record is the college Google Sheet for that course and batch. The sheet stays shared so anyone with the link can view it. Aayam’s server downloads a copy of that sheet as an Excel file. It never writes back to Google, and the browser is never given a Google key.
            </p>
            <p className="text-muted-foreground">
              From each sheet the server reads the fields the college already published: course, batch, section name, subject, the faculty name written in the cell, room, start time, end time, date, weekday, and whether that class is marked off, cancelled, holiday, or filled red. A cancelled class is kept on the grid with a line through it. That copy is stored so the page can open again without downloading the sheet every time, including after the server process restarts.
            </p>
            <p className="text-muted-foreground">
              A student request downloads the sheet for the batch they picked. It does not download the other batches. A faculty sign-in reads every sheet, because that view lists every lecture under the faculty name.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Students</h2>
            <p className="text-muted-foreground">
              There is no student account. Aayam does not ask for a name, email, phone number, or roll number. The course, batch, and section you pick are saved in this browser under keys that start with <code>timetable-</code>. The server sees the batch or the section in the address of the timetable request, and uses that only to choose which sheet to read. It does not build a profile from it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Faculty sign-in</h2>
            <p className="text-muted-foreground">
              Faculty sign in with Google. Aayam receives the name and email on the Google ID token, and only for an <code>@itm.edu</code> or <code>@isu.ac.in</code> address that is already listed in the faculty directory. That directory is a table in the Aayam database on Cloudflare. The check stores the email, the faculty name, whether that person can see every class, and the time of the last sign-in.
            </p>
            <p className="text-muted-foreground">
              A signed-in session is an HttpOnly cookie named <code>timetable_faculty_session</code>, kept for 7 days, plus a copy of the same token in this browser so a home-screen icon can stay signed in. Sign-out deletes both. The Google data is used to open that person’s timetable. It is not sold, and it is not used for advertising.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Notices</h2>
            <p className="text-muted-foreground">
              If you turn notifications on, the browser asks for permission. Aayam then stores the push subscription for this browser: the endpoint and its keys, and the course, batch, and section that were open, so a message can be sent to that group. The subscription does not include a student name. You can turn notifications off in the timetable. An operator can also write a short notice, which is stored and shown to the matching students.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. What stays on this device</h2>
            <p className="text-muted-foreground">
              Theme, class colours, whether a Meet link opens or is copied, and which notices you have already closed are stored in this browser. Clearing the site data removes them. Aayam does not receive a student identity from that storage.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Contact</h2>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Timetable administrator:</strong> Karamveer Singh</p>
              <p><strong className="text-foreground">Email:</strong> <a href="mailto:Kv404@protonmail.com" className="text-primary underline">Kv404@protonmail.com</a> · <a href="mailto:2025.karamveers@isu.ac.in" className="text-primary underline">2025.karamveers@isu.ac.in</a></p>
              <p><strong className="text-foreground">Website:</strong> <a href="https://aayam.kv404.dev" className="text-primary underline">https://aayam.kv404.dev</a></p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
