"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TranscriptionMindMapPanel } from "@/components/transcriptions/transcription-mind-map-panel";
import {
  TranscriptionSummaryEmptyState,
  TranscriptionSummaryGeneratingState,
  TranscriptionSummaryPanelTabs,
  TranscriptionSummaryTemplateToolbar,
} from "@/components/transcriptions/transcription-summary-panel";
import { cn } from "@markless/shared/src/lib/utils";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import type {
  TranscriptionAiArtifactClientData,
  TranscriptionAiSummaryData,
  TranscriptionMindMapData,
} from "@markless/shared/src/types/transcriptions";

export type TranscriptionInsightsPanelProps = {
  dict: TranscriptionsPageDictionary["summaryPanel"];
  publicId: string;
  activeTab: "summary" | "mindmap";
  onActiveTabChange: (tab: "summary" | "mindmap") => void;
  variant: "sidebar" | "mobile";
  className?: string;
  style?: React.CSSProperties;

  summaryTemplateKey: "off" | "general";
  onSummaryTemplateChange: (value: "off" | "general") => void;
  summaryTemplateSelectTriggerRef: RefObject<HTMLButtonElement | null>;
  isSummaryEnabled: boolean;
  isSummaryGenerating: boolean;
  isSummaryAwaitingTranscript: boolean;
  summaryArtifact: TranscriptionAiArtifactClientData | null;
  summaryData: TranscriptionAiSummaryData | null;
  hasSummaryContent: boolean;
  canChangeSummaryTemplate: boolean;
  canRefreshSummary: boolean;
  canCopySummary: boolean;
  canGenerateSummary: boolean;
  isTranscriptReady: boolean;
  onRefreshSummary: () => void;
  onCopySummary: () => void;
  onGenerateSummary: () => void;

  isMindMapBusy: boolean;
  isMindMapAwaitingTranscript: boolean;
  mindMapArtifact: TranscriptionAiArtifactClientData | null;
  mindMapData: TranscriptionMindMapData | null;
  hasMindMapContent: boolean;
  canGenerateMindMap: boolean;
  canRefreshMindMap: boolean;
  onGenerateMindMap: () => void;
  onRefreshMindMap: () => void;
};

export function TranscriptionInsightsPanel({
  dict,
  publicId,
  activeTab,
  onActiveTabChange,
  variant,
  className,
  style,
  summaryTemplateKey,
  onSummaryTemplateChange,
  summaryTemplateSelectTriggerRef,
  isSummaryEnabled,
  isSummaryGenerating,
  isSummaryAwaitingTranscript,
  summaryArtifact,
  summaryData,
  hasSummaryContent,
  canChangeSummaryTemplate,
  canRefreshSummary,
  canCopySummary,
  canGenerateSummary,
  isTranscriptReady,
  onRefreshSummary,
  onCopySummary,
  onGenerateSummary,
  isMindMapBusy,
  isMindMapAwaitingTranscript,
  mindMapArtifact,
  mindMapData,
  hasMindMapContent,
  canGenerateMindMap,
  canRefreshMindMap,
  onGenerateMindMap,
  onRefreshMindMap,
}: TranscriptionInsightsPanelProps) {
  const isMobile = variant === "mobile";
  const RootTag = isMobile ? "div" : "aside";

  return (
    <RootTag
      className={cn(
        "min-h-0 flex-shrink-0 flex-col bg-white",
        isMobile ? "flex flex-1" : "hidden xl:flex",
        className
      )}
      style={style}
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
            onSummaryClick={() => onActiveTabChange("summary")}
            onMindmapClick={() => onActiveTabChange("mindmap")}
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
              canRefreshSummary={canRefreshSummary}
              canCopySummary={canCopySummary}
              disabled={!canChangeSummaryTemplate}
              selectTriggerRef={summaryTemplateSelectTriggerRef}
              onTemplateChange={onSummaryTemplateChange}
              onRefresh={onRefreshSummary}
              onCopy={onCopySummary}
            />

            {isSummaryEnabled ? (
              isSummaryGenerating || isSummaryAwaitingTranscript ? (
                <TranscriptionSummaryGeneratingState
                  message={
                    isSummaryAwaitingTranscript
                      ? dict.states.waitingForTranscript
                      : dict.states.generating
                  }
                />
              ) : summaryArtifact?.status === "failed" ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <p className="mt-4 text-sm font-medium text-red-600">Failed to generate summary</p>
                  <Button variant="outline" size="sm" onClick={onRefreshSummary} className="mt-4">
                    Retry
                  </Button>
                </div>
              ) : hasSummaryContent && summaryData ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900">{dict.content.overview}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">{summaryData.overview}</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900">{dict.content.keyPoints}</h3>
                    <ul className="space-y-3">
                      {summaryData.keyPoints.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 text-sm text-slate-600"
                        >
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
                        <li
                          key={item.id}
                          className="flex items-start gap-3 text-sm text-slate-600"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
                          <span className="leading-relaxed">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null
            ) : (
              <TranscriptionSummaryEmptyState
                dict={dict}
                onGenerate={onGenerateSummary}
                generateDisabled={!canGenerateSummary}
                generateDisabledTooltip={
                  !isTranscriptReady ? dict.empty.generateDisabledTooltip : undefined
                }
              />
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {isMindMapBusy || isMindMapAwaitingTranscript ? (
              <TranscriptionSummaryGeneratingState
                message={
                  isMindMapAwaitingTranscript
                    ? dict.mindmap.waitingForTranscript
                    : dict.mindmap.generating
                }
              />
            ) : hasMindMapContent && mindMapData ? (
              <div className={cn(isMobile && "min-h-[50dvh]")}>
                <TranscriptionMindMapPanel
                  root={mindMapData.root}
                  publicId={publicId}
                  dict={dict.mindmap}
                  isRefreshing={isMindMapBusy}
                  onRefresh={onRefreshMindMap}
                />
              </div>
            ) : mindMapArtifact?.status === "failed" ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-700">{dict.mindmap.failedTitle}</p>
                <p className="mt-2 text-sm text-slate-500">{dict.mindmap.failedBody}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  disabled={!canRefreshMindMap}
                  onClick={onRefreshMindMap}
                >
                  {dict.mindmap.retryCta}
                </Button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
                {!canGenerateMindMap && !isTranscriptReady ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          type="button"
                          className="bg-primary px-6 text-white hover:bg-primary/90"
                          disabled
                        >
                          {dict.mindmap.generateCta}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {dict.mindmap.generateDisabledTooltip}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    type="button"
                    className="bg-primary px-6 text-white hover:bg-primary/90"
                    disabled={!canGenerateMindMap}
                    onClick={onGenerateMindMap}
                  >
                    {dict.mindmap.generateCta}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </RootTag>
  );
}

