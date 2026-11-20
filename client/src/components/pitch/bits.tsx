import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AayamIcon } from "@/components/AayamLogo";

export const sourceHost = "aayam.kv404.dev";

/** Pricing slide. Beginner is the cheap entry. Pro is per student. */
export const beginnerPrice = "₹60";
export const beginnerRate = "per student, or ₹2,000 per class, per quarter";
export const proPrice = "₹500";
export const proRate = "per student / quarter";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8eb4ff]";

export interface PitchActions {
  hasSavedAccess: boolean;
  savedLabel: string;
  onContinue: () => void;
  onOpenStudent: () => void;
  onOpenFaculty: () => void;
  onOpenPage: (event: MouseEvent, url: string) => void;
  sourceUrl: string;
}

export function Eyebrow({ children }: { children: string }) {
  return <p className="text-[11px] font-medium tracking-[0.22em] text-[#5b8def] uppercase">{children}</p>;
}

export function LivePill() {
  return (
    <span className="rounded-full border border-[#4c8dff]/80 px-2 py-0.5 text-[10px] font-medium tracking-[0.16em] text-[#8eb4ff] uppercase">
      Live
    </span>
  );
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const visible = () => {
      const rect = node.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    };
    if (visible()) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.01, rootMargin: "0px 0px 12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Section({
  id,
  tone = "base",
  children,
  className = "",
}: {
  id?: string;
  tone?: "base" | "raise" | "navy" | "blue";
  children: ReactNode;
  className?: string;
}) {
  const background =
    tone === "raise" ? "bg-[#0c0e14]" : tone === "navy" ? "bg-[#0d1730]" : tone === "blue" ? "bg-[#2f6fed]" : "";
  return (
    <section id={id} className={`scroll-mt-20 ${background} ${className}`}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">{children}</div>
    </section>
  );
}

export function Mark({ on }: { on: boolean }) {
  if (!on) return <span className="text-white/30" aria-label="Not included">—</span>;
  return (
    <span className="text-[#8eb4ff]" aria-label="Included">
      ✓
    </span>
  );
}

const tones: Record<string, string> = {
  Maths: "#1d4e89",
  DSA: "#0f6e56",
  Physics: "#6d4b7b",
  ML: "#8a5a2a",
  English: "#7a3e3e",
  Lab: "#245c4a",
  SE: "#3d4f7c",
};

const weekRows: Array<{ time: string; cells: string[] }> = [
  { time: "09:00", cells: ["Maths", "DSA", "Maths", "ML", "Physics", "Off"] },
  { time: "10:00", cells: ["English", "DSA", "Lab", "ML", "Off", "Off"] },
  { time: "11:15", cells: ["SE", "SE", "SE", "ML", "Off", "Off"] },
  { time: "13:00", cells: ["", "", "Lab", "Lab", "Off", "Off"] },
  { time: "14:10", cells: ["", "", "Maths", "English", "Off", "Off"] },
];

export function WeekPreview() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101218] shadow-[0_30px_80px_-48px_rgba(76,141,255,0.65)]" aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="size-2 rounded-full bg-white/20" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/10" />
        <span className="ml-2 font-mono text-[10px] text-white/40">{sourceHost}</span>
        <span className="ml-auto rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-[#07080c]">Week</span>
      </div>
      <div className="grid grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] text-[10px]">
        <div className="border-b border-white/10" />
        {days.map((day) => (
          <div key={day} className="border-b border-l border-white/10 px-1.5 py-2 text-white/40">{day}</div>
        ))}
        {weekRows.map((row) => (
          <div key={row.time} className="contents">
            <div className="border-b border-white/10 px-1 py-1.5 font-mono text-[9px] text-white/35">{row.time}</div>
            {row.cells.slice(0, 5).map((cell, index) => (
              <div key={`${row.time}-${index}`} className="min-w-0 border-b border-l border-white/10 p-1">
                {cell === "Off" ? (
                  <span className="text-[9px] text-rose-300/80">Off</span>
                ) : cell ? (
                  <span className="block truncate rounded-md px-1 py-1 font-medium text-white" style={{ background: tones[cell] }}>
                    {cell}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return <AayamIcon size={size} className="[&_svg]:text-white" />;
}
