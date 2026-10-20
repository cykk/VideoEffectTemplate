"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { 
  LoaderCircle, Radio, RefreshCw, 
  Download, Star, Play, Pause, Copy, Edit3, Check, Rewind, FastForward, Volume, Volume1, Volume2, VolumeX,
  Search, Replace, Users, ChevronUp,
  X, Languages, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/hooks/use-locale";
import { buildDashboardUrl } from "@/hooks/use-auth-action";
import { useSummaryPanelWidth } from "@/hooks/use-summary-panel-width";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { TranscriptionPageChromeDialogs } from "@/components/transcriptions/transcription-page-chrome-dialogs";
import { useTranscriptionPageChrome } from "@/hooks/use-transcription-page-chrome";
import { TranscriptionGuestSidebar } from "@/components/transcriptions/transcription-guest-sidebar";
import { TranscriptionResultPageHeader } from "@/components/transcriptions/transcription-result-page-header";
import { TranscriptionRenameDialog } from "@/components/transcriptions/transcription-rename-dialog";
import { TranscriptionEditSpeakerDialog } from "@/components/transcriptions/transcription-edit-speaker-dialog";
import { TRANSCRIPTION_SEARCH_REPLACE_INSET_CLASSNAME, SHOW_TRANSCRIPTION_SPEAKER_OPTIONS_BUTTON } from "@/components/transcriptions/transcription-page-chrome-styles";
import { TranscriptionSearchReplacePanel } from "@/components/transcriptions/transcription-search-replace-panel";
import { TranscriptionTranslationPanel } from "@/components/transcriptions/transcription-translation-panel";
import type { TranslationDisplayMode } from "@/components/transcriptions/transcription-translation-panel";
import { TranslationProgressBanner } from "@/components/transcriptions/translation-progress-banner";
import { useTranscriptSearchReplace } from "@/hooks/use-transcript-search-replace";
import { useTranscriptionTranslation } from "@/hooks/use-transcription-translation";
import {
  renderTranscriptHighlight,
  type TranscriptHighlightRange,
} from "@/lib/transcriptions/render-transcript-highlight";
import { TranscriptionSummaryResizeHandle } from "@/components/transcriptions/transcription-summary-resize-handle";
import { TranscriptionInsightsPanel } from "@/components/transcriptions/transcription-insights-panel";
import {
  TranscriptionMobileWorkspaceTabs,
  type WorkspacePanel,
} from "@/components/transcriptions/transcription-mobile-workspace-tabs";
import { TranscriptionUpgradePlanCard } from "@/components/transcriptions/transcription-upgrade-plan-card";
import { TranscriptScrollJumpButton } from "@/components/transcriptions/transcript-scroll-jump-button";
import { useUpgradePlanCardVisibility } from "@/hooks/use-upgrade-plan-card-visibility";
import { toast } from "sonner";
import {
  toastConfirmOptions,
  toastErrorOptions,
} from "@markless/shared/src/lib/toast-options";
import { getAnonymousTranscriptionAccessToken } from "@/lib/transcriptions/client-storage";
import { hasEditedDisplaySegments } from "@/lib/transcriptions/has-edited-display-segments";
import { renameTranscriptionDisplayTitleRequest } from "@/lib/transcriptions/rename-transcription";
import { getSpeakerAvatarClassName } from "@/lib/transcriptions/speaker-presentation";
import { renderHighlightedTemplate } from "@/lib/transcriptions/render-highlighted-template";
import { formatAppDateTime } from "@/lib/formatters";
import { cn } from "@markless/shared/src/lib/utils";
import { apiFetch, buildClientSseUrl } from "@markless/shared/src/lib/http/client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@markless/shared/src/types/api/video";
import type {
  TranscriptionAiArtifactClientData,
  TranscriptionAiArtifactCollectionClientData,
  TranscriptionAiArtifactType,
  TranscriptionAiSummaryData,
  TranscriptionDisplaySegment,
  TranscriptionJobClientData,
  TranscriptionMindMapNode,
  TranscriptionReadResponse,
  TranscriptionTranslationClientData,
  TranscriptionTranslationCollectionClientData,
} from "@markless/shared/src/types/transcriptions";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import {
  TRANSLATION_TARGET_LANGUAGES,
  type TranslationTargetLanguageId,
} from "@markless/shared/src/i18n/data/translation-target-languages";
import { TranscriptionRatingFeedbackDialog } from "@/components/transcriptions/transcription-rating-feedback-dialog";
import { TranscriptionMindMapPanel } from "@/components/transcriptions/transcription-mind-map-panel";
import { TranscriptionSegmentPulsePlaceholder } from "@/components/transcriptions/transcription-segment-pulse-placeholder";
import { TranscriptionProgressCard } from "@/components/transcriptions/transcription-progress-card";
import {
  trackTranscriptionCompleted,
  trackTranscriptionFailed,
  trackTranslationCompleted,
} from "@/lib/analytics/project";
import {
  SUMMARY_TEMPLATE_SELECT_CONTENT_CLASSNAME,
  SUMMARY_TEMPLATE_SELECT_ITEM_CLASSNAME,
  SUMMARY_TEMPLATE_SELECT_TRIGGER_CLASSNAME,
  TranscriptionSummaryEmptyState,
  TranscriptionSummaryGeneratingState,
  getSummaryActionButtonClassName,
} from "@/components/transcriptions/transcription-summary-panel";

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

type TranslationActionState =
  | "not_created"
  | "processing"
  | "fresh_completed"
  | "stale_completed"
  | "failed";

type StreamEventPayload = {
  type?: "snapshot" | "update" | "heartbeat";
  task?: TranscriptionJobClientData;
  aiArtifacts?: TranscriptionAiArtifactCollectionClientData;
  translations?: TranscriptionTranslationCollectionClientData;
  completedTranslation?: TranscriptionTranslationClientData | null;
};

type PlaybackUrlResponse = {
  url: string;
  expiresIn: number;
};

type SubmitTranscriptionFeedbackResponse = {
  saved: true;
};

type UpdateAiArtifactResponse = {
  artifactType: TranscriptionAiArtifactType;
  templateKey: "off" | "general";
  queued: boolean;
  aiArtifacts: TranscriptionAiArtifactCollectionClientData;
};

function isApiSuccess<T>(
  payload: ApiSuccessResponse<T> | ApiErrorResponse | null
): payload is ApiSuccessResponse<T> {
  return Boolean(payload?.success);
}

function isTerminalStatus(status: TranscriptionJobClientData["status"]): boolean {
  return status === "succeeded" || status === "failed";
}

function isFailedTranscriptionTask(task: TranscriptionJobClientData | null): boolean {
  return Boolean(task && (task.status === "failed" || task.stage === "failed"));
}

function isCompletedTranscriptionTask(task: TranscriptionJobClientData | null): boolean {
  return Boolean(task && task.status === "succeeded" && task.stage === "completed");
}

const EMPTY_AI_ARTIFACTS: TranscriptionAiArtifactCollectionClientData = {
  summary: null,
  mind_map: null,
};

const EMPTY_TRANSLATIONS: TranscriptionTranslationCollectionClientData = {};

type PendingArtifactGenerationState = Record<TranscriptionAiArtifactType, boolean>;

const EMPTY_PENDING_ARTIFACT_GENERATION_STATE: PendingArtifactGenerationState = {
  summary: false,
  mind_map: false,
};

function shouldWaitForSummaryArtifact(
  task: TranscriptionJobClientData | null,
  aiArtifacts: TranscriptionAiArtifactCollectionClientData,
  pendingArtifacts: PendingArtifactGenerationState
): boolean {
  if (!isCompletedTranscriptionTask(task)) {
    return false;
  }

  if (aiArtifacts.summary?.status === "processing" || pendingArtifacts.summary) {
    return true;
  }

  return task.summaryTemplateKey === "general" && !aiArtifacts.summary;
}

function shouldWaitForMindMapArtifact(
  task: TranscriptionJobClientData | null,
  aiArtifacts: TranscriptionAiArtifactCollectionClientData,
  pendingArtifacts: PendingArtifactGenerationState
): boolean {
  if (!isCompletedTranscriptionTask(task)) {
    return false;
  }

  if (aiArtifacts.mind_map?.status === "processing" || pendingArtifacts.mind_map) {
    return true;
  }

  return task.mindMapTemplateKey === "general" && !aiArtifacts.mind_map;
}

function shouldWaitForTranslations(
  task: TranscriptionJobClientData | null,
  translations: TranscriptionTranslationCollectionClientData
): boolean {
  if (!isCompletedTranscriptionTask(task)) {
    return false;
  }

  return Object.values(translations).some(
    (translation) => translation.status === "processing"
  );
}

function shouldKeepRealtimeSync(
  task: TranscriptionJobClientData | null,
  aiArtifacts: TranscriptionAiArtifactCollectionClientData,
  pendingArtifacts: PendingArtifactGenerationState,
  translations: TranscriptionTranslationCollectionClientData
): boolean {
  if (!task) {
    return false;
  }

  if (!isTerminalStatus(task.status)) {
    return true;
  }

  return (
    shouldWaitForSummaryArtifact(task, aiArtifacts, pendingArtifacts) ||
    shouldWaitForMindMapArtifact(task, aiArtifacts, pendingArtifacts) ||
    shouldWaitForTranslations(task, translations)
  );
}

function createProcessingAiArtifact(
  artifactType: TranscriptionAiArtifactType,
  current: TranscriptionAiArtifactClientData | null,
  task: TranscriptionJobClientData | null
): TranscriptionAiArtifactClientData {
  return {
    artifactType,
    templateKey: "general",
    status: "processing",
    sourceDisplayVersion: task?.displayVersion ?? current?.sourceDisplayVersion ?? 1,
    summary: artifactType === "summary" ? null : current?.summary ?? null,
    mindMap: artifactType === "mind_map" ? null : current?.mindMap ?? null,
    errorMessage: null,
    generatedAt: current?.generatedAt ?? null,
    updatedAt: new Date().toISOString(),
    isStale: false,
  };
}

function getTranslationActionState(
  translation: TranscriptionTranslationClientData | null,
  isTranslating: boolean
): TranslationActionState {
  if (isTranslating || translation?.status === "processing") {
    return "processing";
  }

  if (!translation) {
    return "not_created";
  }

  if (translation.status === "failed") {
    return "failed";
  }

  if (translation.status === "completed") {
    return translation.isStale ? "stale_completed" : "fresh_completed";
  }

  return "not_created";
}

function hasCompletedTranslationSegments(
  translation: TranscriptionTranslationClientData | null | undefined
): boolean {
  return translation?.status === "completed" && Boolean(translation.segments?.length);
}

function normalizeLanguageCode(language: string | null | undefined): string | null {
  if (!language) {
    return null;
  }

  const normalized = language.trim().toLowerCase().replace(/_/g, "-");
  return normalized ? normalized.split("-")[0] : null;
}

function isAwaitingTranslationContent(input: {
  translationDisplayMode: TranslationDisplayMode;
  targetLanguage: string;
  pendingTranslationLanguage: string | null;
  selectedTranslation: TranscriptionTranslationClientData | null;
  isTranslationInProgress: boolean;
}): boolean {
  if (input.translationDisplayMode !== "translation") {
    return false;
  }

  const isPendingTarget =
    input.pendingTranslationLanguage === input.targetLanguage ||
    input.isTranslationInProgress;

  if (!isPendingTarget) {
    return false;
  }

  return !hasCompletedTranslationSegments(input.selectedTranslation);
}

function mergeTranslationCollection(
  current: TranscriptionTranslationCollectionClientData,
  incoming: TranscriptionTranslationCollectionClientData,
  completedTranslation?: TranscriptionTranslationClientData | null
): TranscriptionTranslationCollectionClientData {
  const next: TranscriptionTranslationCollectionClientData = { ...current };

  for (const [language, incomingTranslation] of Object.entries(incoming)) {
    const existingTranslation = next[language];

    next[language] =
      existingTranslation?.segments?.length &&
      !incomingTranslation.segments?.length &&
      existingTranslation.updatedAt >= incomingTranslation.updatedAt
        ? existingTranslation
        : incomingTranslation;
  }

  if (completedTranslation) {
    next[completedTranslation.targetLanguage] = completedTranslation;
  }

  return next;
}

function isReusableSummaryArtifact(
  artifact: TranscriptionAiArtifactClientData | null | undefined
): boolean {
  return (
    artifact?.status === "completed" &&
    Boolean(artifact.summary) &&
    !artifact.isStale
  );
}

type ProgressStageConfig = {
  anchor: number;
  softCap: number;
};

const MINIMUM_TRANSCRIPTION_ESTIMATE_MS = 15_000;
const TRANSCRIPTION_MS_PER_MEDIA_MINUTE = 2_000;
const TRANSCRIPTION_PROGRESS_START = 30;
const TRANSCRIPTION_PROGRESS_AT_ESTIMATE = 84;
const TRANSCRIPTION_PROGRESS_AT_EXTENDED_ESTIMATE = 92;
const TRANSCRIPTION_PROGRESS_SOFT_CAP = 96;
const RESULT_RECOVERY_MIN_DELAY_MS = 45_000;
const RESULT_RECOVERY_MAX_DELAY_MS = 10 * 60_000;
const RESULT_RECOVERY_COOLDOWN_MS = 8_000;

function getTranscriptionEstimateMs(task: TranscriptionJobClientData): number {
  const mediaDurationMs = task.processedDurationMs ?? task.sourceDurationMs ?? 0;
  return Math.max(
    MINIMUM_TRANSCRIPTION_ESTIMATE_MS,
    (mediaDurationMs / 60_000) * TRANSCRIPTION_MS_PER_MEDIA_MINUTE
  );
}

function getResultRecoveryDelayMs(task: TranscriptionJobClientData): number {
  return Math.min(
    RESULT_RECOVERY_MAX_DELAY_MS,
    Math.max(RESULT_RECOVERY_MIN_DELAY_MS, getTranscriptionEstimateMs(task) * 1.25)
  );
}

