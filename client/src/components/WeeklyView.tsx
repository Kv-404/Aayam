import type { PublicLecture } from "@shared/types";
import { cohortLabel } from "@shared/cohort";
import { memo, useEffect, useMemo, useRef } from "react";
import { NowMark, TimeGrid } from "@/components/TimeGrid";
import { useColors } from "@/lib/colorState";
import { LectureRoom } from "@/components/MeetLink";
import type { MeetAction } from "@/lib/prefs";
import { formatCalendarDate, formatCompactRange } from "@/lib/time";
import { isFoldedOffDay, slotPhase } from "@/lib/view";

export function WeeklyView({
  lectures,
  showDivision,
  showFaculty = false,
  showLive = true,
  today = "",
  minutes = -1,
  meet,
}: {
  lectures: PublicLecture[];
  showDivision: boolean;
  showFaculty?: boolean;
  showLive?: boolean;
  today?: string;
  minutes?: number;
  meet: MeetAction;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const todayBlock = useRef<HTMLDivElement>(null);
  const days = [...new Set(lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)))].sort((a, b) => a.localeCompare(b));
  const dayKey = days.join("|");
  const byDate = useMemo(() => {
    const groups = new Map<string, PublicLecture[]>();
    for (const lecture of lectures) {
      if (!lecture.date) continue;
      const group = groups.get(lecture.date);
      if (group) group.push(lecture);
      else groups.set(lecture.date, [lecture]);
    }
    return groups;
  }, [lectures]);
  const columns = useMemo(() => days.map((date) => ({ date, lectures: byDate.get(date) ?? [] })), [dayKey, byDate]);
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    function revealToday() {
      const column = root?.querySelector(".wk-head.wk-today");
      if (!(column instanceof HTMLElement) || !root) return;
      const time = root.querySelector(".wk-corner");
      const gutter = time instanceof HTMLElement ? time.getBoundingClientRect().width : 0;
      const rootBox = root.getBoundingClientRect();
      const columnBox = column.getBoundingClientRect();
      const previous = column.previousElementSibling;
      const previousBox = previous instanceof HTMLElement ? previous.getBoundingClientRect() : null;
      const edge = rootBox.left + gutter;
      const previousClipped = Boolean(previousBox && previousBox.left < edge - 1 && previousBox.right > edge + 1);
      const todayClipped = columnBox.left < edge - 1 || columnBox.right > rootBox.right - 4;
      if (!previousClipped && !todayClipped) return;
      root.scrollLeft += columnBox.left - edge;
    }
    revealToday();
    window.addEventListener("resize", revealToday);
    return () => window.removeEventListener("resize", revealToday);
  }, [today, dayKey]);
  useEffect(() => {
    const block = todayBlock.current;
    if (!block || !window.matchMedia("(max-width: 639px)").matches) return;
    block.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [today, dayKey]);
  if (days.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">No dated lectures match these filters.</p>;
  }
  const forDay = (date: string) => byDate.get(date) ?? [];
  const offDay = (date: string) => isFoldedOffDay(forDay(date));
  return (
    <>
    <div className="sm:hidden">
      {days.map((date) => {
        const dayLectures = forDay(date);
        const weekday = dayLectures[0]?.weekday ?? "";
        const off = offDay(date);
        return (
          <section key={date} ref={date === today ? todayBlock : undefined} className={`mb-6 ${date === today ? "scroll-mt-24 short:scroll-mt-2" : ""}`}>
            <h2 className="flex items-center gap-2 border-b border-border bg-background py-2">
              <span className={`text-base tracking-tight ${date === today ? "font-bold" : "font-semibold"} ${off ? "text-danger" : ""}`}>{off ? `${weekday} Off` : weekday.slice(0, 3)}</span>
              {!off && <span className={`text-sm ${date === today ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{formatCalendarDate(date).replace(/^[A-Za-z]{3},?\s*/, "")}</span>}
              {date === today && <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Today</span>}
            </h2>
            {off ? null : (
              <ol>
                {[...dayLectures]
                  .sort((a, b) => a.startMinutes - b.startMinutes || a.division.localeCompare(b.division) || a.subject.localeCompare(b.subject))
                  .map((lecture) => (
                    <PhoneRow key={lecture.id} lecture={lecture} showDivision={showDivision} showFaculty={showFaculty} now={showLive && isLive(lecture, today, minutes)} meet={meet} />
                  ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
    <div ref={scroller} className="rise hidden overflow-x-auto sm:block">
      <TimeGrid
        columns={columns}
        today={today}
        minutes={minutes}
        showDivision={showDivision}
        showFaculty={showFaculty}
        showLive={showLive}
        meet={meet}
      />
    </div>
    </>
  );
}

function isLive(lecture: PublicLecture, today: string, minutes: number) {
  return lecture.kind === "lecture" && lecture.displayStatus !== "cancelled" && slotPhase(lecture, today, minutes) === "now";
}

function bareTime(label: string) {
  return label.replace(/\s*[AP]M$/i, "").trim();
}

// All classes can draw hundreds of cards, and the clock ticks every 15 seconds. Only a card whose props changed repaints.
const PhoneRow = memo(function PhoneRow({ lecture, showDivision, showFaculty, now, meet }: { lecture: PublicLecture; showDivision: boolean; showFaculty: boolean; now: boolean; meet: MeetAction }) {
  const { classNameFor } = useColors();
  const cancelled = lecture.displayStatus === "cancelled" && lecture.subject !== "OFF";
  if (lecture.kind === "break") {
    return (
      <li className="flex items-baseline gap-3 border-b border-border py-2 text-xs text-muted-foreground">
        <span className="w-12 shrink-0" aria-hidden="true" />
        <span>
          {lecture.subject} · {formatCompactRange(lecture.startLabel, lecture.endLabel)}
        </span>
      </li>
    );
  }
  return (
    <li className="flex gap-3 border-b border-border py-2">
      <p className="w-12 shrink-0 pt-1.5 text-right font-mono text-[11px] leading-4 text-muted-foreground">
        <span className="block">{bareTime(lecture.startLabel)}</span>
        <span className="block">{bareTime(lecture.endLabel)}</span>
      </p>
      <div className={`min-w-0 flex-1 ${classNameFor(lecture.subject, lecture.displayStatus)} ${now ? "is-now" : ""}`} data-testid="lecture-card" data-live={now ? "true" : undefined}>
        <div className="flex items-start justify-between gap-2">
          <p className={`min-w-0 leading-snug font-medium tracking-tight ${cancelled ? "line-through decoration-danger decoration-2" : ""}`}>{lecture.subject}</p>
          {now && <NowMark />}
          {cancelled && <span className="shrink-0 text-[11px] font-semibold text-danger">Cancelled</span>}
        </div>
        <ClassFoot faculty={showDivision && !showFaculty ? "" : lecture.faculty} room={lecture.room} cohort={showDivision ? lecture.division : ""} meet={meet} oneLine batch={showDivision && !showFaculty ? lecture.batch : ""} />
      </div>
    </li>
  );
});

function ClassFoot({ faculty, room, cohort = "", meet, oneLine = false, batch = "" }: { faculty: string; room: string; cohort?: string; meet: MeetAction; oneLine?: boolean; batch?: string }) {
  const label = [cohort ? cohortLabel(cohort) : "", batch, faculty].filter(Boolean).join(" · ");
  if (!label && !room.trim()) return null;
  return (
    <div className="mt-1.5 flex items-start justify-between gap-2 text-[13px] leading-snug">
      {label ? <span className={`class-faculty min-w-0 font-medium text-foreground ${oneLine ? "truncate" : ""}`} title={label}>{label}</span> : <span />}
      {room.trim() && <LectureRoom room={room} action={meet} variant="chip" />}
    </div>
  );
}
