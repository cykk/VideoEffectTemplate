"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { Check, Copy, Edit3, Play, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@markless/shared/src/lib/utils";
import { getSpeakerAvatarClassName } from "@/lib/transcriptions/speaker-presentation";
import {
  renderTranscriptHighlight,
  type TranscriptHighlightRange,
} from "@/lib/transcriptions/render-transcript-highlight";
import { formatTranscriptTimestamp } from "@/lib/shared-transcription-formatters";
import { TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME } from "@/components/transcriptions/transcription-page-chrome-styles";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import type { TranscriptionDisplaySegment } from "@markless/shared/src/types/transcriptions";

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

export type TranscriptionSegmentCardProps = {
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
  canPlay?: boolean;
  canCopy?: boolean;
  segmentEditDict: TranscriptionsPageDictionary["segmentEdit"];
  unknownValue: string;
};

export function TranscriptionSegmentCard({
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
  canPlay = true,
  canCopy = true,
  segmentEditDict,
  unknownValue,
}: TranscriptionSegmentCardProps) {
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const speakerLabel = segment.speakerLabel ?? "Speaker";
  const speakerInitial = speakerLabel.charAt(0).toUpperCase();
  const avatarClassName = getSpeakerAvatarClassName(segment.speakerColorToken);
  const showActions = isEditing || isActive;
  const showHoverActions = canPlay || canCopy || canEdit;

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

          <span className="shrink-0 text-xs font-medium leading-none text-slate-400">
            {formatTranscriptTimestamp(segment.startMs) || unknownValue}
          </span>
        </div>

        {showHoverActions ? (
          <div
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 transition-opacity duration-200",
              showActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {canPlay ? (
              <SegmentActionTooltip label={segmentEditDict.actions.playTooltip}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onPlaySegment?.(segment);
                  }}
                  className={`${TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME} text-slate-400 group-hover:text-slate-600`}
                  aria-label={segmentEditDict.actions.playAria}
                >
                  <Play className="size-4" aria-hidden="true" />
                </button>
              </SegmentActionTooltip>
            ) : null}
            {canCopy ? (
              <SegmentActionTooltip label={segmentEditDict.actions.copyTooltip}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onCopySegment?.(segment);
                  }}
                  className={`${TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME} text-slate-400 group-hover:text-slate-600`}
                  aria-label={segmentEditDict.actions.copyAria}
                >
                  <Copy className="size-4" aria-hidden="true" />
                </button>
              </SegmentActionTooltip>
            ) : null}
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
                    TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME,
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
                  className={`${TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME} text-slate-400 group-hover:text-slate-600`}
                  aria-label={segmentEditDict.actions.cancelAria}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </>
            ) : canEdit ? (
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
                  className={`${TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME} text-slate-400 group-hover:text-slate-600`}
                  aria-label={segmentEditDict.actions.editAria}
                >
                  <Edit3 className="size-4" aria-hidden="true" />
                </button>
              </SegmentActionTooltip>
            ) : null}
          </div>
        ) : null}
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

