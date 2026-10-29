import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Search, X } from "lucide-react";
import { TimetableFilters } from "@/components/TimetableFilters";
import { Input } from "@/components/ui/input";
import { clearSearchHistory, forgetSearch, readSearchHistory, rememberSearch } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import type { Filters } from "@/lib/view";

export function SearchPanel({
  query,
  placeholder,
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
  onQuery,
  onChange,
  onClear,
}: {
  query: string;
  placeholder: string;
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
  onQuery: (query: string) => void;
  onChange: (partial: Partial<Filters>) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(readSearchHistory);
  const [panelTop, setPanelTop] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressed = open || query.trim() !== "";

  function place() {
    const bottom = buttonRef.current?.getBoundingClientRect().bottom;
    if (bottom == null) return;
    const next = bottom + 4;
    setPanelTop((current) => (current === next ? current : next));
  }

  function toggle() {
    if (!open) place();
    setOpen((current) => !current);
  }

  function record(value: string) {
    if (!value.trim()) return;
    setHistory(rememberSearch(value));
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    place();
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Search"
        aria-expanded={open}
        aria-pressed={pressed}
        data-testid="search-button"
        onClick={toggle}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
          pressed && "bg-muted text-foreground",
        )}
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
      <div
        className={`fixed inset-x-4 z-40 mt-0 grid w-auto overflow-hidden top-[var(--search-panel-top)] transition-[grid-template-rows,opacity] duration-200 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-1 sm:w-80 ${open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}
        style={{ "--search-panel-top": `${panelTop}px` } as CSSProperties}
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[min(32rem,calc(100dvh-5rem))] space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-sm">
            <Input
              ref={inputRef}
              value={query}
              placeholder={placeholder}
              aria-label="Search the timetable"
              data-testid="search-field"
              onChange={(event) => onQuery(event.target.value)}
              onBlur={() => record(query)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                record(query);
              }}
            />
            {history.length > 0 && (
              <div className="space-y-1">
                <ul className="space-y-0.5">
                  {history.map((item) => (
                    <li key={item.toLowerCase()} className="flex items-center gap-1">
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onQuery(item);
                          setHistory(rememberSearch(item));
                        }}
                      >
                        {item}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item}`}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setHistory(forgetSearch(item))}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <button type="button" className="text-xs font-semibold text-accent" onClick={() => setHistory(clearSearchHistory())}>
                    Clear all
                  </button>
                </div>
              </div>
            )}
            <TimetableFilters
              filters={filters}
              courses={courses}
              batches={batches}
              semesters={semesters}
              days={days}
              subjects={subjects}
              faculties={faculties}
              rooms={rooms}
              cohorts={cohorts}
              cohortFormat={cohortFormat}
              onChange={onChange}
              onClear={onClear}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
