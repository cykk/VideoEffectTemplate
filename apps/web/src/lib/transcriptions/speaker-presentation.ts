import type { TranscriptionSpeakerColorToken } from "@markless/shared/src/types/transcriptions";

const SPEAKER_COLOR_CLASSNAME_MAP: Record<TranscriptionSpeakerColorToken, string> = {
  slate: "bg-slate-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  pink: "bg-pink-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
  indigo: "bg-indigo-500",
};

/** 历史 DB 中可能仍存 rose，展示时映射为 pink，不修改数据库。 */
const LEGACY_SPEAKER_COLOR_CLASSNAME_MAP: Record<string, string> = {
  rose: SPEAKER_COLOR_CLASSNAME_MAP.pink,
};

export function getSpeakerAvatarClassName(colorToken: string): string {
  return (
    SPEAKER_COLOR_CLASSNAME_MAP[colorToken as TranscriptionSpeakerColorToken] ??
    LEGACY_SPEAKER_COLOR_CLASSNAME_MAP[colorToken] ??
    SPEAKER_COLOR_CLASSNAME_MAP.slate
  );
}
