import { ArrowLeft, FileText } from "lucide-react";

export function TermsOfService({ onBack }: { onBack?: () => void }) {
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
            <FileText className="size-4 text-primary" />
            <span>Last updated: 16 November 2026</span>
          </div>
        </div>

        <article className="max-w-none space-y-6 text-sm leading-relaxed">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Terms of Service</h1>
            <p className="mt-2 text-muted-foreground">
              These terms cover use of Aayam (आयाम) at <a href="https://aayam.kv404.dev" className="text-primary underline">aayam.kv404.dev</a>. Using the timetable means you accept them.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. What Aayam is</h2>
            <p className="text-muted-foreground">
              Aayam shows the college timetable. The original record is the official Google Sheet for a course and batch. The server downloads that sheet and shows a copy: the subject, faculty name, room, time, date, and any cancellation the sheet marks. Aayam does not edit the sheet. If the sheet and this page disagree, the sheet and the college’s own notice are the record.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Who can open it</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Students</strong> pick a course, then a batch such as 2025–29, then a section. That opens the sheet for that batch. There is no student account and no batch PIN.
              </li>
              <li>
                <strong className="text-foreground">Faculty</strong> sign in with a Google account on <code>@itm.edu</code> or <code>@isu.ac.in</code> that is listed in the faculty directory. That view reads every sheet, so the lectures under that name can be shown together.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. The college’s timetable</h2>
            <p className="text-muted-foreground">
              The words in the sheet, including subject names, faculty names, and room numbers, are the college’s. Aayam is allowed to display that published timetable. You may use it to see when and where a class is. You may not present a changed copy as the official sheet.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable use</h2>
            <p className="text-muted-foreground">
              Do not overload the sync, scrape the sheets through this service in bulk, try to sign in as someone else, or try to obtain the operator password. A student request is for one batch. Asking it to pull every batch is outside how the service is offered.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Notices</h2>
            <p className="text-muted-foreground">
              The college operator may send a short notice to a course, a batch, or every student.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Changes</h2>
            <p className="text-muted-foreground">
              The sheets change when the college updates them. These terms can change too. The date at the top of this page is the date of the current text. Continuing to use Aayam after that date means you accept the updated terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Contact</h2>
            <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
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
