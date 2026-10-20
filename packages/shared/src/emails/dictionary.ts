import { getDictionary } from "@markless/shared/src/i18n";
import type { AppEmailDictionary, Locale } from "@markless/shared/src/i18n/types";

export type EmailDictionary = AppEmailDictionary;

export function getEmailDictionary(locale: Locale): EmailDictionary {
    return getDictionary(locale).app.email;
}
