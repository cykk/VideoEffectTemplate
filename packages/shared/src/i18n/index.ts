import enDictionary from "@markless/shared/src/i18n/locales/en.json";
import { defaultLocale, locales, type AppDictionary, type Locale } from "@markless/shared/src/i18n/types";

export function getDictionary(_locale: Locale = defaultLocale): AppDictionary {
  return structuredClone(enDictionary) as unknown as AppDictionary;
}

export { defaultLocale, locales };
export type { Locale, AppDictionary } from "@markless/shared/src/i18n/types";
export type { AuthPanelDictionary, FAQItem, RichText, RichTextSegment } from "@markless/shared/src/i18n/types";
