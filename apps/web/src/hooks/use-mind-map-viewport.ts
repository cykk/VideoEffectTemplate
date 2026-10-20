"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.15;
const FIT_MARGIN = 24;
const PAN_THRESHOLD_PX = 5;

export type MindMapViewportTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

type UseMindMapViewportOptions = {
  contentWidth: number;
  contentHeight: number;
  enabled?: boolean;
};

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function getFitTransform(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number
): MindMapViewportTransform {
  if (viewportWidth <= 0 || viewportHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return { scale: 1, translateX: FIT_MARGIN, translateY: FIT_MARGIN };
  }

  const availableWidth = Math.max(viewportWidth - FIT_MARGIN * 2, 1);
  const availableHeight = Math.max(viewportHeight - FIT_MARGIN * 2, 1);
  const scale = clampScale(Math.min(availableWidth / contentWidth, availableHeight / contentHeight));
  const translateX = (viewportWidth - contentWidth * scale) / 2;
  const translateY = (viewportHeight - contentHeight * scale) / 2;

  return { scale, translateX, translateY };
}

export function useMindMapViewport({
  contentWidth,
  contentHeight,
  enabled = true,
}: UseMindMapViewportOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<MindMapViewportTransform>({
    scale: 1,
    translateX: FIT_MARGIN,
    translateY: FIT_MARGIN,
  });
  const isPanningRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    setTransform(
      getFitTransform(
        viewport.clientWidth,
        viewport.clientHeight,
        contentWidth,
        contentHeight
      )
    );
  }, [contentHeight, contentWidth]);

  const zoomByFactor = useCallback(
    (factor: number, anchorX?: number, anchorY?: number) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      setTransform((current) => {
        const nextScale = clampScale(current.scale * factor);
        const rect = viewport.getBoundingClientRect();
        const px = anchorX ?? rect.left + rect.width / 2;
        const py = anchorY ?? rect.top + rect.height / 2;
        const localX = px - rect.left;
        const localY = py - rect.top;
        const worldX = (localX - current.translateX) / current.scale;
        const worldY = (localY - current.translateY) / current.scale;

        return {
          scale: nextScale,
          translateX: localX - worldX * nextScale,
          translateY: localY - worldY * nextScale,
        };
      });
    },
    []
  );

  const zoomIn = useCallback(() => {
    zoomByFactor(ZOOM_STEP);
  }, [zoomByFactor]);

  const zoomOut = useCallback(() => {
    zoomByFactor(1 / ZOOM_STEP);
  }, [zoomByFactor]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!enabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomByFactor(factor, event.clientX, event.clientY);
    },
    [enabled, zoomByFactor]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !enabled) {
      return;
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [enabled, handleWheel]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || event.button !== 0) {
        return;
      }

      isPointerDownRef.current = true;
      isPanningRef.current = false;
      setIsPanning(false);
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        translateX: transform.translateX,
        translateY: transform.translateY,
      };
    },
    [enabled, transform.translateX, transform.translateY]
  );

  const beginPanning = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      return;
    }

    isPanningRef.current = true;
    setIsPanning(true);
    window.getSelection()?.removeAllRanges();
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerDownRef.current) {
        return;
      }

      const deltaX = event.clientX - panStartRef.current.x;
      const deltaY = event.clientY - panStartRef.current.y;

      if (!isPanningRef.current) {
        if (Math.hypot(deltaX, deltaY) < PAN_THRESHOLD_PX) {
          return;
        }

        beginPanning(event);
      }

      event.preventDefault();

      setTransform((current) => ({
        ...current,
        translateX: panStartRef.current.translateX + deltaX,
        translateY: panStartRef.current.translateY + deltaY,
      }));
    },
    [beginPanning]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = false;

    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    fitToView();
  }, [contentHeight, contentWidth, enabled, fitToView]);

  return {
    viewportRef,
    transform,
    isPanning,
    fitToView,
    zoomIn,
    zoomOut,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
