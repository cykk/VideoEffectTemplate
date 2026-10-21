import "server-only";
import type { AppDictionary } from "@markless/shared/src/i18n/types";

const legacyLegalContent = /mp3\s?to\s?text|mp3totext|transcri(?:be|pt|ption)|subtitle|guest audio|uploaded audio/i;

export function isLegalContentReady(dictionary: AppDictionary): boolean {
  return process.env.LEGAL_CONTENT_READY === "true"
    && !legacyLegalContent.test(JSON.stringify({
      privacy: dictionary.pages.privacy,
      terms: dictionary.pages.terms,
    }));
}
