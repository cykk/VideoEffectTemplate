/** Minimum published posts required before Blog appears in header navigation. */
export const BLOG_NAV_MIN_POSTS = 3;

/**
 * Enable Blog in header/footer once at least {BLOG_NAV_MIN_POSTS} published posts exist.
 */
export const BLOG_NAV_ENABLED = false;

export const DEFAULT_BLOG_COVER_IMAGE = "/blog/default-cover.svg";

/** 静态封面放在 apps/web/public/blog/covers/（Next.js 从此目录提供 /blog/... 路径） */
/** 列表封面推荐 16:9 */
export const BLOG_LIST_COVER_ASPECT_CLASS = "aspect-video";
