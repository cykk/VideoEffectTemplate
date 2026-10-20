"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Download, MoreHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@markless/shared/src/lib/utils";
import {
  TRANSCRIPTION_HEADER_BACK_BUTTON_CLASSNAME,
  TRANSCRIPTION_HEADER_EXPORT_BUTTON_CLASSNAME,
  TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME,
} from "@/components/transcriptions/transcription-page-chrome-styles";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export type TranscriptionResultPageHeaderProps = {
  fileName?: string;
  isTitleLoading?: boolean;
  homeHref: string;
  backLabel: string;
  toolbarDict: TranscriptionsPageDictionary["toolbar"];
  exportLabel: string;
  exportDisabled?: boolean;
  onExportClick: () => void;
  onShareClick?: () => void;
  onRenameClick?: () => void;
  isSearchReplaceOpen?: boolean;
  searchReplaceAnchor?: ReactNode;
};

function TruncatedPageTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = titleRef.current;
    if (!element) {
      return;
    }

    const updateTruncation = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    };

    updateTruncation();

    const resizeObserver = new ResizeObserver(updateTruncation);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [title]);

  const heading = (
    <h1
      ref={titleRef}
      className="truncate text-lg font-semibold text-slate-900"
    >
      {title}
    </h1>
  );

  const titleShell = <div className="min-w-0 flex-1">{heading}</div>;

  if (!isTruncated) {
    return titleShell;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{titleShell}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="max-w-md text-left text-sm font-normal break-words whitespace-normal"
      >
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

export function TranscriptionResultPageHeader({
  fileName,
  isTitleLoading = false,
  homeHref,
  backLabel,
  toolbarDict,
  exportLabel,
  exportDisabled = false,
  onExportClick,
  onShareClick,
  onRenameClick,
  isSearchReplaceOpen = false,
  searchReplaceAnchor,
}: TranscriptionResultPageHeaderProps) {
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
        {isTitleLoading || !fileName ? (
          <div
            aria-hidden="true"
            className="h-5 w-48 max-w-full animate-pulse rounded bg-slate-200"
          />
        ) : (
          <TruncatedPageTitle title={fileName} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={toolbarDict.actions.shareAria}
          className={TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME}
          onClick={onShareClick}
        >
          <Share2 className="size-4" aria-hidden="true" />
        </button>
        {onRenameClick ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={toolbarDict.actions.moreAria}
                className={TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => {
                  onRenameClick();
                }}
              >
                {toolbarDict.actions.rename}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            aria-label={toolbarDict.actions.moreAria}
            className={TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        )}
        <Button
          type="button"
          className={cn(
            TRANSCRIPTION_HEADER_EXPORT_BUTTON_CLASSNAME,
            isSearchReplaceOpen && "pointer-events-none invisible"
          )}
          disabled={exportDisabled}
          onClick={onExportClick}
          aria-hidden={isSearchReplaceOpen}
          tabIndex={isSearchReplaceOpen ? -1 : undefined}
        >
          <Download className="size-5" aria-hidden="true" />
          <span className="hidden sm:inline">{exportLabel}</span>
        </Button>
      </div>
    </header>
  );
}
