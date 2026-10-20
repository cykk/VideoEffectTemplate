"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import {
  toastConfirmOptions,
  toastErrorOptions,
} from "@markless/shared/src/lib/toast-options";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@markless/shared/src/types/api/video";
import type {
  TranscriptionDisplaySegment,
  TranscriptionJobClientData,
} from "@markless/shared/src/types/transcriptions";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";
import {
  findTranscriptSearchMatches,
  replaceMatchInText,
  type TranscriptSearchMatch,
} from "@/lib/transcriptions/transcript-search";
import type { TranscriptHighlightRange } from "@/lib/transcriptions/render-transcript-highlight";

type SearchReplaceTab = "search" | "replace";

type SearchReplaceTaskResponse = {
  task: TranscriptionJobClientData;
};

function isApiSuccess<T>(
  payload: ApiSuccessResponse<T> | ApiErrorResponse | null
): payload is ApiSuccessResponse<T> {
  return Boolean(payload?.success);
}

type UseTranscriptSearchReplaceOptions = {
  publicId: string;
  task: TranscriptionJobClientData | null;
  setTask: (task: TranscriptionJobClientData) => void;
  getSegmentDisplayText: (segment: TranscriptionDisplaySegment) => string;
  setSegmentTextOverrides: Dispatch<SetStateAction<Record<string, string>>>;
  editingSegmentId: string | null;
  editDraft: string;
  editBaseline: string;
  cancelSegmentEdit: () => void;
  getTranscriptionAuthHeaders: () => Record<string, string> | undefined;
  dict: TranscriptionsPageDictionary["searchReplace"];
  segmentEditAutoSaveToast: string;
};

