import { type Locale, locales, defaultLocale } from "@markless/shared/src/i18n/types";

const intlLocaleMap: Record<Locale, string> = {
  en: "en-US",
};

export function resolveIntlLocale(locale: string | Locale | undefined): string {
  if (locale && Object.prototype.hasOwnProperty.call(intlLocaleMap, locale)) {
    return intlLocaleMap[locale as Locale];
  }
  return intlLocaleMap.en;
}

/**
 * 从路径名中准确提取语言代码
 * 避免将 /image-to-video 等路径段误识别为 locale
 */
export function getLocaleFromPathname(pathname: string | null): Locale {
  const segments = pathname?.split('/') || [];
  const firstSegment = segments[1];
  
  // 检查是否在支持的语言列表中
  if (firstSegment && (locales as readonly string[]).includes(firstSegment)) {
    return firstSegment as Locale;
  }
  
  return defaultLocale;
}
