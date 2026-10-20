"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Clock,
  Facebook,
  FileAudio2,
  FileVideo2,
  Info,
  Instagram,
  Link as LinkIcon,
  LoaderCircle,
  Mic,
  Search,
  Sparkles,
  Subtitles,
  Trash2,
  Twitter,
  Upload,
  Youtube,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { toastErrorOptions } from "@markless/shared/src/lib/toast-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AppUpgradeDialog } from "@/components/pricing/app-upgrade-dialog";
import { AuthModal } from "@/components/tools/auth-modal";
import { GuestLimitAuthModal } from "@/components/tools/guest-limit-auth-modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildDashboardUrl, useAuthAction, type GuestLimitUsageSnapshot } from "@/hooks/use-auth-action";
import { useLocale } from "@/hooks/use-locale";
import { useUserBootstrap, SIGNED_OUT_BOOTSTRAP, USER_BOOTSTRAP_QUERY_KEY } from "@/hooks/use-user-bootstrap";
import { cn } from "@markless/shared/src/lib/utils";
import {
  getSupportedTranscriptionUploadAccept,
  inferSupportedTranscriptionUploadSourceType,
  resolveSupportedTranscriptionUploadContentType,
} from "@markless/shared/src/lib/transcriptions/media-formats";
import {
  formatTranscriptionUploadFileSizeLimit,
  getTranscriptionUploadMaxFileBytes,
} from "@markless/shared/src/lib/transcriptions/upload-limits";
import type { HeroUploadAudioLanguageId } from "@markless/shared/src/i18n/data/hero-upload-audio-languages";
import type { LandingDictionary } from "@markless/shared/src/i18n/types";
import {
  buildLocalizedTranscriptionPath,
  saveGuestTranscriptionClaimState,
  saveTranscriptionUploadPreferences,
} from "@/lib/transcriptions/client-storage";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import { markCreditsRefreshPending } from "@markless/shared/src/lib/payments/client-checkout";
import {
  API_ERROR_CODES,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from "@markless/shared/src/types/api/video";
import {
  trackFileSelected,
  trackTranscriptionStarted,
  trackUploadCompleted,
  trackUploadCtaClicked,
  trackUploadFailed,
  trackUploadStarted,
} from "@/lib/analytics/project";

type SelectedFileState = {
  file: File;
  sourceType: "audio" | "video";
  contentType: string;
  durationMs: number | null;
};

type UploadConfigSettings = {
  audioLanguage: HeroUploadAudioLanguageId;
  generateSubtitle: boolean;
  aiSummary: "off" | "general";
};

type UploadUrlPayload = {
  key: string;
  uploadUrl: string;
  objectUrl: string;
  method: "PUT";
  headers: Record<string, string>;
};

type CreateTranscriptionPayload = {
  publicId: string;
  resultUrl: string;
  anonymousAccessToken: string | null;
};

type UploadPhase = "idle" | "uploading" | "starting";

type LinkResolvePayload = {
  canonicalUrl: string;
  title: string;
  durationMs: number | null;
  thumbnailUrl: string | null;
  sourceType: "audio" | "video";
  status: "resolvable" | "preview_only";
  reason: string | null;
  message: string | null;
  previewToken: string;
};

type LinkResolvedMediaState = LinkResolvePayload;

type TranscriptionPreflightPayload = {
  allowed: boolean;
  requiredCredits: number;
  availableCredits: number;
};

type AnonymousTranscriptionPreflightPayload = {
  allowed: boolean;
  used: number;
  limit: number;
  remainingCount: number;
};

type UploadDict = LandingDictionary["hero"]["upload"];

const DEFAULT_UPLOAD_CONFIG: UploadConfigSettings = {
  audioLanguage: "auto",
  generateSubtitle: false,
  aiSummary: "off",
};

const SETTING_SELECT_TRIGGER_CLASSNAME =
  "flex h-8 w-full max-w-[140px] cursor-pointer items-center justify-between gap-2 truncate rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-700 shadow-xs outline-none transition-[color,box-shadow] hover:border-slate-300 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-[160px] sm:max-w-[160px] [&_svg]:pointer-events-none [&_svg]:shrink-0";

const SETTING_SELECT_ITEM_CLASSNAME =
  "cursor-pointer text-sm font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-700 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-700 data-[state=checked]:text-slate-700 data-[state=checked]:[&_svg]:text-primary";

const SETTING_SELECT_CONTENT_CLASSNAME = "rounded-lg border-slate-200 shadow-md";

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function inferSourceType(file: File): "audio" | "video" | null {
  return inferSupportedTranscriptionUploadSourceType({
    fileName: file.name,
    contentType: file.type,
  });
}

function resolveMediaDurationMs(
  file: File,
  sourceType: "audio" | "video"
): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const mediaElement = document.createElement(sourceType === "video" ? "video" : "audio");

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      mediaElement.removeAttribute("src");
      mediaElement.load();
    };

    mediaElement.preload = "metadata";
    mediaElement.onloadedmetadata = () => {
      const durationSeconds = mediaElement.duration;
      cleanup();

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        resolve(null);
        return;
      }

      resolve(Math.round(durationSeconds * 1000));
    };

    mediaElement.onerror = () => {
      cleanup();
      resolve(null);
    };

    mediaElement.src = objectUrl;
  });
}

function isApiSuccess<T>(
  payload: ApiSuccessResponse<T> | ApiErrorResponse | null
): payload is ApiSuccessResponse<T> {
  return Boolean(payload?.success);
}

function resolveApiErrorMessage(
  payload: ApiSuccessResponse<unknown> | ApiErrorResponse | null,
  fallback: string
): string {
  if (payload && !payload.success) {
    return payload.error.message;
  }

  return fallback;
}

