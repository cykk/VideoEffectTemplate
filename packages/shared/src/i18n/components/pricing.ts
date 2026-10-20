import { getDictionary } from "@markless/shared/src/i18n";
import type { ComponentPricingDictionary, Locale } from "@markless/shared/src/i18n/types";

export type PricingCopy = ComponentPricingDictionary;

export function getPricingCopy(locale: Locale): PricingCopy {
  return getDictionary(locale).component.pricing;
}
