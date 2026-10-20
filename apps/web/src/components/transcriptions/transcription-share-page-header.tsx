"use client";

import Link from "next/link";
import { ChevronLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@markless/shared/src/lib/utils";
import {
  TRANSCRIPTION_HEADER_BACK_BUTTON_CLASSNAME,
  TRANSCRIPTION_HEADER_EXPORT_BUTTON_CLASSNAME,
} from "@/components/transcriptions/transcription-page-chrome-styles";

export type TranscriptionSharePageHeaderProps = {
  fileName: string;
  homeHref: string;
  backLabel: string;
  exportLabel: string;
  exportDisabled?: boolean;
  onExportClick: () => void;
  searchReplaceAnchor?: React.ReactNode;
  isSearchOpen?: boolean;
};

export function TranscriptionSharePageHeader({
  fileName,
  homeHref,
  backLabel,
  exportLabel,
  exportDisabled = false,
  onExportClick,
  searchReplaceAnchor,
  isSearchOpen = false,
}: TranscriptionSharePageHeaderProps) {
  return (
    <header className="relative flex h-16 flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xl lg:px-6">
      {searchReplaceAnchor}

      <div className="flex min-w-0 flex-1 items-center gap-4 pr-2">
        <Link
          href={homeHref}
          aria-label={backLabel}
          className={cn(TRANSCRIPTION_HEADER_BACK_BUTTON_CLASSNAME, "shrink-0")}
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
          <span>{backLabel}</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-slate-900">{fileName}</h1>
        </div>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center",
          isSearchOpen && "pointer-events-none invisible"
        )}
        aria-hidden={isSearchOpen}
      >
        <Button
          type="button"
          className={cn(
            TRANSCRIPTION_HEADER_EXPORT_BUTTON_CLASSNAME,
            isSearchOpen && "pointer-events-none invisible"
          )}
          disabled={exportDisabled}
          onClick={onExportClick}
        >
          <Download className="size-5" aria-hidden="true" />
          <span className="hidden sm:inline">{exportLabel}</span>
        </Button>
      </div>
    </header>
  );
}

