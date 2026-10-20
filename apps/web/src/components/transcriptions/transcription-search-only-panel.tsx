"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PopoverContent } from "@/components/ui/popover";
import { TRANSCRIPTION_INLINE_INPUT_CLASSNAME } from "@/components/transcriptions/transcription-page-chrome-styles";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

const PANEL_HEADER_CLASSNAME = "flex items-center justify-between gap-2 px-3 py-2.5";
const PANEL_BODY_CLASSNAME = "space-y-3 border-t border-slate-200/80 px-3 py-3";
const FIELD_LABEL_CLASSNAME = "text-xs font-medium text-slate-500";
const MATCH_NAV_GROUP_CLASSNAME =
  "pointer-events-auto flex items-center gap-0.5 rounded-md bg-slate-100/80 px-1 py-0.5";
const MATCH_NAV_BUTTON_CLASSNAME =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 transition-colors hover:bg-white hover:text-slate-700 hover:shadow-sm xl:size-6";

function formatMatchCounter(template: string, current: number, total: number): string {
  return template.replace("{current}", String(current)).replace("{total}", String(total));
}

export type TranscriptionSearchOnlyPanelProps = {
  dict: TranscriptionsPageDictionary["searchReplace"];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  onClose: () => void;
};

export function TranscriptionSearchOnlyPanel({
  dict,
  searchQuery,
  onSearchQueryChange,
  matchCount,
  currentMatchIndex,
  onPreviousMatch,
  onNextMatch,
  onClose,
}: TranscriptionSearchOnlyPanelProps) {
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasMatches = matchCount > 0;
  const matchCounterLabel = hasMatches
    ? formatMatchCounter(dict.matchCounter, currentMatchIndex + 1, matchCount)
    : dict.noResults;

  return (
    <PopoverContent
      side="bottom"
      align="end"
      sideOffset={0}
      avoidCollisions={false}
      collisionPadding={16}
      aria-label={dict.popoverAria}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      className="z-[70] w-[min(calc(100vw-2rem),18rem)] rounded-lg border-slate-200/90 p-0 shadow-md"
    >
      <div className={PANEL_HEADER_CLASSNAME}>
        <p className="text-sm font-semibold text-slate-900">{dict.tabs.search}</p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={dict.closeAria}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className={PANEL_BODY_CLASSNAME}>
        <div className="space-y-2">
          <label htmlFor="shared-transcript-search-input" className={FIELD_LABEL_CLASSNAME}>
            {dict.searchLabel}
          </label>
          <div className="relative">
            <input
              id="shared-transcript-search-input"
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder={dict.searchPlaceholder}
              autoComplete="off"
              className={TRANSCRIPTION_INLINE_INPUT_CLASSNAME}
            />
            {hasSearchQuery ? (
              <div className="absolute inset-y-0 right-1 flex items-center">
                <div className={MATCH_NAV_GROUP_CLASSNAME}>
                  <span className="px-1.5 text-[11px] font-medium text-slate-500">
                    {matchCounterLabel}
                  </span>
                  <button
                    type="button"
                    onClick={onPreviousMatch}
                    disabled={!hasMatches}
                    className={MATCH_NAV_BUTTON_CLASSNAME}
                    aria-label={dict.prevMatchAria}
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextMatch}
                    disabled={!hasMatches}
                    className={MATCH_NAV_BUTTON_CLASSNAME}
                    aria-label={dict.nextMatchAria}
                  >
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PopoverContent>
  );
}

