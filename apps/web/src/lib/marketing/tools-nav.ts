export const MARKETING_TOOL_LINKS = [
  {
    id: "mp3-to-srt",
    path: "/mp3-to-srt",
    labelKey: "mp3ToSrt",
  },
  {
    id: "m4a-to-text",
    path: "/m4a-to-text",
    labelKey: "m4aToText",
  },
] as const;

export type MarketingToolLabelKey = (typeof MARKETING_TOOL_LINKS)[number]["labelKey"];

export interface MarketingToolNavLabels {
  items: Record<MarketingToolLabelKey, string>;
}

export interface ResolvedMarketingToolLink {
  id: string;
  href: string;
  label: string;
}

export function buildMarketingPath(locale: string, path: string): string {
  return locale === "en" ? path : `/${locale}${path}`;
}

export function resolveMarketingToolLinks(
  locale: string,
  labels: MarketingToolNavLabels
): ResolvedMarketingToolLink[] {
  return MARKETING_TOOL_LINKS.map((link) => ({
    id: link.id,
    href: buildMarketingPath(locale, link.path),
    label: labels.items[link.labelKey],
  }));
}
