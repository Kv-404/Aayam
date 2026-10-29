import { useEffect, useState } from "react";
import BellToggle from "@/components/BellToggle";

export function NotifyControl({
  optedIn,
  pulse,
  onEnable,
}: {
  optedIn: boolean;
  pulse: number;
  onEnable: () => void;
}) {
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (optedIn || !hold) return;
    setHold(false);
  }, [optedIn, hold]);

  useEffect(() => {
    if (!hold || !optedIn) return;
    const id = window.setTimeout(() => setHold(false), 700);
    return () => window.clearTimeout(id);
  }, [hold, optedIn]);

  if (optedIn && !hold) return null;

  return (
    <BellToggle
      pressed={optedIn}
      onChange={(pressed) => {
        if (!pressed) return;
        setHold(true);
        onEnable();
      }}
      offLabel="Notify me"
      onLabel="Notified"
      label="Notify me about lectures"
      color="var(--foreground)"
      background="var(--muted)"
      onColor="var(--background)"
      onBackground="var(--foreground)"
      size="sm"
      radius={18}
      badge={false}
      count={pulse}
      waves
      className="shrink-0"
    />
  );
}
