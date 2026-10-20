"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Download,
  Expand,
  RefreshCw,
  Scan,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@markless/shared/src/lib/utils";
import {
  toastConfirmOptions,
  toastErrorOptions,
} from "@markless/shared/src/lib/toast-options";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import type { TranscriptionMindMapNode } from "@markless/shared/src/types/transcriptions";
import {
  TranscriptionMindMapSvg,
  useMindMapLayout,
} from "@/components/transcriptions/transcription-mind-map-diagram";
import { useMindMapViewport } from "@/hooks/use-mind-map-viewport";
import {
  buildMindMapMarkdown,
  buildMindMapPngBlob,
  buildMindMapXmindBlob,
  triggerMindMapDownload,
} from "@/lib/transcriptions/mind-map-export";

const TOOLBAR_BUTTON_CLASSNAME =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

const FULLSCREEN_EXIT_BUTTON_CLASSNAME =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const FULLSCREEN_HEADER_CLASSNAME =
  "flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-4 py-2 backdrop-blur-sm";

type MindMapToolbarProps = {
  dict: TranscriptionsPageDictionary["summaryPanel"]["mindmap"];
  isRefreshDisabled: boolean;
  onRefresh: () => void;
  onDownloadPng: () => void;
  onDownloadMarkdown: () => void;
  onDownloadXmind: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onFullscreen: () => void;
  portalContainer?: HTMLElement | null;
  className?: string;
};

function MindMapToolbarButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={TOOLBAR_BUTTON_CLASSNAME}
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function MindMapToolbar({
  dict,
  isRefreshDisabled,
  onRefresh,
  onDownloadPng,
  onDownloadMarkdown,
  onDownloadXmind,
  onZoomIn,
  onZoomOut,
  onFit,
  onFullscreen,
  portalContainer,
  className,
}: MindMapToolbarProps) {
  return (
    <div className={cn("flex items-center justify-end gap-2.5", className)}>
      <div className="flex items-center gap-1.5">
        <MindMapToolbarButton
          label={dict.toolbar.refreshAria}
          disabled={isRefreshDisabled}
          onClick={onRefresh}
        >
          <RefreshCw className={cn("size-4", isRefreshDisabled && "animate-spin")} aria-hidden="true" />
        </MindMapToolbarButton>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(TOOLBAR_BUTTON_CLASSNAME, "w-auto gap-1 px-2")}
                  aria-label={dict.toolbar.downloadAria}
                >
                  <Download className="size-4" aria-hidden="true" />
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {dict.toolbar.downloadAria}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            className="w-56"
            portalContainer={portalContainer}
          >
            <DropdownMenuItem className="cursor-pointer" onClick={onDownloadPng}>
              <Download className="size-4" aria-hidden="true" />
              {dict.toolbar.downloadPng}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={onDownloadMarkdown}>
              <Download className="size-4" aria-hidden="true" />
              {dict.toolbar.downloadMarkdown}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={onDownloadXmind}>
              <Download className="size-4" aria-hidden="true" />
              {dict.toolbar.downloadXmind}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5">
        <MindMapToolbarButton label={dict.toolbar.zoomOutAria} onClick={onZoomOut}>
          <ZoomOut className="size-4" aria-hidden="true" />
        </MindMapToolbarButton>

        <MindMapToolbarButton label={dict.toolbar.zoomInAria} onClick={onZoomIn}>
          <ZoomIn className="size-4" aria-hidden="true" />
        </MindMapToolbarButton>

        <MindMapToolbarButton label={dict.toolbar.fitAria} onClick={onFit}>
          <Scan className="size-4" aria-hidden="true" />
        </MindMapToolbarButton>

        <MindMapToolbarButton label={dict.toolbar.fullscreenAria} onClick={onFullscreen}>
          <Expand className="size-4" aria-hidden="true" />
        </MindMapToolbarButton>
      </div>
    </div>
  );
}

