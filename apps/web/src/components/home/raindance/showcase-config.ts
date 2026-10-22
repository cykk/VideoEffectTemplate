/**
 * 首页示例成片配置。素材放在 `apps/web/public/showcase/` 下（建议用 optimize-web-videos 处理为 9:16 的小体积 MP4，
 * 海报用 optimize-web-images 处理为 WebP）。没有素材时首页会自动隐藏「成片展示」板块，不会出现破图。
 *
 * 文案（alt）按顺序取自 `marketing.raindanceHome.showcase.items`。
 */
export type ShowcaseItem = {
  /** 例如 "/showcase/raindance-1.mp4" */
  video: string;
  /** 例如 "/showcase/raindance-1.webp" */
  poster: string;
};

export const SHOWCASE_ITEMS: ShowcaseItem[] = [];
