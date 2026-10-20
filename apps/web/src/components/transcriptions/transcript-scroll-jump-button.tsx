"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

const SCROLL_EDGE_THRESHOLD_PX = 80;
const FOOTER_OFFSET_PX = 16;
const SCROLL_DELTA_THRESHOLD_PX = 2;
const PROGRAMMATIC_SCROLL_END_MS = 150;

type JumpMode = "top" | "bottom";

interface TranscriptScrollJumpButtonProps {
  enabled: boolean;
  scrollContainerRef: RefObject<HTMLElement | null>;
  footerRef: RefObject<HTMLElement | null>;
  dict: TranscriptionsPageDictionary["scrollJump"];
}

function isScrollable(root: HTMLElement): boolean {
  return root.scrollHeight - root.clientHeight > SCROLL_EDGE_THRESHOLD_PX;
}

function isNearTop(root: HTMLElement): boolean {
  return root.scrollTop <= SCROLL_EDGE_THRESHOLD_PX;
}

function isNearBottom(root: HTMLElement): boolean {
  return (
    root.scrollHeight - root.scrollTop - root.clientHeight <=
    SCROLL_EDGE_THRESHOLD_PX
  );
}

function resolveModeForDirection(
  root: HTMLElement,
  direction: JumpMode
): JumpMode | null {
  if (!isScrollable(root)) {
    return null;
  }

  if (direction === "top" && isNearTop(root)) {
    return null;
  }

  if (direction === "bottom" && isNearBottom(root)) {
    return null;
  }

  return direction;
}

export function TranscriptScrollJumpButton({
  enabled,
  scrollContainerRef,
  footerRef,
  dict,
}: TranscriptScrollJumpButtonProps) {
  const [mode, setMode] = useState<JumpMode | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const lastScrollTopRef = useRef(0);
  const suppressAfterClickRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const applyDirection = useCallback((root: HTMLElement, direction: JumpMode) => {
    const nextMode = resolveModeForDirection(root, direction);
    setMode(nextMode);
  }, []);

  const finishProgrammaticScroll = useCallback(
    (root: HTMLElement) => {
      if (!programmaticScrollRef.current) {
        return;
      }

      programmaticScrollRef.current = false;
      lastScrollTopRef.current = root.scrollTop;
    },
    []
  );

  useEffect(() => {
    if (!enabled) {
      setMode(null);
      setHasScrolled(false);
      return;
    }

    const root = scrollContainerRef.current;
    if (!root) {
      return;
    }

    lastScrollTopRef.current = root.scrollTop;

    const handleScroll = () => {
      const currentScrollTop = root.scrollTop;

      if (programmaticScrollRef.current) {
        lastScrollTopRef.current = currentScrollTop;

        if (programmaticScrollEndTimerRef.current) {
          clearTimeout(programmaticScrollEndTimerRef.current);
        }

        programmaticScrollEndTimerRef.current = setTimeout(() => {
          finishProgrammaticScroll(root);
        }, PROGRAMMATIC_SCROLL_END_MS);

        return;
      }

      const delta = currentScrollTop - lastScrollTopRef.current;
      if (Math.abs(delta) < SCROLL_DELTA_THRESHOLD_PX) {
        return;
      }

      setHasScrolled(true);

      const direction: JumpMode = delta > 0 ? "bottom" : "top";

      if (suppressAfterClickRef.current) {
        suppressAfterClickRef.current = false;
        applyDirection(root, direction);
        lastScrollTopRef.current = currentScrollTop;
        return;
      }

      applyDirection(root, direction);
      lastScrollTopRef.current = currentScrollTop;
    };

    const handleScrollEnd = () => {
      finishProgrammaticScroll(root);
    };

    root.addEventListener("scroll", handleScroll, { passive: true });
    root.addEventListener("scrollend", handleScrollEnd);
    window.addEventListener("resize", handleScroll);

    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(root);

    return () => {
      if (programmaticScrollEndTimerRef.current) {
        clearTimeout(programmaticScrollEndTimerRef.current);
      }

      root.removeEventListener("scroll", handleScroll);
      root.removeEventListener("scrollend", handleScrollEnd);
      window.removeEventListener("resize", handleScroll);
      resizeObserver.disconnect();
    };
  }, [applyDirection, enabled, finishProgrammaticScroll, scrollContainerRef]);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) {
      setFooterHeight(0);
      return;
    }

    const updateFooterHeight = () => {
      setFooterHeight(footer.getBoundingClientRect().height);
    };

    updateFooterHeight();

    const resizeObserver = new ResizeObserver(updateFooterHeight);
    resizeObserver.observe(footer);

    return () => resizeObserver.disconnect();
  }, [footerRef, enabled]);

  const handleJump = useCallback(() => {
    const root = scrollContainerRef.current;
    if (!root || !mode) {
      return;
    }

    const maxScroll = root.scrollHeight - root.clientHeight;
    const targetTop = mode === "top" ? 0 : maxScroll;

    suppressAfterClickRef.current = true;
    programmaticScrollRef.current = true;
    setMode(null);

    root.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  }, [mode, scrollContainerRef]);

  if (!enabled || !hasScrolled || !mode) {
    return null;
  }

  const isScrollToTop = mode === "top";
  const label = isScrollToTop ? dict.toTop : dict.toBottom;
  const ariaLabel = isScrollToTop ? dict.toTopAria : dict.toBottomAria;

  return (
    <div
      className="pointer-events-none absolute right-3 z-20"
      style={{ bottom: footerHeight + FOOTER_OFFSET_PX }}
    >
      <div className="group relative cursor-pointer pointer-events-auto">
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 right-[calc(100%+8px)] -translate-y-1/2",
            "whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5",
            "text-xs font-medium text-slate-900 shadow-sm",
            "pointer-events-none opacity-0 transition-opacity duration-200",
            "group-hover:opacity-100 group-hover:shadow-md group-focus-within:opacity-100"
          )}
        >
          {label}
        </span>
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={handleJump}
          className={cn(
            "flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-sm",
            "transition-shadow duration-200 hover:shadow-md",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
          )}
        >
          {isScrollToTop ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
};
