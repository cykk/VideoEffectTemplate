import enDictionary from "@markless/shared/src/i18n/locales/en.json";
import { HERO_UPLOAD_AUDIO_LANGUAGES } from "@markless/shared/src/i18n/data/hero-upload-audio-languages";
import {
  defaultLocale,
  locales,
  type AppDictionary,
  type Locale,
  type PartialAppDictionary,
} from "@markless/shared/src/i18n/types";

const heroUploadAudioLanguages = HERO_UPLOAD_AUDIO_LANGUAGES.map((language) => ({
  id: language.id,
  label: language.label,
  nativeLabel: language.nativeLabel,
}));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const maybeStructuredClone = (globalThis as {
  structuredClone?: <T>(value: T) => T;
}).structuredClone;

function cloneDeep<T>(value: T): T {
  if (typeof maybeStructuredClone === "function") {
    return maybeStructuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeDeep<T>(target: T, source?: PartialAppDictionary): T {
  if (!source) {
    return target;
  }

  const stack: Array<{ target: Record<string, unknown>; source: Record<string, unknown> }> = [];

  if (isPlainObject(target) && isPlainObject(source)) {
    stack.push({ target: target as Record<string, unknown>, source: source as Record<string, unknown> });
  }

  while (stack.length > 0) {
    const { target: currentTarget, source: currentSource } = stack.pop()!;

    for (const [key, value] of Object.entries(currentSource)) {
      if (value === undefined) {
        continue;
      }

      const existing = currentTarget[key];

      if (isPlainObject(existing) && isPlainObject(value)) {
        stack.push({
          target: existing as Record<string, unknown>,
          source: value,
        });
      } else {
        currentTarget[key] = value as unknown;
      }
    }
  }

  return target;
}

const fallbackDictionary = mergeDeep(enDictionary as unknown as AppDictionary, {
  marketing: {
    landing: {
      hero: {
        upload: {
          settings: {
            audioLanguage: {
              languages: heroUploadAudioLanguages,
            },
          },
        },
      },
    },
  },
} as PartialAppDictionary);

const dictionaries: Partial<Record<Locale, PartialAppDictionary>> = {
  en: enDictionary as unknown as AppDictionary,
};

export function getDictionary(locale: Locale = defaultLocale): AppDictionary {
  const base = cloneDeep(fallbackDictionary);
  const dictionary = dictionaries[locale];

  if (!dictionary) {
    return base;
  }

  return mergeDeep(base, dictionary);
}

export { defaultLocale, locales };
export type { Locale, AppDictionary } from "@markless/shared/src/i18n/types";
export type {
  AuthPanelDictionary,
  FAQItem,
  RichText,
  RichTextSegment,
} from "@markless/shared/src/i18n/types";
