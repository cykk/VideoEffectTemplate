"use client";

import { useEffect, useState } from "react";

const DESKTOP_SUMMARY_LAYOUT_QUERY = "(min-width: 1280px)";

export function useDesktopSummaryLayout(): boolean {
  const [isDesktopSummaryLayout, setIsDesktopSummaryLayout] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_SUMMARY_LAYOUT_QUERY);

    const updateLayout = () => {
      setIsDesktopSummaryLayout(mediaQuery.matches);
    };

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  return isDesktopSummaryLayout;
}

