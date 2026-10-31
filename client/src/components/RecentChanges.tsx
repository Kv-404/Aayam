import type { ChangeEvent, PreviousValues } from "@shared/types";
import { cohortLabel } from "@shared/cohort";
import { formatCalendarDate, formatDetected } from "@/lib/time";

const labels: Record<string, string> = {
  added: "Added",
  removed: "Removed",
  cancelled: "Cancelled",
  restored: "Restored",
  reverted: "Reverted",
  rescheduled: "Rescheduled",
  room_change: "Room",
  faculty_change: "Faculty",
  subject_change: "Subject",
  details_changed: "Updated",
  replaced: "Replacement",
  tab_added: "New tab",
  tab_removed: "Tab removed",
};

const detailFields: { key: keyof PreviousValues; label: string }[] = [
  { key: "subject", label: "Subject" },
  { key: "faculty", label: "Faculty" },
  { key: "room", label: "Room" },
  { key: "startLabel", label: "Starts" },
  { key: "endLabel", label: "Ends" },
  { key: "status", label: "Status" },
];

function detailRows(change: ChangeEvent) {
  return detailFields.flatMap((field) => {
    const before = change.previous?.[field.key];
    const after = change.next?.[field.key];
    if (!before && !after) return [];
    if (before && after && before !== after) {
      return [{ label: field.label, value: `${before} → ${after}` }];
    }
    return [{ label: field.label, value: after || before || "" }];
  });
}

export function RecentChanges({
  changes,
  timeZone,
  empty,
}: {
  changes: ChangeEvent[];
  timeZone: string;
  empty?: string;
}) {
  const ordered = [...changes].sort(
    (a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.detectedAt.localeCompare(a.detectedAt) || b.id - a.id,
  );
  const groups: { key: string; label: string; items: ChangeEvent[] }[] = [];
  for (const change of ordered) {
    const key = change.date || "undated";
    const label = change.date
      ? `${change.weekday ? `${change.weekday} · ` : ""}${formatCalendarDate(change.date)}`
      : "Not tied to a day";
    const current = groups.at(-1);
    if (current?.key === key) current.items.push(change);
    else groups.push({ key, label, items: [change] });
  }

  return (
    <section aria-label="Recent timetable updates" data-testid="change-feed" className="space-y-6">
      <div>
        <h2 className="text-muted-foreground font-mono text-[11px] font-medium tracking-[0.22em] uppercase">Updates</h2>
        <p className="text-sm text-muted-foreground">
          Each update is its own entry. The time is when this page detected the change, not when the sheet was edited.
        </p>
      </div>
      {ordered.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {empty ?? "No changes yet. The current sheet is the baseline. Edits, cancellations, and new classes show up here after the next sync."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</h3>
            <ol className="space-y-2">
              {group.items.map((change) => {
                const details = detailRows(change);
                return (
                  <li key={`${group.key}-${change.id}`} className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">{labels[change.type] ?? change.type}</span>
                      {change.division && <span>{cohortLabel(change.division)}</span>}
                      <span className="font-medium normal-case tracking-normal">Detected {formatDetected(change.detectedAt, timeZone)}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{change.summary}</p>
                    {details.length > 0 && (
                      <dl className="mt-2 space-y-1">
                        {details.map((detail) => (
                          <div key={detail.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-xs">
                            <dt className="text-muted-foreground">{detail.label}</dt>
                            <dd className="min-w-0 text-foreground">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </section>
  );
}
