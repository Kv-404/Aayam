import type { PublicLecture } from "@shared/types";
import { cohortLabel } from "@shared/cohort";
import { memo, useMemo, useState, type CSSProperties } from "react";
import { Coffee, UtensilsCrossed } from "lucide-react";
import { StatusBadge, badgeText } from "@/components/StatusBadge";
import { LectureRoom } from "@/components/MeetLink";
import { useColors } from "@/lib/colorState";
import type { MeetAction } from "@/lib/prefs";
import { clockFromMinutes, formatCalendarDate, formatCompactRange } from "@/lib/time";
import { isFoldedOff, isFoldedOffDay, slotPhase } from "@/lib/view";

/** Pixels per minute. A 50 minute class is about 62px. */
const PX = 1.25;
const MIN_SPAN = 15;
/** Space between two cards that follow each other, like the old table rows. */
const GAP = 8;
/** Two periods of the same class this close together are drawn joined, with the short break between them. */
const JOIN_MINUTES = 15;

export type GridColumn = { date: string; lectures: PublicLecture[] };

type Placed = { lecture: PublicLecture; lane: number; lanes: number; cluster: number };

export function NowMark() {
  return (
    <span className="now-mark" data-testid="now-mark">
      Now
    </span>
  );
}

/**
 * Calendar-style time grid: hour gutter, one column per date, lectures placed by start and end time.
 * Overlapping lectures in a column share its width. Used by the wide Week view and the wide Day view.
 */
