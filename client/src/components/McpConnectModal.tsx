import { findCoordinator } from "@shared/coordinators";
import { Check, Copy, ExternalLink, Lock, ShieldCheck, Sparkles, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMcpInstallGuides,
  isLocalDevHostname,
  resolveMcpEndpointUrl,
  starterPromptsForUser,
  type McpClientId,
} from "@/lib/mcpInstall";

export interface McpConnectModalProps {
  open: boolean;
  onClose: () => void;
  faculty?: string;
  email?: string;
  canSeeAllFaculty?: boolean;
  cohortLabel?: string;
}

export function McpConnectModal({
  open,
  onClose,
  faculty,
  email,
  canSeeAllFaculty,
  cohortLabel,
}: McpConnectModalProps) {
  const [selectedClient, setSelectedClient] = useState<McpClientId>("claude");
  const [preferLocal, setPreferLocal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const localDev = isLocalDevHostname();
  const endpointUrl = resolveMcpEndpointUrl(preferLocal);
  const guides = useMemo(() => buildMcpInstallGuides(endpointUrl), [endpointUrl]);
  const activeGuide = guides.find((g) => g.id === selectedClient) ?? guides[0]!;
  const isFaculty = Boolean(faculty && email);
  const coordinator = useMemo(
    () => (isFaculty ? findCoordinator(email, faculty) : undefined),
    [isFaculty, email, faculty],
  );
  const prompts = useMemo(
    () => starterPromptsForUser({ isFaculty, canSeeAllFaculty, cohortLabel }),
    [isFaculty, canSeeAllFaculty, cohortLabel],
  );

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  if (!open) return null;

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked in non-HTTPS contexts; text remains selectable in UI.
    }
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % guides.length
        : (index - 1 + guides.length) % guides.length;
    setSelectedClient(guides[nextIndex]!.id);
  }

  const accessSummary = isFaculty
    ? canSeeAllFaculty
      ? `Signed in as ${faculty} · All-access faculty & directory`
      : coordinator
        ? `Signed in as ${faculty} · Coordinator (${coordinator.cohorts.join(", ")})`
        : `Signed in as ${faculty} · Personal faculty schedule & cohorts`
    : "OAuth 2.1 sign-in with an authorized @itm.edu or @isu.ac.in faculty account required at connect time.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-connect-title"
        data-testid="mcp-connect-modal"
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Remote MCP · OAuth 2.1 (PKCE + CIMD)
            </p>
            <h2 id="mcp-connect-title" className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
              Connect your AI assistant
            </h2>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {isFaculty ? (
                <ShieldCheck className="size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
              ) : (
                <Lock className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              )}
              <span className="min-w-0 leading-snug">{accessSummary}</span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close Connect AI dialog"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 sm:px-6">
          {/* Endpoint bar */}
          <div className="rounded-lg border border-border bg-muted/35 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                MCP Server URL
              </span>
              {localDev && (
                <button
                  type="button"
                  onClick={() => setPreferLocal((current) => !current)}
                  className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {preferLocal ? "Switch to production URL" : "Use local API URL (:8787)"}
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground whitespace-nowrap">
                {endpointUrl}
              </code>
              <button
                type="button"
                data-testid="copy-mcp-url"
                onClick={() => void copyText("endpoint-url", endpointUrl)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                {copiedId === "endpoint-url" ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" aria-hidden="true" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Client selector */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Choose your AI app or editor</p>
            <div
              role="tablist"
              aria-label="AI applications"
              className="flex flex-wrap gap-1.5"
            >
              {guides.map((guide, index) => {
                const selected = guide.id === activeGuide.id;
                return (
                  <button
                    key={guide.id}
                    type="button"
                    role="tab"
                    id={`mcp-tab-${guide.id}`}
                    aria-selected={selected}
                    aria-controls={`mcp-panel-${guide.id}`}
                    data-testid={`mcp-tab-${guide.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setSelectedClient(guide.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                      selected
                        ? "border-transparent bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{guide.name}</span>
                    <span
                      className={`font-mono text-[10px] ${
                        selected ? "text-background/70" : "text-muted-foreground"
                      }`}
                    >
                      {guide.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active installation instructions */}
          <div
            role="tabpanel"
            id={`mcp-panel-${activeGuide.id}`}
            aria-labelledby={`mcp-tab-${activeGuide.id}`}
            className="rounded-lg border border-border bg-card/50 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{activeGuide.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{activeGuide.summary}</p>
              </div>
              {activeGuide.deeplinkUrl && activeGuide.deeplinkLabel && (
                <a
                  href={activeGuide.deeplinkUrl}
                  data-testid={`mcp-deeplink-${activeGuide.id}`}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span>{activeGuide.deeplinkLabel}</span>
                </a>
              )}
            </div>

            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-foreground/90 leading-relaxed">
              {activeGuide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            {activeGuide.snippet && (
              <div className="rounded-lg border border-border bg-muted/40 overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <Terminal className="size-3" aria-hidden="true" />
                    {activeGuide.snippetLabel}
                  </span>
                  <button
                    type="button"
                    data-testid={`mcp-copy-snippet-${activeGuide.id}`}
                    onClick={() => void copyText(`snippet-${activeGuide.id}`, activeGuide.snippet!)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {copiedId === `snippet-${activeGuide.id}` ? (
                      <>
                        <Check className="size-3 text-emerald-500" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground">
                  <code>{activeGuide.snippet}</code>
                </pre>
              </div>
            )}

            {activeGuide.note && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">{activeGuide.note}</p>
            )}
          </div>

          {/* Starter prompts to test after connecting */}
          <div className="border-t border-border pt-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                Starter prompts after connecting
              </p>
            </div>
            <div className="grid gap-2">
              {prompts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{item.prompt}</p>
                  </div>
                  <button
                    type="button"
                    data-testid={`copy-prompt-${item.id}`}
                    onClick={() => void copyText(`prompt-${item.id}`, item.prompt)}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {copiedId === `prompt-${item.id}` ? (
                      <>
                        <Check className="size-3 text-emerald-500" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
