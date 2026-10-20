"use client";

import type { KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import { cn } from "@markless/shared/src/lib/utils";
import { TRANSCRIPTION_INLINE_INPUT_CLASSNAME } from "@/components/transcriptions/transcription-page-chrome-styles";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import type { SearchReplaceTab } from "@/hooks/use-transcript-search-replace";

const TAB_BUTTON_BASE_CLASSNAME =
  "min-h-8 cursor-pointer border-b-2 px-3 py-1.5 text-xs font-medium transition-colors";

const TAB_BUTTON_ACTIVE_CLASSNAME =
  "border-primary bg-brand-50/60 font-semibold text-brand-600";

const TAB_BUTTON_INACTIVE_CLASSNAME =
  "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700";

const PANEL_HEADER_CLASSNAME = "flex items-center justify-between gap-2 px-3 py-2.5";

const PANEL_BODY_CLASSNAME =
  "space-y-3 border-t border-slate-200/80 px-3 py-3";

const FIELD_STACK_CLASSNAME = "space-y-2";

const FIELD_LABEL_CLASSNAME = "text-xs font-semibold text-slate-900";

const MATCH_NAV_GROUP_CLASSNAME =
  "pointer-events-auto flex items-center gap-0.5 rounded-md bg-slate-100/80 px-1 py-0.5";

const MATCH_NAV_BUTTON_CLASSNAME =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 transition-colors hover:bg-white hover:text-slate-700 hover:shadow-sm xl:size-6";

function formatMatchCounter(
  template: string,
  current: number,
  total: number
): string {
  return template
    .replace("{current}", String(current))
    .replace("{total}", String(total));
}

function SearchInputWithNavigation({
  id,
  label,
  placeholder,
  value,
  onChange,
  matchCounterTemplate,
  noResultsLabel,
  matchCount,
  currentMatchIndex,
  onPreviousMatch,
  onNextMatch,
  prevMatchAria,
  nextMatchAria,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  matchCounterTemplate: string;
  noResultsLabel: string;
  matchCount: number;
  currentMatchIndex: number;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  prevMatchAria: string;
  nextMatchAria: string;
}) {
  const hasSearchQuery = value.trim().length > 0;
  const hasMatches = matchCount > 0;
  const matchCounterLabel = hasMatches
    ? formatMatchCounter(
        matchCounterTemplate,
        currentMatchIndex + 1,
        matchCount
      )
    : noResultsLabel;

  return (
    <div className={FIELD_STACK_CLASSNAME}>
      <label htmlFor={id} className={FIELD_LABEL_CLASSNAME}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            TRANSCRIPTION_INLINE_INPUT_CLASSNAME,
            hasSearchQuery && (hasMatches ? "pr-[6.75rem]" : "pr-[5.75rem]")
          )}
        />

        {hasSearchQuery ? (
          <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center">
            <div className={MATCH_NAV_GROUP_CLASSNAME}>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  hasMatches
                    ? "min-w-[2.25rem] px-0.5 text-center text-slate-500"
                    : "whitespace-nowrap px-1 text-slate-400"
                )}
                aria-live="polite"
                aria-atomic="true"
                aria-label={hasMatches ? undefined : noResultsLabel}
              >
                {matchCounterLabel}
              </span>
              {hasMatches ? (
                <>
                  <button
                    type="button"
                    onClick={onPreviousMatch}
                    className={MATCH_NAV_BUTTON_CLASSNAME}
                    aria-label={prevMatchAria}
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextMatch}
                    className={MATCH_NAV_BUTTON_CLASSNAME}
                    aria-label={nextMatchAria}
                  >
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TranscriptionSearchReplacePanelProps = {
  dict: TranscriptionsPageDictionary["searchReplace"];
  tab: SearchReplaceTab;
  onTabChange: (tab: SearchReplaceTab) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  replaceQuery: string;
  onReplaceQueryChange: (value: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  isReplacing: boolean;
  onClose: () => void;
};

export function TranscriptionSearchReplacePanel({
  dict,
  tab,
  onTabChange,
  searchQuery,
  onSearchQueryChange,
  replaceQuery,
  onReplaceQueryChange,
  matchCount,
  currentMatchIndex,
  onPreviousMatch,
  onNextMatch,
  onReplaceOne,
  onReplaceAll,
  isReplacing,
  onClose,
}: TranscriptionSearchReplacePanelProps) {
  const hasMatches = matchCount > 0;

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      onTabChange(tab === "search" ? "replace" : "search");
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onTabChange("search");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onTabChange("replace");
    }
  };

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
        <div
          role="tablist"
          aria-label={dict.popoverAria}
          className="flex min-w-0 flex-1 items-end gap-1"
          onKeyDown={handleTabKeyDown}
        >
          <button
            type="button"
            role="tab"
            id="transcript-search-replace-tab-search"
            aria-selected={tab === "search"}
            aria-controls="transcript-search-replace-panel"
            onClick={() => onTabChange("search")}
            className={cn(
              TAB_BUTTON_BASE_CLASSNAME,
              tab === "search"
                ? TAB_BUTTON_ACTIVE_CLASSNAME
                : TAB_BUTTON_INACTIVE_CLASSNAME
            )}
          >
            {dict.tabs.search}
          </button>
          <button
            type="button"
            role="tab"
            id="transcript-search-replace-tab-replace"
            aria-selected={tab === "replace"}
            aria-controls="transcript-search-replace-panel"
            onClick={() => onTabChange("replace")}
            className={cn(
              TAB_BUTTON_BASE_CLASSNAME,
              tab === "replace"
                ? TAB_BUTTON_ACTIVE_CLASSNAME
                : TAB_BUTTON_INACTIVE_CLASSNAME
            )}
          >
            {dict.tabs.replace}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={dict.closeAria}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div
        id="transcript-search-replace-panel"
        role="tabpanel"
        aria-labelledby={
          tab === "search"
            ? "transcript-search-replace-tab-search"
            : "transcript-search-replace-tab-replace"
        }
        className={PANEL_BODY_CLASSNAME}
      >
        <SearchInputWithNavigation
          id="transcript-search-input"
          label={dict.searchLabel}
          placeholder={dict.searchPlaceholder}
          value={searchQuery}
          onChange={onSearchQueryChange}
          matchCounterTemplate={dict.matchCounter}
          noResultsLabel={dict.noResults}
          matchCount={matchCount}
          currentMatchIndex={currentMatchIndex}
          onPreviousMatch={onPreviousMatch}
          onNextMatch={onNextMatch}
          prevMatchAria={dict.prevMatchAria}
          nextMatchAria={dict.nextMatchAria}
        />

        {tab === "replace" ? (
          <>
            <div className={FIELD_STACK_CLASSNAME}>
              <label
                htmlFor="transcript-replace-input"
                className={FIELD_LABEL_CLASSNAME}
              >
                {dict.replaceLabel}
              </label>
              <input
                id="transcript-replace-input"
                type="text"
                value={replaceQuery}
                onChange={(event) => onReplaceQueryChange(event.target.value)}
                placeholder={dict.replacePlaceholder}
                autoComplete="off"
                className={TRANSCRIPTION_INLINE_INPUT_CLASSNAME}
              />
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                size="sm"
                disabled={!hasMatches || isReplacing}
                onClick={() => {
                  void onReplaceOne();
                }}
                className="h-8 flex-1 text-xs shadow-none"
              >
                {dict.replaceOne}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!hasMatches || isReplacing}
                onClick={() => {
                  void onReplaceAll();
                }}
                className="h-8 flex-1 text-xs shadow-none"
              >
                {dict.replaceAll}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </PopoverContent>
  );
}
