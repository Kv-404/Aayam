import { useEffect, useState, type JSX } from "react";
import { ArrowRight } from "lucide-react";
import {
  Eyebrow,
  focusRing,
  Reveal,
  sourceHost,
  WeekPreview,
  Wordmark,
  type PitchActions,
} from "@/components/pitch/bits";

const primaryButton = `inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#07080c] hover:bg-white/90 sm:w-auto ${focusRing}`;
const ghostButton = `w-full rounded-lg border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5 sm:w-auto ${focusRing}`;

const links = [
  ["#features", "Features"],
  ["#students", "Students"],
  ["#faculty", "Faculty"],
  ["#next", "What's next"],
  ["#pricing", "Pricing"],
];

export function PitchTop(actions: PitchActions): JSX.Element {
  const { hasSavedAccess, savedLabel, onContinue, onOpenStudent, onOpenFaculty, sourceUrl } = actions;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-30 border-b border-white/10 backdrop-blur-md ${
          scrolled ? "bg-[#07080c]/90 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.9)]" : "bg-[#07080c]/70"
        }`}
      >
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <a href="#top" aria-label="Aayam, back to top" className={`inline-flex ${focusRing}`}>
            <Wordmark size={22} />
          </a>
          <nav aria-label="On this page" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 lg:flex">
            {links.map(([href, label]) => (
              <a key={href} href={href} className={`text-sm text-white/60 hover:text-white ${focusRing}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={onOpenStudent} className={`rounded-lg px-2.5 py-1.5 text-sm text-white/70 hover:text-white ${focusRing}`}>
              Student
            </button>
            <button type="button" onClick={onOpenFaculty} className={`rounded-lg bg-white px-2.5 py-1.5 text-sm font-medium text-[#07080c] hover:bg-white/90 ${focusRing}`}>
              Faculty
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Reveal>
          <Eyebrow>ITM / ISU · School of FutureTech</Eyebrow>
          <div className="mt-5 flex items-end gap-3">
            <Wordmark size={42} />
            <p className="pb-1 text-xl font-medium text-[#4c8dff]">आयाम</p>
          </div>
          <h1 className="mt-6 text-4xl font-medium tracking-tight text-balance sm:text-5xl">
            The timetable that changes when the sheet does.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
            Aayam reads the official Google Sheet and shows it for one section, or for one teacher. You get today, the week, and the changes: a cancelled class or a moved room shows up here.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="https://exam.somyacodes.in/" target="_blank" rel="noreferrer" className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#ff5555]/70 px-4 py-2.5 text-sm text-[#ff5555] hover:bg-[#ff5555]/10 sm:w-auto ${focusRing}`}>
              AT/KT exams
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            {hasSavedAccess ? (
              <button type="button" onClick={onContinue} className={primaryButton}>
                Continue to {savedLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" onClick={onOpenStudent} className={primaryButton}>
                Open as student
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={onOpenFaculty} className={ghostButton}>
              Faculty sign in
            </button>
            <a href={sourceUrl} target="_blank" rel="noreferrer" className={`inline-flex w-full items-center justify-center text-sm text-white/55 underline-offset-4 hover:text-white hover:underline sm:w-auto ${focusRing}`}>
              View the code
            </a>
          </div>
          <p className="mt-8 font-mono text-xs text-white/40">{sourceHost}</p>
        </Reveal>
        <Reveal delay={120} className="min-w-0">
          <WeekPreview />
        </Reveal>
      </section>
    </>
  );
}
