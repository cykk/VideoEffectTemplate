"use client";

import { Copy, Languages, Search } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME } from "@/components/transcriptions/transcription-page-chrome-styles";
import type { TranscriptionViewCapabilities } from "@/components/transcriptions/transcription-view-capabilities";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import type { ReactElement } from "react";

function SegmentActionTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export type TranscriptionTranscriptToolbarProps = {
  title: string;
  toolbarDict: TranscriptionsPageDictionary["toolbar"];
  capabilities: TranscriptionViewCapabilities["transcript"];
  isSearchOpen?: boolean;
  isTranslationOpen?: boolean;
  onSearchClick?: () => void;
  onCopyClick?: () => void;
  translationTrigger?: ReactElement;
};

export function TranscriptionTranscriptToolbar({
  title,
  toolbarDict,
  capabilities,
  isSearchOpen = false,
  isTranslationOpen = false,
  onSearchClick,
  onCopyClick,
  translationTrigger,
}: TranscriptionTranscriptToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
          {capabilities.search ? (
            <SegmentActionTooltip label={toolbarDict.actions.searchTooltip}>
              <button
                type="button"
                className={cn(
                  TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME,
                  isSearchOpen && "bg-brand-50 text-brand-600"
                )}
                aria-label={toolbarDict.actions.searchAria}
                aria-expanded={isSearchOpen}
                onClick={onSearchClick}
              >
                <Search className="size-4" aria-hidden="true" />
              </button>
            </SegmentActionTooltip>
          ) : null}
          {capabilities.copy ? (
            <SegmentActionTooltip label={toolbarDict.actions.copyTooltip}>
              <button
                type="button"
                className={TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME}
                aria-label={toolbarDict.actions.copyAria}
                onClick={onCopyClick}
              >
                <Copy className="size-4" aria-hidden="true" />
              </button>
            </SegmentActionTooltip>
          ) : null}
          {capabilities.translate !== "off" ? (
            translationTrigger ?? (
              <SegmentActionTooltip label={toolbarDict.actions.translateTooltip}>
                <button
                  type="button"
                  className={cn(
                    TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME,
                    "relative",
                    isTranslationOpen && "bg-brand-50 text-brand-600"
                  )}
                  aria-label={toolbarDict.actions.translateAria}
                  aria-expanded={isTranslationOpen}
                >
                  <Languages className="size-4" aria-hidden="true" />
                </button>
              </SegmentActionTooltip>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

