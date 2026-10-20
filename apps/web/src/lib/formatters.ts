import { resolveIntlLocale } from "@markless/shared/src/i18n/locale-config";
import type { Locale } from "@markless/shared/src/i18n/types";

type LocaleInput = Locale | string | undefined;

function getIntlLocale(locale: LocaleInput): string {
  return resolveIntlLocale(locale);
}

export function formatAppNumber(value: number, locale?: LocaleInput): string {
  return new Intl.NumberFormat(getIntlLocale(locale)).format(value);
}

export function formatAppCurrency(
  value: number,
  currency: string = "USD",
  locale?: LocaleInput
): string {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "currency",
    currency,
  }).format(value);
}

export function formatAppDate(value: string | Date, locale?: LocaleInput): string {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: "medium",
  }).format(date);
}

export function formatAppDateTime(value: string | Date, locale?: LocaleInput): string {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatAppRelativeTime(value: string | Date, locale?: LocaleInput): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat(getIntlLocale(locale), {
    numeric: "auto",
  });

  const diffSeconds = Math.round(diffMs / 1000);
  if (Math.abs(diffSeconds) < 60) {
    return formatter.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffMs / 86_400_000);
  if (Math.abs(diffDays) < 30) {
    return formatter.format(diffDays, "day");
  }

  return formatAppDateTime(date, locale);
}
