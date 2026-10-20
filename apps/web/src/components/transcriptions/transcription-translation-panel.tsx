"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatLanguageAccessibleLabel,
  LanguageOptionDisplay,
  LanguageSelectedDisplay,
} from "@/components/ui/language-display";
import { cn } from "@markless/shared/src/lib/utils";
import { TRANSCRIPTION_INLINE_INPUT_CLASSNAME } from "@/components/transcriptions/transcription-page-chrome-styles";
import {
  TRANSLATION_TARGET_LANGUAGES,
  type TranslationTargetLanguageId,
  type TranslationTargetLanguageOption,
} from "@markless/shared/src/i18n/data/translation-target-languages";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

const PANEL_HEADER_CLASSNAME = "flex items-center justify-between gap-2 px-3 py-2.5";

const PANEL_BODY_CLASSNAME = "space-y-3 border-t border-slate-200/80 px-3 py-3";

const FIELD_LABEL_CLASSNAME = "text-xs font-medium text-slate-500";

const LANGUAGE_SELECT_TRIGGER_CLASSNAME = cn(
  TRANSCRIPTION_INLINE_INPUT_CLASSNAME,
  "flex h-9 cursor-pointer items-center justify-between gap-2 text-left font-medium"
);

const LANGUAGE_SELECT_CONTENT_CLASSNAME =
  "z-[80] w-[var(--radix-popover-trigger-width)] overflow-x-hidden rounded-lg border-slate-200 p-0 shadow-md";

const DISPLAY_MODE_OPTIONS = ["original", "translation"] as const;

export type TranslationDisplayMode = (typeof DISPLAY_MODE_OPTIONS)[number];

