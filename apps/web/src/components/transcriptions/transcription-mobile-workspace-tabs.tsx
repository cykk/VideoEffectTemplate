"use client";

import { FileText, Network, Sparkles } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";

export type WorkspacePanel = "transcript" | "summary" | "mindmap";

export type ArtifactTabStatus = "idle" | "processing" | "ready";

export type TranscriptionMobileWorkspaceTabsProps = {
  transcriptLabel: string;
  summaryLabel: string;
  mindMapLabel: string;
  tabBarAria: string;
  summaryProcessingAria: string;
  mindMapProcessingAria: string;
  activePanel: WorkspacePanel;
  onPanelChange: (panel: WorkspacePanel) => void;
  summaryStatus?: ArtifactTabStatus;
  mindMapStatus?: ArtifactTabStatus;
};

const PANELS: Array<{
  id: WorkspacePanel;
  icon: typeof FileText;
}> = [
  { id: "transcript", icon: FileText },
  { id: "summary", icon: Sparkles },
  { id: "mindmap", icon: Network },
];

function getProcessingAria(
  panel: WorkspacePanel,
  summaryProcessingAria: string,
  mindMapProcessingAria: string
): string | undefined {
  if (panel === "summary") {
    return summaryProcessingAria;
  }

  if (panel === "mindmap") {
    return mindMapProcessingAria;
  }

  return undefined;
}

export function TranscriptionMobileWorkspaceTabs({
  transcriptLabel,
  summaryLabel,
  mindMapLabel,
  tabBarAria,
  summaryProcessingAria,
  mindMapProcessingAria,
  activePanel,
  onPanelChange,
  summaryStatus = "idle",
  mindMapStatus = "idle",
}: TranscriptionMobileWorkspaceTabsProps) {
  const labels: Record<WorkspacePanel, string> = {
    transcript: transcriptLabel,
    summary: summaryLabel,
    mindmap: mindMapLabel,
  };

  const statuses: Record<WorkspacePanel, ArtifactTabStatus> = {
    transcript: "idle",
    summary: summaryStatus,
    mindmap: mindMapStatus,
  };

  return (
    <nav
      role="tablist"
      aria-label={tabBarAria}
      className="shrink-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm xl:hidden"
    >
      <div className="grid h-14 grid-cols-3">
        {PANELS.map((panel) => {
          const Icon = panel.icon;
          const isActive = activePanel === panel.id;
          const status = statuses[panel.id];
          const isProcessing = status === "processing";
          const showReadyDot = status === "ready" && !isActive;

          return (
            <button
              key={panel.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-busy={isProcessing || undefined}
              aria-label={
                isProcessing
                  ? getProcessingAria(
                      panel.id,
                      summaryProcessingAria,
                      mindMapProcessingAria
                    )
                  : undefined
              }
              onClick={() => onPanelChange(panel.id)}
              className={cn(
                "relative flex min-h-11 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                isActive ? "text-primary" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <span className="relative inline-flex">
                <Icon className="size-5" aria-hidden="true" />
                {isProcessing ? (
                  <span
                    className="absolute -right-1 -top-1 size-2 animate-pulse rounded-full bg-primary"
                    aria-hidden="true"
                  />
                ) : showReadyDot ? (
                  <span
                    className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
              <span className="max-w-full truncate text-[11px] font-medium leading-none">
                {labels[panel.id]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