function shouldShowResultRecovery(task: TranscriptionJobClientData | null, nowMs: number): boolean {
  if (!task || task.status !== "transcribing" || task.stage !== "waiting_result") {
    return false;
  }

  const stageStartedAtMs = Date.parse(task.updatedAt);
  if (!Number.isFinite(stageStartedAtMs)) {
    return false;
  }

  return nowMs - stageStartedAtMs >= getResultRecoveryDelayMs(task);
}

function getWaitingResultProgressTarget(
  task: TranscriptionJobClientData,
  nowMs: number
): number {
  const stageStartedAtMs = Date.parse(task.updatedAt);
  const elapsedMs = Number.isFinite(stageStartedAtMs)
    ? Math.max(0, nowMs - stageStartedAtMs)
    : 0;
  const estimatedMs = getTranscriptionEstimateMs(task);

  if (elapsedMs <= estimatedMs) {
    return (
      TRANSCRIPTION_PROGRESS_START +
      ((TRANSCRIPTION_PROGRESS_AT_ESTIMATE - TRANSCRIPTION_PROGRESS_START) * elapsedMs) /
        estimatedMs
    );
  }

  if (elapsedMs <= estimatedMs * 1.5) {
    return (
      TRANSCRIPTION_PROGRESS_AT_ESTIMATE +
      ((TRANSCRIPTION_PROGRESS_AT_EXTENDED_ESTIMATE - TRANSCRIPTION_PROGRESS_AT_ESTIMATE) *
        (elapsedMs - estimatedMs)) /
        (estimatedMs * 0.5)
    );
  }

  return (
    TRANSCRIPTION_PROGRESS_AT_EXTENDED_ESTIMATE +
    (TRANSCRIPTION_PROGRESS_SOFT_CAP - TRANSCRIPTION_PROGRESS_AT_EXTENDED_ESTIMATE) *
      (1 - Math.exp(-(elapsedMs - estimatedMs * 1.5) / estimatedMs))
  );
}

function getProgressStageConfig(
  task: TranscriptionJobClientData | null
): ProgressStageConfig {
  if (!task) {
    return { anchor: 0, softCap: 0 };
  }

  if (task.status === "succeeded" || task.stage === "completed") {
    return { anchor: 100, softCap: 100 };
  }

  if (task.status === "failed" || task.stage === "failed") {
    return { anchor: 50, softCap: 50 };
  }

  switch (task.stage) {
    case "queued":
      return { anchor: 4, softCap: 16 };
    case "extracting_audio":
      return { anchor: 16, softCap: 25 };
    case "audio_extracted":
      return { anchor: 25, softCap: 28 };
    case "submitting_model":
      return { anchor: 28, softCap: TRANSCRIPTION_PROGRESS_START };
    case "waiting_result":
      return { anchor: TRANSCRIPTION_PROGRESS_START, softCap: TRANSCRIPTION_PROGRESS_SOFT_CAP };
    default:
      return task.status === "preprocessing"
        ? { anchor: 16, softCap: 25 }
        : { anchor: TRANSCRIPTION_PROGRESS_START, softCap: TRANSCRIPTION_PROGRESS_SOFT_CAP };
  }
}

function getProgressLabel(
  task: TranscriptionJobClientData | null,
  statusDict: TranscriptionsPageDictionary["status"]
): string {
  if (!task) {
    return statusDict.preparingFile;
  }

  switch (task.stage) {
    case "queued":
    case "importing_media":
    case "uploading_source":
    case "extracting_audio":
    case "audio_extracted":
    case "submitting_model":
      return statusDict.preparingFile;
    case "waiting_result":
      return statusDict.transcribing;
    default:
      return statusDict.transcribing;
  }
}

