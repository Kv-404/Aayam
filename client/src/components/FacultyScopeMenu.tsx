import { coordinatorPreviews } from "@shared/coordinators";
import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const menuRef = useRef<HTMLDivElement>(null);
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

  const visible = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: query ? section.items.filter((item) => `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(query)) : section.items,
      }))
      .filter((section) => section.items.length > 0);
  }, [filterQuery, sections]);

  return (
    <div ref={menuRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Faculty scope"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="faculty-scope"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-2.5 py-1 text-sm font-medium shadow-xs hover:bg-muted/50 transition-colors"
      >
        <div className="flex flex-col text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <span data-testid="faculty-scope-label" className="font-semibold text-foreground truncate max-w-[130px] sm:max-w-[190px]">
              {label}
            </span>
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
              {badge}
            </span>
          </div>
          {email && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[150px] sm:max-w-[220px]">
              {email}
            </span>
          )}
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground ml-0.5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border/60"
        title="Sign out of faculty mode"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Sign out</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose a cohort or faculty"
          data-testid="faculty-scope-menu"
          className="menu-pop absolute top-full left-0 z-40 mt-1 max-h-[min(28rem,calc(100dvh-5rem))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-background p-1.5 shadow-md"
        >
          <div className="p-1 pb-2">
            <input
              type="text"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="Search cohorts or faculty"
              aria-label="Search cohorts or faculty"
              className="w-full rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          {visible.map((section) => (
            <div key={section.title} className="mb-1">
              <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {section.title}
              </p>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  data-testid={`scope-${item.id}`}
                  onClick={() => {
                    onPick(item.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                    item.id === activeId ? "bg-accent/20 font-semibold" : ""
                  }`}
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-[10px] font-normal text-muted-foreground">{item.hint}</span>}
                </button>
              ))}
            </div>
          ))}

          {visible.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No matches.</p>}

          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSwitchToStudent();
            }}
            className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Switch to Student view
          </button>

          {import.meta.env.DEV && (
            <div className="mt-1 border-t border-border px-2 py-2">
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