function TranslationDisplayModeControl({
  value,
  onValueChange,
  label,
  ariaLabel,
  originalLabel,
  translationLabel,
  disabled,
}: {
  value: TranslationDisplayMode;
  onValueChange: (value: TranslationDisplayMode) => void;
  label: string;
  ariaLabel: string;
  originalLabel: string;
  translationLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className={FIELD_LABEL_CLASSNAME}>{label}</p>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className="flex rounded-md border border-slate-200 bg-slate-100/80 p-0.5"
      >
        {DISPLAY_MODE_OPTIONS.map((mode) => {
          const isSelected = value === mode;

          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onValueChange(mode)}
              className={cn(
                "flex-1 cursor-pointer rounded-[5px] px-2 py-1.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
                isSelected
                  ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                  : "font-medium text-slate-700 hover:bg-white/40 hover:text-slate-900"
              )}
            >
              {mode === "original" ? originalLabel : translationLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TranslationTargetLanguagePicker({
  value,
  onValueChange,
  searchPlaceholder,
  noResults,
  listAria,
  disabled,
  availableLanguages,
}: {
  value: TranslationTargetLanguageId;
  onValueChange: (value: TranslationTargetLanguageId) => void;
  searchPlaceholder: string;
  noResults: string;
  listAria: string;
  disabled?: boolean;
  availableLanguages?: TranslationTargetLanguageId[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const languagePool = useMemo(() => {
    if (!availableLanguages?.length) {
      return TRANSLATION_TARGET_LANGUAGES;
    }

    const allowedLanguages = new Set(availableLanguages);
    return TRANSLATION_TARGET_LANGUAGES.filter((language) =>
      allowedLanguages.has(language.id)
    );
  }, [availableLanguages]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredLanguages = normalizedSearch
    ? languagePool.filter(
        (language) =>
          language.label.toLowerCase().includes(normalizedSearch) ||
          language.nativeLabel.toLowerCase().includes(normalizedSearch)
      )
    : languagePool;

  const selectedLanguage =
    languagePool.find((language) => language.id === value) ??
    languagePool[0] ??
    TRANSLATION_TARGET_LANGUAGES[0];

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
    if (disabled) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      setSearch("");
    }
  };

  const handleSelect = (languageId: TranslationTargetLanguageId) => {
    onValueChange(languageId);
    setOpen(false);
    setSearch("");
  };

  const renderLanguageItem = (language: TranslationTargetLanguageOption) => {
    const isSelected = language.id === value;

    return (
      <button
        key={language.id}
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => handleSelect(language.id)}
        className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-sm px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"
      >
        <LanguageOptionDisplay
          label={language.label}
          nativeLabel={language.nativeLabel}
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
          disabled={disabled}
          className={LANGUAGE_SELECT_TRIGGER_CLASSNAME}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={formatLanguageAccessibleLabel(
            selectedLanguage.label,
            selectedLanguage.nativeLabel
          )}
        >
          <LanguageSelectedDisplay
            label={selectedLanguage.label}
            nativeLabel={selectedLanguage.nativeLabel}
          />
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={LANGUAGE_SELECT_CONTENT_CLASSNAME}
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

        <div
          className="max-h-44 overflow-x-hidden overflow-y-auto px-1 pb-1"
          role="listbox"
          aria-label={listAria}
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

export type TranscriptionTranslationPanelProps = {
  dict: TranscriptionsPageDictionary["translation"];
  targetLanguage: TranslationTargetLanguageId;
  onTargetLanguageChange: (value: TranslationTargetLanguageId) => void;
  isTranslating: boolean;
  actionState:
    | "not_created"
    | "processing"
    | "fresh_completed"
    | "stale_completed"
    | "failed";
  showDisplayMode: boolean;
  displayMode: TranslationDisplayMode;
  onDisplayModeChange: (value: TranslationDisplayMode) => void;
  onStartTranslation?: () => void | Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
  availableLanguages?: TranslationTargetLanguageId[];
  isLoading?: boolean;
};

export function TranscriptionTranslationPanel({
  dict,
  targetLanguage,
  onTargetLanguageChange,
  isTranslating,
  actionState,
  showDisplayMode,
  displayMode,
  onDisplayModeChange,
  onStartTranslation,
  onClose,
  readOnly = false,
  availableLanguages,
  isLoading = false,
}: TranscriptionTranslationPanelProps) {
  const isTranslationInProgress = actionState === "processing";
  const isPanelLocked = isTranslating || isTranslationInProgress || isLoading;
  const shouldShowActionButton = !readOnly && actionState !== "fresh_completed";
  const panelTitle =
    isTranslationInProgress ? dict.inProgressTitle : dict.title;
  const buttonLabel =
    actionState === "processing"
      ? dict.startButtonLoading
      : actionState === "stale_completed"
        ? dict.retranslateButton
        : actionState === "failed"
          ? dict.retryButton
          : dict.startButton;

  const statusLabel =
    actionState === "stale_completed"
      ? dict.outdatedLabel
      : null;

  return (
    <PopoverContent
      side="right"
      align="start"
      sideOffset={10}
      avoidCollisions={false}
      collisionPadding={16}
      aria-label={dict.popoverAria}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      onPointerDownOutside={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("[data-slot=popover-content]")
        ) {
          event.preventDefault();
        }
      }}
      onFocusOutside={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("[data-slot=popover-content]")
        ) {
          event.preventDefault();
        }
      }}
      className="z-[70] w-[min(calc(100vw-2rem),20rem)] rounded-lg border-slate-200/90 p-0 shadow-md"
    >
      <div className={PANEL_HEADER_CLASSNAME}>
        <h3 className="text-sm font-semibold text-slate-900">{panelTitle}</h3>
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
          <p className={FIELD_LABEL_CLASSNAME}>{dict.targetLanguageLabel}</p>
          <TranslationTargetLanguagePicker
            value={targetLanguage}
            onValueChange={onTargetLanguageChange}
            searchPlaceholder={dict.languageSearchPlaceholder}
            noResults={dict.languageNoResults}
            listAria={dict.languageListAria}
            disabled={isPanelLocked}
            availableLanguages={availableLanguages}
          />
        </div>

        {statusLabel ? (
          <p className="text-xs font-medium text-slate-500">{statusLabel}</p>
        ) : null}

        {shouldShowActionButton ? (
          <Button
            type="button"
            className="h-9 w-full"
            disabled={isPanelLocked}
            aria-busy={isPanelLocked}
            onClick={() => void onStartTranslation?.()}
          >
            {isTranslationInProgress ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {buttonLabel}
              </>
            ) : (
              buttonLabel
            )}
          </Button>
        ) : null}

        {showDisplayMode ? (
          <TranslationDisplayModeControl
            value={displayMode}
            onValueChange={onDisplayModeChange}
            label={dict.displayModeLabel}
            ariaLabel={dict.displayModeAria}
            originalLabel={dict.displayModeOriginal}
            translationLabel={dict.displayModeTranslation}
            disabled={isPanelLocked}
          />
        ) : null}
      </div>
    </PopoverContent>
  );
}

