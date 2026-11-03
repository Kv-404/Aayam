import { coordinatorPreviews } from "@shared/coordinators";
import { Check, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMenuBackdrop } from "@/lib/menuBackdrop";

export interface ScopeItem {
  id: string;
  label: string;
  hint?: string;
}

export interface ScopeSection {
  title: string;
  items: ScopeItem[];
}

export function FacultyScopeMenu({
  label,
  email,
  badge,
  sections,
  activeId,
  onPick,
  onLogout,
  onSwitchToStudent,
}: {
  label: string;
  email?: string;
  badge: string;
  sections: ScopeSection[];
  activeId: string;
  onPick: (id: string) => void;
  onLogout: () => void;
  onSwitchToStudent: () => void;
}) {
  const [open, setOpen] = useState(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("menu") === "1";
  });
  const [filterQuery, setFilterQuery] = useState("");
  const [phonePane, setPhonePane] = useState<"faculty" | "batches">(() => (activeId.startsWith("faculty:") ? "faculty" : "batches"));
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useMenuBackdrop(open);
  const badgeClass = badge === "All access"
    ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
    : "bg-sky-500/15 text-sky-700 dark:text-sky-300";

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
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

  useEffect(() => {
    if (!open) {
      setFilterQuery("");
      return;
    }
    // A phone keeps the list in view. Focusing the field there would raise the keyboard over it.
    if (window.matchMedia("(min-width: 640px)").matches) searchRef.current?.focus();
    menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const visible = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: query ? section.items.filter((item) => `${item.label} ${section.title} ${item.hint ?? ""}`.toLowerCase().includes(query)) : section.items,
      }))
      .filter((section) => section.items.length > 0);
  }, [filterQuery, sections]);
  const facultySections = visible.filter((section) => section.items[0]?.id.startsWith("faculty:"));
  const batchSections = visible.filter((section) => !section.items[0]?.id.startsWith("faculty:"));
  const count = (list: ScopeSection[]) => list.reduce((total, section) => total + section.items.length, 0);
  const facultyCount = count(facultySections);
  // Counts real cohorts, not the "All classes" or "All my cohorts" rows.
  const batchCount = batchSections.flatMap((section) => section.items).filter((item) => item.id.startsWith("cohort:")).length;
  // A search with results only in the other pane should not look empty on a phone.
  const shownPane =
    filterQuery.trim() && phonePane === "faculty" && facultyCount === 0 && batchSections.length > 0
      ? "batches"
      : filterQuery.trim() && phonePane === "batches" && batchSections.length === 0 && facultyCount > 0
        ? "faculty"
        : phonePane;

  function renderSection(section: ScopeSection, grouped: boolean) {
    return (
      <div key={section.title} className={grouped ? "mb-2 break-inside-avoid" : "mb-1"}>
        {grouped && (
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {section.title}
          </p>
        )}
        {section.items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              data-active={active ? "true" : undefined}
              data-testid={`scope-${item.id}`}
              onClick={() => {
                onPick(item.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted sm:py-1.5 ${active ? "bg-muted font-semibold" : ""}`}
            >
              <span className="min-w-0 truncate">{item.label}</span>
              {active ? (
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                item.hint && !section.title.includes(item.hint) && <span className="shrink-0 text-[10px] font-normal text-muted-foreground">{item.hint}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative flex min-w-0 items-center gap-1.5">
      <button
        type="button"
        aria-label="Faculty scope"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="faculty-scope"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-border/80 bg-background/90 px-2 py-1 text-xs font-medium sm:gap-1.5 sm:px-2.5 sm:text-sm shadow-xs hover:bg-muted/50 transition-colors"
      >
        <div className="flex flex-col text-left min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span data-testid="faculty-scope-label" className="min-w-0 font-semibold text-foreground truncate sm:max-w-[190px]">
              {label}
            </span>
            <span className={`hidden shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex ${badgeClass}`}>
              {badge}
            </span>
          </div>
          {email && (
            <span className="hidden text-[11px] text-muted-foreground truncate sm:block sm:max-w-[220px]">
              {email}
            </span>
          )}
        </div>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground sm:ml-0.5 sm:size-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onLogout}
        className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs sm:inline-flex text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border/60"
        title="Sign out of faculty mode"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        <span className="hidden 2xl:inline">Sign out</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose a cohort or faculty"
          data-testid="faculty-scope-menu"
          className="menu-pop absolute top-full left-0 z-40 mt-1 flex max-h-[min(38rem,calc(100dvh-5rem))] w-[min(46rem,calc(100vw-9rem))] flex-col rounded-lg border border-border bg-background p-1.5 shadow-md max-sm:fixed max-sm:inset-x-3 max-sm:top-12 max-sm:mt-0 max-sm:w-auto"
        >
          <div className="shrink-0 p-1 pb-2">
            <input
              ref={searchRef}
              type="text"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="Search faculty or batches"
              aria-label="Search faculty or batches"
              className="w-full rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="mb-1.5 grid shrink-0 grid-cols-2 gap-1 rounded-md bg-muted/60 p-1 sm:hidden">
            {(["faculty", "batches"] as const).map((pane) => (
              <button
                key={pane}
                type="button"
                aria-pressed={shownPane === pane}
                data-testid={`scope-pane-${pane}`}
                onClick={() => setPhonePane(pane)}
                className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${shownPane === pane ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"}`}
              >
                {pane === "faculty" ? `Faculty (${facultyCount})` : `Batches (${batchCount})`}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 gap-1.5 overflow-hidden">
            <section aria-label="Faculty" data-testid="scope-faculty-pane" className={`min-h-0 w-full flex-col sm:flex sm:w-[38%] sm:shrink-0 sm:border-r sm:border-border sm:pr-1.5 ${shownPane === "faculty" ? "flex" : "hidden"}`}>
              <p className="hidden shrink-0 px-2.5 pt-1 pb-1.5 text-[11px] font-semibold text-foreground sm:block">Faculty <span className="font-normal text-muted-foreground">{facultyCount}</span></p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {facultySections.map((section) => renderSection(section, false))}
                {facultyCount === 0 && <p className="px-2.5 py-2 text-xs text-muted-foreground">No matches.</p>}
              </div>
            </section>
            <section aria-label="Batches" data-testid="scope-batch-pane" className={`min-h-0 min-w-0 flex-1 flex-col sm:flex ${shownPane === "batches" ? "flex" : "hidden"}`}>
              <p className="hidden shrink-0 px-2.5 pt-1 pb-1.5 text-[11px] font-semibold text-foreground sm:block">Batches <span className="font-normal text-muted-foreground">{batchCount}</span></p>
              <div className="min-h-0 flex-1 overflow-y-auto lg:columns-2 lg:gap-1.5">
                {batchSections.map((section) => renderSection(section, true))}
                {batchSections.length === 0 && <p className="px-2.5 py-2 text-xs text-muted-foreground">No matches.</p>}
              </div>
            </section>
          </div>

          <div className="my-1 shrink-0 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSwitchToStudent();
            }}
            className="block w-full shrink-0 rounded-md px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Switch to Student view
          </button>

          {import.meta.env.DEV && (
            <div className="mt-1 shrink-0 border-t border-border px-2 py-2">
              <p className="px-1 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Local preview</p>
              <div className="flex flex-wrap gap-1">
                {coordinatorPreviews().map((person) => (
                  <a
                    key={person.id}
                    href={`/?preview=${person.id}&menu=1`}
                    className="rounded-md bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-muted/70"
                  >
                    {person.name.split(" ")[0]}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
