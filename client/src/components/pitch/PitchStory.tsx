import { Bell, CalendarDays, LayoutGrid, type LucideIcon } from "lucide-react";
import { Eyebrow, LivePill, Reveal, Section, focusRing, type PitchActions } from "@/components/pitch/bits";

const features: Array<{ icon: LucideIcon; title: string; note: string }> = [
  {
    icon: CalendarDays,
    title: "Today",
    note: "The day's classes in order, with the room and who is teaching. The next class stays easy to find.",
  },
  {
    icon: LayoutGrid,
    title: "This week",
    note: "The same classes as a grid. A student sees one section. A teacher sees every lecture under their name.",
  },
  {
    icon: Bell,
    title: "What changed",
    note: "A class taken off a day that is still published stays on the grid as cancelled, in its own colour. You can export the week and get a reminder before a lecture starts.",
  },
];

const sheetSteps = [
  { title: "The sheet", note: "Administration keeps the official timetable in one Google Sheet per batch, with the sections inside it." },
  { title: "Aayam reads it", note: "The site downloads the sheet. It never writes back. Each sync compares the new week with the one it already has." },
  { title: "You see the change", note: "The day, the week, and the updates list pick up a new room, a new class, or a cancellation." },
];

export function PitchStory({
  onOpenStudent,
  onOpenFaculty,
}: Pick<PitchActions, "onOpenStudent" | "onOpenFaculty">) {
  return (
    <>
      <Section id="features" tone="raise">
        <Reveal>
          <div className="flex items-center gap-2">
            <Eyebrow>What you get</Eyebrow>
            <LivePill />
          </div>
          <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Today, the week, and every change since the last version.
          </h2>
        </Reveal>
        <ul className="mt-10 grid gap-3 lg:grid-cols-3">
          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.title}>
                <Reveal delay={index * 60} className="h-full">
                  <article className="h-full rounded-2xl border border-white/10 bg-[#07080c] px-5 py-5">
                    <Icon className="size-4 text-[#5b8def]" aria-hidden="true" />
                    <h3 className="mt-4 text-base font-medium">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{item.note}</p>
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section>
        <Reveal>
          <Eyebrow>Who it's for</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            One section for a student. One teaching week for a teacher.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-3 lg:grid-cols-2">
          <Reveal className="h-full">
            <article id="students" className="flex h-full scroll-mt-24 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-medium">Students</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Enter the 6-digit PIN for your batch, then choose your section. The timetable shows only that section, with the faculty name on each class.
              </p>
              <ol className="mt-5 grid gap-2 text-sm text-white/75">
                <li>1. PIN for the batch</li>
                <li>2. Pick the section</li>
                <li>3. Day, week, and changes for that section</li>
              </ol>
              <button type="button" onClick={onOpenStudent} className={`mt-6 self-start rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#07080c] ${focusRing}`}>
                Open as student
              </button>
            </article>
          </Reveal>
          <Reveal delay={80} className="h-full">
            <article id="faculty" className="flex h-full scroll-mt-24 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-medium">Faculty</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Sign in with your @itm.edu or @isu.ac.in Google account. You see the classes you teach. Each card shows the section, the room, and the time.
              </p>
              <ol className="mt-5 grid gap-2 text-sm text-white/75">
                <li>1. Institutional Google sign-in</li>
                <li>2. Your lectures across the week</li>
                <li>3. The section on the card, so the room is clear</li>
              </ol>
              <button type="button" onClick={onOpenFaculty} className={`mt-6 self-start rounded-lg border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5 ${focusRing}`}>
                Faculty sign in
              </button>
            </article>
          </Reveal>
        </div>
      </Section>

      <Section id="how" tone="raise">
        <Reveal>
          <Eyebrow>How it stays current</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            The sheet stays the source. This page is the view of it.
          </h2>
        </Reveal>
        <ol className="mt-10 grid gap-3 md:grid-cols-3">
          {sheetSteps.map((step, index) => (
            <li key={step.title}>
              <Reveal delay={index * 60} className="h-full">
                <article className="h-full rounded-2xl border border-white/10 px-5 py-5">
                  <p className="font-mono text-xs text-[#5b8def]">0{index + 1}</p>
                  <h3 className="mt-3 text-base font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{step.note}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