export function TimeGrid({
  columns,
  today,
  minutes,
  showDivision,
  showFaculty,
  showLive,
  meet,
  header = true,
  detail = false,
}: {
  columns: GridColumn[];
  today: string;
  minutes: number;
  showDivision: boolean;
  showFaculty: boolean;
  showLive: boolean;
  meet: MeetAction;
  header?: boolean;
  detail?: boolean;
}) {
  const { slotFor } = useColors();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const laneCap = detail ? 6 : 3;

  const prepared = useMemo(
    () =>
      columns.map(({ date, lectures }) => {
        const off = isFoldedOffDay(lectures);
        const timed = lectures.filter((lecture) => lecture.startMinutes >= 0 && !isFoldedOff(lecture));
        const seen = new Set<string>();
        const breaks = timed.filter((lecture) => {
          if (lecture.kind !== "break") return false;
          const key = `${lecture.startMinutes}-${lecture.endMinutes}-${lecture.subject}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const placed = off ? [] : placeLanes(linkBackToBack(timed.filter((lecture) => lecture.kind !== "break")));
        const maxLanes = placed.reduce((most, item) => Math.max(most, item.lanes), 1);
        const weekday = lectures[0]?.weekday ?? "";
        return { date, weekday, off, offLecture: lectures.find(isFoldedOff), breaks: off ? [] : breaks, placed, maxLanes };
      }),
    [columns],
  );

  const [rangeStart, rangeEnd] = useMemo(() => {
    let first = Infinity;
    let last = -Infinity;
    for (const { lectures } of columns) {
      for (const lecture of lectures) {
        if (lecture.startMinutes < 0 || isFoldedOff(lecture)) continue;
        first = Math.min(first, lecture.startMinutes);
        last = Math.max(last, spanEnd(lecture));
      }
    }
    if (!Number.isFinite(first)) return [8 * 60, 17 * 60];
    return [Math.floor(first / 60) * 60, Math.max(Math.ceil(last / 60) * 60, Math.floor(first / 60) * 60 + 60)];
  }, [columns]);

  // A break at the same time in neighbouring days becomes one band across those columns.
  const { spans, spanned } = useMemo(() => {
    const key = (lecture: PublicLecture) => `${lecture.startMinutes}-${spanEnd(lecture)}-${lecture.subject.trim().toLowerCase()}`;
    const keys = prepared.map((column) => new Set(column.breaks.map(key)));
    const spans: Array<{ from: number; to: number; lecture: PublicLecture }> = [];
    const spanned = prepared.map(() => new Set<string>());
    prepared.forEach((column, index) => {
      for (const lecture of column.breaks) {
        const k = key(lecture);
        if (spanned[index].has(k)) continue;
        let to = index;
        while (to + 1 < prepared.length && keys[to + 1].has(k)) to += 1;
        if (to === index) continue;
        for (let at = index; at <= to; at++) spanned[at].add(k);
        spans.push({ from: index, to, lecture });
      }
    });
    return { spans, spanned };
  }, [prepared]);
  const breakKey = (lecture: PublicLecture) => `${lecture.startMinutes}-${spanEnd(lecture)}-${lecture.subject.trim().toLowerCase()}`;
  const bodyRow = header ? 2 : 1;

  const height = (rangeEnd - rangeStart) * PX;
  const hours: number[] = [];
  for (let at = rangeStart; at <= rangeEnd; at += 60) hours.push(at);
  const y = (at: number) => (at - rangeStart) * PX;
  const nowVisible = minutes >= rangeStart && minutes <= rangeEnd && prepared.some((column) => column.date === today);

  const template = [
    "3.5rem",
    ...prepared.map((column) => {
      if (detail) return "minmax(0,1fr)";
      const wide = expanded.has(column.date) ? Math.max(column.maxLanes, 1) * 7 : 8.5;
      return `minmax(${wide}rem,1fr)`;
    }),
  ].join(" ");

  const toggle = (date: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  return (
    <div className="wk-grid" style={{ gridTemplateColumns: template }}>
      {header && (
        <>
          <div className="wk-corner" aria-hidden="true" />
          {prepared.map((column) => {
            const isToday = column.date === today;
            return (
              <div key={column.date} className={`wk-head ${isToday ? "wk-today font-bold" : "font-medium"} ${column.off ? "text-danger" : ""}`} data-date={column.date}>
                <div className="flex items-center gap-1.5">
                  <span className="block">{column.weekday || formatCalendarDate(column.date).slice(0, 3)}</span>
                  {isToday && <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Today</span>}
                </div>
                <span className={`block text-xs ${isToday ? "font-semibold" : "font-normal"} ${column.off ? "text-danger" : "text-muted-foreground"}`}>
                  {column.off ? "Off" : formatCalendarDate(column.date)}
                </span>
              </div>
            );
          })}
        </>
      )}
      <div className="wk-gutter" style={{ height, gridRow: bodyRow, gridColumn: 1 }}>
        {hours.map((at) =>
          nowVisible && Math.abs(at - minutes) < 12 ? null : (
            <span key={at} className="wk-hour" style={{ top: y(at) }}>
              {clockFromMinutes(at, { period: true, hourOnly: true })}
            </span>
          ),
        )}
        {nowVisible && (
          <span className="wk-now-label" style={{ top: y(minutes) }}>
            {clockFromMinutes(minutes)}
          </span>
        )}
      </div>
      {prepared.map((column, columnIndex) => {
        const isToday = column.date === today;
        const open = expanded.has(column.date);
        const cap = open ? Infinity : laneCap;
        const hidden = new Map<number, { count: number; start: number; end: number }>();
        const blocks = column.placed.flatMap((item) => {
          const shown = Math.min(item.lanes, cap);
          if (item.lanes > cap && item.lane >= cap - 1) {
            const group = hidden.get(item.cluster) ?? { count: 0, start: Infinity, end: -Infinity };
            group.count += 1;
            group.start = Math.min(group.start, item.lecture.startMinutes);
            group.end = Math.max(group.end, spanEnd(item.lecture));
            hidden.set(item.cluster, group);
            return [];
          }
          return [{ ...item, shown }];
        });
        return (
          <div key={column.date} className={`wk-col ${isToday ? "wk-today" : ""}`} style={{ height, gridRow: bodyRow, gridColumn: columnIndex + 2 }} data-date={column.date}>
            {hours.map((at) => (
              <span key={at} className="wk-line" style={{ top: y(at) }} aria-hidden="true" />
            ))}
            {column.off ? (
              <div className="wk-off cal-graphite" style={{ top: 2, height: height - 4 }}>
                <span className="text-sm font-medium text-danger">Off</span>
                {detail && column.offLecture?.reason && <span className="mt-1 text-xs text-muted-foreground">{column.offLecture.reason}</span>}
              </div>
            ) : (
              <>
                {column.breaks.filter((lecture) => !spanned[columnIndex].has(breakKey(lecture))).map((lecture) => (
                  <BreakBand key={lecture.id} lecture={lecture} top={y(lecture.startMinutes)} height={(spanEnd(lecture) - lecture.startMinutes) * PX} narrow />
                ))}
                {blocks.map((item) => {
                  const width = 100 / item.shown;
                  const link = links.get(item.lecture);
                  const top = y(item.lecture.startMinutes) + (link?.before !== undefined ? 0 : GAP / 2);
                  const bottom = y(spanEnd(item.lecture)) - (link?.after ? 0 : GAP / 2);
                  const tall = bottom - top;
                  const style = {
                    top,
                    height: tall,
                    left: `calc(${item.lane * width}% + 2px)`,
                    width: `calc(${width}% - 4px)`,
                    "--wk-h": `${tall}px`,
                  } as CSSProperties;
                  return (
                    <Block
                      key={item.lecture.id}
                      lecture={item.lecture}
                      tone={slotFor(item.lecture.subject, item.lecture.displayStatus)}
                      style={style}
                      compact={tall < 46}
                      joinBefore={link?.before}
                      joinAfter={Boolean(link?.after)}
                      now={showLive && isLive(item.lecture, today, minutes)}
                      showDivision={showDivision}
                      showFaculty={showFaculty}
                      meet={meet}
                      detail={detail}
                    />
                  );
                })}
                {[...hidden.values()].map((group, index) => {
                  const width = 100 / cap;
                  return (
                    <button
                      key={`more-${index}`}
                      type="button"
                      className="wk-more"
                      onClick={() => toggle(column.date)}
                      style={{
                        top: y(group.start),
                        height: Math.max((group.end - group.start) * PX - 2, 18),
                        left: `calc(${(cap - 1) * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                      aria-label={`Show ${group.count} more ${group.count === 1 ? "class" : "classes"}`}
                    >
                      +{group.count}
                    </button>
                  );
                })}
                {open && (
                  <button type="button" className="wk-less" onClick={() => toggle(column.date)}>
                    Show less
                  </button>
                )}
              </>
            )}
            {isToday && nowVisible && (
              <span className="wk-now" style={{ top: y(minutes) }} aria-hidden="true" data-testid="now-line" />
            )}
          </div>
        );
      })}
      {spans.map(({ from, to, lecture }) => (
        <div key={`span-${from}-${lecture.id}`} className="wk-span" style={{ height, gridRow: bodyRow, gridColumn: `${from + 2} / ${to + 3}` }}>
          <BreakBand lecture={lecture} top={y(lecture.startMinutes)} height={(spanEnd(lecture) - lecture.startMinutes) * PX} />
        </div>
      ))}
    </div>
  );
}