export function useTranscriptSearchReplace({
  publicId,
  task,
  setTask,
  getSegmentDisplayText,
  setSegmentTextOverrides,
  editingSegmentId,
  editDraft,
  editBaseline,
  cancelSegmentEdit,
  getTranscriptionAuthHeaders,
  dict,
  segmentEditAutoSaveToast,
}: UseTranscriptSearchReplaceOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<SearchReplaceTab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isReplacing, setIsReplacing] = useState(false);

  const searchableSegments = useMemo(
    () =>
      (task?.segments ?? []).map((segment) => ({
        id: segment.id,
        text: getSegmentDisplayText(segment),
      })),
    [getSegmentDisplayText, task?.segments]
  );

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

  const exitSegmentEditIfNeeded = useCallback(() => {
    if (!editingSegmentId) {
      return;
    }

    const trimmedDraft = editDraft.trim();
    const trimmedBaseline = editBaseline.trim();

    if (trimmedDraft !== trimmedBaseline) {
      setSegmentTextOverrides((current) => ({
        ...current,
        [editingSegmentId]: trimmedDraft,
      }));
      toast.success(segmentEditAutoSaveToast, toastConfirmOptions);
    }

    cancelSegmentEdit();
  }, [
    cancelSegmentEdit,
    editBaseline,
    editDraft,
    editingSegmentId,
    segmentEditAutoSaveToast,
    setSegmentTextOverrides,
  ]);

  const openPanel = useCallback(
    (nextTab: SearchReplaceTab) => {
      exitSegmentEditIfNeeded();
      setTab(nextTab);
      setIsOpen(true);
    },
    [exitSegmentEditIfNeeded]
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const goToPreviousMatch = useCallback(() => {
    if (!matches.length) {
      return;
    }

    setCurrentMatchIndex((current) =>
      current <= 0 ? matches.length - 1 : current - 1
    );
  }, [matches.length]);

  const goToNextMatch = useCallback(() => {
    if (!matches.length) {
      return;
    }

    setCurrentMatchIndex((current) =>
      current >= matches.length - 1 ? 0 : current + 1
    );
  }, [matches.length]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (!matches.length) {
      setCurrentMatchIndex(0);
      return;
    }

    setCurrentMatchIndex((current) =>
      current >= matches.length ? matches.length - 1 : current
    );
  }, [matches.length]);

  useEffect(() => {
    if (!isOpen || !matches.length) {
      return;
    }

    const currentMatch = matches[currentMatchIndex];
    if (!currentMatch) {
      return;
    }

    const element = document.getElementById("transcript-search-current-match");
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentMatchIndex, isOpen, matches, searchQuery]);

  const handleReplaceOne = useCallback(async () => {
    const trimmedSearch = searchQuery.trim();
    if (!trimmedSearch || !matches.length || !task) {
      toast.error(dict.toast.noMatches, toastErrorOptions);
      return;
    }

    const match = matches[currentMatchIndex];
    if (!match) {
      return;
    }

    const segment = task.segments.find((item) => item.id === match.segmentId);
    if (!segment) {
      return;
    }

    const currentText = getSegmentDisplayText(segment);
    const nextText = replaceMatchInText(currentText, match, replaceQuery).trim();

    if (!nextText) {
      toast.error(dict.toast.replaceFailed, toastErrorOptions);
      return;
    }

    setIsReplacing(true);

    try {
      const response = await apiFetch(
        `/api/transcriptions/${publicId}/display-segments/${match.segmentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(getTranscriptionAuthHeaders() ?? {}),
          },
          body: JSON.stringify({ text: nextText }),
        }
      );
      const payload = (await response.json()) as
        | ApiSuccessResponse<SearchReplaceTaskResponse>
        | ApiErrorResponse;

      if (!response.ok || !isApiSuccess(payload)) {
        toast.error(dict.toast.replaceFailed, toastErrorOptions);
        return;
      }

      setTask(payload.data.task);
      setSegmentTextOverrides((current) => {
        const next = { ...current };
        delete next[match.segmentId];
        return next;
      });
      toast.success(dict.toast.replaceOneSuccess, toastConfirmOptions);
    } catch {
      toast.error(dict.toast.replaceFailed, toastErrorOptions);
    } finally {
      setIsReplacing(false);
    }
  }, [
    currentMatchIndex,
    dict.toast.noMatches,
    dict.toast.replaceFailed,
    dict.toast.replaceOneSuccess,
    getSegmentDisplayText,
    getTranscriptionAuthHeaders,
    matches,
    publicId,
    replaceQuery,
    searchQuery,
    setSegmentTextOverrides,
    setTask,
    task,
  ]);

  const handleReplaceAll = useCallback(async () => {
    const trimmedSearch = searchQuery.trim();
    if (!trimmedSearch || !matches.length) {
      toast.error(dict.toast.noMatches, toastErrorOptions);
      return;
    }

    setIsReplacing(true);

    try {
      const response = await apiFetch(
        `/api/transcriptions/${publicId}/search-replace`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(getTranscriptionAuthHeaders() ?? {}),
          },
          body: JSON.stringify({
            search: trimmedSearch,
            replace: replaceQuery,
          }),
        }
      );
      const payload = (await response.json()) as
        | ApiSuccessResponse<SearchReplaceTaskResponse>
        | ApiErrorResponse;

      if (!response.ok || !isApiSuccess(payload)) {
        toast.error(dict.toast.replaceFailed, toastErrorOptions);
        return;
      }

      setTask(payload.data.task);
      setSegmentTextOverrides({});
      setCurrentMatchIndex(0);
      toast.success(dict.toast.replaceAllSuccess, toastConfirmOptions);
    } catch {
      toast.error(dict.toast.replaceFailed, toastErrorOptions);
    } finally {
      setIsReplacing(false);
    }
  }, [
    dict.toast.noMatches,
    dict.toast.replaceAllSuccess,
    dict.toast.replaceFailed,
    getTranscriptionAuthHeaders,
    matches.length,
    publicId,
    replaceQuery,
    searchQuery,
    setSegmentTextOverrides,
    setTask,
  ]);

  return {
    isOpen,
    setIsOpen,
    tab,
    setTab,
    searchQuery,
    setSearchQuery,
    replaceQuery,
    setReplaceQuery,
    matches,
    currentMatchIndex,
    highlightBySegmentId,
    isReplacing,
    openPanel,
    closePanel,
    goToPreviousMatch,
    goToNextMatch,
    handleReplaceOne,
    handleReplaceAll,
  };
}

export type { SearchReplaceTab, TranscriptSearchMatch };
