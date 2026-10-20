import type { AppDictionary } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";

export const OG_IMAGE_URL = "/og-image.png";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

function getBrandName(dictionary: AppDictionary): string {
    return dictionary.component.layout.header.brand.identity.primary_name;
}

export function getMetadataBaseUrl(): URL {
    return new URL(getWebBaseUrl());
}

export function getMetadataSiteName(dictionary: AppDictionary): string {
    return getBrandName(dictionary);
}

export function buildBrandedMetadataTitle(title: string, dictionary: AppDictionary): string {
    const suffix = `| ${getBrandName(dictionary)}`;

    if (title.trim().endsWith(suffix)) {
        return title;
    }

    return `${title} ${suffix}`;
}

/** 内页 title：不追加品牌后缀 */
export function buildMetadataTitle(title: string, _dictionary?: AppDictionary): string {
    return title.trim();
}

export function getMetadataTitleTemplate(dictionary: AppDictionary): string {
    return `%s | ${getBrandName(dictionary)}`;
}
