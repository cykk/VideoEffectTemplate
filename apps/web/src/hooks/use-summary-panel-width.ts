"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const STORAGE_KEY = "transcription-summary-panel-width";

export const SUMMARY_PANEL_DEFAULT_WIDTH = 360;
const SUMMARY_PANEL_MIN_WIDTH = 280;
const SUMMARY_PANEL_MAX_WIDTH_PX = 480;
const SUMMARY_PANEL_MAX_WIDTH_PERCENT = 0.45;
const TRANSCRIPT_MIN_WIDTH = 360;
export const SUMMARY_PANEL_RESIZE_HANDLE_WIDTH = 12;

function readStoredWidth(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistWidth(width: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // Ignore storage failures.
  }
}

export function clampSummaryPanelWidth(width: number, containerWidth: number): number {
  if (containerWidth <= 0) {
    return width;
  }

  const maxByPercent = containerWidth * SUMMARY_PANEL_MAX_WIDTH_PERCENT;
  const maxByTranscript =
    containerWidth - TRANSCRIPT_MIN_WIDTH - SUMMARY_PANEL_RESIZE_HANDLE_WIDTH;
  const maxAllowed = Math.min(
    SUMMARY_PANEL_MAX_WIDTH_PX,
    maxByPercent,
    Math.max(SUMMARY_PANEL_MIN_WIDTH, maxByTranscript)
  );

  return Math.max(SUMMARY_PANEL_MIN_WIDTH, Math.min(width, maxAllowed));
}

export function useSummaryPanelWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [summaryWidth, setSummaryWidth] = useState(SUMMARY_PANEL_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const pendingWidthRef = useRef(SUMMARY_PANEL_DEFAULT_WIDTH);

  const getContainerWidth = useCallback(() => {
    return containerRef.current?.getBoundingClientRect().width ?? 0;
  }, []);

  const applyClampedWidth = useCallback(
    (width: number) => {
      const nextWidth = clampSummaryPanelWidth(width, getContainerWidth());
      pendingWidthRef.current = nextWidth;
      setSummaryWidth(nextWidth);
    },
    [getContainerWidth]
  );

  useEffect(() => {
    const stored = readStoredWidth();
    const initialWidth = stored ?? SUMMARY_PANEL_DEFAULT_WIDTH;
    pendingWidthRef.current = initialWidth;
    setSummaryWidth(initialWidth);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const syncWidthToContainer = () => {
      const containerWidth = container.getBoundingClientRect().width;
      if (containerWidth <= 0) {
        return;
      }

      setSummaryWidth(() => {
        const nextWidth = clampSummaryPanelWidth(
          pendingWidthRef.current,
          containerWidth
        );
        pendingWidthRef.current = nextWidth;
        return nextWidth;
      });
    };

    syncWidthToContainer();

    const observer = new ResizeObserver(syncWidthToContainer);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      dragStateRef.current = {
        startX: event.clientX,
        startWidth: summaryWidth,
      };
      setIsResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [summaryWidth]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) {
        return;
      }

      const delta = dragStateRef.current.startX - event.clientX;
      applyClampedWidth(dragStateRef.current.startWidth + delta);
    },
    [applyClampedWidth]
  );

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) {
      return;
    }

    dragStateRef.current = null;
    setIsResizing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    setSummaryWidth((current) => {
      persistWidth(current);
      pendingWidthRef.current = current;
      return current;
    });
  }, []);

  const handleDoubleClick = useCallback(() => {
    applyClampedWidth(SUMMARY_PANEL_DEFAULT_WIDTH);
    persistWidth(SUMMARY_PANEL_DEFAULT_WIDTH);
    pendingWidthRef.current = SUMMARY_PANEL_DEFAULT_WIDTH;
  }, [applyClampedWidth]);

  return {
    containerRef,
    summaryWidth,
    isResizing,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
  };
}
