import type { TranscriptionDisplaySegment } from "@markless/shared/src/types/transcriptions";

export function hasEditedDisplaySegments(
  segments: TranscriptionDisplaySegment[],
  segmentTextOverrides: Record<string, string> = {}
): boolean {
  return segments.some((segment) => {
    if (segment.isEdited) {
      return true;
    }

    const override = segmentTextOverrides[segment.id];
    if (override === undefined) {
      return false;
    }

    return override.trim() !== segment.text.trim();
  });
}