/** Lunch and other breaks: a quiet dashed band with an icon, the name and the time. */
function BreakBand({ lecture, top, height, narrow = false }: { lecture: PublicLecture; top: number; height: number; narrow?: boolean }) {
  const lunch = /lunch/i.test(lecture.subject);
  const Icon = lunch ? UtensilsCrossed : Coffee;
  return (
    <div className={`wk-band ${narrow ? "is-narrow" : ""}`} style={{ top: top + GAP / 2, height: Math.max(height - GAP, 18) }}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="wk-band-name">{lecture.subject.toLowerCase()}</span>
      <span className="wk-band-time">{formatCompactRange(lecture.startLabel, lecture.endLabel)}</span>
    </div>
  );
}

/** Back-to-back periods of one class: how many minutes of break sit before a period, and whether one follows. */
const links = new WeakMap<PublicLecture, { before?: number; after?: boolean }>();

/** Marks back-to-back periods of one class (same cohort, subject, teacher, room, status). Each stays its own card. */
function linkBackToBack(lectures: PublicLecture[]) {
  const sorted = [...lectures].sort((a, b) => a.division.localeCompare(b.division) || a.startMinutes - b.startMinutes);
  for (let index = 1; index < sorted.length; index++) {
    const prev = sorted[index - 1]!;
    const lecture = sorted[index]!;
    if (
      lecture.kind === "lecture" &&
      prev.kind === "lecture" &&
      prev.division === lecture.division &&
      prev.subject.trim().toLowerCase() === lecture.subject.trim().toLowerCase() &&
      prev.faculty === lecture.faculty &&
      prev.room === lecture.room &&
      prev.displayStatus === lecture.displayStatus &&
      lecture.startMinutes >= prev.endMinutes &&
      lecture.startMinutes - prev.endMinutes <= JOIN_MINUTES
    ) {
      links.set(prev, { ...links.get(prev), after: true });
      links.set(lecture, { ...links.get(lecture), before: lecture.startMinutes - prev.endMinutes });
    }
  }
  return lectures;
}

function spanEnd(lecture: PublicLecture) {
  return Math.max(lecture.endMinutes, lecture.startMinutes + MIN_SPAN);
}

function isLive(lecture: PublicLecture, today: string, minutes: number) {
  return lecture.kind === "lecture" && lecture.displayStatus !== "cancelled" && slotPhase(lecture, today, minutes) === "now";
}

