export function ColorSwitch({
  on,
  onChange,
  title = "Class colours",
  onHint = "Each class has its own colour",
  offHint = "Plain timetable",
  testId = "colors-toggle",
  compact = false,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  title?: string;
  onHint?: string;
  offHint?: string;
  testId?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        data-testid={testId}
        onClick={() => onChange(!on)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors"
      >
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-foreground" : "bg-muted-foreground/30"}`} aria-hidden="true">
          <span className={`absolute top-0.5 size-4 rounded-full border border-border bg-background transition-transform ${on ? "right-0.5" : "left-0.5"}`} />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-testid={testId}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left"
    >
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block text-xs">{on ? onHint : offHint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full ${on ? "bg-foreground" : "bg-muted"}`} aria-hidden="true">
        <span className={`absolute top-0.5 size-5 rounded-full border border-border bg-background ${on ? "right-0.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
