import { Check } from "lucide-react";
import {
  Eyebrow,
  Reveal,
  Section,
  beginnerPrice,
  beginnerRate,
  focusRing,
  proPrice,
  proRate,
  sourceHost,
  type PitchActions,
} from "@/components/pitch/bits";

const beginner = [
  "Day list and weekly grid",
  "Cancellations, rooms, and lecture details",
  "Batch and section choice",
  "Faculty sign-in on an institutional account",
  "Calendar export and lecture reminders",
];

const pro = [
  "Everything in Beginner",
  "A login for each student, and for admin",
  "Fees, assignments, and marks",
  "Library and faculty tools",
];

export function PitchClose({
  onOpenStudent,
  onOpenFaculty,
  onOpenPage,
  sourceUrl,
  onOpenMcp,
}: Pick<PitchActions, "onOpenStudent" | "onOpenFaculty" | "onOpenPage" | "sourceUrl"> & { onOpenMcp?: () => void }) {
  return (
    <>
      <Section id="pricing" tone="raise">
        <Reveal>
          <Eyebrow>For the institution</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Start with the timetable. Add the rest when the campus is ready.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
            These prices are for the college, per quarter. Students and faculty open the live timetable from this page.
          </p>
        </Reveal>
        <div className="mt-10 grid items-stretch gap-3 md:grid-cols-2">
          <Reveal className="flex h-full flex-col">
            <article className="flex h-full flex-1 flex-col rounded-2xl border border-white/10 bg-[#07080c] p-6">
              <p className="text-xs tracking-[0.16em] text-white/45 uppercase">Beginner</p>
              <p className="mt-4 text-4xl font-medium tracking-tight">{beginnerPrice}</p>
              <p className="mt-2 text-sm text-white/55">{beginnerRate}</p>
              <p className="mt-4 text-sm text-white/70">The timetable that is live now.</p>
              <div className="min-h-4 flex-1" />
              <ul className="mt-5 grid gap-2 border-t border-white/10 pt-5 text-sm">
                {beginner.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#5b8def]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
          <Reveal className="flex h-full flex-col" delay={80}>
            <article className="flex h-full flex-1 flex-col rounded-2xl border border-[#4c8dff]/70 bg-[#0d1b33] p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.16em] text-[#8eb4ff] uppercase">Pro</p>
                <span className="text-[11px] text-white/45">Modules still in development</span>
              </div>
              <p className="mt-4 text-4xl font-medium tracking-tight">{proPrice}</p>
              <p className="mt-2 text-sm text-white/70">{proRate}</p>
              <p className="mt-4 text-sm text-white/70">The timetable, plus a login and a record for each student.</p>
              <div className="min-h-4 flex-1" />
              <ul className="mt-5 grid gap-2 border-t border-white/10 pt-5 text-sm">
                {pro.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#8eb4ff]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </Section>

      <section className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <h2 className="max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Open the timetable.
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/60">Students pick a batch and section. Faculty use an institutional Google account.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onOpenStudent} className={`rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#07080c] ${focusRing}`}>
              Open as student
            </button>
            <button type="button" onClick={onOpenFaculty} className={`rounded-lg border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5 ${focusRing}`}>
              Faculty sign in
            </button>
            {onOpenMcp && (
              <button type="button" onClick={onOpenMcp} data-testid="pitch-mcp-connect" className={`rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/85 hover:bg-white/5 hover:text-white ${focusRing}`}>
                Connect AI (MCP)
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-white/45 sm:px-8">
          <p>
            {sourceHost}
            <span aria-hidden="true"> · </span>
            <a href={sourceUrl} target="_blank" rel="noreferrer" className={`underline-offset-4 hover:text-white hover:underline ${focusRing}`}>
              GitHub
            </a>
          </p>
          <div className="flex items-center gap-3">
            <a href="/privacy" onClick={(event) => onOpenPage(event, "/privacy")} className={`underline-offset-4 hover:text-white hover:underline ${focusRing}`}>
              Privacy
            </a>
            <a href="/terms" onClick={(event) => onOpenPage(event, "/terms")} className={`underline-offset-4 hover:text-white hover:underline ${focusRing}`}>
              Terms
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
