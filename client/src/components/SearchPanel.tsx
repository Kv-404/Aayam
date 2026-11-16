import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { TimetableFilters } from "@/components/TimetableFilters";
import { Input } from "@/components/ui/input";
import { useMenuBackdrop } from "@/lib/menuBackdrop";
import { clearSearchHistory, forgetSearch, readSearchHistory, rememberSearch } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import type { Filters } from "@/lib/view";

export function SearchPanel({
  query,
  placeholder,
  filters,
  filtersOn = false,
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
  filtersOn?: boolean;
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
  const [anchor, setAnchor] = useState({ top: 56, left: 12, right: 12 });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressed = open || filtersOn || query.trim() !== "";
  // Results update as you type, so the blur lifts once there is something to look at.
  useMenuBackdrop(open && !filtersOn && query.trim() === "");

  function measureTop() {
    const rect = buttonRef.current?.getBoundingClientRect();
    const wide = window.innerWidth >= 640;
    if (!rect) {
      setAnchor({ top: 56, left: 12, right: 12 });
      return;
    }
    setAnchor({
      top: rect.bottom + 8,
      left: wide ? Math.max(12, rect.right - 320) : 12,
      right: wide ? Math.max(12, window.innerWidth - rect.right) : 12,
    });
  }

  function toggle() {
    if (!open) measureTop();
    setOpen((current) => !current);
  }

  function record(value: string) {
    if (!value.trim()) return;
    setHistory(rememberSearch(value));
  }

  useEffect(() => {
    function onGlobalKey(event: KeyboardEvent) {
      if (event.key === "/" && !open) {
        const target = event.target as HTMLElement | null;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target?.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        measureTop();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={filtersOn ? "Search, filters on" : "Search"}
        aria-expanded={open}
        aria-pressed={pressed}
        data-testid="search-button"
        onClick={toggle}
        className={cn(
          "inline-flex size-8 sm:size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
          pressed && "bg-muted text-foreground",
        )}
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
      <div
        className={`fixed z-40 origin-top rounded-lg border border-border bg-background shadow-md transition duration-200 ease-out ${open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}
        style={{ top: anchor.top, left: anchor.left, right: anchor.right }}
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
      >
        <div className="max-h-[min(32rem,calc(100dvh-5rem))] space-y-3 overflow-y-auto p-3">
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
                  <button type="button" className="py-2 text-xs font-semibold text-foreground" onClick={() => setHistory(clearSearchHistory())}>
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
  );
}
