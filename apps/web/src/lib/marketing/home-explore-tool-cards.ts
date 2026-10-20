import {
  MARKETING_TOOL_LINKS,
  buildMarketingPath,
  type MarketingToolLabelKey,
} from "@/lib/marketing/tools-nav";

export interface ResolvedExploreToolCard {
  key: MarketingToolLabelKey;
  href: string;
}

/**
 * 首页 Explore More Transcription Tools 按钮顺序与路由。
 * 新增工具页时：在 MARKETING_TOOL_LINKS 注册，并在 landing.productCards.items 补 label。
 */
export function resolveHomeExploreToolCards(locale: string): ResolvedExploreToolCard[] {
  return MARKETING_TOOL_LINKS.map((link) => ({
    key: link.labelKey,
    href: buildMarketingPath(locale, link.path),
  }));
}
