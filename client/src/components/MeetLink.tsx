import { useEffect, useState } from "react";
import type { MeetAction } from "@/lib/prefs";
import { compactRoom, meetHref } from "@/lib/time";

const chip = "class-room shrink-0 rounded bg-background/80 px-1.5 py-px font-bold tracking-tight text-foreground";

export function LectureRoom({ room, action, variant }: { room: string; action: MeetAction; variant: "chip" | "meta" | "inline" }) {
  const href = meetHref(room);
  if (href) {
    const control = <MeetControl href={href} action={action} variant={variant} />;
    return variant === "inline" ? (
      <>
        <span> · </span>
        {control}
      </>
    ) : (
      control
    );
  }
  const place = compactRoom(room);
  if (!place) return null;
  if (variant === "inline") return <span>{` · ${place}`}</span>;
  if (variant === "meta") {
    return (
      <p className="text-[11px] text-muted-foreground" title={room}>
        {place}
      </p>
    );
  }
  return (
    <span className={chip} title={room}>
      {place}
    </span>
  );
}

function MeetControl({ href, action, variant }: { href: string; action: MeetAction; variant: "chip" | "meta" | "inline" }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const className = `${chip} cursor-pointer no-underline ${variant === "chip" ? "" : "text-[11px]"}`;
  const label = copied ? "Copied" : "Meet";
  if (action === "copy") {
    return (
      <button
        type="button"
        data-testid="meet-link"
        title={href}
        aria-label={copied ? "Meet link copied" : "Copy the Meet link"}
        onClick={(event) => {
          event.stopPropagation();
          void navigator.clipboard.writeText(href).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
        className={className}
      >
        {label}
      </button>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-testid="meet-link"
      title={href}
      aria-label="Open the Meet link"
      onClick={(event) => event.stopPropagation()}
      className={className}
    >
      Meet
    </a>
  );
}

export function MeetChoice({ action, onChange, compact = false, menu = false }: { action: MeetAction; onChange: (action: MeetAction) => void; compact?: boolean; menu?: boolean }) {
  const options = [
    { id: "open" as const, label: "Open link" },
    { id: "copy" as const, label: "Copy link" },
  ];
  const choices = (
    <div className={compact ? "mt-2 grid grid-cols-2 gap-1" : "grid w-full grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:w-56"}>
      {options.map((option) => {
        const selected = action === option.id;
        return (
          <button
            key={option.id}
            type="button"
            data-testid={`meet-${option.id}`}
            role={menu ? "menuitemradio" : undefined}
            aria-checked={menu ? selected : undefined}
            aria-pressed={menu ? undefined : selected}
            onClick={() => onChange(option.id)}
            className={`rounded px-2 text-center ${compact ? "py-1.5 text-left text-xs" : "py-1.5 text-sm"} ${selected ? "bg-foreground text-background" : compact ? "hover:bg-muted" : "text-foreground"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <div>
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">Meet button</p>
        {choices}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span>
        <span className="block text-sm font-medium">Meet button</span>
        <span className="text-muted-foreground block text-xs">Open the call, or copy the link.</span>
      </span>
      {choices}
    </div>
  );
}