function isInsufficientCreditsError(
  payload: ApiSuccessResponse<unknown> | ApiErrorResponse | null
): payload is ApiErrorResponse {
  return Boolean(
    payload &&
      !payload.success &&
      payload.error.code === API_ERROR_CODES.INSUFFICIENT_CREDITS
  );
}

function isAnonymousCreditsExhaustedError(
  payload: ApiSuccessResponse<unknown> | ApiErrorResponse | null
): payload is ApiErrorResponse {
  return Boolean(
    payload &&
      !payload.success &&
      payload.error.code === API_ERROR_CODES.ANONYMOUS_CREDITS_EXHAUSTED
  );
}

function isUploadFileTooLargeError(
  payload: ApiSuccessResponse<unknown> | ApiErrorResponse | null
): payload is ApiErrorResponse {
  return Boolean(
    payload && !payload.success && payload.error.code === API_ERROR_CODES.UPLOAD_FILE_TOO_LARGE
  );
}

function resolveGuestLimitUsage(
  source: { used?: number; limit?: number } | null | undefined,
  fallbackLimit: number
): GuestLimitUsageSnapshot {
  const limit =
    typeof source?.limit === "number" && source.limit > 0 ? source.limit : fallbackLimit;
  const used =
    typeof source?.used === "number" && source.used >= 0
      ? source.used
      : limit;

  return { used, limit };
}

function getAnonymousLimitUsageFromError(
  payload: ApiErrorResponse
): { used?: number; limit?: number } | undefined {
  const details = payload.error.details;
  if (!details || typeof details !== "object") {
    return undefined;
  }

  const record = details as Record<string, unknown>;
  return {
    used: typeof record.used === "number" ? record.used : undefined,
    limit: typeof record.limit === "number" ? record.limit : undefined,
  };
}

function normalizeLinkUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function uploadFileWithProgress(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    file: File;
    onProgress: (progress: number) => void;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method, url);

    for (const [key, value] of Object.entries(options.headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        return;
      }

      const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
      options.onProgress(progress);
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress(100);
        resolve();
        return;
      }

      reject(new Error("Upload failed"));
    };

    xhr.send(options.file);
  });
}

type AudioLanguageOption = {
  id: string;
  label: string;
  nativeLabel: string;
};

