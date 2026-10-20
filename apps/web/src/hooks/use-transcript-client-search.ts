"use client";

import { useCallback, useMemo, useState } from "react";
import { findTranscriptSearchMatches } from "@/lib/transcriptions/transcript-search";
import type { TranscriptHighlightRange } from "@/lib/transcriptions/render-transcript-highlight";

type SearchableSegment = {
  id: string;
  text: string;
};

export function useTranscriptClientSearch(searchableSegments: SearchableSegment[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const matches = useMemo(
    () => findTranscriptSearchMatches(searchableSegments, searchQuery),
    [searchableSegments, searchQuery]
  );

  const highlightBySegmentId = useMemo(() => {
    const trimmedSearch = searchQuery.trim();
    if (!trimmedSearch || !matches.length) {
      return {} as Record<string, TranscriptHighlightRange[]>;
    }

    return matches.reduce<Record<string, TranscriptHighlightRange[]>>(
      (accumulator, match, index) => {
        if (!accumulator[match.segmentId]) {
          accumulator[match.segmentId] = [];
        }

        accumulator[match.segmentId].push({
          start: match.start,
          end: match.end,
          isCurrent: index === currentMatchIndex,
        });

        return accumulator;
      },
      {}
    );
  }, [currentMatchIndex, matches, searchQuery]);

  const goToPreviousMatch = useCallback(() => {
    if (!matches.length) {
      return;
    }

    setCurrentMatchIndex((current) => (current - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const goToNextMatch = useCallback(() => {
    if (!matches.length) {
      return;
    }

    setCurrentMatchIndex((current) => (current + 1) % matches.length);
  }, [matches.length]);

  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentMatchIndex(0);
  }, []);

  return {
    isOpen,
    setIsOpen,
    searchQuery,
    setSearchQuery: handleSearchQueryChange,
    matches,
    currentMatchIndex,
    highlightBySegmentId,
    goToPreviousMatch,
    goToNextMatch,
    openPanel,
    closePanel,
  };
}

