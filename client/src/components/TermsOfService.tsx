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
            <span>Last updated: October 2026</span>
          </div>
        </div>

        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Terms of Service</h1>
            <p className="mt-2 text-muted-foreground">
              Welcome to Aayam · आयाम (<a href="https://aayam.kv404.dev" className="text-primary underline">aayam.kv404.dev</a>). By using our application, you agree to these Terms of Service.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Description of Service</h2>
            <p className="text-muted-foreground">
              Aayam (आयाम) is an automated, real-time college schedule viewer that aggregates published course timetables from official institutional planning sheets for students and faculty.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Authorized Use &amp; Account Access</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Student Access:</strong> Student schedule views are publicly accessible for all active academic cohorts and divisions.
              </li>
              <li>
                <strong className="text-foreground">Faculty &amp; Coordinator Access:</strong> Faculty schedule views require authentication using an official Google Workspace account under approved domains (<code>@itm.edu</code> or <code>@isu.ac.in</code>). Attempting unauthorized access or spoofing credentials is strictly prohibited.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Accuracy of Schedules &amp; Disclaimers</h2>
            <p className="text-muted-foreground">
              The service synchronizes data directly from official college planning spreadsheets. While we strive to maintain instant and accurate change tracking (including lecture relocations, cancellations, and holiday notices), official institutional announcements from course administration always supersede the timetable view.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use Policy</h2>
            <p className="text-muted-foreground">
              Users agree not to disrupt or burden the system through automated scraping, denial-of-service attempts, or reverse engineering of backend synchronization endpoints.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Modifications to Service and Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify or discontinue features, update schedule configurations, or revise these terms to align with institutional policies. Continued use of the service signifies acceptance of revised terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Contact</h2>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Timetable Administrator:</strong> Karamveer Singh</p>
              <p><strong className="text-foreground">Email:</strong> <a href="mailto:Kv404@protonmail.com" className="text-primary underline">Kv404@protonmail.com</a> &middot; <a href="mailto:2025.karamveers@isu.ac.in" className="text-primary underline">2025.karamveers@isu.ac.in</a></p>
              <p><strong className="text-foreground">Website:</strong> <a href="https://timetable.kv404.dev" className="text-primary underline">https://timetable.kv404.dev</a></p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