/** Greedy lane assignment. Lectures that overlap form a cluster, and every lecture in it shares the cluster's lane count. */
function placeLanes(lectures: PublicLecture[]): Placed[] {
  const sorted = [...lectures].sort(
    (a, b) => a.startMinutes - b.startMinutes || spanEnd(b) - spanEnd(a) || a.division.localeCompare(b.division) || a.subject.localeCompare(b.subject),
  );
  const placed: Placed[] = [];
  let clusterFrom = 0;
  let clusterEnd = -Infinity;
  let cluster = 0;
  let laneEnds: number[] = [];
  const close = () => {
    for (let index = clusterFrom; index < placed.length; index += 1) placed[index]!.lanes = laneEnds.length;
  };
  for (const lecture of sorted) {
    const end = spanEnd(lecture);
    if (placed.length > 0 && lecture.startMinutes >= clusterEnd) {
      close();
      clusterFrom = placed.length;
      laneEnds = [];
      cluster += 1;
    }
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= lecture.startMinutes);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    clusterEnd = Math.max(clusterEnd, end);
    placed.push({ lecture, lane, lanes: 0, cluster });
  }
  close();
  return placed;
}

// The clock ticks every 15 seconds and All classes can draw hundreds of blocks. Only a block whose props changed repaints.
const Block = memo(function Block({
  lecture,
  tone,
  style,
  compact,
  now,
  showDivision,
  showFaculty,
  meet,
  detail,
  joinBefore,
  joinAfter,
}: {
  lecture: PublicLecture;
  tone: string;
  style: CSSProperties;
  compact: boolean;
  joinBefore?: number;
  joinAfter: boolean;
  now: boolean;
  showDivision: boolean;
  showFaculty: boolean;
  meet: MeetAction;
  detail: boolean;
}) {
  const { classNameFor } = useColors();
  const off = lecture.subject === "OFF";
  const cancelled = lecture.displayStatus === "cancelled" && !off;
  const rescheduled = lecture.displayStatus === "rescheduled";
  const faculty = showDivision && !showFaculty ? "" : lecture.faculty;
  const label = [showDivision ? cohortLabel(lecture.division) : "", showDivision && !showFaculty ? lecture.batch : "", faculty].filter(Boolean).join(" · ");
  const room = lecture.room.trim();
  const joined = joinBefore !== undefined;
  void tone;
  return (
    <div className={`wk-slot ${compact ? "wk-compact" : ""} ${joined ? "wk-join-top" : ""} ${joinAfter ? "wk-join-bottom" : ""}`} style={style}>
      {joined && (
        <div className={`wk-gap ${classNameFor(lecture.subject, lecture.displayStatus)}`} style={{ top: -joinBefore * PX, height: joinBefore * PX }} aria-hidden="true">
          {joinBefore > 0 && <span>{joinBefore} min break</span>}
        </div>
      )}
      <div
        className={`${classNameFor(lecture.subject, lecture.displayStatus)} ${now ? "is-now" : ""} h-full overflow-hidden`}
        data-testid="lecture-card"
        data-live={now ? "true" : undefined}
        title={[lecture.subject, `${lecture.startLabel} – ${lecture.endLabel}`, label, room, cancelled ? "Cancelled" : ""].filter(Boolean).join("\n")}
      >
        <div className="flex items-start justify-between gap-2">
          <p className={`min-w-0 leading-snug ${now ? "font-semibold" : "font-medium"} ${off ? "text-danger" : ""} ${cancelled ? "line-through decoration-danger decoration-2" : ""}`}>{lecture.subject}</p>
          {now && <NowMark />}
          {cancelled && <span className="shrink-0 text-[10px] font-semibold tracking-wide text-danger uppercase">Cancelled</span>}
        </div>
        {!off && (label || room) && (
          <div className="mt-1.5 flex items-start justify-between gap-2 text-[13px] leading-snug">
            {label ? <span className="class-faculty min-w-0 truncate font-medium text-foreground" title={label}>{label}</span> : <span />}
            {room && <LectureRoom room={room} action={meet} variant="chip" />}
          </div>
        )}
        {rescheduled && (
          <div className="mt-1">
            <StatusBadge status={lecture.displayStatus} label={badgeText(lecture.displayStatus, lecture.subject)} />
          </div>
        )}
        {detail && lecture.reason && <p className="mt-1 text-xs">{lecture.reason}</p>}
      </div>
    </div>
  );
});
