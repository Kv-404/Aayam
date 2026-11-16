import type { MouseEvent } from "react";
import { HomePitch } from "@/components/HomePitch";

const sourceUrl = "https://github.com/Kv-404/Aayam";

export function PitchPage({
  hasSavedAccess,
  savedLabel,
  onContinue,
  onOpenStudent,
  onOpenFaculty,
  onOpenPage,
}: {
  hasSavedAccess: boolean;
  savedLabel: string;
  onContinue: () => void;
  onOpenStudent: () => void;
  onOpenFaculty: () => void;
  onOpenPage: (event: MouseEvent, url: string) => void;
}) {
  return (
    <HomePitch
      hasSavedAccess={hasSavedAccess}
      savedLabel={savedLabel}
      onContinue={onContinue}
      onOpenStudent={onOpenStudent}
      onOpenFaculty={onOpenFaculty}
      onOpenPage={onOpenPage}
      sourceUrl={sourceUrl}
    />
  );
}
