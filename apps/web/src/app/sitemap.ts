import { MetadataRoute } from "next";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import {
  getLatestPublishedPostModifiedDate,
  getPublishedPosts,
} from "@/lib/blog/load-posts";

type SitemapPageConfig = {
  path: string;
  priority: number;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  lastModified: Date;
};

// lastModified reflects the date the page content was last meaningfully changed.
// Using static dates avoids sending misleading "just updated" signals on every crawl.
// Update these when page content changes significantly.
const PUBLIC_PAGES: readonly SitemapPageConfig[] = [
  {
    path: "pricing",
    priority: 0.6,
    changeFrequency: "weekly",
    lastModified: new Date("2026-07-10"),
  },
] as const;

/** /blog 无文章时的 sitemap lastModified 回退值 */
const BLOG_HUB_FALLBACK_LAST_MODIFIED = new Date("2026-08-08");

function buildPageUrl(baseUrl: string, path: string): string {
  return path ? `${baseUrl}/${path}` : baseUrl;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getWebBaseUrl();
  const staticEntries = PUBLIC_PAGES.map((page) => ({
    url: buildPageUrl(baseUrl, page.path),
    lastModified: page.lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const blogHubLastModified =
    getLatestPublishedPostModifiedDate() ?? BLOG_HUB_FALLBACK_LAST_MODIFIED;

  const blogHubEntry = {
    url: `${baseUrl}/blog`,
    lastModified: blogHubLastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  };

  const blogPostEntries = getPublishedPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, blogHubEntry, ...blogPostEntries];
}