function formatDuration(durationMs: number | null, fallback: string): string {
  if (!durationMs || durationMs <= 0) {
    return fallback;
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatHumanReadableDuration(
  durationMs: number | null,
  fallback: string
): string {
  if (!durationMs || durationMs <= 0) {
    return fallback;
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hr`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} sec`);
  }

  return parts.join(" ");
}

function formatTranscriptTimestamp(
  startMs: number | null,
  fallback: string
): string {
  if (!startMs || startMs < 0) {
    return fallback;
  }

  const totalSeconds = Math.max(0, Math.floor(startMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return [minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatSpeakerCount(value: number | null, fallback: string): string {
  if (!value || value <= 0) {
    return fallback;
  }

  return String(value);
}

const ICON_BUTTON_INTERACTION_CLASSNAME =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary active:bg-slate-100 active:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const SECONDARY_ICON_BUTTON_CLASSNAME = cn(ICON_BUTTON_INTERACTION_CLASSNAME, "size-9 xl:size-7");

const PLAYBACK_SECONDARY_BUTTON_CLASSNAME =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-primary active:bg-slate-200 active:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const PLAYBACK_PRIMARY_BUTTON_CLASSNAME =
  "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md transition-[color,transform] duration-150 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

const PLAYBACK_SPEED_BUTTON_CLASSNAME =
  "inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md px-2 font-mono text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-primary active:bg-slate-200 active:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const PLAYBACK_TIME_LABEL_CLASSNAME =
  "shrink-0 font-mono text-sm font-normal tabular-nums tracking-tight text-slate-500";

const PLAYBACK_SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

function formatPlaybackSpeed(speed: number): string {
  return speed === 1 ? "1x" : `${speed}x`;
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is unavailable");
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command failed");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

function buildSummaryCopyText(
  summary: TranscriptionAiSummaryData,
  dict: TranscriptionsPageDictionary["summaryPanel"]
): string {
  const sections = [
    `${dict.content.overview}\n${summary.overview}`,
    `${dict.content.keyPoints}\n${summary.keyPoints.map((item) => `- ${item.text}`).join("\n")}`,
    `${dict.content.takeaways}\n${summary.takeaways.map((item) => `- ${item.text}`).join("\n")}`,
  ];

  return sections.join("\n\n").trim();
}


export function TranscriptionResultPage({ publicId }: { publicId: string }) {
  const { locale, dictionary } = useLocale();
  const dashboardUrl = buildDashboardUrl(locale);
  const { data: bootstrap } = useUserBootstrap();
  const isAuthenticated = bootstrap?.authenticated ?? false;
  const {
    containerRef: workspaceSplitRef,
    summaryWidth,
    isResizing: isSummaryPanelResizing,
    handlePointerDown: handleSummaryResizePointerDown,
    handlePointerMove: handleSummaryResizePointerMove,
    handlePointerUp: handleSummaryResizePointerUp,
    handleDoubleClick: handleSummaryResizeDoubleClick,
  } = useSummaryPanelWidth();
  const pageDict = dictionary.pages.transcriptions;
  const brandIdentity = dictionary.component.layout.header.brand.identity;
  const summaryPanelDict = pageDict.summaryPanel;
  const sidebarDict = pageDict.sidebar;
  const [task, setTask] = useState<TranscriptionJobClientData | null>(null);
  const [aiArtifacts, setAiArtifacts] = useState<TranscriptionAiArtifactCollectionClientData>(
    EMPTY_AI_ARTIFACTS
  );
  const [translations, setTranslations] =
    useState<TranscriptionTranslationCollectionClientData>(EMPTY_TRANSLATIONS);
  const [translationDisplayMode, setTranslationDisplayMode] =
    useState<TranslationDisplayMode>("translation");
  const [displayedTranslationLanguage, setDisplayedTranslationLanguage] =
    useState<string | null>(null);
  const [pendingTranslationLanguage, setPendingTranslationLanguage] =
    useState<string | null>(null);
  const [translationContentLoadFailures, setTranslationContentLoadFailures] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [isCheckingForResult, setIsCheckingForResult] = useState(false);
  const [resultRecoveryMessage, setResultRecoveryMessage] = useState<string | null>(null);
  const [hasCheckedResultOnce, setHasCheckedResultOnce] = useState(false);
  const [isResultRecoveryCoolingDown, setIsResultRecoveryCoolingDown] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRecoveryCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectToStreamRef = useRef<((isReconnect: boolean) => Promise<void>) | null>(null);
  const isDisposedRef = useRef(false);
  const taskRef = useRef<TranscriptionJobClientData | null>(null);
  const trackedTerminalStatusRef = useRef<"succeeded" | "failed" | null>(null);
  const aiArtifactsRef = useRef<TranscriptionAiArtifactCollectionClientData>(EMPTY_AI_ARTIFACTS);
  const translationsRef = useRef<TranscriptionTranslationCollectionClientData>(EMPTY_TRANSLATIONS);
  const previousTranslationsSnapshotRef =
    useRef<TranscriptionTranslationCollectionClientData | null>(null);
  const translationDetailLoadingLanguagesRef = useRef<Set<string>>(new Set());
  const translationDetailRequestIdsRef = useRef<Map<string, number>>(new Map());
  const pendingArtifactsRef = useRef<PendingArtifactGenerationState>(
    EMPTY_PENDING_ARTIFACT_GENERATION_STATE
  );
  const summaryTemplateSelectTriggerRef = useRef<HTMLButtonElement>(null);

  const [activeTab, setActiveTab] = useState<"summary" | "mindmap">("summary");
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<WorkspacePanel>("transcript");
  const [pendingArtifactGeneration, setPendingArtifactGeneration] =
    useState<PendingArtifactGenerationState>(EMPTY_PENDING_ARTIFACT_GENERATION_STATE);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editBaseline, setEditBaseline] = useState("");
  const [segmentTextOverrides, setSegmentTextOverrides] = useState<Record<string, string>>(
    {}
  );
  const segmentEditDict = pageDict.segmentEdit;
  const speakerEditDialogDict = pageDict.speakerEditDialog;
  const searchReplaceDict = pageDict.searchReplace;
  const translationDict = pageDict.translation;
  const ratingFeedbackDict = pageDict.ratingFeedback;
  const exportDialogDict = pageDict.exportDialog;
  const renameDialogDict = pageDict.renameDialog;
  const [isRatingDismissed, setIsRatingDismissed] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [speakerEditTarget, setSpeakerEditTarget] = useState<{
    segmentId: string;
    speakerId: string;
    matchLabel: string;
  } | null>(null);
  const [isSpeakerRenaming, setIsSpeakerRenaming] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeedIndex, setPlaybackSpeedIndex] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isPlaybackUrlLoading, setIsPlaybackUrlLoading] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isUpdatingArtifact, setIsUpdatingArtifact] =
    useState<PendingArtifactGenerationState>(EMPTY_PENDING_ARTIFACT_GENERATION_STATE);
  const [displayProgress, setDisplayProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const upgradePlanCardRef = useRef<HTMLDivElement | null>(null);
  const playbackFooterRef = useRef<HTMLDivElement | null>(null);
  const pendingSeekSecRef = useRef<number | null>(null);
  const summaryArtifact = aiArtifacts.summary;
  const mindMapArtifact = aiArtifacts.mind_map;
  const isSummaryEnabled =
    task?.summaryTemplateKey === "general" || pendingArtifactGeneration.summary;
  const summaryData = summaryArtifact?.summary ?? null;
  const mindMapData = mindMapArtifact?.mindMap ?? null;
  const isSummaryGenerating =
    pendingArtifactGeneration.summary || summaryArtifact?.status === "processing";
  const isMindMapJobRunning =
    mindMapArtifact?.status === "processing" || pendingArtifactGeneration.mind_map;
  const isSummaryBusy = isUpdatingArtifact.summary || isSummaryGenerating;
  const isMindMapBusy = isUpdatingArtifact.mind_map || isMindMapJobRunning;
  const isTranscriptReady = isCompletedTranscriptionTask(task);
  const isSummaryAwaitingTranscript =
    !isTranscriptReady && task?.summaryTemplateKey === "general";
  const isMindMapAwaitingTranscript =
    !isTranscriptReady && task?.mindMapTemplateKey === "general";
  const shouldKeepStreamAlive = shouldKeepRealtimeSync(
    task,
    aiArtifacts,
    pendingArtifactGeneration,
    translations
  );
  const hasSummaryContent = Boolean(summaryData);
  const hasMindMapContent = Boolean(mindMapData);
  const canGenerateSummary = isTranscriptReady && !isSummaryBusy;
  const canChangeSummaryTemplate = isTranscriptReady && !isSummaryBusy;
  const canRefreshSummary =
    isSummaryEnabled && isTranscriptReady && !isSummaryBusy;
  const canCopySummary =
    isSummaryEnabled && isTranscriptReady && Boolean(summaryData) && !isSummaryBusy;
  const canGenerateMindMap = isTranscriptReady && !isMindMapBusy;
  const canRefreshMindMap = isTranscriptReady && !isMindMapBusy;
  const playbackDict = pageDict.playback;
  const playbackSpeed = PLAYBACK_SPEED_OPTIONS[playbackSpeedIndex];
  const progressValue = Math.round(displayProgress);
  const progressLabel = getProgressLabel(task, pageDict.status);
  const showResultRecovery = shouldShowResultRecovery(task, Date.now());
  const hasSegments = (task?.segments.length ?? 0) > 0;
  // Render the real workspace immediately while the initial detail snapshot is loading.
  const isProcessing = !task || !isTerminalStatus(task.status);
  const isFailedTask = isFailedTranscriptionTask(task);
  const showProgressBar = isProcessing && !hasSegments;
  const showTranscriptFailureState = isFailedTask && !hasSegments;
  const showTranscriptToolbar = hasSegments;
  const showBottomPlayback = hasSegments;
  const showScrollJumpButton = showTranscriptToolbar;
  const isTruncatedByFreeLimit = showBottomPlayback && Boolean(task?.wasDurationTrimmed);
  const hasActiveSubscription = Boolean(bootstrap?.subscription);
  const showUpgradePlanCard = isTruncatedByFreeLimit && !hasActiveSubscription;
  const isUpgradePlanCardVisible = useUpgradePlanCardVisibility(
    showUpgradePlanCard,
    transcriptScrollRef,
    upgradePlanCardRef
  );
  const showPlaybackUpgradeStrip =
    showUpgradePlanCard && !isUpgradePlanCardVisible;
  const truncatedDurationLabel = formatHumanReadableDuration(
    task?.durationMs ?? null,
    pageDict.content.unknownValue
  );
  const originalDurationLabel = formatHumanReadableDuration(
    task?.sourceDurationMs ?? null,
    pageDict.content.unknownValue
  );
  const hasEditedSegments = useMemo(
    () => hasEditedDisplaySegments(task?.segments ?? [], segmentTextOverrides),
    [segmentTextOverrides, task?.segments]
  );
  const {
    guestSidebarProps,
    openExportDialog,
    openShareDialog,
    openShareGateFromGuest,
    handleViewAllPlansFromUpgradeCard,
    upgradePanelProps,
    chromeDialogProps,
  } = useTranscriptionPageChrome({
    publicId,
    pageDict,
    dictionary,
    locale,
    bootstrap,
    truncatedDurationLabel,
    originalDurationLabel,
    hasEditedSegments,
  });
  const playbackProgressPercent =
    durationSec > 0 ? Math.min(100, Math.max(0, (currentTimeSec / durationSec) * 100)) : 0;
  const currentTimeLabel = formatDuration(Math.round(currentTimeSec * 1000), "00:00");

  const handleShareClick = useCallback(() => {
    if (isAuthenticated) {
      void openShareDialog();
      return;
    }

    openShareGateFromGuest();
  }, [isAuthenticated, openShareDialog, openShareGateFromGuest]);

  const handleWorkspacePanelChange = useCallback((panel: WorkspacePanel) => {
    setActiveWorkspacePanel(panel);
    if (panel === "summary") {
      setActiveTab("summary");
    }
    if (panel === "mindmap") {
      setActiveTab("mindmap");
    }
  }, []);

  const summaryTabStatus = isSummaryGenerating
    ? "processing"
    : hasSummaryContent
      ? "ready"
      : "idle";
  const mindMapTabStatus = isMindMapBusy
    ? "processing"
    : hasMindMapContent
      ? "ready"
      : "idle";
  const mobileWorkspaceDict = pageDict.mobileWorkspace;

  const handleScrollToUpgradePlanCard = useCallback(() => {
    const scrollRoot = transcriptScrollRef.current;
    if (!scrollRoot) {
      return;
    }

    const maxScroll = scrollRoot.scrollHeight - scrollRoot.clientHeight;
    scrollRoot.scrollTo({
      top: maxScroll,
      behavior: "smooth",
    });
  }, []);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const loadTask = useCallback(async (): Promise<TranscriptionReadResponse> => {
    const accessToken = getAnonymousTranscriptionAccessToken(publicId);
    const response = await apiFetch(`/api/transcriptions/${publicId}`, {
      cache: "no-store",
      headers: accessToken
        ? {
            "x-transcription-access-token": accessToken,
          }
        : undefined,
    });

    const payload = (await response.json().catch(() => null)) as
      | ApiSuccessResponse<TranscriptionReadResponse>
      | ApiErrorResponse
      | null;

    if (!response.ok || !isApiSuccess(payload)) {
      if (payload && !payload.success && payload.error.code === "FORBIDDEN") {
        throw new Error(pageDict.errors.loadFailed);
      }

      if (payload && !payload.success && payload.error.code === "INVALID_PARAMS") {
        throw new Error(pageDict.errors.notFound);
      }

      throw new Error(
        payload && !payload.success
          ? payload.error.message
          : pageDict.errors.loadFailed
      );
    }

    const serverTask = payload.data.task;
    const serverAiArtifacts = payload.data.aiArtifacts ?? EMPTY_AI_ARTIFACTS;
    const localPending = pendingArtifactsRef.current;
    const preserveSummaryGeneration =
      localPending.summary &&
      !serverAiArtifacts.summary;
    const preserveMindMapGeneration =
      localPending.mind_map &&
      !serverAiArtifacts.mind_map;

    setTask(
      preserveSummaryGeneration || preserveMindMapGeneration
        ? {
            ...serverTask,
            ...(preserveSummaryGeneration ? { summaryTemplateKey: "general" as const } : {}),
            ...(preserveMindMapGeneration ? { mindMapTemplateKey: "general" as const } : {}),
          }
        : serverTask
    );
    setAiArtifacts((current) => ({
      summary:
        preserveSummaryGeneration ? current.summary : serverAiArtifacts.summary,
      mind_map:
        preserveMindMapGeneration ? current.mind_map : serverAiArtifacts.mind_map,
    }));
    setTranslations((current) =>
      mergeTranslationCollection(current, payload.data.translations ?? EMPTY_TRANSLATIONS)
    );
    setPendingArtifactGeneration((current) => ({
      summary: preserveSummaryGeneration ? current.summary : false,
      mind_map: preserveMindMapGeneration ? current.mind_map : false,
    }));
    setErrorMessage(null);
    return payload.data;
  }, [pageDict.errors.loadFailed, pageDict.errors.notFound, publicId]);

  const handleCheckForResult = useCallback(async () => {
    if (isCheckingForResult || isResultRecoveryCoolingDown) {
      return;
    }

    setIsCheckingForResult(true);

    try {
      const latest = await loadTask();
      if (!isTerminalStatus(latest.task.status)) {
        setHasCheckedResultOnce(true);
        setResultRecoveryMessage(pageDict.resultRecovery.stillProcessing);
        setIsResultRecoveryCoolingDown(true);
        if (resultRecoveryCooldownTimerRef.current) {
          clearTimeout(resultRecoveryCooldownTimerRef.current);
        }
        resultRecoveryCooldownTimerRef.current = setTimeout(() => {
          resultRecoveryCooldownTimerRef.current = null;
          setIsResultRecoveryCoolingDown(false);
        }, RESULT_RECOVERY_COOLDOWN_MS);
      }
    } catch {
      // loadTask already provides the normal page-level error state for recoverable failures.
    } finally {
      setIsCheckingForResult(false);
    }
  }, [isCheckingForResult, isResultRecoveryCoolingDown, loadTask, pageDict.resultRecovery.stillProcessing]);

  useEffect(() => {
    if (showResultRecovery) {
      return;
    }

    setResultRecoveryMessage(null);
    setHasCheckedResultOnce(false);
    setIsResultRecoveryCoolingDown(false);
    if (resultRecoveryCooldownTimerRef.current) {
      clearTimeout(resultRecoveryCooldownTimerRef.current);
      resultRecoveryCooldownTimerRef.current = null;
    }
  }, [showResultRecovery]);

  useEffect(() => {
    return () => {
      if (resultRecoveryCooldownTimerRef.current) {
        clearTimeout(resultRecoveryCooldownTimerRef.current);
      }
    };
  }, []);

  const getPlaybackHeaders = useCallback(() => {
    const accessToken = getAnonymousTranscriptionAccessToken(publicId);
    return accessToken
      ? {
          "x-transcription-access-token": accessToken,
        }
      : undefined;
  }, [publicId]);

  const getTranscriptionAuthHeaders = useCallback(() => {
    const accessToken = getAnonymousTranscriptionAccessToken(publicId);
    return accessToken
      ? {
          "x-transcription-access-token": accessToken,
        }
      : undefined;
  }, [publicId]);

  const applyCompletedTranslation = useCallback(
    (translation: TranscriptionTranslationClientData) => {
      if (!hasCompletedTranslationSegments(translation)) {
        return;
      }

      translationDetailLoadingLanguagesRef.current.delete(translation.targetLanguage);
      translationDetailRequestIdsRef.current.set(
        translation.targetLanguage,
        (translationDetailRequestIdsRef.current.get(translation.targetLanguage) ?? 0) + 1
      );

      setTranslations((current) =>
        mergeTranslationCollection(current, EMPTY_TRANSLATIONS, translation)
      );
      setTranslationContentLoadFailures((current) => {
        if (!current[translation.targetLanguage]) {
          return current;
        }

        const next = { ...current };
        delete next[translation.targetLanguage];
        return next;
      });
      setPendingTranslationLanguage((current) =>
        current === translation.targetLanguage ? null : current
      );
      setTranslationDisplayMode("translation");
      trackTranslationCompleted({
        targetLanguage: translation.targetLanguage,
        isAuthenticated,
        dedupeKey: `translation_completed:${publicId}:${translation.targetLanguage}`,
      });
    },
    [isAuthenticated, publicId]
  );

  useEffect(() => {
    if (!task || (task.status !== "succeeded" && task.status !== "failed")) {
      return;
    }
    if (trackedTerminalStatusRef.current === task.status) {
      return;
    }

    trackedTerminalStatusRef.current = task.status;
    if (task.status === "succeeded") {
      trackTranscriptionCompleted({
        sourceType: task.sourceType,
        durationMs: task.processedDurationMs ?? task.sourceDurationMs,
        isAuthenticated,
        dedupeKey: `transcription_completed:${task.publicId}`,
      });
      return;
    }

    trackTranscriptionFailed({
      sourceType: task.sourceType,
      failureStage: task.stage,
      isAuthenticated,
      dedupeKey: `transcription_failed:${task.publicId}`,
    });
  }, [isAuthenticated, task]);

  const handleRenameDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isRenaming) {
        return;
      }

      setIsRenameDialogOpen(open);
    },
    [isRenaming]
  );

  const handleRenameTranscription = useCallback(
    async (displayTitle: string) => {
      setIsRenaming(true);

      try {
        const result = await renameTranscriptionDisplayTitleRequest({
          publicId,
          displayTitle,
          headers: getTranscriptionAuthHeaders(),
          fallbackErrorMessage: renameDialogDict.saveError,
        });

        setTask((current) =>
          current ? { ...current, displayTitle: result.displayTitle } : current
        );
        setIsRenameDialogOpen(false);
        toast.success(renameDialogDict.saveSuccess, toastConfirmOptions);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : renameDialogDict.saveError,
          toastErrorOptions
        );
      } finally {
        setIsRenaming(false);
      }
    },
    [
      getTranscriptionAuthHeaders,
      publicId,
      renameDialogDict.saveError,
      renameDialogDict.saveSuccess,
    ]
  );

  const loadTranslationDetail = useCallback(
    async (language: string) => {
      const requestId = (translationDetailRequestIdsRef.current.get(language) ?? 0) + 1;
      translationDetailRequestIdsRef.current.set(language, requestId);
      translationDetailLoadingLanguagesRef.current.add(language);

      try {
        const response = await apiFetch(`/api/transcriptions/${publicId}/translations/${language}`, {
          cache: "no-store",
          headers: getTranscriptionAuthHeaders(),
        });
        const payload = (await response.json().catch(() => null)) as
          | ApiSuccessResponse<{ translation: TranscriptionTranslationClientData }>
          | ApiErrorResponse
          | null;

        if (!response.ok || !isApiSuccess(payload)) {
          throw new Error(
            payload && !payload.success
              ? payload.error.message
              : translationDict.toasts.loadError
          );
        }

        if (!hasCompletedTranslationSegments(payload.data.translation)) {
          throw new Error(translationDict.toasts.loadError);
        }

        if (translationDetailRequestIdsRef.current.get(language) !== requestId) {
          return;
        }

        applyCompletedTranslation(payload.data.translation);
      } catch (error) {
        if (translationDetailRequestIdsRef.current.get(language) === requestId) {
          setTranslationContentLoadFailures((current) => ({
            ...current,
            [language]: true,
          }));
          setPendingTranslationLanguage((current) =>
            current === language ? null : current
          );
        }

        throw error;
      } finally {
        if (translationDetailRequestIdsRef.current.get(language) === requestId) {
          translationDetailLoadingLanguagesRef.current.delete(language);
        }
      }
    },
    [applyCompletedTranslation, getTranscriptionAuthHeaders, publicId, translationDict.toasts.loadError]
  );

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    aiArtifactsRef.current = aiArtifacts;
  }, [aiArtifacts]);

  useEffect(() => {
    translationsRef.current = translations;
  }, [translations]);

  useEffect(() => {
    const previousTranslations = previousTranslationsSnapshotRef.current;

    if (!previousTranslations) {
      previousTranslationsSnapshotRef.current = translations;
      return;
    }

    for (const [language, translation] of Object.entries(translations)) {
      const previousTranslation = previousTranslations[language];
      if (
        previousTranslation?.status === "processing" &&
        translation.status === "failed"
      ) {
        toast.error(translationDict.toasts.failed, toastErrorOptions);
        break;
      }
    }

    previousTranslationsSnapshotRef.current = translations;
  }, [translationDict.toasts.failed, translations]);

  useEffect(() => {
    pendingArtifactsRef.current = pendingArtifactGeneration;
  }, [pendingArtifactGeneration]);

  useEffect(() => {
    if (!task) {
      setDisplayProgress(0);
      return;
    }

    const { anchor, softCap } = getProgressStageConfig(task);

    if (task.status === "succeeded" || task.stage === "completed") {
      setDisplayProgress((current) => Math.max(current, 100));
      return;
    }

    if (task.status === "failed" || task.stage === "failed") {
      setDisplayProgress((current) => Math.max(current, anchor));
      return;
    }

    setDisplayProgress((current) => {
      if (current < anchor) {
        return anchor;
      }
      return current;
    });

    const timer = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (task.stage === "waiting_result") {
          const target = getWaitingResultProgressTarget(task, Date.now());
          return Math.max(current, Math.min(TRANSCRIPTION_PROGRESS_SOFT_CAP, target));
        }

        const base = Math.max(current, anchor);
        if (base >= softCap) {
          return base;
        }

        const remaining = softCap - base;
        const step =
          remaining > 20
            ? 1.2
            : remaining > 10
              ? 0.8
              : remaining > 4
                ? 0.45
                : 0.2;

        return Math.min(softCap, base + step);
      });
    }, task.stage === "waiting_result" ? 500 : 180);

    return () => {
      window.clearInterval(timer);
    };
  }, [task]);

  const submitTranscriptionFeedback = useCallback(
    async (rating: number, feedbackText: string) => {
      const response = await apiFetch(`/api/transcriptions/${publicId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getTranscriptionAuthHeaders() ?? {}),
        },
        body: JSON.stringify({
          rating,
          feedbackText,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse<SubmitTranscriptionFeedbackResponse>
        | ApiErrorResponse
        | null;

      if (!response.ok || !isApiSuccess(payload)) {
        throw new Error(
          payload && !payload.success
            ? payload.error.message
            : ratingFeedbackDict.submitError
        );
      }
    },
    [getTranscriptionAuthHeaders, publicId, ratingFeedbackDict.submitError]
  );

  const updateAiArtifact = useCallback(
    async (
      artifactType: TranscriptionAiArtifactType,
      options: {
        templateKey?: "off" | "general";
        force?: boolean;
      } = {}
    ) => {
      const templateKey = options.templateKey ?? "general";
      const isAlreadyEnabled =
        artifactType === "summary"
          ? task?.summaryTemplateKey === templateKey
          : task?.mindMapTemplateKey === "general";
      const currentArtifact =
        artifactType === "summary" ? aiArtifacts.summary : aiArtifacts.mind_map;

      if (
        isAlreadyEnabled &&
        !options.force &&
        (templateKey === "off" ||
          (currentArtifact &&
            currentArtifact.status === "completed" &&
            !currentArtifact.isStale))
      ) {
        setPendingArtifactGeneration((current) => ({
          ...current,
          [artifactType]: false,
        }));
        return;
      }

      const response = await apiFetch(`/api/transcriptions/${publicId}/ai-artifact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getTranscriptionAuthHeaders() ?? {}),
        },
        body: JSON.stringify({
          artifactType,
          templateKey,
          force: options.force ?? false,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse<UpdateAiArtifactResponse>
        | ApiErrorResponse
        | null;

      if (!response.ok || !isApiSuccess(payload)) {
        throw new Error(
          payload && !payload.success
            ? payload.error.message
            : summaryPanelDict.actions.updateError
        );
      }

      setTask((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          ...(artifactType === "summary"
            ? { summaryTemplateKey: templateKey }
            : { mindMapTemplateKey: "general" as const }),
        };
      });

      const shouldPreserveLocalProcessingState =
        templateKey === "general" &&
        payload.data.queued;

      if (!shouldPreserveLocalProcessingState) {
        setAiArtifacts(payload.data.aiArtifacts ?? EMPTY_AI_ARTIFACTS);
        setPendingArtifactGeneration((current) => ({
          ...current,
          [artifactType]: false,
        }));
      }
    },
    [
      aiArtifacts.mind_map,
      aiArtifacts.summary,
      getTranscriptionAuthHeaders,
      publicId,
      summaryPanelDict.actions.updateError,
      task,
    ]
  );

  const ensurePlaybackUrl = useCallback(async () => {
    if (playbackUrl) {
      return playbackUrl;
    }

    setIsPlaybackUrlLoading(true);

    try {
      const response = await apiFetch(`/api/transcriptions/${publicId}/playback-url`, {
        cache: "no-store",
        headers: getPlaybackHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse<PlaybackUrlResponse>
        | ApiErrorResponse
        | null;

      if (!response.ok || !isApiSuccess(payload)) {
        throw new Error(
          payload && !payload.success
            ? payload.error.message
            : "Failed to load playback source"
        );
      }

      setPlaybackUrl(payload.data.url);
      return payload.data.url;
    } finally {
      setIsPlaybackUrlLoading(false);
    }
  }, [getPlaybackHeaders, playbackUrl, publicId]);

  const playFromSecond = useCallback(
    async (startSecond: number, nextActiveSegmentId: string | null) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      const url = await ensurePlaybackUrl();

      if (!audio.src || audio.src !== url) {
        pendingSeekSecRef.current = startSecond;
        audio.src = url;
        audio.load();
      } else {
        audio.currentTime = startSecond;
      }

      await audio.play();
      setIsPlaying(true);
      setActiveSegmentId(nextActiveSegmentId);
    },
    [ensurePlaybackUrl]
  );

  const handlePlaySegment = useCallback(
    async (segment: TranscriptionDisplaySegment) => {
      await playFromSecond(segment.startMs / 1000, segment.id);
    },
    [playFromSecond]
  );

  const handleTogglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      if (!audio.src) {
        const firstSegment = task?.segments[0];
        await playFromSecond(
          firstSegment ? firstSegment.startMs / 1000 : 0,
          firstSegment?.id ?? null
        );
        return;
      }

      await audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }, [playFromSecond, task?.segments]);

  const handleSeekRelative = useCallback((offsetSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const maxDuration = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
    const nextTime = Math.max(0, Math.min(maxDuration, audio.currentTime + offsetSeconds));
    audio.currentTime = nextTime;
  }, []);

  const handleSeekToPercent = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }

    const clampedPercent = Math.min(100, Math.max(0, percent));
    audio.currentTime = (clampedPercent / 100) * audio.duration;
  }, []);

  const handleVolumeChange = useCallback((nextVolume: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = Math.max(0, Math.min(1, nextVolume / 100));
  }, []);

  const handleCopyTranscript = useCallback(async () => {
    const transcriptText =
      task?.displayFullText?.trim() ||
      task?.segments.map((segment) => segment.text.trim()).filter(Boolean).join("\n\n") ||
      "";

    if (!transcriptText) {
      toast.error("Unable to copy. Please try again.", toastErrorOptions);
      return;
    }

    try {
      await copyTextToClipboard(transcriptText);
      toast.success("Transcript copied", toastConfirmOptions);
    } catch {
      toast.error("Unable to copy. Please try again.", toastErrorOptions);
    }
  }, [task?.displayFullText, task?.segments]);

  const handleGenerateSummary = useCallback(async () => {
    if (!isCompletedTranscriptionTask(task) || isSummaryBusy) {
      return;
    }

    const previousTemplateKey = task?.summaryTemplateKey ?? "off";
    const reusableSummary = isReusableSummaryArtifact(aiArtifacts.summary);

    setTask((current) =>
      current ? { ...current, summaryTemplateKey: "general" } : current
    );

    if (reusableSummary) {
      try {
        await updateAiArtifact("summary");
      } catch (error) {
        setTask((current) =>
          current ? { ...current, summaryTemplateKey: previousTemplateKey } : current
        );
        const errorMessage =
          error instanceof Error ? error.message : summaryPanelDict.actions.updateError;
        toast.error(errorMessage, toastErrorOptions);
      }
      return;
    }

    setPendingArtifactGeneration((current) => ({
      ...current,
      summary: true,
    }));
    setAiArtifacts((current) => ({
      ...current,
      summary: createProcessingAiArtifact("summary", current.summary, task),
    }));
    setIsUpdatingArtifact((current) => ({
      ...current,
      summary: true,
    }));

    try {
      await updateAiArtifact("summary");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : summaryPanelDict.actions.updateError;
      setTask((current) =>
        current ? { ...current, summaryTemplateKey: previousTemplateKey } : current
      );
      setAiArtifacts((current) => ({
        ...current,
        summary: {
          ...createProcessingAiArtifact("summary", current.summary, task),
          status: "failed",
          errorMessage,
        },
      }));
      setPendingArtifactGeneration((current) => ({
        ...current,
        summary: false,
      }));
      toast.error(errorMessage, toastErrorOptions);
    } finally {
      setIsUpdatingArtifact((current) => ({
        ...current,
        summary: false,
      }));
    }
  }, [
    aiArtifacts.summary,
    isSummaryBusy,
    summaryPanelDict.actions.updateError,
    task,
    updateAiArtifact,
  ]);

  const handleSummaryTemplateChange = useCallback(
    async (value: "off" | "general") => {
      if (!task || isSummaryBusy || task.summaryTemplateKey === value) {
        return;
      }

      if (value === "general" && !isCompletedTranscriptionTask(task)) {
        return;
      }

      if (value === "general") {
        await handleGenerateSummary();
        return;
      }

      setPendingArtifactGeneration((current) => ({
        ...current,
        summary: false,
      }));

      const previousTemplateKey = task.summaryTemplateKey;

      setTask((current) =>
        current ? { ...current, summaryTemplateKey: "off" } : current
      );

      try {
        await updateAiArtifact("summary", { templateKey: "off" });
      } catch (error) {
        setTask((current) =>
          current
            ? { ...current, summaryTemplateKey: previousTemplateKey }
            : current
        );
        const errorMessage =
          error instanceof Error ? error.message : summaryPanelDict.actions.updateError;
        toast.error(errorMessage, toastErrorOptions);
      }
    },
    [
      handleGenerateSummary,
      isSummaryBusy,
      summaryPanelDict.actions.updateError,
      task,
      updateAiArtifact,
    ]
  );

  const handleRefreshSummary = useCallback(async () => {
    if (!isCompletedTranscriptionTask(task) || isSummaryBusy) {
      return;
    }

    setPendingArtifactGeneration((current) => ({
      ...current,
      summary: true,
    }));
    setAiArtifacts((current) => ({
      ...current,
      summary: createProcessingAiArtifact("summary", current.summary, task),
    }));
    setIsUpdatingArtifact((current) => ({
      ...current,
      summary: true,
    }));

    try {
      await updateAiArtifact("summary", { force: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : summaryPanelDict.actions.updateError;
      setAiArtifacts((current) => ({
        ...current,
        summary: {
          ...createProcessingAiArtifact("summary", current.summary, task),
          status: "failed",
          errorMessage,
        },
      }));
      setPendingArtifactGeneration((current) => ({
        ...current,
        summary: false,
      }));
      toast.error(errorMessage, toastErrorOptions);
    } finally {
      setIsUpdatingArtifact((current) => ({
        ...current,
        summary: false,
      }));
    }
  }, [
    isSummaryBusy,
    summaryPanelDict.actions.updateError,
    task,
    updateAiArtifact,
  ]);

  const handleGenerateMindMap = useCallback(async () => {
    if (!isCompletedTranscriptionTask(task) || isMindMapBusy) {
      return;
    }

    setPendingArtifactGeneration((current) => ({
      ...current,
      mind_map: true,
    }));
    setAiArtifacts((current) => ({
      ...current,
      mind_map: createProcessingAiArtifact("mind_map", current.mind_map, task),
    }));
    setIsUpdatingArtifact((current) => ({
      ...current,
      mind_map: true,
    }));

    try {
      await updateAiArtifact("mind_map");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : summaryPanelDict.actions.updateError;
      setAiArtifacts((current) => ({
        ...current,
        mind_map: {
          ...createProcessingAiArtifact("mind_map", current.mind_map, task),
          status: "failed",
          errorMessage,
        },
      }));
      setPendingArtifactGeneration((current) => ({
        ...current,
        mind_map: false,
      }));
      toast.error(errorMessage, toastErrorOptions);
    } finally {
      setIsUpdatingArtifact((current) => ({
        ...current,
        mind_map: false,
      }));
    }
  }, [
    isMindMapBusy,
    publicId,
    summaryPanelDict.actions.updateError,
    task,
    updateAiArtifact,
  ]);

  const handleRefreshMindMap = useCallback(async () => {
    if (!isCompletedTranscriptionTask(task) || isMindMapBusy) {
      return;
    }

    setPendingArtifactGeneration((current) => ({
      ...current,
      mind_map: true,
    }));
    setAiArtifacts((current) => ({
      ...current,
      mind_map: createProcessingAiArtifact("mind_map", current.mind_map, task),
    }));
    setIsUpdatingArtifact((current) => ({
      ...current,
      mind_map: true,
    }));

    try {
      await updateAiArtifact("mind_map", { force: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : summaryPanelDict.actions.updateError;
      setAiArtifacts((current) => ({
        ...current,
        mind_map: {
          ...createProcessingAiArtifact("mind_map", current.mind_map, task),
          status: "failed",
          errorMessage,
        },
      }));
      setPendingArtifactGeneration((current) => ({
        ...current,
        mind_map: false,
      }));
      toast.error(errorMessage, toastErrorOptions);
    } finally {
      setIsUpdatingArtifact((current) => ({
        ...current,
        mind_map: false,
      }));
    }
  }, [isMindMapBusy, summaryPanelDict.actions.updateError, task, updateAiArtifact]);

  const handleCopySummary = useCallback(async () => {
    if (!summaryData) {
      toast.error(summaryPanelDict.actions.copyError, toastErrorOptions);
      return;
    }

    try {
      await copyTextToClipboard(buildSummaryCopyText(summaryData, summaryPanelDict));
      toast.success(summaryPanelDict.actions.copySuccess, toastConfirmOptions);
    } catch {
      toast.error(summaryPanelDict.actions.copyError, toastErrorOptions);
    }
  }, [summaryData, summaryPanelDict]);

  const cancelSegmentEdit = useCallback(() => {
    setEditingSegmentId(null);
    setEditDraft("");
    setEditBaseline("");
  }, []);

  const {
    isOpen: isTranslationOpen,
    setIsOpen: setIsTranslationOpen,
    targetLanguage,
    setTargetLanguage,
    isTranslating,
    closePanel: closeTranslationPanel,
    handleStartTranslation,
  } = useTranscriptionTranslation({
    publicId,
    getAuthHeaders: getTranscriptionAuthHeaders,
    onTranslationRequested: (translation) => {
      setTranslations((current) => ({
        ...current,
        [translation.targetLanguage]: translation,
      }));
      setTranslationContentLoadFailures((current) => {
        if (!current[translation.targetLanguage]) {
          return current;
        }

        const next = { ...current };
        delete next[translation.targetLanguage];
        return next;
      });
      setPendingTranslationLanguage(translation.targetLanguage);
      setTranslationDisplayMode("translation");
    },
    onTranslationError: (message) => {
      toast.error(message || translationDict.toasts.startError, toastErrorOptions);
    },
  });

  const displayedTranslation =
    displayedTranslationLanguage
      ? translations[displayedTranslationLanguage] ?? null
      : null;
  const selectedTranslation = targetLanguage ? translations[targetLanguage] ?? null : null;
  const translationActionState = getTranslationActionState(
    selectedTranslation,
    isTranslating
  );
  const isTranslationInProgress = translationActionState === "processing";
  const isAwaitingTranslation = isAwaitingTranslationContent({
    translationDisplayMode,
    targetLanguage,
    pendingTranslationLanguage,
    selectedTranslation,
    isTranslationInProgress,
  });
  const resolvedDisplayTranslation = useMemo(() => {
    if (hasCompletedTranslationSegments(displayedTranslation)) {
      return displayedTranslation;
    }

    if (
      translationDisplayMode === "translation" &&
      (pendingTranslationLanguage === targetLanguage ||
        displayedTranslationLanguage === targetLanguage) &&
      hasCompletedTranslationSegments(selectedTranslation)
    ) {
      return selectedTranslation;
    }

    return null;
  }, [
    displayedTranslation,
    displayedTranslationLanguage,
    pendingTranslationLanguage,
    selectedTranslation,
    targetLanguage,
    translationDisplayMode,
  ]);
  const translationSegmentTextById = useMemo(() => {
    if (!resolvedDisplayTranslation?.segments?.length) {
      return new Map<string, string>();
    }

    return new Map(
      resolvedDisplayTranslation.segments.map((segment) => [
        segment.sourceSegmentId,
        segment.textTranslated,
      ])
    );
  }, [resolvedDisplayTranslation]);
  const shouldShowTranslationDisplayMode =
    (translationActionState === "fresh_completed" ||
      translationActionState === "stale_completed") &&
    Boolean(resolvedDisplayTranslation?.segments?.length);

  const selectedTargetLanguageOption =
    TRANSLATION_TARGET_LANGUAGES.find((language) => language.id === targetLanguage) ??
    TRANSLATION_TARGET_LANGUAGES[0];
  const showTranslationProgressBanner =
    Boolean(task?.segments?.length) &&
    (isTranslationInProgress || isAwaitingTranslation);
  const showTranslationContentLoadFailure =
    Boolean(translationContentLoadFailures[targetLanguage]) &&
    selectedTranslation?.status === "completed" &&
    !hasCompletedTranslationSegments(selectedTranslation);

  const handleTargetLanguageChange = useCallback(
    (language: TranslationTargetLanguageId) => {
      setTargetLanguage(language);

      if (normalizeLanguageCode(task?.language) === normalizeLanguageCode(language)) {
        setDisplayedTranslationLanguage(null);
        setPendingTranslationLanguage(null);
        setTranslationDisplayMode("original");
        return;
      }

      const translation = translations[language];
      const hasReadySegments = hasCompletedTranslationSegments(translation);

      if (hasReadySegments) {
        setDisplayedTranslationLanguage(language);
        setPendingTranslationLanguage(null);
        setTranslationDisplayMode("translation");
        return;
      }

      if (translation?.status === "completed") {
        setTranslationDisplayMode("translation");

        if (!translationDetailLoadingLanguagesRef.current.has(language)) {
          void loadTranslationDetail(language).catch(() => {
            toast.error(translationDict.toasts.loadError, toastErrorOptions);
          });
        }
        return;
      }

      setPendingTranslationLanguage(null);
    },
    [loadTranslationDetail, setTargetLanguage, task?.language, translationDict.toasts.loadError, translations]
  );

  const shouldUseDisplayedTranslation =
    translationDisplayMode === "translation" &&
    Boolean(resolvedDisplayTranslation?.segments?.length) &&
    !isAwaitingTranslation;

  const getSegmentDisplayText = useCallback(
    (segment: TranscriptionDisplaySegment) => {
      if (shouldUseDisplayedTranslation && translationSegmentTextById.has(segment.id)) {
        return translationSegmentTextById.get(segment.id)!;
      }

      return segmentTextOverrides[segment.id] ?? segment.text;
    },
    [
      segmentTextOverrides,
      shouldUseDisplayedTranslation,
      translationSegmentTextById,
    ]
  );

  const canEditTranscriptSegments = !shouldUseDisplayedTranslation;

  const handleCopySegment = useCallback(
    async (segment: TranscriptionDisplaySegment) => {
      const segmentText = getSegmentDisplayText(segment).trim();

      if (!segmentText) {
        toast.error(segmentEditDict.toast.copyError, toastErrorOptions);
        return;
      }

      try {
        await copyTextToClipboard(segmentText);
        toast.success(segmentEditDict.toast.copySuccess, toastConfirmOptions);
      } catch {
        toast.error(segmentEditDict.toast.copyError, toastErrorOptions);
      }
    },
    [
      getSegmentDisplayText,
      segmentEditDict.toast.copyError,
      segmentEditDict.toast.copySuccess,
    ]
  );

  const persistSegmentText = useCallback(
    async (segmentId: string, text: string): Promise<boolean> => {
      try {
        const response = await apiFetch(
          `/api/transcriptions/${publicId}/display-segments/${segmentId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(getTranscriptionAuthHeaders() ?? {}),
            },
            body: JSON.stringify({ text }),
          }
        );
        const payload = (await response.json().catch(() => null)) as
          | ApiSuccessResponse<TranscriptionReadResponse>
          | ApiErrorResponse
          | null;

        if (!response.ok || !isApiSuccess(payload)) {
          toast.error(segmentEditDict.toast.saveError, toastErrorOptions);
          return false;
        }

        setTask(payload.data.task);
        setSegmentTextOverrides((current) => {
          const next = { ...current };
          delete next[segmentId];
          return next;
        });
        return true;
      } catch {
        toast.error(segmentEditDict.toast.saveError, toastErrorOptions);
        return false;
      }
    },
    [getTranscriptionAuthHeaders, publicId, segmentEditDict.toast.saveError]
  );

  const handleRequestSegmentEdit = useCallback(
    async (segment: TranscriptionDisplaySegment) => {
      if (!canEditTranscriptSegments) {
        return;
      }

      if (editingSegmentId === segment.id) {
        return;
      }

      if (editingSegmentId) {
        const trimmedDraft = editDraft.trim();
        const trimmedBaseline = editBaseline.trim();

        if (trimmedDraft !== trimmedBaseline) {
          const previousSegmentId = editingSegmentId;
          const saved = await persistSegmentText(previousSegmentId, trimmedDraft);
          if (!saved) {
            return;
          }
          toast.success(segmentEditDict.toast.switchAutoSave, toastConfirmOptions);
        }
      }

      const displayText = getSegmentDisplayText(segment);
      setEditingSegmentId(segment.id);
      setEditDraft(displayText);
      setEditBaseline(displayText);
      setActiveSegmentId(segment.id);
    },
    [
      canEditTranscriptSegments,
      editBaseline,
      editDraft,
      editingSegmentId,
      getSegmentDisplayText,
      persistSegmentText,
      segmentEditDict.toast.switchAutoSave,
    ]
  );

  const handleSaveSegmentEdit = useCallback(async () => {
    if (!editingSegmentId) {
      return;
    }

    const trimmedDraft = editDraft.trim();
    const trimmedBaseline = editBaseline.trim();

    if (trimmedDraft === trimmedBaseline) {
      cancelSegmentEdit();
      return;
    }

    const saved = await persistSegmentText(editingSegmentId, trimmedDraft);
    if (!saved) {
      return;
    }
    cancelSegmentEdit();
    toast.success(segmentEditDict.toast.saveSuccess, toastConfirmOptions);
  }, [
    cancelSegmentEdit,
    editBaseline,
    editDraft,
    editingSegmentId,
    persistSegmentText,
    segmentEditDict.toast.saveSuccess,
  ]);

  const flushPendingSegmentEdit = useCallback(async (): Promise<boolean> => {
    if (!editingSegmentId) {
      return true;
    }

    const trimmedDraft = editDraft.trim();
    const trimmedBaseline = editBaseline.trim();

    if (trimmedDraft === trimmedBaseline) {
      cancelSegmentEdit();
      return true;
    }

    const saved = await persistSegmentText(editingSegmentId, trimmedDraft);
    if (!saved) {
      return false;
    }

    cancelSegmentEdit();
    toast.success(segmentEditDict.toast.switchAutoSave, toastConfirmOptions);
    return true;
  }, [
    cancelSegmentEdit,
    editBaseline,
    editDraft,
    editingSegmentId,
    persistSegmentText,
    segmentEditDict.toast.switchAutoSave,
  ]);

  const handleRequestSpeakerEdit = useCallback(
    async (segment: TranscriptionDisplaySegment) => {
      if (!canEditTranscriptSegments || !segment.speakerId) {
        return;
      }

      const flushed = await flushPendingSegmentEdit();
      if (!flushed) {
        return;
      }

      setSpeakerEditTarget({
        segmentId: segment.id,
        speakerId: segment.speakerId,
        matchLabel: segment.speakerLabel ?? pageDict.content.segmentFallbackSpeaker,
      });
    },
    [
      canEditTranscriptSegments,
      flushPendingSegmentEdit,
      pageDict.content.segmentFallbackSpeaker,
    ]
  );

  const persistSpeakerRename = useCallback(
    async (scope: "single" | "all", displayName: string): Promise<boolean> => {
      if (!speakerEditTarget) {
        return false;
      }

      setIsSpeakerRenaming(true);

      try {
        const response = await apiFetch(
          scope === "single"
            ? `/api/transcriptions/${publicId}/display-segments/${speakerEditTarget.segmentId}`
            : `/api/transcriptions/${publicId}/speakers/bulk-rename`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(getTranscriptionAuthHeaders() ?? {}),
            },
            body: JSON.stringify(
              scope === "single"
                ? { speakerLabelOverride: displayName }
                : {
                    matchLabel: speakerEditTarget.matchLabel,
                    displayName,
                  }
            ),
          }
        );
        const payload = (await response.json().catch(() => null)) as
          | ApiSuccessResponse<TranscriptionReadResponse>
          | ApiErrorResponse
          | null;

        if (!response.ok || !isApiSuccess(payload)) {
          toast.error(speakerEditDialogDict.saveError, toastErrorOptions);
          return false;
        }

        setTask(payload.data.task);
        setSpeakerEditTarget(null);
        toast.success(
          scope === "single"
            ? speakerEditDialogDict.saveSuccessSingle
            : speakerEditDialogDict.saveSuccessAll,
          toastConfirmOptions
        );
        return true;
      } catch {
        toast.error(speakerEditDialogDict.saveError, toastErrorOptions);
        return false;
      } finally {
        setIsSpeakerRenaming(false);
      }
    },
    [
      getTranscriptionAuthHeaders,
      publicId,
      speakerEditDialogDict.saveError,
      speakerEditDialogDict.saveSuccess,
      speakerEditTarget,
    ]
  );

  const handleSpeakerEditDialogOpenChange = useCallback((open: boolean) => {
    if (!open && !isSpeakerRenaming) {
      setSpeakerEditTarget(null);
    }
  }, [isSpeakerRenaming]);

  const handleApplySpeakerRename = useCallback(
    async (displayName: string) => {
      await persistSpeakerRename("single", displayName);
    },
    [persistSpeakerRename]
  );

  const handleApplySpeakerRenameToAll = useCallback(
    async (displayName: string) => {
      await persistSpeakerRename("all", displayName);
    },
    [persistSpeakerRename]
  );

  const handleSegmentSelect = useCallback((segmentId: string) => {
    setActiveSegmentId(segmentId);
  }, []);

  const handleTranslationDisplayModeChange = useCallback(
    (mode: TranslationDisplayMode) => {
      if (mode === "translation" && editingSegmentId) {
        cancelSegmentEdit();
      }
      setTranslationDisplayMode(mode);
    },
    [cancelSegmentEdit, editingSegmentId]
  );

  const {
    isOpen: isSearchReplaceOpen,
    setIsOpen: setIsSearchReplaceOpen,
    tab: searchReplaceTab,
    setTab: setSearchReplaceTab,
    searchQuery,
    setSearchQuery,
    replaceQuery,
    setReplaceQuery,
    matches: searchMatches,
    currentMatchIndex,
    highlightBySegmentId,
    isReplacing,
    openPanel: openSearchReplacePanel,
    closePanel: closeSearchReplacePanel,
    goToPreviousMatch,
    goToNextMatch,
    handleReplaceOne,
    handleReplaceAll,
  } = useTranscriptSearchReplace({
    publicId,
    task,
    setTask,
    getSegmentDisplayText,
    setSegmentTextOverrides,
    editingSegmentId,
    editDraft,
    editBaseline,
    cancelSegmentEdit,
    getTranscriptionAuthHeaders,
    dict: searchReplaceDict,
    segmentEditAutoSaveToast: segmentEditDict.toast.switchAutoSave,
  });

  const handleSearchReplaceOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        closeTranslationPanel();
      }
      setIsSearchReplaceOpen(open);
    },
    [closeTranslationPanel, setIsSearchReplaceOpen]
  );

  const handleTranslationOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        closeSearchReplacePanel();
      }
      setIsTranslationOpen(open);
    },
    [closeSearchReplacePanel, setIsTranslationOpen]
  );

  const handleOpenSearchReplacePanel = useCallback(
    (tab: "search" | "replace") => {
      closeTranslationPanel();
      openSearchReplacePanel(tab);
    },
    [closeTranslationPanel, openSearchReplacePanel]
  );

  useEffect(() => {
    if (!targetLanguage) {
      return;
    }

    if (translationContentLoadFailures[targetLanguage]) {
      return;
    }

    const translation = translations[targetLanguage];
    if (!translation || translation.status !== "completed") {
      return;
    }

    if (hasCompletedTranslationSegments(translation)) {
      if (
        displayedTranslationLanguage !== targetLanguage &&
        (pendingTranslationLanguage === targetLanguage ||
          translationDisplayMode === "translation")
      ) {
        setDisplayedTranslationLanguage(targetLanguage);
      }

      if (pendingTranslationLanguage === targetLanguage) {
        setPendingTranslationLanguage(null);
        setTranslationDisplayMode("translation");
      }
      return;
    }

    if (!translationDetailLoadingLanguagesRef.current.has(targetLanguage)) {
      void loadTranslationDetail(targetLanguage).catch(() => {
        toast.error(translationDict.toasts.loadError, toastErrorOptions);
      });
    }
  }, [
    loadTranslationDetail,
    displayedTranslationLanguage,
    pendingTranslationLanguage,
    targetLanguage,
    translationDisplayMode,
    translationDict.toasts.loadError,
    translationContentLoadFailures,
    translations,
  ]);

  const handleRatingSelect = useCallback(
    (rating: number) => {
      setSelectedRating(rating);

      if (rating <= 3) {
        setIsFeedbackDialogOpen(true);
        return;
      }

      setIsRatingDismissed(true);
      setSelectedRating(null);
      toast.success(ratingFeedbackDict.thankYou, toastConfirmOptions);

      void submitTranscriptionFeedback(rating, "").catch(() => {
        toast.error(ratingFeedbackDict.submitError, toastErrorOptions);
      });
    },
    [ratingFeedbackDict.submitError, ratingFeedbackDict.thankYou, submitTranscriptionFeedback]
  );

  const handleFeedbackDialogOpenChange = useCallback((open: boolean) => {
    setIsFeedbackDialogOpen(open);
    if (!open) {
      setSelectedRating(null);
    }
  }, []);

  const handleFeedbackSubmit = useCallback(
    (feedback: string) => {
      if (selectedRating === null) {
        return;
      }

      if (!feedback.trim()) {
        toast.error(ratingFeedbackDict.feedbackRequired, toastErrorOptions);
        return;
      }

      const rating = selectedRating;
      const feedbackText = feedback.trim();

      setIsFeedbackDialogOpen(false);
      setSelectedRating(null);
      setIsRatingDismissed(true);
      toast.success(ratingFeedbackDict.submitSuccess, toastConfirmOptions);

      void submitTranscriptionFeedback(rating, feedbackText).catch(() => {
        toast.error(ratingFeedbackDict.submitError, toastErrorOptions);
      });
    },
    [
      ratingFeedbackDict.feedbackRequired,
      ratingFeedbackDict.submitError,
      ratingFeedbackDict.submitSuccess,
      selectedRating,
      submitTranscriptionFeedback,
    ]
  );

  useEffect(() => {
    if (!editingSegmentId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelSegmentEdit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelSegmentEdit, editingSegmentId]);

  const scheduleReconnect = useCallback(() => {
    if (isDisposedRef.current) {
      return;
    }

    if (
      !shouldKeepRealtimeSync(
        taskRef.current,
        aiArtifactsRef.current,
        pendingArtifactsRef.current,
        translationsRef.current
      )
    ) {
      return;
    }

    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => {
      void connectToStreamRef.current?.(true);
    }, 2500);
  }, [clearReconnectTimer]);

  const connectToStream = useCallback(async (isReconnect: boolean) => {
    try {
      const latest = await loadTask();
      if (isDisposedRef.current) {
        return;
      }

      if (
        !shouldKeepRealtimeSync(
          latest.task,
          latest.aiArtifacts ?? EMPTY_AI_ARTIFACTS,
          pendingArtifactsRef.current,
          latest.translations ?? EMPTY_TRANSLATIONS
        )
      ) {
        closeStream();
        setConnectionState("idle");
        return;
      }

      closeStream();
      clearReconnectTimer();
      setConnectionState(isReconnect ? "reconnecting" : "connecting");

      const streamTarget = buildClientSseUrl(
        `/api/transcriptions/${publicId}/stream`
      );
      const streamUrl = new URL(streamTarget);

      if (process.env.NODE_ENV !== "production") {
        console.log("[Transcription SSE] Stream target", {
          pageOrigin:
            typeof window !== "undefined" ? window.location.origin : null,
          streamTarget,
          streamOrigin: streamUrl.origin,
          hasStreamToken: Boolean(latest.streamToken),
        });
      }

      if (latest.streamToken) {
        streamUrl.searchParams.set("token", latest.streamToken);
      }

      const source = new EventSource(streamUrl.toString(), {
        withCredentials: true,
      });
      eventSourceRef.current = source;

      source.onopen = () => {
        setConnectionState("connected");
      };

      source.onmessage = (event) => {
        let parsed: StreamEventPayload | null = null;

        try {
          parsed = JSON.parse(event.data) as StreamEventPayload;
        } catch {
          return;
        }

        const localPending = pendingArtifactsRef.current;
        const serverTask = parsed?.task;
        const serverAiArtifacts = parsed?.aiArtifacts;
        const preserveSummaryGeneration = Boolean(
          localPending.summary &&
            !serverAiArtifacts?.summary
        );
        const preserveMindMapGeneration = Boolean(
          localPending.mind_map &&
            !serverAiArtifacts?.mind_map
        );

        if (serverTask) {
          setTask(
            preserveSummaryGeneration || preserveMindMapGeneration
              ? {
                  ...serverTask,
                  ...(preserveSummaryGeneration
                    ? { summaryTemplateKey: "general" as const }
                    : {}),
                  ...(preserveMindMapGeneration
                    ? { mindMapTemplateKey: "general" as const }
                    : {}),
                }
              : serverTask
          );
        }

        if (serverAiArtifacts) {
          setAiArtifacts((current) => ({
            summary: preserveSummaryGeneration
              ? current.summary
              : serverAiArtifacts.summary,
            mind_map: preserveMindMapGeneration
              ? current.mind_map
              : serverAiArtifacts.mind_map,
          }));
          setPendingArtifactGeneration((current) => ({
            ...current,
            summary:
              preserveSummaryGeneration ||
              serverAiArtifacts.summary?.status === "processing"
                ? current.summary
                : false,
            mind_map:
              preserveMindMapGeneration ||
              serverAiArtifacts.mind_map?.status === "processing"
                ? current.mind_map
                : false,
          }));
        }

        if (parsed?.translations) {
          setTranslations((current) =>
            mergeTranslationCollection(
              current,
              parsed.translations ?? EMPTY_TRANSLATIONS,
              parsed.completedTranslation ?? null
            )
          );
        }

        if (hasCompletedTranslationSegments(parsed?.completedTranslation)) {
          applyCompletedTranslation(parsed.completedTranslation);
        }
      };

      source.onerror = () => {
        if (isDisposedRef.current) {
          return;
        }

        closeStream();
        setConnectionState("disconnected");
        scheduleReconnect();
      };
    } catch (error) {
      if (isDisposedRef.current) {
        return;
      }

      const nextMessage =
        error instanceof Error ? error.message : pageDict.errors.loadFailed;
      setConnectionState("disconnected");
      setErrorMessage(nextMessage);

      if (nextMessage !== pageDict.errors.notFound) {
        scheduleReconnect();
      }
    }
  }, [
    clearReconnectTimer,
    closeStream,
    applyCompletedTranslation,
    loadTask,
    pageDict.errors.loadFailed,
    pageDict.errors.notFound,
    publicId,
    scheduleReconnect,
  ]);

  useEffect(() => {
    connectToStreamRef.current = connectToStream;
  }, [connectToStream]);

  useEffect(() => {
    if (isLoading || !task) {
      return;
    }

    if (!shouldKeepStreamAlive) {
      clearReconnectTimer();
      closeStream();
      setConnectionState("idle");
      return;
    }

    if (
      eventSourceRef.current ||
      connectionState === "connecting" ||
      connectionState === "reconnecting"
    ) {
      return;
    }

    void connectToStreamRef.current?.(false);
  }, [
    clearReconnectTimer,
    closeStream,
    connectionState,
    isLoading,
    shouldKeepStreamAlive,
    task,
  ]);

  useEffect(() => {
    if (
      !shouldWaitForSummaryArtifact(task, aiArtifacts, pendingArtifactGeneration) &&
      !shouldWaitForMindMapArtifact(task, aiArtifacts, pendingArtifactGeneration) &&
      !shouldWaitForTranslations(task, translations)
    ) {
      return;
    }

    const intervalRef = { current: null as number | null };
    const timeout = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        void loadTask().catch(() => {
          // Keep polling as a fallback when SSE is delayed or unavailable.
        });
      }, 3000);
    }, 10_000);

    return () => {
      window.clearTimeout(timeout);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [aiArtifacts, loadTask, pendingArtifactGeneration, task, translations]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDurationSec(Number.isFinite(audio.duration) ? audio.duration : 0);

      if (pendingSeekSecRef.current !== null) {
        audio.currentTime = pendingSeekSecRef.current;
        pendingSeekSecRef.current = null;
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTimeSec(audio.currentTime);
      const currentTimeMs = Math.floor(audio.currentTime * 1000);
      const currentSegment =
        task?.segments.find(
          (segment) =>
            segment.startMs <= currentTimeMs && currentTimeMs < segment.endMs
        ) ?? null;
      setActiveSegmentId(currentSegment?.id ?? null);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [task?.segments]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  useEffect(() => {
    isDisposedRef.current = false;

    void (async () => {
      try {
        setIsLoading(true);
        await loadTask();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : pageDict.errors.loadFailed
        );
      } finally {
        if (!isDisposedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isDisposedRef.current = true;
      clearReconnectTimer();
      closeStream();
    };
  }, [clearReconnectTimer, closeStream, connectToStream, loadTask, pageDict.errors.loadFailed, publicId]);

  const handleRetry = () => {
    setErrorMessage(null);
    setIsLoading(true);
    void (async () => {
      try {
        await connectToStream(false);
      } finally {
        if (!isDisposedRef.current) {
          setIsLoading(false);
        }
      }
    })();
  };

  return (
    <div className="flex h-[100svh] w-full overflow-hidden bg-slate-50 font-sans text-slate-900">
      <audio ref={audioRef} preload="metadata" className="hidden" />
      {/* 1. 全局左侧边栏 (Left Sidebar) */}
      {!isAuthenticated ? (
        <TranscriptionGuestSidebar
          locale={locale}
          sidebarDict={sidebarDict}
          brandIdentity={brandIdentity}
          {...guestSidebarProps}
        />
      ) : null}

      {/* 2. 全局右侧主区域 (Right Main Area) */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        <Popover open={isSearchReplaceOpen} onOpenChange={handleSearchReplaceOpenChange}>
          <TranscriptionResultPageHeader
            fileName={task?.displayTitle ?? task?.fileName}
            isTitleLoading={!task}
            homeHref={isAuthenticated ? dashboardUrl : locale === "en" ? "/" : `/${locale}`}
            backLabel={pageDict.actions.backHome}
            toolbarDict={pageDict.toolbar}
            exportLabel={exportDialogDict.triggerLabel}
            exportDisabled={!isTranscriptReady}
            onExportClick={openExportDialog}
            onShareClick={handleShareClick}
            onRenameClick={() => setIsRenameDialogOpen(true)}
            isSearchReplaceOpen={isSearchReplaceOpen}
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

          <TranscriptionSearchReplacePanel
            dict={searchReplaceDict}
            tab={searchReplaceTab}
            onTabChange={setSearchReplaceTab}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            replaceQuery={replaceQuery}
            onReplaceQueryChange={setReplaceQuery}
            matchCount={searchMatches.length}
            currentMatchIndex={currentMatchIndex}
            onPreviousMatch={goToPreviousMatch}
            onNextMatch={goToNextMatch}
            onReplaceOne={handleReplaceOne}
            onReplaceAll={handleReplaceAll}
            isReplacing={isReplacing}
            onClose={closeSearchReplacePanel}
          />
        </Popover>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="font-semibold">{errorMessage}</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={handleRetry} className="h-8">
                  <RefreshCw className="mr-2 size-3" /> Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2.2 右侧底部区域 (分为内部左右两栏) */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={workspaceSplitRef} className="flex min-h-0 flex-1 flex-col xl:flex-row">
          
          {/* 2.2.1 内部左侧：转录结果 (Inner Left) */}
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
                {showProgressBar ? (
                  <TranscriptionProgressCard
                    label={progressLabel}
                    progressValue={progressValue}
                    recovery={
                      showResultRecovery
                        ? {
                            description: pageDict.resultRecovery.description,
                            statusMessage: resultRecoveryMessage,
                            checkLabel: pageDict.resultRecovery.checkButton,
                            checkAgainLabel: pageDict.resultRecovery.checkAgainButton,
                            hasCheckedOnce: hasCheckedResultOnce,
                            isChecking: isCheckingForResult,
                            isCoolingDown: isResultRecoveryCoolingDown,
                            onCheck: handleCheckForResult,
                          }
                        : undefined
                    }
                  />
                ) : null}

                {showTranscriptToolbar ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-base font-semibold text-slate-900">
                        {pageDict.content.fullText}
                      </h2>
                      <div className="flex items-center gap-2">
                        <SegmentActionTooltip label={pageDict.toolbar.actions.searchTooltip}>
                          <button
                            type="button"
                            className={cn(
                              SECONDARY_ICON_BUTTON_CLASSNAME,
                              isSearchReplaceOpen &&
                                searchReplaceTab === "search" &&
                                "bg-brand-50 text-brand-600"
                            )}
                            aria-label={pageDict.toolbar.actions.searchAria}
                            aria-expanded={isSearchReplaceOpen}
                            onClick={() => {
                              if (isSearchReplaceOpen && searchReplaceTab === "search") {
                                closeSearchReplacePanel();
                                return;
                              }

                              handleOpenSearchReplacePanel("search");
                            }}
                          >
                            <Search className="size-4" aria-hidden="true" />
                          </button>
                        </SegmentActionTooltip>
                        <SegmentActionTooltip label={pageDict.toolbar.actions.replaceTooltip}>
                          <button
                            type="button"
                            className={cn(
                              SECONDARY_ICON_BUTTON_CLASSNAME,
                              isSearchReplaceOpen &&
                                searchReplaceTab === "replace" &&
                                "bg-brand-50 text-brand-600"
                            )}
                            aria-label={pageDict.toolbar.actions.replaceAria}
                            aria-expanded={isSearchReplaceOpen}
                            onClick={() => {
                              if (isSearchReplaceOpen && searchReplaceTab === "replace") {
                                closeSearchReplacePanel();
                                return;
                              }

                              handleOpenSearchReplacePanel("replace");
                            }}
                          >
                            <Replace className="size-4" aria-hidden="true" />
                          </button>
                        </SegmentActionTooltip>
                        <SegmentActionTooltip label={pageDict.toolbar.actions.copyTooltip}>
                          <button
                            type="button"
                            className={SECONDARY_ICON_BUTTON_CLASSNAME}
                            aria-label={pageDict.toolbar.actions.copyAria}
                            onClick={() => {
                              void handleCopyTranscript();
                            }}
                          >
                            <Copy className="size-4" aria-hidden="true" />
                          </button>
                        </SegmentActionTooltip>
                        <Popover
                          open={isTranslationOpen}
                          onOpenChange={handleTranslationOpenChange}
                        >
                          <SegmentActionTooltip
                            label={pageDict.toolbar.actions.translateTooltip}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  SECONDARY_ICON_BUTTON_CLASSNAME,
                                  "relative",
                                  (isTranslationOpen || isTranslationInProgress) &&
                                    "bg-brand-50 text-brand-600"
                                )}
                                aria-label={pageDict.toolbar.actions.translateAria}
                                aria-expanded={isTranslationOpen}
                                aria-busy={isTranslationInProgress}
                              >
                                <Languages className="size-4" aria-hidden="true" />
                                {isTranslationInProgress ? (
                                  <span
                                    className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-brand-500 ring-2 ring-white"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </button>
                            </PopoverTrigger>
                          </SegmentActionTooltip>
                          <TranscriptionTranslationPanel
                            dict={translationDict}
                            targetLanguage={targetLanguage}
                            onTargetLanguageChange={handleTargetLanguageChange}
                            isTranslating={isTranslating}
                            actionState={translationActionState}
                            showDisplayMode={shouldShowTranslationDisplayMode}
                            displayMode={translationDisplayMode}
                            onDisplayModeChange={handleTranslationDisplayModeChange}
                            onStartTranslation={() =>
                              handleStartTranslation({
                                force:
                                  translationActionState === "stale_completed" ||
                                  translationActionState === "failed",
                              })
                            }
                            onClose={closeTranslationPanel}
                          />
                        </Popover>
                        {SHOW_TRANSCRIPTION_SPEAKER_OPTIONS_BUTTON ? (
                          <SegmentActionTooltip label={pageDict.toolbar.actions.speakersTooltip}>
                            <button
                              type="button"
                              className={SECONDARY_ICON_BUTTON_CLASSNAME}
                              aria-label={pageDict.toolbar.actions.speakersAria}
                            >
                              <Users className="size-4" aria-hidden="true" />
                            </button>
                          </SegmentActionTooltip>
                        ) : null}
                      </div>
                    </div>

                    {!isRatingDismissed ? (
                      <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 pl-3 pr-4 py-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <span>{pageDict.toolbar.rating.label}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((rating) => {
                              const isSelected =
                                selectedRating !== null && rating <= selectedRating;

                              return (
                                <button
                                  key={rating}
                                  type="button"
                                  onClick={() => handleRatingSelect(rating)}
                                  className="inline-flex cursor-pointer items-center justify-center rounded-sm p-0.5 max-xl:p-2 max-xl:-m-2 transition-colors hover:text-primary"
                                  aria-label={pageDict.toolbar.rating.starAria.replace(
                                    "{rating}",
                                    String(rating)
                                  )}
                                >
                                  <Star
                                    className={cn(
                                      "size-5",
                                      isSelected
                                        ? "fill-primary text-primary"
                                        : "text-slate-300"
                                    )}
                                    aria-hidden="true"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsRatingDismissed(true)}
                          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          aria-label={pageDict.toolbar.rating.dismissAria}
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Segments */}
                <div className="space-y-6">
                  {showTranslationProgressBanner ? (
                    <TranslationProgressBanner
                      titlePrefix={translationDict.progressBanner.titlePrefix}
                      languageLabel={selectedTargetLanguageOption.label}
                      languageNativeLabel={selectedTargetLanguageOption.nativeLabel}
                      description={translationDict.progressBanner.description}
                      ariaLabel={translationDict.progressBanner.ariaLabel}
                    />
                  ) : null}
                  {showTranslationContentLoadFailure ? (
                    <div
                      role="alert"
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5"
                    >
                      <p className="text-sm leading-relaxed text-amber-900">
                        {translationDict.toasts.loadError}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                        onClick={() => {
                          void loadTranslationDetail(targetLanguage).catch(() => {
                            toast.error(translationDict.toasts.loadError, toastErrorOptions);
                          });
                        }}
                      >
                        <RefreshCw className="size-3.5" aria-hidden="true" />
                        {translationDict.retryButton}
                      </Button>
                    </div>
                  ) : null}
                  {task?.segments.length ? (
                    task.segments.map((segment) => (
                      <SegmentCard
                        key={segment.id}
                        segment={segment}
                        displayText={getSegmentDisplayText(segment)}
                        highlightRanges={
                          isSearchReplaceOpen
                            ? highlightBySegmentId[segment.id]
                            : undefined
                        }
                        isActive={activeSegmentId === segment.id}
                        isEditing={editingSegmentId === segment.id}
                        isDirty={
                          editingSegmentId === segment.id &&
                          editDraft.trim() !== editBaseline.trim()
                        }
                        editDraft={editingSegmentId === segment.id ? editDraft : undefined}
                        onEditDraftChange={setEditDraft}
                        onClick={() => handleSegmentSelect(segment.id)}
                        onRequestEdit={() => handleRequestSegmentEdit(segment)}
                        onSaveEdit={handleSaveSegmentEdit}
                        onCancelEdit={cancelSegmentEdit}
                        onPlaySegment={handlePlaySegment}
                        onCopySegment={handleCopySegment}
                        canEdit={canEditTranscriptSegments}
                        canEditSpeaker={
                          canEditTranscriptSegments && Boolean(segment.speakerId)
                        }
                        onRequestSpeakerEdit={() => handleRequestSpeakerEdit(segment)}
                        segmentEditDict={segmentEditDict}
                        unknownValue={pageDict.content.unknownValue}
                      />
                    ))
                  ) : showProgressBar ? (
                    <TranscriptionSegmentPulsePlaceholder />
                  ) : showTranscriptFailureState ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                      <p className="text-sm font-semibold text-red-900">
                        {pageDict.empty.failedTitle}
                      </p>
                      <p className="mt-2 text-sm text-red-700">
                        {task?.errorMessage?.trim() || pageDict.empty.failedDescription}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-12 text-center">
                      <p className="text-sm text-slate-500">{pageDict.empty.noSegments}</p>
                    </div>
                  )}
                </div>

                {showUpgradePlanCard ? (
                  <div className="pt-2 pb-4">
                    <TranscriptionUpgradePlanCard
                      ref={upgradePlanCardRef}
                      {...upgradePanelProps}
                      onViewAllPlans={handleViewAllPlansFromUpgradeCard}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {showBottomPlayback ? (
              <div ref={playbackFooterRef} className="shrink-0">
                <TranscriptionPlaybackBar
                  dict={playbackDict}
                  truncationDict={pageDict.truncation}
                  durationMs={task?.durationMs ?? null}
                  unknownValue={pageDict.content.unknownValue}
                  showUpgradeStrip={showPlaybackUpgradeStrip}
                  sourceDurationMs={task?.sourceDurationMs ?? null}
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  currentTimeLabel={currentTimeLabel}
                  progressPercent={playbackProgressPercent}
                  onTogglePlay={handleTogglePlay}
                  onSeekRelative={handleSeekRelative}
                  onSeekToPercent={handleSeekToPercent}
                  onCycleSpeed={() =>
                    setPlaybackSpeedIndex(
                      (current) => (current + 1) % PLAYBACK_SPEED_OPTIONS.length
                    )
                  }
                  onVolumeChange={handleVolumeChange}
                  onUpgradeCtaClick={handleScrollToUpgradePlanCard}
                />
              </div>
            ) : null}

            <TranscriptScrollJumpButton
              enabled={showScrollJumpButton}
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

          <TranscriptionInsightsPanel
            variant="sidebar"
            style={{ width: summaryWidth }}
            dict={summaryPanelDict}
            publicId={publicId}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            summaryTemplateKey={task?.summaryTemplateKey ?? "off"}
            onSummaryTemplateChange={(value) => {
              void handleSummaryTemplateChange(value);
            }}
            summaryTemplateSelectTriggerRef={summaryTemplateSelectTriggerRef}
            isSummaryEnabled={isSummaryEnabled}
            isSummaryGenerating={isSummaryGenerating}
            isSummaryAwaitingTranscript={isSummaryAwaitingTranscript}
            summaryArtifact={summaryArtifact}
            summaryData={summaryData}
            hasSummaryContent={hasSummaryContent}
            canChangeSummaryTemplate={canChangeSummaryTemplate}
            canRefreshSummary={canRefreshSummary}
            canCopySummary={canCopySummary}
            canGenerateSummary={canGenerateSummary}
            isTranscriptReady={isTranscriptReady}
            onRefreshSummary={() => void handleRefreshSummary()}
            onCopySummary={() => void handleCopySummary()}
            onGenerateSummary={() => void handleGenerateSummary()}
            isMindMapBusy={isMindMapBusy}
            isMindMapAwaitingTranscript={isMindMapAwaitingTranscript}
            mindMapArtifact={mindMapArtifact}
            mindMapData={mindMapData}
            hasMindMapContent={hasMindMapContent}
            canGenerateMindMap={canGenerateMindMap}
            canRefreshMindMap={canRefreshMindMap}
            onGenerateMindMap={() => void handleGenerateMindMap()}
            onRefreshMindMap={() => void handleRefreshMindMap()}
          />

          <div
            className={cn(
              "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white xl:hidden",
              activeWorkspacePanel === "transcript" ? "hidden" : "flex"
            )}
          >
            <TranscriptionInsightsPanel
              variant="mobile"
              dict={summaryPanelDict}
              publicId={publicId}
              activeTab={activeTab}
              onActiveTabChange={(tab) => {
                setActiveTab(tab);
                setActiveWorkspacePanel(tab);
              }}
              summaryTemplateKey={task?.summaryTemplateKey ?? "off"}
              onSummaryTemplateChange={(value) => {
                void handleSummaryTemplateChange(value);
              }}
              summaryTemplateSelectTriggerRef={summaryTemplateSelectTriggerRef}
              isSummaryEnabled={isSummaryEnabled}
              isSummaryGenerating={isSummaryGenerating}
              isSummaryAwaitingTranscript={isSummaryAwaitingTranscript}
              summaryArtifact={summaryArtifact}
              summaryData={summaryData}
              hasSummaryContent={hasSummaryContent}
              canChangeSummaryTemplate={canChangeSummaryTemplate}
              canRefreshSummary={canRefreshSummary}
              canCopySummary={canCopySummary}
              canGenerateSummary={canGenerateSummary}
              isTranscriptReady={isTranscriptReady}
              onRefreshSummary={() => void handleRefreshSummary()}
              onCopySummary={() => void handleCopySummary()}
              onGenerateSummary={() => void handleGenerateSummary()}
              isMindMapBusy={isMindMapBusy}
              isMindMapAwaitingTranscript={isMindMapAwaitingTranscript}
              mindMapArtifact={mindMapArtifact}
              mindMapData={mindMapData}
              hasMindMapContent={hasMindMapContent}
              canGenerateMindMap={canGenerateMindMap}
              canRefreshMindMap={canRefreshMindMap}
              onGenerateMindMap={() => void handleGenerateMindMap()}
              onRefreshMindMap={() => void handleRefreshMindMap()}
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
      </main>

      <TranscriptionRatingFeedbackDialog
        open={isFeedbackDialogOpen}
        onOpenChange={handleFeedbackDialogOpenChange}
        rating={selectedRating ?? 1}
        dictionary={ratingFeedbackDict}
        onSubmit={handleFeedbackSubmit}
      />

      <TranscriptionRenameDialog
        open={isRenameDialogOpen}
        onOpenChange={handleRenameDialogOpenChange}
        dict={renameDialogDict}
        initialName={task?.displayTitle ?? task?.fileName ?? ""}
        isSaving={isRenaming}
        onRename={handleRenameTranscription}
      />

      <TranscriptionEditSpeakerDialog
        open={speakerEditTarget !== null}
        onOpenChange={handleSpeakerEditDialogOpenChange}
        dict={speakerEditDialogDict}
        initialName={speakerEditTarget?.matchLabel ?? ""}
        isSaving={isSpeakerRenaming}
        onApply={handleApplySpeakerRename}
        onApplyToAll={handleApplySpeakerRenameToAll}
      />

      <TranscriptionPageChromeDialogs {...chromeDialogProps} />
    </div>
  );
}

function SummaryPanelErrorState({
  dict,
  onRetry,
}: {
  dict: TranscriptionsPageDictionary["summaryPanel"];
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-6 text-center">
      <p className="text-sm font-medium text-slate-700">{dict.states.failedTitle}</p>
      <p className="mt-2 text-sm text-slate-500">{dict.states.failedBody}</p>
      <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
        {dict.states.retryCta}
      </Button>
    </div>
  );
}

function resolveVolumeIcon(volume: number) {
  if (volume === 0) {
    return VolumeX;
  }

  if (volume <= 33) {
    return Volume;
  }

  if (volume <= 66) {
    return Volume1;
  }

  return Volume2;
}

function PlaybackVolumeControl({
  dict,
  onVolumeChange,
}: {
  dict: TranscriptionsPageDictionary["playback"];
  onVolumeChange: (nextVolume: number) => void;
}) {
  const [volume, setVolume] = useState(100);
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const lastVolumeBeforeMuteRef = useRef(100);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const VolumeIcon = resolveVolumeIcon(volume);
  const isMuted = volume === 0;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const updateViewport = () => {
      setIsDesktop(mediaQuery.matches);
      if (mediaQuery.matches) {
        setIsOpen(false);
      }
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  }, [clearCloseTimer]);

  const openPopover = useCallback(() => {
    clearCloseTimer();
    setIsOpen(true);
  }, [clearCloseTimer]);

  const handleVolumeChange = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(100, Math.max(0, nextVolume));
    if (clampedVolume > 0) {
      lastVolumeBeforeMuteRef.current = clampedVolume;
    }
    setVolume(clampedVolume);
    onVolumeChange(clampedVolume);
  }, [onVolumeChange]);

  const handleToggleMute = useCallback(() => {
    if (volume === 0) {
      setVolume(lastVolumeBeforeMuteRef.current || 100);
      return;
    }

    lastVolumeBeforeMuteRef.current = volume;
    setVolume(0);
  }, [volume]);

  const handleButtonClick = () => {
    if (isDesktop) {
      handleToggleMute();
      return;
    }

    setIsOpen((current) => !current);
  };

  const handleOpenChange = (open: boolean) => {
    if (!isDesktop) {
      setIsOpen(open);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <div
        className="inline-flex"
        onMouseEnter={() => {
          if (isDesktop) {
            openPopover();
          }
        }}
        onMouseLeave={() => {
          if (isDesktop) {
            scheduleClose();
          }
        }}
      >
        <PopoverAnchor asChild>
          <button
            type="button"
            aria-label={isMuted ? dict.muteAria : dict.volumeAria}
            aria-expanded={isOpen}
            onClick={handleButtonClick}
            className={PLAYBACK_SECONDARY_BUTTON_CLASSNAME}
          >
            <VolumeIcon className="size-5" aria-hidden="true" />
          </button>
        </PopoverAnchor>

        <PopoverContent
          side="top"
          align="center"
          alignOffset={-6}
          sideOffset={4}
          aria-label={dict.volumePopoverLabel}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={() => {
            if (isDesktop) {
              openPopover();
            }
          }}
          onMouseLeave={() => {
            if (isDesktop) {
              scheduleClose();
            }
          }}
          className="w-auto cursor-pointer rounded-lg border-slate-200 px-2 py-2 shadow-md"
        >
          <Slider
            orientation="vertical"
            min={0}
            max={100}
            step={1}
            value={[volume]}
            onValueChange={(values) => handleVolumeChange(values[0] ?? 0)}
            aria-label={dict.volumeSliderAria}
            className="h-16 min-h-16 w-6 cursor-pointer data-[orientation=vertical]:h-16 data-[orientation=vertical]:min-h-16 [&_[data-slot=slider-thumb]]:cursor-grab [&_[data-slot=slider-thumb]]:active:cursor-grabbing [&_[data-slot=slider-track]]:w-1 [&_[data-slot=slider-track]]:cursor-pointer [&_[data-slot=slider-track]]:bg-(--color-progress-bg) [&_[data-slot=slider-range]]:bg-(--color-progress-fill) [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-(--color-progress-fill) [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-sm [&_[data-slot=slider-thumb]]:ring-2 [&_[data-slot=slider-thumb]]:ring-white [&_[data-slot=slider-thumb]]:hover:ring-4"
          />
        </PopoverContent>
      </div>
    </Popover>
  );
}

function TranscriptionPlaybackBar({
  dict,
  truncationDict,
  durationMs,
  unknownValue,
  showUpgradeStrip,
  sourceDurationMs,
  isPlaying,
  playbackSpeed,
  currentTimeLabel,
  progressPercent,
  onTogglePlay,
  onSeekRelative,
  onSeekToPercent,
  onCycleSpeed,
  onVolumeChange,
  onUpgradeCtaClick,
}: {
  dict: TranscriptionsPageDictionary["playback"];
  truncationDict: TranscriptionsPageDictionary["truncation"];
  durationMs: number | null;
  unknownValue: string;
  showUpgradeStrip: boolean;
  sourceDurationMs: number | null;
  isPlaying: boolean;
  playbackSpeed: (typeof PLAYBACK_SPEED_OPTIONS)[number];
  currentTimeLabel: string;
  progressPercent: number;
  onTogglePlay: () => void;
  onSeekRelative: (offsetSeconds: number) => void;
  onSeekToPercent?: (percent: number) => void;
  onCycleSpeed: () => void;
  onVolumeChange: (nextVolume: number) => void;
  onUpgradeCtaClick: () => void;
}) {
  const durationLabel = formatHumanReadableDuration(durationMs, unknownValue);
  const originalDurationLabel = formatHumanReadableDuration(sourceDurationMs, unknownValue);
  const speedLabel = formatPlaybackSpeed(playbackSpeed);
  const speedAriaLabel = dict.speedAria.replace("{speed}", speedLabel);

  return (
    <div className="z-10 flex shrink-0 flex-col border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_12px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      {showUpgradeStrip ? (
        <div className="border-t border-b border-primary/15 bg-gradient-to-r from-primary/12 to-primary/5 px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Lock className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                  <p className="text-sm leading-snug text-slate-600">
                  {renderHighlightedTemplate(
                    truncationDict.previewLine,
                    { truncated: durationLabel },
                    "font-normal text-slate-600"
                  )}
                </p>
                <p className="text-sm leading-relaxed text-slate-600">
                  {renderHighlightedTemplate(
                    truncationDict.unlockLine,
                    { original: originalDurationLabel },
                    "font-normal text-slate-600"
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 w-full shrink-0 rounded-full bg-primary px-4 text-white hover:bg-primary/90 sm:w-auto"
              onClick={onUpgradeCtaClick}
            >
              {dict.upgradeCta}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={dict.skipBackAria}
            onClick={() => onSeekRelative(-10)}
            className={PLAYBACK_SECONDARY_BUTTON_CLASSNAME}
          >
            <Rewind className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={isPlaying ? dict.pauseAria : dict.playAria}
            onClick={onTogglePlay}
            className={PLAYBACK_PRIMARY_BUTTON_CLASSNAME}
          >
            {isPlaying ? (
              <Pause className="size-5.5" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 size-5.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label={dict.skipForwardAria}
            onClick={() => onSeekRelative(10)}
            className={PLAYBACK_SECONDARY_BUTTON_CLASSNAME}
          >
            <FastForward className="size-5" aria-hidden="true" />
          </button>
        </div>

        <PlaybackProgressBar
          ariaLabel={dict.scrubAria}
          progressPercent={progressPercent}
          currentTimeLabel={currentTimeLabel}
          durationLabel={durationLabel}
          onSeekToPercent={onSeekToPercent}
        />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <PlaybackVolumeControl dict={dict} onVolumeChange={onVolumeChange} />
          <button
            type="button"
            aria-label={speedAriaLabel}
            onClick={onCycleSpeed}
            className={PLAYBACK_SPEED_BUTTON_CLASSNAME}
          >
            {speedLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaybackProgressBar({
  ariaLabel,
  progressPercent,
  currentTimeLabel,
  durationLabel,
  onSeekToPercent,
}: {
  ariaLabel: string;
  progressPercent: number;
  currentTimeLabel: string;
  durationLabel: string;
  onSeekToPercent?: (percent: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const clampedProgress = Math.min(100, Math.max(0, progressPercent));

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || !onSeekToPercent) {
        return;
      }

      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const percent = ((clientX - rect.left) / rect.width) * 100;
      onSeekToPercent(percent);
    },
    [onSeekToPercent]
  );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <span className={PLAYBACK_TIME_LABEL_CLASSNAME}>{currentTimeLabel}</span>
      <div
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedProgress}
        tabIndex={0}
        className="group flex h-4 min-w-0 flex-1 cursor-pointer touch-manipulation items-center focus-visible:outline-none"
        onPointerDown={(event) => {
          if (!onSeekToPercent) {
            return;
          }

          seekFromClientX(event.clientX);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!onSeekToPercent || event.buttons !== 1) {
            return;
          }

          seekFromClientX(event.clientX);
        }}
        onKeyDown={(event) => {
          if (!onSeekToPercent) {
            return;
          }

          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onSeekToPercent(Math.max(0, clampedProgress - 5));
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            onSeekToPercent(Math.min(100, clampedProgress + 5));
          }
        }}
      >
        <div
          ref={trackRef}
          className="relative h-1 w-full rounded-full bg-(--color-progress-bg) transition-all duration-150 group-hover:h-1.5 group-focus-visible:h-1.5"
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-(--color-progress-fill) transition-all duration-150"
            style={{ width: `${clampedProgress}%` }}
          />
          <div
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--color-progress-fill) opacity-0 shadow ring-2 ring-white transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{ left: `${clampedProgress}%` }}
          />
        </div>
      </div>
      <span className={PLAYBACK_TIME_LABEL_CLASSNAME}>{durationLabel}</span>
    </div>
  );
}

function SegmentActionTooltip({
  label,
  children,
  align,
  side = "top",
}: {
  label: string;
  children: ReactElement;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} align={align}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SegmentCard({
  segment,
  displayText,
  highlightRanges,
  isActive,
  isEditing,
  isDirty,
  editDraft,
  onEditDraftChange,
  onClick,
  onRequestEdit,
  onSaveEdit,
  onCancelEdit,
  onPlaySegment,
  onCopySegment,
  canEdit = true,
  canEditSpeaker = false,
  onRequestSpeakerEdit,
  segmentEditDict,
  unknownValue,
}: {
  segment: TranscriptionDisplaySegment;
  displayText: string;
  highlightRanges?: TranscriptHighlightRange[];
  isActive?: boolean;
  isEditing?: boolean;
  isDirty?: boolean;
  editDraft?: string;
  onEditDraftChange?: (value: string) => void;
  onClick?: () => void;
  onRequestEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onPlaySegment?: (segment: TranscriptionDisplaySegment) => void | Promise<void>;
  onCopySegment?: (segment: TranscriptionDisplaySegment) => void | Promise<void>;
  canEdit?: boolean;
  canEditSpeaker?: boolean;
  onRequestSpeakerEdit?: () => void;
  segmentEditDict: TranscriptionsPageDictionary["segmentEdit"];
  unknownValue: string;
}) {
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const speakerLabel = segment.speakerLabel ?? "Speaker";
  const speakerInitial = speakerLabel.charAt(0).toUpperCase();
  const avatarClassName = getSpeakerAvatarClassName(segment.speakerColorToken);
  const showActions = isEditing || isActive;

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const textarea = editTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, [isEditing]);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group rounded-xl px-4 pt-3 pb-4 transition-colors duration-200",
        isEditing && "cursor-default",
        !isEditing && isActive && "cursor-pointer bg-primary/5",
        !isEditing && !isActive && "cursor-pointer hover:bg-slate-50"
      )}
    >
      <div className="flex h-7 items-center justify-between gap-4">
        <div className="flex h-7 min-w-0 items-center gap-2">
          {canEditSpeaker ? (
            <SegmentActionTooltip label={segmentEditDict.speakerEdit.editTooltip}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestSpeakerEdit?.();
                }}
                className="flex shrink-0 items-center gap-2 cursor-pointer focus:outline-none"
                aria-label={segmentEditDict.speakerEdit.editAria}
              >
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ${avatarClassName}`}
                >
                  {speakerInitial}
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium leading-none transition-colors",
                    isActive || isEditing ? "text-primary" : "text-slate-600"
                  )}
                >
                  {speakerLabel}
                </span>
              </button>
            </SegmentActionTooltip>
          ) : (
            <>
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ${avatarClassName}`}
              >
                {speakerInitial}
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium leading-none transition-colors",
                  isActive || isEditing ? "text-primary" : "text-slate-600"
                )}
              >
                {speakerLabel}
              </span>
            </>
          )}

          <span className="shrink-0 text-xs font-medium leading-none text-slate-400">
            {formatTranscriptTimestamp(segment.startMs, unknownValue)}
          </span>
        </div>

        <div
          className={cn(
            "flex h-7 shrink-0 items-center gap-1.5 transition-opacity duration-200",
            showActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <SegmentActionTooltip label={segmentEditDict.actions.playTooltip}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void onPlaySegment?.(segment);
              }}
              className={`${SECONDARY_ICON_BUTTON_CLASSNAME} text-slate-400 group-hover:text-slate-600`}
              aria-label={segmentEditDict.actions.playAria}
            >
              <Play className="size-4" aria-hidden="true" />
            </button>
          </SegmentActionTooltip>
          <SegmentActionTooltip label={segmentEditDict.actions.copyTooltip}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void onCopySegment?.(segment);
              }}
              className={`${SECONDARY_ICON_BUTTON_CLASSNAME} text-slate-400 group-hover:text-slate-600`}
              aria-label={segmentEditDict.actions.copyAria}
            >
              <Copy className="size-4" aria-hidden="true" />
            </button>
          </SegmentActionTooltip>
          {isEditing ? (
            <>
              <button
                type="button"
                disabled={!isDirty}
                onClick={(event) => {
                  event.stopPropagation();
                  onSaveEdit?.();
                }}
                className={cn(
                  SECONDARY_ICON_BUTTON_CLASSNAME,
                  "text-slate-400 group-hover:text-slate-600",
                  isDirty && "text-primary hover:text-primary",
                  !isDirty && "pointer-events-none opacity-40"
                )}
                aria-label={segmentEditDict.actions.saveAria}
              >
                <Check className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelEdit?.();
                }}
                className={`${SECONDARY_ICON_BUTTON_CLASSNAME} text-slate-400 group-hover:text-slate-600`}
                aria-label={segmentEditDict.actions.cancelAria}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            canEdit ? (
              <SegmentActionTooltip
                label={segmentEditDict.actions.editTooltip}
                align="end"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRequestEdit?.();
                  }}
                  className={`${SECONDARY_ICON_BUTTON_CLASSNAME} text-slate-400 group-hover:text-slate-600`}
                  aria-label={segmentEditDict.actions.editAria}
                >
                  <Edit3 className="size-4" aria-hidden="true" />
                </button>
              </SegmentActionTooltip>
            ) : null
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 transition-colors focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/15">
          <Textarea
            ref={editTextareaRef}
            value={editDraft ?? ""}
            onChange={(event) => onEditDraftChange?.(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            className="min-h-0 resize-none border-0 bg-transparent p-0 text-[15px] leading-relaxed text-slate-900 shadow-none focus-visible:border-0 focus-visible:ring-0"
            rows={1}
          />
        </div>
      ) : (
        <p
          onDoubleClick={(event) => {
            if (!canEdit) {
              return;
            }

            event.stopPropagation();
            onRequestEdit?.();
          }}
          className={cn(
            "mt-3 text-[15px] leading-relaxed transition-colors",
            isActive ? "text-slate-900" : "text-slate-600 group-hover:text-slate-800",
            !canEdit && "cursor-default"
          )}
        >
          {highlightRanges?.length
            ? renderTranscriptHighlight(displayText, highlightRanges, {
                currentMatchId: highlightRanges.some((range) => range.isCurrent)
                  ? "transcript-search-current-match"
                  : undefined,
              })
            : displayText}
        </p>
      )}
    </div>
  );
}
