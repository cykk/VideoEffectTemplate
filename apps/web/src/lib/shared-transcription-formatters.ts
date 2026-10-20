import type { TranscriptionAiSummaryData } from "@markless/shared/src/types/transcriptions";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export function buildSummaryCopyText(
  summary: TranscriptionAiSummaryData,
  dict: TranscriptionsPageDictionary["summaryPanel"]
): string {
  const sections = [
    `${dict.content.overview}\n${summary.overview}`,
    `${dict.content.keyPoints}\n${summary.keyPoints.map((item) => `- ${item.text}`).join("\n")}`,
    `${dict.content.takeaways}\n${summary.takeaways.map((item) => `- ${item.text}`).join("\n")}`,
  ];

  return sections.join("\n\n").trim();
}

export function formatHumanReadableDuration(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs <= 0) {
    return "--";
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hr`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} sec`);
  }

  return parts.join(" ");
}

export function formatTranscriptTimestamp(startMs: number | null | undefined): string {
  if (startMs === null || startMs === undefined || startMs < 0) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(startMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return [minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

