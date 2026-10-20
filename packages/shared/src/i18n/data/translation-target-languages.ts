import { HERO_UPLOAD_AUDIO_LANGUAGES } from "@markless/shared/src/i18n/data/hero-upload-audio-languages";

type HeroUploadLanguage = (typeof HERO_UPLOAD_AUDIO_LANGUAGES)[number];

export const TRANSLATION_TARGET_LANGUAGES = HERO_UPLOAD_AUDIO_LANGUAGES.filter(
  (language): language is Exclude<HeroUploadLanguage, { id: "auto" }> =>
    language.id !== "auto"
);

export type TranslationTargetLanguageId =
  (typeof TRANSLATION_TARGET_LANGUAGES)[number]["id"];

export type TranslationTargetLanguageOption =
  (typeof TRANSLATION_TARGET_LANGUAGES)[number];
