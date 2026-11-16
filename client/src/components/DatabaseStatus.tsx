import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchDatabaseStatus } from "@/lib/api";

export interface DatabaseStatusProps {
  showLabel?: boolean;
  className?: string;
}

export function DatabaseStatus({ showLabel = false, className = "" }: DatabaseStatusProps) {
  const [forceCount, setForceCount] = useState(0);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["db-status", forceCount],
    queryFn: () => fetchDatabaseStatus(forceCount > 0),
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const state: "connecting" | "connected" | "disconnected" =
    isLoading || isFetching
      ? "connecting"
      : isError || !data?.connected
        ? "disconnected"
        : "connected";

  const label =
    state === "connected"
      ? "Database connected"
      : state === "connecting"
        ? "Connecting to database"
        : "Database not connected";

  const dotColor =
    state === "connected"
      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
      : state === "connecting"
        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
        : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]";

  const pingColor =
    state === "connected"
      ? "bg-emerald-400"
      : state === "connecting"
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <button
      type="button"
      data-testid="db-status-indicator"
      onClick={() => setForceCount((c) => c + 1)}
      title={data?.latencyMs ? `${label} (${data.latencyMs}ms)` : label}
      aria-label={label}
      className={
        showLabel
          ? `inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`
          : `inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:size-9 ${className}`
      }
    >
      <span className="relative flex size-2 items-center justify-center">
        {state === "connecting" && (
          <span className={`absolute inline-flex size-full animate-ping rounded-full ${pingColor} opacity-75`} />
        )}
        <span className={`inline-block size-2 rounded-full ${dotColor} ${state === "connecting" ? "animate-pulse" : ""}`} />
      </span>
      {showLabel ? <span className="text-[11px] font-normal leading-none">{label}</span> : null}
    </button>
  );
}

export default DatabaseStatus;
