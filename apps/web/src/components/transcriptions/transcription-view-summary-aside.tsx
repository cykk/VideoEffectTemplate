"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  toastConfirmOptions,
  toastErrorOptions,
} from "@markless/shared/src/lib/toast-options";
import {
  TranscriptionSummaryEmptyState,
  TranscriptionSummaryGeneratingState,
  TranscriptionSummaryPanelTabs,
  TranscriptionSummaryTemplateToolbar,
} from "@/components/transcriptions/transcription-summary-panel";
import { TranscriptionMindMapPanel } from "@/components/transcriptions/transcription-mind-map-panel";
import { buildSummaryCopyText } from "@/lib/shared-transcription-formatters";
import type { TranscriptionViewCapabilities } from "@/components/transcriptions/transcription-view-capabilities";
import type {
  TranscriptionAiArtifactClientData,
  TranscriptionAiSummaryData,
  TranscriptionAiSummaryTemplateKey,
  TranscriptionMindMapData,
} from "@markless/shared/src/types/transcriptions";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import { cn } from "@markless/shared/src/lib/utils";

export type TranscriptionViewSummaryAsideProps = {
  dict: TranscriptionsPageDictionary["summaryPanel"];
  capabilities: TranscriptionViewCapabilities["summary"];
  summaryTemplateKey: TranscriptionAiSummaryTemplateKey;
  summaryArtifact: TranscriptionAiArtifactClientData | null;
  mindMapArtifact: TranscriptionAiArtifactClientData | null;
  summaryData: TranscriptionAiSummaryData | null;
  mindMapData: TranscriptionMindMapData | null;
  publicId: string;
  width: number;
  canCopy: boolean;
  variant?: "sidebar" | "mobile";
  activeTab?: "summary" | "mindmap";
  onActiveTabChange?: (tab: "summary" | "mindmap") => void;
};

function SummaryReadonlyErrorState({
  dict,
}: {
  dict: TranscriptionsPageDictionary["summaryPanel"];
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-6 text-center">
      <p className="text-sm font-medium text-slate-700">{dict.states.failedTitle}</p>
      <p className="mt-2 text-sm text-slate-500">{dict.states.failedBody}</p>
    </div>
  );
}

function MindMapReadonlyErrorState({
  dict,
}: {
  dict: TranscriptionsPageDictionary["summaryPanel"]["mindmap"];
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{dict.failedTitle}</p>
      <p className="mt-2 text-sm text-slate-500">{dict.failedBody}</p>
    </div>
  );
}

function MindMapReadonlyEmptyState({
  dict,
}: {
  dict: TranscriptionsPageDictionary["summaryPanel"]["mindmap"];
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <Button type="button" className="bg-primary px-6 text-white hover:bg-primary/90" disabled>
        {dict.generateCta}
      </Button>
    </div>
  );
}

export function TranscriptionViewSummaryAside({
  dict,
  capabilities,
  summaryTemplateKey,
  summaryArtifact,
  mindMapArtifact,
  summaryData,
  mindMapData,
  publicId,
  width,
  canCopy,
  variant = "sidebar",
  activeTab: controlledActiveTab,
  onActiveTabChange,
}: TranscriptionViewSummaryAsideProps) {
  const isMobile = variant === "mobile";
  const [internalActiveTab, setInternalActiveTab] = useState<"summary" | "mindmap">("summary");
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = onActiveTabChange ?? setInternalActiveTab;
  const hasSummary = Boolean(summaryData);
  const hasMindMap = Boolean(mindMapData?.root);
  const isSummaryEnabled = summaryTemplateKey === "general";
  const isSummaryGenerating = summaryArtifact?.status === "processing";
  const isMindMapGenerating = mindMapArtifact?.status === "processing";

  const handleCopySummary = async () => {
    if (!summaryData || !canCopy || !capabilities.copy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildSummaryCopyText(summaryData, dict));
      toast.success(dict.actions.copySuccess, toastConfirmOptions);
    } catch {
      toast.error(dict.actions.copyError, toastErrorOptions);
    }
  };

  if (!capabilities.view && !capabilities.mindMap) {
    return null;
  }

  const RootTag = isMobile ? "div" : "aside";

  return (
    <RootTag
      className={cn(
        "min-h-0 flex-shrink-0 flex-col bg-white",
        isMobile ? "flex flex-1" : "hidden xl:flex"
      )}
      style={isMobile ? undefined : { width }}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto",
          isMobile ? "px-4 pb-4 pt-4" : "px-5 pb-5 pt-8"
        )}
      >
        {variant === "sidebar" ? (
          <TranscriptionSummaryPanelTabs
            activeTab={activeTab}
            dict={dict}
            onSummaryClick={() => setActiveTab("summary")}
            onMindmapClick={() => setActiveTab("mindmap")}
          />
        ) : null}

        {activeTab === "summary" ? (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              !(isSummaryEnabled && isSummaryGenerating) && "space-y-6"
            )}
          >
            <TranscriptionSummaryTemplateToolbar
              dict={dict}
              templateKey={summaryTemplateKey}
              isSummaryEnabled={isSummaryEnabled}
              canRefreshSummary={false}
              canCopySummary={isSummaryEnabled && hasSummary && canCopy && capabilities.copy}
              disabled
              onCopy={() => void handleCopySummary()}
            />

            {isSummaryEnabled ? (
              isSummaryGenerating ? (
                <TranscriptionSummaryGeneratingState message={dict.states.generating} />
              ) : summaryArtifact?.status === "failed" ? (
                <SummaryReadonlyErrorState dict={dict} />
              ) : hasSummary && summaryData ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900">{dict.content.overview}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">{summaryData.overview}</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900">{dict.content.keyPoints}</h3>
                    <ul className="space-y-3">
                      {summaryData.keyPoints.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 text-sm text-slate-600">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
                          <span className="leading-relaxed">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900">{dict.content.takeaways}</h3>
                    <ul className="space-y-3">
                      {summaryData.takeaways.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 text-sm text-slate-600">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
                          <span className="leading-relaxed">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <TranscriptionSummaryGeneratingState message={dict.states.generating} />
              )
            ) : (
              <TranscriptionSummaryEmptyState dict={dict} generateDisabled />
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {isMindMapGenerating ? (
              <TranscriptionSummaryGeneratingState message={dict.mindmap.generating} />
            ) : capabilities.mindMap && hasMindMap && mindMapData ? (
              <div className={cn(isMobile && "min-h-[50dvh]")}>
                <TranscriptionMindMapPanel
                  root={mindMapData.root}
                  publicId={publicId}
                  dict={dict.mindmap}
                  isRefreshing={false}
                  onRefresh={() => undefined}
                />
              </div>
            ) : mindMapArtifact?.status === "failed" ? (
              <MindMapReadonlyErrorState dict={dict.mindmap} />
            ) : (
              <MindMapReadonlyEmptyState dict={dict.mindmap} />
            )}
          </div>
        )}
      </div>
    </RootTag>
  );
}

