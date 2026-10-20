"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const VISIBLE_ON_RATIO = 0.75;
const VISIBLE_OFF_RATIO = 0.4;
const SCROLL_BOTTOM_THRESHOLD_PX = 80;

function computeVisibleRatio(root: HTMLElement, card: HTMLElement): number {
  const rootRect = root.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const visibleTop = Math.max(cardRect.top, rootRect.top);
  const visibleBottom = Math.min(cardRect.bottom, rootRect.bottom);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);

  if (cardRect.height <= 0) {
    return 0;
  }

  return visibleHeight / cardRect.height;
}

function isAtScrollBottom(root: HTMLElement): boolean {
  return (
    root.scrollHeight - root.scrollTop - root.clientHeight <=
    SCROLL_BOTTOM_THRESHOLD_PX
  );
}

function evaluateVisibility(
  ratio: number,
  atBottom: boolean,
  previous: boolean
): boolean {
  if (ratio >= VISIBLE_ON_RATIO || atBottom) {
    return true;
  }

  if (ratio < VISIBLE_OFF_RATIO) {
    return false;
  }

  return previous;
}

export function useUpgradePlanCardVisibility(
  enabled: boolean,
  scrollRootRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>
): boolean {
  const [isVisible, setIsVisible] = useState(false);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      isVisibleRef.current = false;
      return;
    }

    const root = scrollRootRef.current;
    if (!root) {
      return;
    }

    let rafId = 0;

    const updateVisibility = () => {
      const card = cardRef.current;
      if (!card) {
        return;
      }

      const ratio = computeVisibleRatio(root, card);
      const atBottom = isAtScrollBottom(root);
      const nextVisible = evaluateVisibility(
        ratio,
        atBottom,
        isVisibleRef.current
      );

      if (nextVisible !== isVisibleRef.current) {
        isVisibleRef.current = nextVisible;
        setIsVisible(nextVisible);
      }
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateVisibility);
    };

    scheduleUpdate();

    root.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(root);

    const card = cardRef.current;
    if (card) {
      resizeObserver.observe(card);
    }

    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafId);
      root.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [enabled, scrollRootRef, cardRef]);

  return isVisible;
}
