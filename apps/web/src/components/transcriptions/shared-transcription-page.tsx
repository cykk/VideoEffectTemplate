"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Languages, LoaderCircle } from "lucide-react";
import { Popover, PopoverAnchor, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@markless/shared/src/types/api/video";
import type {
  PublicTranscriptionShareReadResponse,
  TranscriptionDisplaySegment,
  TranscriptionTranslationClientData,
} from "@markless/shared/src/types/transcriptions";
import type { TranslationTargetLanguageId } from "@markless/shared/src/i18n/data/translation-target-languages";
import { toast } from "sonner";
import {
  toastConfirmOptions,
  toastErrorOptions,
} from "@markless/shared/src/lib/toast-options";
import { cn } from "@markless/shared/src/lib/utils";
import { TranscriptionViewShell } from "@/components/transcriptions/transcription-view-shell";
import { TranscriptionSharePageHeader } from "@/components/transcriptions/transcription-share-page-header";
import { SHARE_VIEW_CAPABILITIES } from "@/components/transcriptions/transcription-view-capabilities";
import { TranscriptionTranscriptToolbar } from "@/components/transcriptions/transcription-transcript-toolbar";
import { TranscriptionSearchOnlyPanel } from "@/components/transcriptions/transcription-search-only-panel";
import {
  TranscriptionTranslationPanel,
  type TranslationDisplayMode,
} from "@/components/transcriptions/transcription-translation-panel";
import { TranscriptionSegmentCard } from "@/components/transcriptions/transcription-segment-card";
import { TranscriptionViewSummaryAside } from "@/components/transcriptions/transcription-view-summary-aside";
import {
  TranscriptionMobileWorkspaceTabs,
  type WorkspacePanel,
} from "@/components/transcriptions/transcription-mobile-workspace-tabs";
import { TranscriptionSummaryResizeHandle } from "@/components/transcriptions/transcription-summary-resize-handle";
import { TranscriptionPlaybackBar } from "@/components/transcriptions/transcription-playback-bar";
import { TranscriptScrollJumpButton } from "@/components/transcriptions/transcript-scroll-jump-button";
import {
  TranscriptionExportDialog,
  type TranscriptionExportOptions,
} from "@/components/transcriptions/transcription-export-dialog";
import {
  getFileNameFromContentDisposition,
  triggerBrowserDownload,
} from "@/lib/transcriptions/export-download";
import { hasEditedDisplaySegments } from "@/lib/transcriptions/has-edited-display-segments";
import { TRANSCRIPTION_SEARCH_REPLACE_INSET_CLASSNAME } from "@/components/transcriptions/transcription-page-chrome-styles";
import { TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME } from "@/components/transcriptions/transcription-page-chrome-styles";
import { useTranscriptClientSearch } from "@/hooks/use-transcript-client-search";
import { useSummaryPanelWidth } from "@/hooks/use-summary-panel-width";
import {
  PLAYBACK_SPEED_OPTIONS,
  useAudioPlayback,
} from "@/hooks/use-audio-playback";
import { trackTranscriptExport } from "@/lib/analytics/project";

function isApiSuccess<T>(
  payload: ApiSuccessResponse<T> | ApiErrorResponse | null
): payload is ApiSuccessResponse<T> {
  return Boolean(payload?.success);
}

function hasCompletedTranslationSegments(
  translation: TranscriptionTranslationClientData | null | undefined
): boolean {
  return translation?.status === "completed" && Boolean(translation.segments?.length);
}

type SharedTranscriptionPageProps = {
  shareToken: string;
};

export function SharedTranscriptionPage({ shareToken }: SharedTranscriptionPageProps) {
  const { dictionary } = useLocale();
  const pageDict = dictionary.pages.transcriptions;
  const sharedPageDict = pageDict.sharedPage;
  const capabilities = SHARE_VIEW_CAPABILITIES;

  const [data, setData] = useState<PublicTranscriptionShareReadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState<TranslationTargetLanguageId>("en");
  const [translationDisplayMode, setTranslationDisplayMode] =
    useState<TranslationDisplayMode>("translation");
  const [translationDetails, setTranslationDetails] = useState<
    Record<string, TranscriptionTranslationClientData>
  >({});
  const [isTranslationLoading, setIsTranslationLoading] = useState(false);
  const [isTranslationOpen, setIsTranslationOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<WorkspacePanel>("transcript");
  const [insightsActiveTab, setInsightsActiveTab] = useState<"summary" | "mindmap">("summary");

  const exportDialogDict = pageDict.exportDialog;

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const playbackFooterRef = useRef<HTMLDivElement | null>(null);

  const {
    containerRef: workspaceSplitRef,
    summaryWidth,
    isResizing: isSummaryPanelResizing,
    handlePointerDown: handleSummaryResizePointerDown,
    handlePointerMove: handleSummaryResizePointerMove,
    handlePointerUp: handleSummaryResizePointerUp,
    handleDoubleClick: handleSummaryResizeDoubleClick,
  } = useSummaryPanelWidth();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiFetch(`/api/public/shares/${shareToken}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | ApiSuccessResponse<PublicTranscriptionShareReadResponse>
          | ApiErrorResponse
          | null;

        if (!response.ok || !isApiSuccess(payload)) {
          throw new Error(
            payload && !payload.success
              ? payload.error.message
              : sharedPageDict.unavailableDescription
          );
        }

        if (!cancelled) {
          setData(payload.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : sharedPageDict.unavailableDescription
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [shareToken, sharedPageDict.unavailableDescription]);

  const segments = data?.task.segments ?? [];
  const hasEditedSegments = useMemo(
    () => hasEditedDisplaySegments(segments),
    [segments]
  );
  const completedTranslations = data?.translations ?? {};
  const availableLanguages = useMemo(
    () => Object.keys(completedTranslations) as TranslationTargetLanguageId[],
    [completedTranslations]
  );
  const hasAvailableTranslations = availableLanguages.length > 0;

  useEffect(() => {
    if (!hasAvailableTranslations) {
      return;
    }

    setTargetLanguage((current) =>
      availableLanguages.includes(current) ? current : availableLanguages[0]!
    );
  }, [availableLanguages, hasAvailableTranslations]);

  const displayedTranslation = useMemo(() => {
    return (
      translationDetails[targetLanguage] ??
      completedTranslations[targetLanguage] ??
      null
    );
  }, [completedTranslations, targetLanguage, translationDetails]);

  const translationSegmentTextById = useMemo(() => {
    if (!displayedTranslation?.segments?.length) {
      return new Map<string, string>();
    }

    return new Map(
      displayedTranslation.segments.map((segment) => [
        segment.sourceSegmentId,
        segment.textTranslated,
      ])
    );
  }, [displayedTranslation]);

  const shouldShowTranslationDisplayMode = hasAvailableTranslations;

  const getSegmentDisplayText = useCallback(
    (segment: TranscriptionDisplaySegment) => {
      if (
        translationDisplayMode === "translation" &&
        translationSegmentTextById.has(segment.id)
      ) {
        return translationSegmentTextById.get(segment.id)!;
      }

      return segment.text;
    },
    [translationDisplayMode, translationSegmentTextById]
  );

  const searchableSegments = useMemo(
    () =>
      segments.map((segment) => ({
        id: segment.id,
        text: getSegmentDisplayText(segment),
      })),
    [getSegmentDisplayText, segments]
  );

  const {
    isOpen: isSearchOpen,
    setIsOpen: setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    matches: searchMatches,
    currentMatchIndex,
    highlightBySegmentId,
    goToPreviousMatch,
    goToNextMatch,
    closePanel: closeSearchPanel,
  } = useTranscriptClientSearch(searchableSegments);

  const playbackEnabled = Boolean(
    data?.share.allowAudioPlayback && data.playbackUrl && capabilities.playback.enabled
  );

  const {
    audioRef,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeedIndex,
    currentTimeSec,
    progressPercent,
    activeSegmentId,
    handleTogglePlay,
    handleSeekRelative,
    handleSeekToPercent,
    handleVolumeChange,
    handlePlaySegment,
    handleSegmentSelect,
  } = useAudioPlayback({
    playbackUrl: data?.playbackUrl ?? null,
    segments,
    enabled: playbackEnabled,
  });

  const loadTranslationDetail = useCallback(
    async (language: TranslationTargetLanguageId) => {
      if (hasCompletedTranslationSegments(translationDetails[language])) {
        return;
      }

      if (!completedTranslations[language]) {
        return;
      }

      setIsTranslationLoading(true);

      try {
        const response = await apiFetch(
          `/api/public/shares/${shareToken}/translations/${language}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => null)) as
          | ApiSuccessResponse<{ translation: TranscriptionTranslationClientData }>
          | ApiErrorResponse
          | null;

        if (!response.ok || !isApiSuccess(payload)) {
          throw new Error(
            payload && !payload.success
              ? payload.error.message
              : sharedPageDict.unavailableDescription
          );
        }

        setTranslationDetails((current) => ({
          ...current,
          [language]: payload.data.translation,
        }));
      } catch {
        toast.error(sharedPageDict.unavailableDescription, toastErrorOptions);
      } finally {
        setIsTranslationLoading(false);
      }
    },
    [completedTranslations, shareToken, sharedPageDict.unavailableDescription, translationDetails]
  );

  const handleTargetLanguageChange = useCallback(
    (language: TranslationTargetLanguageId) => {
      setTargetLanguage(language);
      void loadTranslationDetail(language);
    },
    [loadTranslationDetail]
  );

  useEffect(() => {
    if (!isTranslationOpen || !hasAvailableTranslations) {
      return;
    }

    void loadTranslationDetail(targetLanguage);
  }, [
    hasAvailableTranslations,
    isTranslationOpen,
    loadTranslationDetail,
    targetLanguage,
  ]);

  const handleCopyTranscript = useCallback(async () => {
    if (!data?.share.allowCopy) {
      return;
    }

    const transcript = segments
      .map((segment) => getSegmentDisplayText(segment))
      .join("\n\n")
      .trim();

    if (!transcript) {
      toast.error(sharedPageDict.copyError, toastErrorOptions);
      return;
    }

    try {
      await navigator.clipboard.writeText(transcript);
      toast.success(sharedPageDict.copySuccess, toastConfirmOptions);
    } catch {
      toast.error(sharedPageDict.copyError, toastErrorOptions);
    }
  }, [data?.share.allowCopy, getSegmentDisplayText, segments, sharedPageDict.copyError, sharedPageDict.copySuccess]);

  const handleCopySegment = useCallback(
    async (segment: TranscriptionDisplaySegment) => {
      if (!data?.share.allowCopy) {
        return;
      }

      const text = getSegmentDisplayText(segment).trim();
      if (!text) {
        toast.error(pageDict.segmentEdit.toast.copyError, toastErrorOptions);
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        toast.success(pageDict.segmentEdit.toast.copySuccess, toastConfirmOptions);
      } catch {
        toast.error(pageDict.segmentEdit.toast.copyError, toastErrorOptions);
      }
    },
    [data?.share.allowCopy, getSegmentDisplayText, pageDict.segmentEdit.toast.copyError, pageDict.segmentEdit.toast.copySuccess]
  );

  const handleSearchOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setIsTranslationOpen(false);
      }
      setIsSearchOpen(open);
    },
    [setIsSearchOpen]
  );

  const handleTranslationOpenChange = useCallback((open: boolean) => {
    if (open) {
      closeSearchPanel();
      setIsSearchOpen(false);
    }
    setIsTranslationOpen(open);
  }, [closeSearchPanel, setIsSearchOpen]);

  const handleExportDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isExporting) {
        return;
      }

      setIsExportDialogOpen(open);
    },
    [isExporting]
  );

  const handleExport = useCallback(
    async (options: TranscriptionExportOptions) => {
      setIsExporting(true);
      const dedupeKey = `shared_transcript_export:${shareToken}:${options.format}`;
      trackTranscriptExport({
        format: options.format,
        isAuthenticated: false,
        source: "share",
        succeeded: false,
        dedupeKey: `${dedupeKey}:started`,
      });

      try {
        const response = await apiFetch(`/api/public/shares/${shareToken}/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
          throw new Error(
            payload && !payload.success
              ? payload.error.message
              : exportDialogDict.exportError
          );
        }

        const blob = await response.blob();
        const fallbackFileName = `${data?.task.publicId ?? shareToken}-transcript.${options.format}`;
        const fileName = getFileNameFromContentDisposition(
          response.headers.get("content-disposition"),
          fallbackFileName
        );

        triggerBrowserDownload(blob, fileName);
        trackTranscriptExport({
          format: options.format,
          isAuthenticated: false,
          source: "share",
          succeeded: true,
          dedupeKey: `${dedupeKey}:completed`,
        });
        setIsExportDialogOpen(false);
        toast.success(exportDialogDict.exportSuccess, toastConfirmOptions);
      } catch (exportError) {
        toast.error(
          exportError instanceof Error ? exportError.message : exportDialogDict.exportError,
          toastErrorOptions
        );
      } finally {
        setIsExporting(false);
      }
    },
    [data?.task.publicId, exportDialogDict.exportError, exportDialogDict.exportSuccess, shareToken]
  );

  const handleWorkspacePanelChange = useCallback((panel: WorkspacePanel) => {
    setActiveWorkspacePanel(panel);
    if (panel === "summary") {
      setInsightsActiveTab("summary");
    }
    if (panel === "mindmap") {
      setInsightsActiveTab("mindmap");
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-slate-50">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <LoaderCircle className="size-8 animate-spin text-brand-600" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-slate-900">{sharedPageDict.loadingTitle}</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            {sharedPageDict.loadingDescription}
          </p>
        </div>
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">{sharedPageDict.unavailableTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {error || sharedPageDict.unavailableDescription}
          </p>
        </div>
      </div>
    );
  }

  const fileName =
    data.task.displayTitle || data.task.fileName || sharedPageDict.titleFallback;
  const summaryData = data.aiArtifacts.summary?.summary ?? null;
  const mindMapData = data.aiArtifacts.mind_map?.mindMap ?? null;
  const canCopy = data.share.allowCopy && capabilities.transcript.copy;
  const showBottomPlayback = playbackEnabled && segments.length > 0;
  const isTranscriptReady = segments.length > 0;
  const summaryPanelDict = pageDict.summaryPanel;
  const mobileWorkspaceDict = pageDict.mobileWorkspace;
  const hasSummaryContent = Boolean(summaryData);
  const hasMindMapContent = Boolean(mindMapData?.root);
  const isSummaryGenerating = data?.aiArtifacts.summary?.status === "processing";
  const isMindMapGenerating = data?.aiArtifacts.mind_map?.status === "processing";
  const summaryTabStatus = isSummaryGenerating
    ? "processing"
    : hasSummaryContent
      ? "ready"
      : "idle";
  const mindMapTabStatus = isMindMapGenerating
    ? "processing"
    : hasMindMapContent
      ? "ready"
      : "idle";

  return (
    <>
    <TranscriptionViewShell
      header={
        <Popover open={isSearchOpen} onOpenChange={handleSearchOpenChange}>
          <TranscriptionSharePageHeader
            fileName={fileName}
            homeHref="/"
            backLabel={sharedPageDict.backAria}
            exportLabel={exportDialogDict.triggerLabel}
            exportDisabled={!isTranscriptReady}
            onExportClick={() => setIsExportDialogOpen(true)}
            isSearchOpen={isSearchOpen}
            searchReplaceAnchor={
              <PopoverAnchor asChild>
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute z-[60] block size-0",
                    TRANSCRIPTION_SEARCH_REPLACE_INSET_CLASSNAME
                  )}
                />
              </PopoverAnchor>
            }
          />
          <TranscriptionSearchOnlyPanel
            dict={pageDict.searchReplace}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            matchCount={searchMatches.length}
            currentMatchIndex={currentMatchIndex}
            onPreviousMatch={goToPreviousMatch}
            onNextMatch={goToNextMatch}
            onClose={closeSearchPanel}
          />
        </Popover>
      }
    >
      <audio ref={audioRef} preload="metadata" className="hidden" />

      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={workspaceSplitRef} className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div
            className={cn(
              "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white",
              activeWorkspacePanel !== "transcript" && "max-xl:hidden"
            )}
        >
          <div
            ref={transcriptScrollRef}
            className="scrollbar-reading min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 lg:p-8"
          >
            <div className="w-full space-y-6">
              <TranscriptionTranscriptToolbar
                title={pageDict.content.fullText}
                toolbarDict={pageDict.toolbar}
                capabilities={{
                  ...capabilities.transcript,
                  copy: canCopy,
                }}
                isSearchOpen={isSearchOpen}
                isTranslationOpen={isTranslationOpen}
                onSearchClick={() => handleSearchOpenChange(!isSearchOpen)}
                onCopyClick={() => void handleCopyTranscript()}
                translationTrigger={
                  capabilities.transcript.translate !== "off" && hasAvailableTranslations ? (
                    <Popover
                      open={isTranslationOpen}
                      onOpenChange={handleTranslationOpenChange}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME,
                            "relative",
                            isTranslationOpen && "bg-brand-50 text-brand-600"
                          )}
                          aria-label={pageDict.toolbar.actions.translateAria}
                          aria-expanded={isTranslationOpen}
                        >
                          <Languages className="size-4" aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                      <TranscriptionTranslationPanel
                        dict={pageDict.translation}
                        targetLanguage={targetLanguage}
                        onTargetLanguageChange={handleTargetLanguageChange}
                        isTranslating={false}
                        actionState={
                          hasCompletedTranslationSegments(displayedTranslation)
                            ? "fresh_completed"
                            : "not_created"
                        }
                        showDisplayMode={shouldShowTranslationDisplayMode}
                        displayMode={translationDisplayMode}
                        onDisplayModeChange={setTranslationDisplayMode}
                        onClose={() => setIsTranslationOpen(false)}
                        readOnly
                        availableLanguages={availableLanguages}
                        isLoading={isTranslationLoading}
                      />
                    </Popover>
                  ) : undefined
                }
              />

              <div className="space-y-6">
                {segments.map((segment) => (
                  <TranscriptionSegmentCard
                    key={segment.id}
                    segment={segment}
                    displayText={getSegmentDisplayText(segment)}
                    highlightRanges={
                      isSearchOpen ? highlightBySegmentId[segment.id] : undefined
                    }
                    isActive={activeSegmentId === segment.id}
                    onClick={() => handleSegmentSelect(segment.id)}
                    onPlaySegment={
                      playbackEnabled ? handlePlaySegment : undefined
                    }
                    onCopySegment={canCopy ? handleCopySegment : undefined}
                    canEdit={false}
                    canPlay={playbackEnabled && capabilities.transcript.segmentPlay}
                    canCopy={canCopy && capabilities.transcript.segmentCopy}
                    segmentEditDict={pageDict.segmentEdit}
                    unknownValue={pageDict.content.unknownValue}
                  />
                ))}
              </div>
            </div>
          </div>

          {showBottomPlayback ? (
            <div ref={playbackFooterRef} className="shrink-0">
              <TranscriptionPlaybackBar
                dict={pageDict.playback}
                durationMs={data.task.durationMs ?? null}
                unknownValue={pageDict.content.unknownValue}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                currentTimeSec={currentTimeSec}
                progressPercent={progressPercent}
                onTogglePlay={() => void handleTogglePlay()}
                onSeekRelative={handleSeekRelative}
                onSeekToPercent={handleSeekToPercent}
                onCycleSpeed={() =>
                  setPlaybackSpeedIndex(
                    (current) => (current + 1) % PLAYBACK_SPEED_OPTIONS.length
                  )
                }
                onVolumeChange={handleVolumeChange}
              />
            </div>
          ) : null}

          <TranscriptScrollJumpButton
            enabled={segments.length > 0}
            scrollContainerRef={transcriptScrollRef}
            footerRef={playbackFooterRef}
            dict={pageDict.scrollJump}
          />
        </div>

        <TranscriptionSummaryResizeHandle
          ariaLabel={pageDict.toolbar.actions.resizeSummaryAria}
          isResizing={isSummaryPanelResizing}
          onPointerDown={handleSummaryResizePointerDown}
          onPointerMove={handleSummaryResizePointerMove}
          onPointerUp={handleSummaryResizePointerUp}
          onDoubleClick={handleSummaryResizeDoubleClick}
        />
        <TranscriptionViewSummaryAside
          dict={pageDict.summaryPanel}
          capabilities={capabilities.summary}
          summaryTemplateKey={data.task.summaryTemplateKey}
          summaryArtifact={data.aiArtifacts.summary}
          mindMapArtifact={data.aiArtifacts.mind_map}
          summaryData={summaryData}
          mindMapData={mindMapData}
          publicId={data.task.publicId}
          width={summaryWidth}
          canCopy={canCopy}
          variant="sidebar"
        />

        <div
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white xl:hidden",
            activeWorkspacePanel === "transcript" ? "hidden" : "flex"
          )}
        >
          <TranscriptionViewSummaryAside
            dict={pageDict.summaryPanel}
            capabilities={capabilities.summary}
            summaryTemplateKey={data.task.summaryTemplateKey}
            summaryArtifact={data.aiArtifacts.summary}
            mindMapArtifact={data.aiArtifacts.mind_map}
            summaryData={summaryData}
            mindMapData={mindMapData}
            publicId={data.task.publicId}
            width={summaryWidth}
            canCopy={canCopy}
            variant="mobile"
            activeTab={insightsActiveTab}
            onActiveTabChange={(tab) => {
              setInsightsActiveTab(tab);
              setActiveWorkspacePanel(tab);
            }}
          />
        </div>
      </div>

        <TranscriptionMobileWorkspaceTabs
          transcriptLabel={pageDict.content.fullText}
          summaryLabel={summaryPanelDict.tabs.summary}
          mindMapLabel={summaryPanelDict.tabs.mindmap}
          tabBarAria={mobileWorkspaceDict.tabBarAria}
          summaryProcessingAria={mobileWorkspaceDict.summaryProcessingAria}
          mindMapProcessingAria={mobileWorkspaceDict.mindMapProcessingAria}
          activePanel={activeWorkspacePanel}
          onPanelChange={handleWorkspacePanelChange}
          summaryStatus={summaryTabStatus}
          mindMapStatus={mindMapTabStatus}
        />
      </div>
    </TranscriptionViewShell>

    <TranscriptionExportDialog
      open={isExportDialogOpen}
      onOpenChange={handleExportDialogOpenChange}
      dictionary={exportDialogDict}
      onExport={handleExport}
      isExporting={isExporting}
      hasEditedSegments={hasEditedSegments}
    />
    </>
  );
}
