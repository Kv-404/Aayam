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
            <span>Last updated: October 2026</span>
          </div>
        </div>

        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Privacy Policy</h1>
            <p className="mt-2 text-muted-foreground">
              This Privacy Policy explains how Aayam · आयाम (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the Service&rdquo;) handles and protects your information when you visit and use <a href="https://aayam.kv404.dev" className="text-primary underline">aayam.kv404.dev</a>.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
            <p>
              We prioritize privacy and minimize data collection to only what is strictly required to provide timetable schedules:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Student Users:</strong> We do not require accounts, sign-ins, or personal information for students. Preferences (such as chosen cohort, theme, and color settings) are stored locally in your web browser&rsquo;s <code>localStorage</code> and never sent to our servers.
              </li>
              <li>
                <strong className="text-foreground">Faculty &amp; Authorized Personnel:</strong> When signing in through Google Identity Services, we access your name and email address to verify that your account belongs to an authorized institutional domain (<code>@itm.edu</code> or <code>@isu.ac.in</code>) and match it with the faculty directory.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. How We Use Google User Data</h2>
            <p>
              Any data received from Google OAuth APIs is strictly used to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>Authenticate your identity as a verified faculty member or coordinator.</li>
              <li>Display your authorized faculty schedule while keeping public selection secure.</li>
              <li>Maintain your authenticated session via encrypted, HTTP-only session cookies.</li>
            </ul>
            <p className="text-muted-foreground">
              We <strong className="text-foreground">do not sell, rent, or transfer</strong> your Google user data to third parties. We do not use Google user data for advertising, profiling, or marketing purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Data Storage &amp; Security</h2>
            <p className="text-muted-foreground">
              Faculty email mappings and permissions are maintained securely in an encrypted cloud PostgreSQL database (Neon). Authentication sessions use HMAC-SHA256 signed <code>httpOnly</code> cookies with <code>SameSite=Lax</code> security flags to protect against cross-site request forgery.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Data Retention &amp; Deletion</h2>
            <p className="text-muted-foreground">
              Authentication sessions expire automatically after 7 days, or immediately when clicking <strong>Sign out</strong>. Faculty members wishing to remove their account information from the faculty directory may request deletion by contacting the administrator.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy or wish to request data updates, please contact:
            </p>
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
