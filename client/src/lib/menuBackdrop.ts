import { useEffect, useSyncExternalStore } from "react";

let openMenus = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function change(by: number) {
  openMenus += by;
  for (const listener of listeners) listener();
}

/** Tells the page a menu is open, so the backdrop blurs what is behind it. */
export function useMenuBackdrop(open: boolean) {
  useEffect(() => {
    if (!open) return;
    change(1);
    return () => change(-1);
  }, [open]);
}

export function useAnyMenuOpen() {
  return useSyncExternalStore(subscribe, () => openMenus > 0);
}
