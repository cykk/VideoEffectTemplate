export const BRAND_CONFIG = {
    primaryName: "MP3ToText",
    wordmarkSuffix: ".io",
    legacyName: "MP3 to Text",
    siteDomain: "mp3totext.io",
    siteUrl: "https://mp3totext.io",
    siteName: "MP3ToText",
    alternateNames: ["MP3ToText.io", "MP3 to Text", "mp3totext.io"],
} as const;

export type BrandConfig = typeof BRAND_CONFIG;
