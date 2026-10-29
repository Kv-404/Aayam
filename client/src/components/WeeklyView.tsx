import type { PublicLecture } from "@shared/types";
import { cohortLabel } from "@shared/cohort";
import { useEffect, useRef } from "react";
import { StatusBadge, badgeText } from "@/components/StatusBadge";
import { NowMark } from "@/components/TodayView";
import { useColors } from "@/lib/colorState";
import { ClockLabel } from "@/components/ClockLabel";
import { LectureRoom } from "@/components/MeetLink";
import type { MeetAction } from "@/lib/prefs";
import { formatCalendarDate, formatCompactRange } from "@/lib/time";
import { isFullOff, slotPhase } from "@/lib/view";

const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function WeeklyView({
  lectures,
  showDivision,
  today = "",
  minutes = -1,
  meet,
}: {
  lectures: PublicLecture[];
  showDivision: boolean;
  today?: string;
  minutes?: number;
  meet: MeetAction;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const todayBlock = useRef<HTMLDivElement>(null);
  const days = [...new Set(lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)))].sort((a, b) => a.localeCompare(b));
  const dayKey = days.join("|");
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    function revealToday() {
      const column = root?.querySelector("th.cal-today");
      if (!(column instanceof HTMLElement) || !root) return;
      const time = root.querySelector("thead th");
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
    block.scrollIntoView({ block: "start", behavior: "instant" });
  }, [today, dayKey]);
  if (days.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">No dated lectures match these filters.</p>;
  }
  const forDay = (date: string) => lectures.filter((lecture) => lecture.date === date);
  const offDay = (date: string) => isFullOff(forDay(date));
  // Full-day OFF cards span the first slot through the last. Their start must not label a normal class row.
  const starts = [...new Set(lectures.filter((lecture) => lecture.kind !== "off").map((lecture) => lecture.startMinutes))]
    .filter((minute) => minute >= 0)
    .sort((a, b) => a - b);
  return (
    <>
    <div className="sm:hidden">
      {days.map((date) => {
        const dayLectures = forDay(date);
        const weekday = dayLectures[0]?.weekday ?? "";
        const off = offDay(date);
        return (
          <section key={date} ref={date === today ? todayBlock : undefined} className={`mb-6 ${date === today ? "scroll-mt-28" : ""}`}>
            <h2 className="sticky top-24 z-20 flex items-baseline gap-2 border-b border-border bg-background py-2">
              <span className={`text-base font-semibold tracking-tight ${off ? "text-danger" : ""}`}>{off ? `${weekday} Off` : weekday.slice(0, 3)}</span>
              {!off && <span className="text-sm text-muted-foreground">{formatCalendarDate(date).replace(/^[A-Za-z]{3},?\s*/, "")}</span>}
              {date === today && !off && <span className="text-xs font-medium text-muted-foreground">Today</span>}
            </h2>
            {off ? null : (
              <ol>
                {[...dayLectures]
                  .sort((a, b) => a.startMinutes - b.startMinutes || a.division.localeCompare(b.division) || a.subject.localeCompare(b.subject))
                  .map((lecture) => (
                    <PhoneRow key={lecture.id} lecture={lecture} showDivision={showDivision} now={isLive(lecture, today, minutes)} meet={meet} />
                  ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
    <div ref={scroller} className="rise hidden overflow-x-auto border-y border-border sm:block">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-background px-3 py-3 align-bottom font-mono text-[11px] font-medium tracking-[0.22em] whitespace-nowrap text-muted-foreground uppercase">Time</th>
            {days.map((date) => {
              const dayLectures = forDay(date);
              const weekday = dayLectures[0]?.weekday ?? "";
              const off = offDay(date);
              return (
                <th key={date} className={`min-w-40 px-3 py-3 align-bottom font-medium ${date === today ? "cal-today" : ""} ${off ? "text-danger" : ""}`}>
                  <span className="block">{weekday || dayOrder.find((day) => dayLectures.some((lecture) => lecture.weekday === day))}</span>
                  <span className={`block text-xs font-normal ${off ? "text-danger" : "text-muted-foreground"}`}>{formatCalendarDate(date)}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {starts.length === 0 ? (
            <tr className="align-top">
              <th className="sticky left-0 bg-background px-3 py-3 font-mono text-xs font-medium whitespace-nowrap text-muted-foreground">All day</th>
              {days.map((date) => (
                <td key={date} className="px-3 py-3" />
              ))}
            </tr>
          ) : (
            starts.map((start) => {
              const sample = lectures.find((lecture) => lecture.startMinutes === start && lecture.kind !== "off");

              type DayCell =
                | { kind: "off"; date: string }
                | { kind: "classes"; date: string; classes: PublicLecture[] }
                | { kind: "break"; date: string; breakLecture: PublicLecture }
                | { kind: "empty"; date: string };

              const dayCells: DayCell[] = days.map((date) => {
                if (offDay(date)) {
                  return { kind: "off", date };
                }
                const daySlots = forDay(date).filter((lecture) => lecture.startMinutes === start && lecture.kind !== "off");
                const dayBreaks = daySlots.filter((lecture) => lecture.kind === "break");
                const dayClasses = daySlots.filter((lecture) => lecture.kind !== "break");

                if (dayClasses.length > 0) {
                  return { kind: "classes", date, classes: dayClasses };
                }
                if (dayBreaks.length > 0) {
                  return { kind: "break", date, breakLecture: dayBreaks[0]! };
                }
                return { kind: "empty", date };
              });

              interface RenderGroup {
                kind: "off" | "classes" | "break" | "empty";
                dates: string[];
                classes?: PublicLecture[];
                breakLecture?: PublicLecture;
              }

              const groups: RenderGroup[] = [];
              for (const cell of dayCells) {
                const prev = groups[groups.length - 1];
                const canMergeBreak =
                  prev &&
                  prev.kind === "break" &&
                  cell.kind === "break" &&
                  prev.breakLecture?.subject === cell.breakLecture.subject &&
                  prev.breakLecture?.startMinutes === cell.breakLecture.startMinutes &&
                  prev.breakLecture?.endMinutes === cell.breakLecture.endMinutes;

                if (canMergeBreak) {
                  prev.dates.push(cell.date);
                } else {
                  groups.push({
                    kind: cell.kind,
                    dates: [cell.date],
                    classes: cell.kind === "classes" ? cell.classes : undefined,
                    breakLecture: cell.kind === "break" ? cell.breakLecture : undefined,
                  });
                }
              }

              return (
                <tr key={start} className="border-b border-border align-top">
                  <th className="sticky left-0 z-10 bg-background px-3 py-3 font-mono text-xs font-medium whitespace-nowrap text-muted-foreground">
                    <ClockLabel label={sample?.startLabel ?? ""} />
                    <span className="mt-1 block font-normal">
                      <ClockLabel label={sample?.endLabel ?? ""} />
                    </span>
                  </th>
                  {groups.map((group) => {
                    if (group.kind === "off") {
                      return group.dates.map((date) => (
                        <td key={date} className={`px-3 py-3 text-sm font-medium text-danger ${date === today ? "cal-today" : ""}`}>
                          Off
                        </td>
                      ));
                    }
                    if (group.kind === "empty") {
                      return group.dates.map((date) => (
                        <td key={date} className={`px-2 py-2 ${date === today ? "cal-today" : ""}`} />
                      ));
                    }
                    if (group.kind === "classes") {
                      return (
                        <td key={group.dates[0]} className={`px-2 py-2 ${group.dates[0] === today ? "cal-today" : ""}`}>
                          <div className="space-y-2">
                            {group.classes!.map((lecture) => (
                              <Cell key={lecture.id} lecture={lecture} showDivision={showDivision} now={isLive(lecture, today, minutes)} meet={meet} />
                            ))}
                          </div>
                        </td>
                      );
                    }
                    // group.kind === "break"
                    const isMulti = group.dates.length > 1;
                    const b = group.breakLecture!;
                    return (
                      <td
                        key={group.dates.join("-")}
                        colSpan={group.dates.length}
                        className={`px-2 py-2 ${!isMulti && group.dates[0] === today ? "cal-today" : ""}`}
                      >
                        {isMulti ? (
                          <div className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/60 px-3 py-2.5 text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase shadow-xs transition-colors hover:bg-muted/80">
                            <span>{b.subject}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="font-mono text-[11px] font-normal tracking-normal text-muted-foreground/80">
                              {formatCompactRange(b.startLabel, b.endLabel)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-muted/60 px-2 py-2 text-center text-[11px] font-semibold tracking-wider text-muted-foreground uppercase shadow-xs transition-colors hover:bg-muted/80">
                            <span>{b.subject}</span>
                            <span className="mt-0.5 font-mono text-[10px] font-normal tracking-normal text-muted-foreground/75">
                              {formatCompactRange(b.startLabel, b.endLabel)}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
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

function PhoneRow({ lecture, showDivision, now, meet }: { lecture: PublicLecture; showDivision: boolean; now: boolean; meet: MeetAction }) {
  const { classNameFor } = useColors();
  const cancelled = lecture.displayStatus === "cancelled" && lecture.subject !== "OFF";
  if (lecture.kind === "break") {
    return (
      <li className="flex items-baseline gap-3 border-b border-border py-2 text-xs text-muted-foreground">
        <span className="w-12 shrink-0 text-right font-mono">{bareTime(lecture.startLabel)}</span>
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
        <ClassFoot faculty={showDivision ? "" : lecture.faculty} room={lecture.room} cohort={showDivision ? lecture.division : ""} meet={meet} />
      </div>
    </li>
  );
}

function Cell({ lecture, showDivision, now, meet }: { lecture: PublicLecture; showDivision: boolean; now: boolean; meet: MeetAction }) {
  const { classNameFor } = useColors();
  const cancelled = lecture.displayStatus === "cancelled" && lecture.subject !== "OFF";
  const rescheduled = lecture.displayStatus === "rescheduled";
  const previousTime = lecture.previous?.startLabel && lecture.previous.startLabel !== lecture.startLabel;
  return (
    <div className={`${classNameFor(lecture.subject, lecture.displayStatus)} ${now ? "is-now" : ""}`} data-testid="lecture-card" data-live={now ? "true" : undefined}>
      <div className="flex items-start justify-between gap-2">
        <p className={`min-w-0 leading-snug ${now ? "font-semibold" : "font-medium"} ${cancelled ? "line-through decoration-danger decoration-2" : ""}`}>{lecture.subject}</p>
        {now && <NowMark />}
        {cancelled && <span className="shrink-0 text-[10px] font-semibold tracking-wide text-danger uppercase">Cancelled</span>}
      </div>
      {previousTime && (
        <p className="mt-0.5 text-xs">
          <span className="line-through">{lecture.previous?.startLabel}</span> {lecture.startLabel}
        </p>
      )}
      <ClassFoot faculty={showDivision ? "" : lecture.faculty} room={lecture.room} cohort={showDivision ? lecture.division : ""} meet={meet} />
      {rescheduled && (
        <div className="mt-1">
          <StatusBadge status={lecture.displayStatus} label={badgeText(lecture.displayStatus, lecture.subject)} />
        </div>
      )}
    </div>
  );
}

function ClassFoot({ faculty, room, cohort = "", meet }: { faculty: string; room: string; cohort?: string; meet: MeetAction }) {
  const label = cohort ? cohortLabel(cohort) : faculty;
  if (!label && !room.trim()) return null;
  return (
    <div className="mt-1.5 flex items-start justify-between gap-2 text-[13px] leading-snug">
      {label ? <span className="class-faculty min-w-0 font-medium text-foreground" title={label}>{label}</span> : <span />}
      {room.trim() && <LectureRoom room={room} action={meet} variant="chip" />}
    </div>
  );
}