function LanguageOptionDisplay({
  label,
  nativeLabel,
  singleLine = false,
}: {
  label: string;
  nativeLabel: string;
  singleLine?: boolean;
}) {
  if (singleLine || !nativeLabel) {
    return (
      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight text-slate-700">
        {label}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 overflow-hidden text-left">
      <span className="w-full truncate text-sm font-medium leading-tight text-slate-700">
        {label}
      </span>
      <span className="w-full truncate text-xs leading-tight text-slate-500">{nativeLabel}</span>
    </span>
  );
}

function AudioLanguagePicker({
  languages,
  value,
  onValueChange,
  searchPlaceholder,
  noResults,
}: {
  languages: AudioLanguageOption[];
  value: HeroUploadAudioLanguageId;
  onValueChange: (value: HeroUploadAudioLanguageId) => void;
  searchPlaceholder: string;
  noResults: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const autoLanguage = languages.find((language) => language.id === "auto");
  const otherLanguages = languages.filter((language) => language.id !== "auto");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredLanguages = normalizedSearch
    ? otherLanguages.filter(
        (language) =>
          language.label.toLowerCase().includes(normalizedSearch) ||
          language.nativeLabel.toLowerCase().includes(normalizedSearch)
      )
    : otherLanguages;

  const selectedLanguage =
    languages.find((language) => language.id === value) ?? languages[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setSearch("");
    }
  };

  const handleSelect = (languageId: HeroUploadAudioLanguageId) => {
    onValueChange(languageId);
    setOpen(false);
  };

  const renderLanguageItem = (language: AudioLanguageOption, singleLine = false) => {
    const isSelected = language.id === value;

    return (
      <button
        key={language.id}
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => handleSelect(language.id as HeroUploadAudioLanguageId)}
        className={cn(
          "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-sm px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none",
          isSelected && "text-slate-700"
        )}
      >
        <LanguageOptionDisplay
          label={language.label}
          nativeLabel={language.nativeLabel}
          singleLine={singleLine}
        />
        {isSelected ? (
          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <span className="size-4 shrink-0" aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={SETTING_SELECT_TRIGGER_CLASSNAME}
          title={selectedLanguage?.label}
          aria-expanded={open}
        >
          <span className="truncate">{selectedLanguage?.label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          SETTING_SELECT_CONTENT_CLASSNAME,
          "w-[var(--radix-popover-trigger-width)] overflow-x-hidden p-0"
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex justify-center border-b border-slate-100 px-3 py-2.5">
          <div className="relative w-full min-w-0">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full min-w-0 border border-slate-200 pl-8 text-sm shadow-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
              aria-label={searchPlaceholder}
            />
          </div>
        </div>

        <div className="overflow-x-hidden px-1">
          {autoLanguage ? renderLanguageItem(autoLanguage, true) : null}
        </div>

        <div
          className="max-h-44 overflow-x-hidden overflow-y-auto px-1 pb-1"
          role="listbox"
          aria-label={searchPlaceholder}
        >
          {filteredLanguages.map((language) => renderLanguageItem(language))}
          {normalizedSearch && filteredLanguages.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">{noResults}</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center text-slate-500 transition-colors hover:text-slate-600"
          aria-label={content}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function UploadSettingRow({
  icon,
  label,
  hint,
  badge,
  tooltip,
  control,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  badge?: string;
  tooltip?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center self-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
          <div className="flex w-full flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">{label}</span>
            {badge ? (
              <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                {badge}
              </span>
            ) : null}
            {tooltip ? <InfoTooltip content={tooltip} /> : null}
          </div>
          {hint ? (
            <p className="w-full text-left text-xs leading-snug text-slate-500">{hint}</p>
          ) : null}
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center justify-end self-center sm:w-auto sm:max-w-[160px]">
        {control}
      </div>
    </div>
  );
}

function UploadFileConfigCard({
  selectedFile,
  durationLabel,
  uploadDict,
  config,
  onConfigChange,
  onRemove,
}: {
  selectedFile: SelectedFileState;
  durationLabel: string;
  uploadDict: UploadDict;
  config: UploadConfigSettings;
  onConfigChange: (next: UploadConfigSettings) => void;
  onRemove: () => void;
}) {
  const settings = uploadDict.settings;
  const audioLanguages = settings.audioLanguage.languages;

  return (
    <>
      <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:p-7">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {selectedFile.sourceType === "video" ? (
            <FileVideo2 className="size-7 text-primary" aria-hidden="true" />
          ) : (
            <FileAudio2 className="size-7 text-primary" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-base font-medium text-slate-700">{selectedFile.file.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-500">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{durationLabel}</span>
            <span aria-hidden="true">{uploadDict.selected.fileMetaSeparator}</span>
            <span>{formatFileSize(selectedFile.file.size)}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
          aria-label={uploadDict.selected.removeFileAria}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-5 pb-3 sm:px-7">
        <UploadSettingRow
          icon={<Mic className="size-5" aria-hidden="true" />}
          label={settings.audioLanguage.label}
          hint={settings.audioLanguage.hint}
          control={
            <AudioLanguagePicker
              languages={audioLanguages}
              value={config.audioLanguage}
              onValueChange={(value) =>
                onConfigChange({
                  ...config,
                  audioLanguage: value,
                })
              }
              searchPlaceholder={settings.audioLanguage.searchPlaceholder}
              noResults={settings.audioLanguage.noResults}
            />
          }
        />

{/*
        <UploadSettingRow
          icon={<Subtitles className="size-4" aria-hidden="true" />}
          label={settings.generateSubtitle.label}
          tooltip={settings.generateSubtitle.tooltip}
          control={
            <Switch
              className="cursor-pointer"
              checked={config.generateSubtitle}
              onCheckedChange={(checked) =>
                onConfigChange({ ...config, generateSubtitle: checked })
              }
              aria-label={settings.generateSubtitle.label}
            />
          }
        />
*/}

        <UploadSettingRow
          icon={<Sparkles className="size-5" aria-hidden="true" />}
          label={settings.aiSummary.label}
          tooltip={settings.aiSummary.tooltip}
          control={
            <Select
              value={config.aiSummary}
              onValueChange={(value: "off" | "general") =>
                onConfigChange({ ...config, aiSummary: value })
              }
            >
              <SelectTrigger className={SETTING_SELECT_TRIGGER_CLASSNAME} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="end"
                className={cn(
                  SETTING_SELECT_CONTENT_CLASSNAME,
                  "w-[var(--radix-select-trigger-width)]"
                )}
              >
                <SelectItem
                  value="off"
                  className={cn(SETTING_SELECT_ITEM_CLASSNAME, "py-2")}
                >
                  {settings.aiSummary.options.off}
                </SelectItem>
                <SelectItem
                  value="general"
                  className={cn(SETTING_SELECT_ITEM_CLASSNAME, "py-2")}
                >
                  {settings.aiSummary.options.general}
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />

      </div>
    </>
  );
}

function LinkMediaConfigCard({
  media,
  durationLabel,
  uploadDict,
  config,
  onConfigChange,
}: {
  media: LinkResolvedMediaState;
  durationLabel: string;
  uploadDict: UploadDict;
  config: UploadConfigSettings;
  onConfigChange: (next: UploadConfigSettings) => void;
}) {
  const settings = uploadDict.settings;
  const audioLanguages = settings.audioLanguage.languages;

  return (
    <>
      <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:p-7">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
          {media.thumbnailUrl ? (
            <Image
              src={media.thumbnailUrl}
              alt={uploadDict.link.previewThumbnailAlt}
              width={56}
              height={56}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : media.sourceType === "video" ? (
            <FileVideo2 className="size-7 text-primary" aria-hidden="true" />
          ) : (
            <FileAudio2 className="size-7 text-primary" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-base font-medium text-slate-700">{media.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-500">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{durationLabel}</span>
          </p>
        </div>
      </div>

      <div className="px-5 pb-3 sm:px-7">
        <UploadSettingRow
          icon={<Mic className="size-5" aria-hidden="true" />}
          label={settings.audioLanguage.label}
          hint={settings.audioLanguage.hint}
          control={
            <AudioLanguagePicker
              languages={audioLanguages}
              value={config.audioLanguage}
              onValueChange={(value) =>
                onConfigChange({
                  ...config,
                  audioLanguage: value,
                })
              }
              searchPlaceholder={settings.audioLanguage.searchPlaceholder}
              noResults={settings.audioLanguage.noResults}
            />
          }
        />

{/*
        <UploadSettingRow
          icon={<Subtitles className="size-4" aria-hidden="true" />}
          label={settings.generateSubtitle.label}
          tooltip={settings.generateSubtitle.tooltip}
          control={
            <Switch
              className="cursor-pointer"
              checked={config.generateSubtitle}
              onCheckedChange={(checked) =>
                onConfigChange({ ...config, generateSubtitle: checked })
              }
              aria-label={settings.generateSubtitle.label}
            />
          }
        />
*/}

        <UploadSettingRow
          icon={<Sparkles className="size-5" aria-hidden="true" />}
          label={settings.aiSummary.label}
          tooltip={settings.aiSummary.tooltip}
          control={
            <Select
              value={config.aiSummary}
              onValueChange={(value: "off" | "general") =>
                onConfigChange({ ...config, aiSummary: value })
              }
            >
              <SelectTrigger className={SETTING_SELECT_TRIGGER_CLASSNAME} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="end"
                className={cn(
                  SETTING_SELECT_CONTENT_CLASSNAME,
                  "w-[var(--radix-select-trigger-width)]"
                )}
              >
                <SelectItem
                  value="off"
                  className={cn(SETTING_SELECT_ITEM_CLASSNAME, "py-2")}
                >
                  {settings.aiSummary.options.off}
                </SelectItem>
                <SelectItem
                  value="general"
                  className={cn(SETTING_SELECT_ITEM_CLASSNAME, "py-2")}
                >
                  {settings.aiSummary.options.general}
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />

      </div>
    </>
  );
}

export type TranscriptionHeroUploadVariant = "marketing" | "dashboard";

export function TranscriptionHeroUpload({
  showFooter = true,
  variant = "marketing",
  enableLinkTab = true,
  onTranscriptionCreated,
}: {
  showFooter?: boolean;
  variant?: TranscriptionHeroUploadVariant;
  /** When false, hides Paste Link tab and panel (upload-only). Restore by setting true. */
  enableLinkTab?: boolean;
  onTranscriptionCreated?: (publicId: string) => void | Promise<void>;
} = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { locale, dictionary } = useLocale();
  const { data: bootstrap } = useUserBootstrap();
  const {
    showAuthModal,
    showGuestLimitAuthModal,
    guestLimitUsage,
    authMode,
    openGuestLimitSignUp,
    closeAuth,
    closeGuestLimitAuth,
    setAuthMode,
  } = useAuthAction();
  const uploadDict = dictionary.marketing.landing.hero.upload;
  const dashboardUploadDict = dictionary.pages.dashboard.upload;
  const isDashboard = variant === "dashboard";
  const showLinkTab = enableLinkTab;
  const dashboardUrl = buildDashboardUrl(locale);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(null);
  const [uploadConfig, setUploadConfig] = useState<UploadConfigSettings>(DEFAULT_UPLOAD_CONFIG);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"upload" | "link">("upload");
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [resolvedLinkMedia, setResolvedLinkMedia] = useState<LinkResolvedMediaState | null>(null);
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const hasLinkUrl = linkUrl.trim().length > 0;
  const isAuthenticated = Boolean(bootstrap?.authenticated);

  const refreshAuthenticatedEntitlements = () => {
    if (!isAuthenticated) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: USER_BOOTSTRAP_QUERY_KEY,
      exact: true,
    });
  };

  const anonymousDailyLimit =
    bootstrap?.freeTranscription.anonymous.dailyLimit ??
    SIGNED_OUT_BOOTSTRAP.freeTranscription.anonymous.dailyLimit;

  const openAnonymousLimitSignUp = (usageSource?: { used?: number; limit?: number } | null) => {
    openGuestLimitSignUp(
      resolveGuestLimitUsage(usageSource, anonymousDailyLimit),
      "go_dashboard",
      dashboardUrl
    );
  };

  const guestLimitFreeTierValues = {
    guestDailyLimit: bootstrap?.freeTranscription.anonymous.dailyLimit ??
      SIGNED_OUT_BOOTSTRAP.freeTranscription.anonymous.dailyLimit,
    guestDurationLimitMinutes:
      bootstrap?.freeTranscription.anonymous.durationLimitMinutes ??
      SIGNED_OUT_BOOTSTRAP.freeTranscription.anonymous.durationLimitMinutes,
    authenticatedDailyLimit:
      bootstrap?.freeTranscription.authenticated.dailyLimit ??
      SIGNED_OUT_BOOTSTRAP.freeTranscription.authenticated.dailyLimit,
    authenticatedDurationLimitMinutes:
      bootstrap?.freeTranscription.authenticated.durationLimitMinutes ??
      SIGNED_OUT_BOOTSTRAP.freeTranscription.authenticated.durationLimitMinutes,
  };
  const getFileTooLargeMessage = (sourceType: "audio" | "video") =>
    uploadDict.errors.fileTooLarge.replace(
      "{limit}",
      formatTranscriptionUploadFileSizeLimit(
        getTranscriptionUploadMaxFileBytes({
          accessMode: isAuthenticated ? "authenticated" : "anonymous",
          sourceType,
        })
      )
    );

  const openFilePicker = () => {
    trackUploadCtaClicked({
      entrySurface: isDashboard ? "dashboard" : "hero",
      isAuthenticated,
    });
    inputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadConfig(DEFAULT_UPLOAD_CONFIG);
    setIsSubmitting(false);
    setUploadPhase("idle");
    setUploadProgress(0);
  };

  const handleResolveLink = () => {
    const normalizedUrl = normalizeLinkUrl(linkUrl);
    if (!normalizedUrl || isResolvingLink) {
      return;
    }

    setIsResolvingLink(true);

    void (async () => {
      const response = await apiFetch("/api/transcriptions/link/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: normalizedUrl,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse<LinkResolvePayload>
        | ApiErrorResponse
        | null;

      if (!response.ok || !isApiSuccess(payload)) {
        throw new Error(
          resolveApiErrorMessage(payload, uploadDict.link.errors.resolveFailed)
        );
      }

      setResolvedLinkMedia(payload.data);
      setUploadConfig(DEFAULT_UPLOAD_CONFIG);
      if (normalizedUrl !== linkUrl) {
        setLinkUrl(normalizedUrl);
      }
    })().catch((error) => {
      const message =
        error instanceof Error ? error.message : uploadDict.link.errors.resolveFailed;
      toast.error(message, toastErrorOptions);
      setResolvedLinkMedia(null);
    }).finally(() => {
      setIsResolvingLink(false);
    });
  };

  const runTranscriptionPreflight = async (
    sourceType: "audio" | "video",
    durationMs: number | null
  ) => {
    const response = await apiFetch("/api/transcriptions/preflight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceType,
        durationMs,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | ApiSuccessResponse<TranscriptionPreflightPayload>
      | ApiErrorResponse
      | null;

    if (!response.ok || !isApiSuccess(payload)) {
      if (isInsufficientCreditsError(payload)) {
        setIsUpgradeDialogOpen(true);
        return false;
      }

      throw new Error(
        resolveApiErrorMessage(payload, uploadDict.errors.createFailed)
      );
    }

    if (!payload.data.allowed) {
      setIsUpgradeDialogOpen(true);
      return false;
    }

    return true;
  };

  const runAnonymousTranscriptionPreflight = async () => {
    const response = await apiFetch("/api/transcriptions/anonymous-preflight", {
      method: "POST",
    });

    const payload = (await response.json().catch(() => null)) as
      | ApiSuccessResponse<AnonymousTranscriptionPreflightPayload>
      | ApiErrorResponse
      | null;

    if (!response.ok || !isApiSuccess(payload)) {
      if (isAnonymousCreditsExhaustedError(payload)) {
        openAnonymousLimitSignUp(
          getAnonymousLimitUsageFromError(payload)
        );
        return false;
      }

      throw new Error(
        resolveApiErrorMessage(payload, uploadDict.errors.createFailed)
      );
    }

    if (!payload.data.allowed) {
      openAnonymousLimitSignUp({
        used: payload.data.used,
        limit: payload.data.limit,
      });
      return false;
    }

    return true;
  };

  const handleStartLinkTranscription = () => {
    const normalizedUrl = normalizeLinkUrl(linkUrl);
    if (!normalizedUrl || !resolvedLinkMedia || isSubmittingLink) {
      return;
    }

    setIsSubmittingLink(true);

      void (async () => {
        if (isAuthenticated) {
          const allowed = await runTranscriptionPreflight(
            resolvedLinkMedia.sourceType,
            resolvedLinkMedia.durationMs
        );

          if (!allowed) {
            setIsSubmittingLink(false);
            return;
          }
        } else {
          const allowed = await runAnonymousTranscriptionPreflight();
          if (!allowed) {
            setIsSubmittingLink(false);
            return;
          }
        }

        const createResponse = await apiFetch("/api/transcriptions/from-link", {
          method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: normalizedUrl,
          previewToken: resolvedLinkMedia.previewToken,
          audioLanguage: uploadConfig.audioLanguage,
          aiSummary: uploadConfig.aiSummary,
          aiMindMap: "off",
        }),
      });

      const createPayload = (await createResponse.json().catch(() => null)) as
        | ApiSuccessResponse<CreateTranscriptionPayload>
        | ApiErrorResponse
        | null;

      if (!createResponse.ok || !isApiSuccess(createPayload)) {
        if (isAnonymousCreditsExhaustedError(createPayload)) {
          if (isAuthenticated) {
            setIsUpgradeDialogOpen(true);
          } else {
            openAnonymousLimitSignUp(getAnonymousLimitUsageFromError(createPayload));
          }
          setIsSubmittingLink(false);
          return;
        }
        if (isInsufficientCreditsError(createPayload)) {
          setIsUpgradeDialogOpen(true);
          setIsSubmittingLink(false);
          return;
        }
        throw new Error(
          resolveApiErrorMessage(createPayload, uploadDict.errors.createFailed)
        );
      }

      if (createPayload.data.anonymousAccessToken) {
        saveGuestTranscriptionClaimState(
          createPayload.data.publicId,
          createPayload.data.anonymousAccessToken
        );
      }

      trackTranscriptionStarted({
        sourceType: resolvedLinkMedia.sourceType,
        inputMethod: "link",
        isAuthenticated,
        durationMs: resolvedLinkMedia.durationMs,
        dedupeKey: `transcription_started:${createPayload.data.publicId}`,
      });
      refreshAuthenticatedEntitlements();

      saveTranscriptionUploadPreferences(createPayload.data.publicId, {
        aiSummary: uploadConfig.aiSummary,
        aiMindMap: "off",
        fileName: resolvedLinkMedia.title,
      });

      if (isAuthenticated) {
        markCreditsRefreshPending();
      }

      if (isDashboard) {
        setLinkUrl("");
        setResolvedLinkMedia(null);
        setIsSubmittingLink(false);
        await onTranscriptionCreated?.(createPayload.data.publicId);
      } else {
        router.push(
          buildLocalizedTranscriptionPath(locale, createPayload.data.publicId)
        );
      }
    })().catch((error) => {
      const message =
        error instanceof Error ? error.message : uploadDict.errors.createFailed;
      toast.error(message, toastErrorOptions);
      setIsSubmittingLink(false);
    });
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!nextFile) {
      return;
    }

    const sourceType = inferSourceType(nextFile);
    if (!sourceType) {
      trackUploadFailed({ entrySurface: isDashboard ? "dashboard" : "hero", isAuthenticated, failureStage: "client_validation", dedupeKey: `upload_failed:unsupported:${Date.now()}` });
      toast.error(uploadDict.errors.unsupportedType, toastErrorOptions);
      return;
    }

    const maxFileBytes = getTranscriptionUploadMaxFileBytes({
      accessMode: isAuthenticated ? "authenticated" : "anonymous",
      sourceType,
    });
    if (nextFile.size > maxFileBytes) {
      trackUploadFailed({ sourceType, fileSize: nextFile.size, entrySurface: isDashboard ? "dashboard" : "hero", isAuthenticated, failureStage: "client_validation", dedupeKey: `upload_failed:size:${Date.now()}` });
      toast.error(
        getFileTooLargeMessage(sourceType),
        toastErrorOptions
      );
      return;
    }

    setIsPreparingFile(true);

    try {
      const durationMs = await resolveMediaDurationMs(nextFile, sourceType);
      const contentType = resolveSupportedTranscriptionUploadContentType({
        sourceType,
        fileName: nextFile.name,
        contentType: nextFile.type,
      });
      if (!contentType) {
        trackUploadFailed({ sourceType, fileSize: nextFile.size, entrySurface: isDashboard ? "dashboard" : "hero", isAuthenticated, failureStage: "client_validation", dedupeKey: `upload_failed:type:${Date.now()}` });
        toast.error(uploadDict.errors.unsupportedType, toastErrorOptions);
        return;
      }
      setUploadConfig(DEFAULT_UPLOAD_CONFIG);
      setIsSubmitting(false);
      setUploadPhase("idle");
      setUploadProgress(0);
      setSelectedFile({
        file: nextFile,
        sourceType,
        contentType,
        durationMs,
      });
      trackFileSelected({ sourceType, fileSize: nextFile.size, entrySurface: isDashboard ? "dashboard" : "hero", isAuthenticated, dedupeKey: `file_selected:${nextFile.name}:${nextFile.size}:${Date.now()}` });
    } catch {
      trackUploadFailed({ sourceType, fileSize: nextFile.size, entrySurface: isDashboard ? "dashboard" : "hero", isAuthenticated, failureStage: "client_validation", dedupeKey: `upload_failed:prepare:${Date.now()}` });
      toast.error(uploadDict.errors.prepareFailed, toastErrorOptions);
    } finally {
      setIsPreparingFile(false);
    }
  };

  const handleStartTranscription = () => {
    if (!selectedFile) {
      return;
    }

    setIsSubmitting(true);
    setUploadPhase("uploading");
    setUploadProgress(0);

      void (async () => {
          if (isAuthenticated) {
            const allowed = await runTranscriptionPreflight(
              selectedFile.sourceType,
              selectedFile.durationMs
          );

            if (!allowed) {
              setIsSubmitting(false);
              setUploadPhase("idle");
              setUploadProgress(0);
              return;
            }
          } else {
            const allowed = await runAnonymousTranscriptionPreflight();
            if (!allowed) {
              setIsSubmitting(false);
              setUploadPhase("idle");
              setUploadProgress(0);
              return;
            }
          }

          const uploadResponse = await apiFetch("/api/storage/r2/upload-url", {
            method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: selectedFile.sourceType,
            fileName: selectedFile.file.name,
            fileSize: selectedFile.file.size,
            contentType: selectedFile.contentType,
          }),
        });

        const uploadPayload = (await uploadResponse.json().catch(() => null)) as
          | ApiSuccessResponse<UploadUrlPayload>
          | ApiErrorResponse
          | null;

        if (!uploadResponse.ok || !isApiSuccess(uploadPayload)) {
          if (isUploadFileTooLargeError(uploadPayload)) {
            throw new Error(getFileTooLargeMessage(selectedFile.sourceType));
          }
          throw new Error(
            resolveApiErrorMessage(uploadPayload, uploadDict.errors.uploadFailed)
          );
        }

        trackUploadStarted({ sourceType: selectedFile.sourceType, fileSize: selectedFile.file.size, entrySurface: isDashboard ? "dashboard" : "hero", isAuthenticated, dedupeKey: `upload_started:${uploadPayload.data.key}` });
        await uploadFileWithProgress(uploadPayload.data.uploadUrl, {
          method: uploadPayload.data.method,
          headers: uploadPayload.data.headers,
          file: selectedFile.file,
          onProgress: (progress) => {
            setUploadProgress(progress);
          },
        });
        trackUploadCompleted({ sourceType: selectedFile.sourceType, fileSize: selectedFile.file.size, entrySurface: isDashboard ? "dashboard" : "hero", isAuthenticated, dedupeKey: `upload_completed:${uploadPayload.data.key}` });

        setUploadPhase("starting");

        const createResponse = await apiFetch("/api/transcriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceType: selectedFile.sourceType,
            audioLanguage: uploadConfig.audioLanguage,
            aiSummary: uploadConfig.aiSummary,
            aiMindMap: "off",
            fileName: selectedFile.file.name,
            fileSize: selectedFile.file.size,
            contentType: selectedFile.contentType,
            durationMs: selectedFile.durationMs,
            sourceKey: uploadPayload.data.key,
          }),
        });

        const createPayload = (await createResponse.json().catch(() => null)) as
          | ApiSuccessResponse<CreateTranscriptionPayload>
          | ApiErrorResponse
          | null;

        if (!createResponse.ok || !isApiSuccess(createPayload)) {
          if (isAnonymousCreditsExhaustedError(createPayload)) {
            if (isAuthenticated) {
              setIsUpgradeDialogOpen(true);
            } else {
              openAnonymousLimitSignUp(getAnonymousLimitUsageFromError(createPayload));
            }
            setIsSubmitting(false);
            setUploadPhase("idle");
            setUploadProgress(0);
            return;
          }
          if (isUploadFileTooLargeError(createPayload)) {
            throw new Error(getFileTooLargeMessage(selectedFile.sourceType));
          }
          if (isInsufficientCreditsError(createPayload)) {
            setIsUpgradeDialogOpen(true);
            setIsSubmitting(false);
            setUploadPhase("idle");
            setUploadProgress(0);
            return;
          }
          throw new Error(
            resolveApiErrorMessage(createPayload, uploadDict.errors.createFailed)
          );
        }

        if (createPayload.data.anonymousAccessToken) {
          saveGuestTranscriptionClaimState(
            createPayload.data.publicId,
            createPayload.data.anonymousAccessToken
          );
        }

        trackTranscriptionStarted({
          sourceType: selectedFile.sourceType,
          inputMethod: "upload",
          isAuthenticated,
          durationMs: selectedFile.durationMs,
          fileSize: selectedFile.file.size,
          dedupeKey: `transcription_started:${createPayload.data.publicId}`,
        });
        refreshAuthenticatedEntitlements();

        saveTranscriptionUploadPreferences(createPayload.data.publicId, {
          aiSummary: uploadConfig.aiSummary,
          aiMindMap: "off",
          fileName: selectedFile.file.name,
        });

        if (isAuthenticated) {
          markCreditsRefreshPending();
        }

        if (isDashboard) {
          setSelectedFile(null);
          setUploadPhase("idle");
          setUploadProgress(0);
          setIsSubmitting(false);
          await onTranscriptionCreated?.(createPayload.data.publicId);
        } else {
          router.push(
            buildLocalizedTranscriptionPath(locale, createPayload.data.publicId)
          );
        }
      })().catch((error) => {
        setIsSubmitting(false);
        setUploadPhase("idle");
        setUploadProgress(0);
        const message =
          error instanceof Error ? error.message : uploadDict.errors.createFailed;
        trackUploadFailed({ sourceType: selectedFile.sourceType, fileSize: selectedFile.file.size, entrySurface: isDashboard ? "dashboard" : "hero", isAuthenticated, failureStage: "upload_or_transcription", dedupeKey: `upload_failed:${selectedFile.file.name}:${Date.now()}` });
        toast.error(message, toastErrorOptions);
      });
  };

  const durationLabel = formatDuration(
    selectedFile?.durationMs ?? null,
    dictionary.pages.transcriptions.content.unknownValue
  );
  const uploadButtonLabel =
    uploadPhase === "uploading"
      ? uploadDict.actions.uploadingProgress.replace("{progress}", String(uploadProgress))
      : uploadPhase === "starting"
        ? uploadDict.actions.startingTranscription
        : isDashboard
          ? dashboardUploadDict.actions.startTranscription
          : uploadDict.actions.transcribeForFree;

  const linkSubmitLabel = isSubmittingLink
    ? uploadDict.actions.startingTranscription
    : isDashboard
      ? dashboardUploadDict.actions.startTranscription
      : uploadDict.actions.transcribeForFree;

  const isUploadPanel = !showLinkTab || activeTab === "upload";

  return (
    <Card
      className={cn(
        "w-full max-w-4xl overflow-hidden",
        "border-none bg-transparent shadow-none"
      )}
    >
      {showLinkTab && !isDashboard ? (
        <div className="flex items-center border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={cn(
              "relative flex-1 cursor-pointer text-center text-sm font-semibold transition-colors",
              isDashboard ? "py-3" : "py-4",
              activeTab === "upload" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {uploadDict.tabs.upload}
            {activeTab === "upload" ? (
              <div className="absolute bottom-0 left-1/2 h-0.5 w-1/2 -translate-x-1/2 bg-primary" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("link")}
            className={cn(
              "relative flex-1 cursor-pointer text-center text-sm font-semibold transition-colors",
              isDashboard ? "py-3" : "py-4",
              activeTab === "link" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {uploadDict.tabs.link}
            {activeTab === "link" ? (
              <div className="absolute bottom-0 left-1/2 h-0.5 w-1/2 -translate-x-1/2 bg-primary" />
            ) : null}
          </button>
        </div>
      ) : null}

      <CardContent className={cn(isDashboard ? "p-0" : "px-8 pb-0 pt-4")}>
        {isUploadPanel ? (
          <div className={cn(isDashboard ? "space-y-4" : "space-y-6")}>
            {/* hidden uploadDict.idleDescription */}
            <input
              ref={inputRef}
              type="file"
              accept={getSupportedTranscriptionUploadAccept()}
              className="hidden"
              onChange={handleFileSelection}
            />

            {selectedFile ? (
              <div className="mx-auto w-full max-w-3xl">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
                  <UploadFileConfigCard
                    selectedFile={selectedFile}
                    durationLabel={durationLabel}
                    uploadDict={uploadDict}
                    config={uploadConfig}
                    onConfigChange={setUploadConfig}
                    onRemove={handleRemoveFile}
                  />

                  <div className="bg-slate-50/50 p-5 sm:p-7 border-t border-slate-100">
                    <Button
                      type="button"
                      size="lg"
                      className="h-12 w-full bg-primary text-white hover:bg-primary/90 text-base font-semibold"
                      disabled={isPreparingFile || isSubmitting}
                      onClick={handleStartTranscription}
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                          <span>{uploadButtonLabel}</span>
                        </>
                      ) : (
                        <span>{uploadButtonLabel}</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : isDashboard ? (
              <>
                <div
                className="group relative flex min-h-[16rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 transition-[box-shadow,border-color] hover:border-slate-400 hover:shadow-sm"
                onClick={openFilePicker}
              >
                <p className="text-sm font-semibold text-slate-900">
                  {dashboardUploadDict.idle.dropzoneTitle}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2 border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                  }}
                >
                  <Upload className="size-4 text-slate-500" aria-hidden="true" />
                  {dashboardUploadDict.idle.browseButton}
                </Button>
                <p className="mt-3 text-center text-xs text-slate-500">
                  {dashboardUploadDict.idle.formatsHint}
                </p>
              </div>
              {isDashboard && enableLinkTab && (
                <div className="flex justify-center mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab("link");
                    }}
                  >
                    <LinkIcon className="mr-1.5 size-4" />
                    {uploadDict.tabs.link}
                  </Button>
                </div>
              )}
            </>
            ) : (
              <div
                className="group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-brand-200/60 bg-brand-100/50 py-16 shadow-sm transition-colors duration-300 hover:border-brand-300/60 hover:bg-brand-100"
                onClick={openFilePicker}
              >
                <div className="text-base font-medium text-slate-700">
                  {uploadDict.idle.dropzoneTitle}
                </div>

                <div className="my-6 flex w-48 items-center gap-4">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-medium text-slate-600">{uploadDict.idle.or}</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <Button
                  type="button"
                  className="mb-8 gap-2 bg-primary text-white shadow-sm hover:bg-primary/90"
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                  }}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  {uploadDict.idle.uploadButton}
                </Button>

                <p className="text-center text-xs leading-relaxed text-slate-600">
                  {uploadDict.supportHint}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              isDashboard ? "space-y-4" : "space-y-8 pb-10 pt-6",
              isDashboard && !resolvedLinkMedia && "flex flex-col justify-center"
            )}
          >
            {!isDashboard || !resolvedLinkMedia ? (
            <div className="space-y-4">
            <div
              className={cn(
                "text-sm text-slate-600",
                isDashboard ? "text-left" : "text-center font-medium"
              )}
            >
              {isDashboard ? dashboardUploadDict.link.description : uploadDict.link.description}
            </div>

            {!isDashboard ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <LinkIcon className="size-3.5" aria-hidden="true" />
                {uploadDict.link.platformsLabel}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  <Youtube className="size-3.5 text-red-500" aria-hidden="true" />
                  {uploadDict.link.platforms.youtube}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <span className="font-bold text-slate-900" aria-hidden="true">
                    ♪
                  </span>
                  {uploadDict.link.platforms.tiktok}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  <Instagram className="size-3.5 text-pink-500" aria-hidden="true" />
                  {uploadDict.link.platforms.instagram}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  <Facebook className="size-3.5 text-blue-600" aria-hidden="true" />
                  {uploadDict.link.platforms.facebook}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  <Twitter className="size-3.5 text-slate-900" aria-hidden="true" />
                  {uploadDict.link.platforms.x}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  <LinkIcon className="size-3.5 text-primary" aria-hidden="true" />
                  {uploadDict.link.platforms.manyOther}
                </div>
              </div>
            </div>
            ) : null}

            <div
              className={cn(
                "flex overflow-hidden rounded-lg border bg-white shadow-sm transition-[color,box-shadow] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                isDashboard
                  ? "w-full border-slate-300 hover:border-slate-400"
                  : "mx-auto max-w-xl border-slate-200"
              )}
            >
              <Input
                type="url"
                inputMode="url"
                placeholder={uploadDict.link.placeholder}
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                className={cn(
                  "h-11 flex-1 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0",
                  isDashboard ? "border-r border-slate-300" : "border-r border-slate-200"
                )}
              />
              <Button
                type="button"
                disabled={!hasLinkUrl || isResolvingLink}
                onClick={handleResolveLink}
                className={cn(
                  "h-11 shrink-0 rounded-none rounded-r-lg px-6 transition-colors",
                  hasLinkUrl
                    ? "bg-primary hover:bg-primary/90"
                    : "cursor-not-allowed bg-primary/40 text-white hover:bg-primary/40 disabled:opacity-100"
                )}
              >
                {isResolvingLink ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    {uploadDict.link.searchingButton}
                  </>
                ) : (
                  uploadDict.link.searchButton
                )}
              </Button>
            </div>
            </div>
            ) : null}
            
            {isDashboard && !resolvedLinkMedia && (
              <div className="flex justify-center mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => setActiveTab("upload")}
                >
                  <Upload className="mr-1.5 size-4" />
                  {uploadDict.tabs.upload}
                </Button>
              </div>
            )}

            {resolvedLinkMedia ? (
              <div className="mx-auto w-full max-w-3xl">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
                  <LinkMediaConfigCard
                    media={resolvedLinkMedia}
                    durationLabel={formatDuration(
                      resolvedLinkMedia.durationMs,
                      dictionary.pages.transcriptions.content.unknownValue
                    )}
                    uploadDict={uploadDict}
                    config={uploadConfig}
                    onConfigChange={setUploadConfig}
                  />

                  <div className="bg-slate-50/50 p-5 sm:p-7 border-t border-slate-100">
                    <Button
                      type="button"
                      size="lg"
                      className="h-12 w-full bg-primary text-white hover:bg-primary/90 text-base font-semibold"
                      disabled={isSubmittingLink}
                      onClick={handleStartLinkTranscription}
                    >
                      {isSubmittingLink ? (
                        <>
                          <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                          <span>{uploadDict.actions.startingTranscription}</span>
                        </>
                      ) : (
                        <span>{linkSubmitLabel}</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {showFooter && !isDashboard ? (
          <div className="mt-12 text-center text-xs text-slate-500">
            {uploadDict.footer.termsPrefix}{" "}
            <a
              href={locale === "en" ? "/terms" : `/${locale}/terms`}
              className="text-primary hover:underline"
            >
              {uploadDict.footer.termsLink}
            </a>{" "}
            {uploadDict.footer.termsAnd}{" "}
            <a
              href={locale === "en" ? "/privacy" : `/${locale}/privacy`}
              className="text-primary hover:underline"
            >
              {uploadDict.footer.privacyLink}
            </a>
            .
          </div>
        ) : null}
      </CardContent>

      <AppUpgradeDialog
        open={isUpgradeDialogOpen}
        onOpenChange={setIsUpgradeDialogOpen}
        entrySurface="transcription_insufficient_credits"
        defaultTab="subscription"
      />

      <AuthModal
        open={showAuthModal}
        onOpenChange={closeAuth}
        mode={authMode}
        onModeChange={setAuthMode}
        locale={locale}
        dictionary={dictionary.tools.authModal}
      />

      {guestLimitUsage ? (
        <GuestLimitAuthModal
          open={showGuestLimitAuthModal}
          onOpenChange={closeGuestLimitAuth}
          mode={authMode}
          onModeChange={setAuthMode}
          dictionary={dictionary.tools.authModal}
          freeTierValues={guestLimitFreeTierValues}
        />
      ) : null}
    </Card>
  );
}
