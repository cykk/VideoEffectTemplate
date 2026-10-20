"use client";

import { Languages, LoaderCircle } from "lucide-react";
import { shouldShowDistinctNativeLabel } from "@/components/ui/language-display";

export type TranslationProgressBannerProps = {
  titlePrefix: string;
  languageLabel: string;
  languageNativeLabel: string;
  description: string;
  ariaLabel: string;
};

export function TranslationProgressBanner({
  titlePrefix,
  languageLabel,
  languageNativeLabel,
  description,
  ariaLabel,
}: TranslationProgressBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3.5"
    >
      <div className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100/80 text-brand-700">
        <Languages className="size-4" aria-hidden="true" />
        <LoaderCircle
          className="absolute -right-0.5 -bottom-0.5 size-3.5 animate-spin text-brand-600"
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold leading-snug text-brand-800">
          {titlePrefix}{" "}
          {shouldShowDistinctNativeLabel(languageLabel, languageNativeLabel) ? (
            <>
              <span>{languageLabel}</span>
              <span className="text-brand-300" aria-hidden="true">
                {" · "}
              </span>
              <span className="font-semibold text-brand-600/90">{languageNativeLabel}</span>
            </>
          ) : (
            <span>{languageLabel}</span>
          )}
        </p>
        <p className="text-xs leading-relaxed text-brand-700/80">{description}</p>
      </div>
    </div>
  );
}

