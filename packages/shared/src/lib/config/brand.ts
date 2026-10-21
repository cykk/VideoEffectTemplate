import enDictionary from "@markless/shared/src/i18n/locales/en.json";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";

const siteUrl = getWebBaseUrl();
const name = enDictionary.component.layout.header.brand.identity.primary_name;

export const BRAND_CONFIG = {
    primaryName: name,
    wordmarkSuffix: enDictionary.component.layout.header.brand.identity.support_label,
    legacyName: name,
    siteDomain: new URL(siteUrl).hostname,
    siteUrl,
    siteName: name,
    supportEmail: getEnv("SUPPORT_EMAIL") || "",
    alternateNames: [name],
} as const;

export type BrandConfig = typeof BRAND_CONFIG;
