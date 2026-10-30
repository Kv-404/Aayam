import { cohortName } from "@shared/cohort";
import type { Filters } from "@/lib/view";

function Select({
  label,
  value,
  options,
  onChange,
  allLabel,
  format,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allLabel?: string;
  format?: (value: string) => string;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {format ? format(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TimetableFilters({
  filters,
  courses,
  batches,
  semesters,
  days,
  subjects,
  faculties,
  rooms,
  cohorts,
  cohortFormat,
  onChange,
  onClear,
}: {
  filters: Filters;
  courses: string[];
  batches: string[];
  semesters: string[];
  days: string[];
  subjects: string[];
  faculties: string[];
  rooms: string[];
  cohorts?: string[];
  cohortFormat?: (division: string) => string;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}) {
  return (
    <section aria-label="Filters" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Filters</h2>
        <button type="button" className="text-xs font-semibold text-accent" onClick={onClear}>
          Clear
        </button>
      </div>
      {cohorts ? (
        <Select label="Cohort" value={filters.division} options={cohorts} allLabel="All cohorts" format={cohortFormat ?? cohortName} onChange={(division) => onChange({ division })} />
      ) : (
        <>
          {courses.length > 1 && <Select label="Program" value={filters.course} options={courses} onChange={(course) => onChange({ course, batch: "", semester: "", division: "", subject: "", faculty: "", room: "" })} />}
          {batches.length > 1 && <Select label="Batch" value={filters.batch} options={batches} onChange={(batch) => onChange({ batch, semester: "", division: "", subject: "", faculty: "", room: "" })} />}
          {semesters.length > 1 && <Select label="Semester" value={filters.semester} options={semesters} onChange={(semester) => onChange({ semester, division: "", subject: "", faculty: "", room: "" })} />}
        </>
      )}
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Day</span>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip selected={filters.day === ""} onClick={() => onChange({ day: "" })}>
            All
          </FilterChip>
          {days.map((day) => (
            <FilterChip key={day} selected={filters.day === day} onClick={() => onChange({ day })}>
              {day.slice(0, 3)}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Status</span>
        <div className="grid grid-cols-2 gap-1.5">
          {(["all", "scheduled", "changed", "cancelled"] as const).map((status) => (
            <FilterChip key={status} selected={filters.status === status} onClick={() => onChange({ status })}>
              {status === "all" ? "All" : status[0]!.toUpperCase() + status.slice(1)}
            </FilterChip>
          ))}
        </div>
      </div>
      <Select label="Subject" value={filters.subject} options={subjects} allLabel="All subjects" onChange={(subject) => onChange({ subject })} />
      {!cohorts && <Select label="Faculty" value={filters.faculty} options={faculties} allLabel="All faculty" onChange={(faculty) => onChange({ faculty })} />}
      <Select label="Classroom" value={filters.room} options={rooms} allLabel="All rooms" onChange={(room) => onChange({ room })} />
    </section>
  );
}

function FilterChip({ selected, children, onClick }: { selected: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
    >
      {children}
    </button>
  );
}