export type TranscriptionMindMapPanelProps = {
  root: TranscriptionMindMapNode;
  publicId: string;
  dict: TranscriptionsPageDictionary["summaryPanel"]["mindmap"];
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function TranscriptionMindMapPanel({
  root,
  publicId,
  dict,
  isRefreshing,
  onRefresh,
}: TranscriptionMindMapPanelProps) {
  const layout = useMindMapLayout(root);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    viewportRef,
    transform,
    isPanning,
    fitToView,
    zoomIn,
    zoomOut,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useMindMapViewport({
    contentWidth: layout.width,
    contentHeight: layout.height,
  });

  const syncFullscreenState = useCallback(() => {
    setIsFullscreen(document.fullscreenElement === shellRef.current);
  }, []);

  const scheduleFitToView = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitToView();
      });
    });
  }, [fitToView]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      syncFullscreenState();
      scheduleFitToView();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [scheduleFitToView, syncFullscreenState]);

  const handleDownloadMarkdown = useCallback(() => {
    try {
      const markdown = buildMindMapMarkdown(root);
      triggerMindMapDownload(
        new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
        `${publicId}-mind-map.md`
      );
      toast.success(dict.downloadMarkdownSuccess, toastConfirmOptions);
    } catch {
      toast.error(dict.downloadError, toastErrorOptions);
    }
  }, [dict.downloadError, dict.downloadMarkdownSuccess, publicId, root]);

  const handleDownloadPng = useCallback(async () => {
    if (!svgRef.current) {
      toast.error(dict.downloadError, toastErrorOptions);
      return;
    }

    try {
      const blob = await buildMindMapPngBlob(svgRef.current);
      triggerMindMapDownload(blob, `${publicId}-mind-map.png`);
      toast.success(dict.downloadPngSuccess, toastConfirmOptions);
    } catch {
      toast.error(dict.downloadError, toastErrorOptions);
    }
  }, [dict.downloadError, dict.downloadPngSuccess, publicId]);

  const handleDownloadXmind = useCallback(async () => {
    try {
      const blob = await buildMindMapXmindBlob(root);
      triggerMindMapDownload(blob, `${publicId}-mind-map.xmind`);
      toast.success(dict.downloadXmindSuccess, toastConfirmOptions);
    } catch {
      toast.error(dict.downloadError, toastErrorOptions);
    }
  }, [dict.downloadError, dict.downloadXmindSuccess, publicId, root]);

  const enterFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
        return;
      }

      await shell.requestFullscreen();
    } catch {
      toast.error(dict.fullscreenError, toastErrorOptions);
    }
  }, [dict.fullscreenError]);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }, []);

  const toolbarProps = {
    dict,
    isRefreshDisabled: isRefreshing,
    onRefresh,
    onDownloadPng: () => void handleDownloadPng(),
    onDownloadMarkdown: handleDownloadMarkdown,
    onDownloadXmind: () => void handleDownloadXmind(),
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onFit: fitToView,
    onFullscreen: () => void enterFullscreen(),
    portalContainer: isFullscreen ? shellRef.current : null,
  };

  return (
    <div
      ref={shellRef}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col bg-white",
        isFullscreen && "h-screen w-screen"
      )}
    >
      {isFullscreen ? (
        <header className={FULLSCREEN_HEADER_CLASSNAME}>
          <button
            type="button"
            className={FULLSCREEN_EXIT_BUTTON_CLASSNAME}
            aria-label={dict.toolbar.exitFullscreenAria}
            onClick={() => void exitFullscreen()}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <MindMapToolbar {...toolbarProps} />
        </header>
      ) : (
        <MindMapToolbar {...toolbarProps} className="shrink-0 pb-2" />
      )}

      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 touch-none overflow-hidden cursor-default",
          !isFullscreen && "min-h-[360px]",
          isPanning && "select-none"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={dict.viewportAria}
        role="application"
      >
        <div
          className="absolute left-0 top-0 origin-top-left cursor-default"
          style={{
            transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
          }}
        >
          <TranscriptionMindMapSvg
            ref={svgRef}
            root={root}
            layout={layout}
            ariaLabel={dict.diagramLabel}
          />
        </div>
      </div>
    </div>
  );
}
