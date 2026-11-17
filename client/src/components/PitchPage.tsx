import { lazy, Suspense, useState, type MouseEvent } from "react";
import { HomePitch } from "@/components/HomePitch";

const McpConnectModal = lazy(() => import("@/components/McpConnectModal").then((m) => ({ default: m.McpConnectModal })));

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
  const [mcpOpen, setMcpOpen] = useState(false);
  return (
    <>
      <HomePitch
        hasSavedAccess={hasSavedAccess}
        savedLabel={savedLabel}
        onContinue={onContinue}
        onOpenStudent={onOpenStudent}
        onOpenFaculty={onOpenFaculty}
        onOpenPage={onOpenPage}
        sourceUrl={sourceUrl}
        onOpenMcp={() => setMcpOpen(true)}
      />
      {mcpOpen ? (
        <Suspense fallback={null}>
          <McpConnectModal open onClose={() => setMcpOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
