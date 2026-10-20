"use client";

import { cn } from "@markless/shared/src/lib/utils";
import { SUMMARY_PANEL_RESIZE_HANDLE_WIDTH } from "@/hooks/use-summary-panel-width";
import type { PointerEvent as ReactPointerEvent } from "react";

interface TranscriptionSummaryResizeHandleProps {
  ariaLabel: string;
  isResizing: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

export function TranscriptionSummaryResizeHandle({
  ariaLabel,
  isResizing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
}: TranscriptionSummaryResizeHandleProps) {
  return (
    <>
      {isResizing ? (
        <div className="fixed inset-0 z-50 cursor-col-resize" aria-hidden="true" />
      ) : null}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={ariaLabel}
        tabIndex={0}
        style={{ width: SUMMARY_PANEL_RESIZE_HANDLE_WIDTH }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        className={cn(
          "relative hidden shrink-0 touch-none select-none xl:flex",
          "cursor-col-resize items-center justify-center",
          "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:transition-colors",
          isResizing ? "before:bg-primary" : "before:bg-slate-200 hover:before:bg-primary/40"
        )}
      />
    </>
  );
}
