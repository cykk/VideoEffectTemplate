import "server-only";

import { generatedBlogPosts } from "../../../.vinext/generated-posts";
import { blogFrontmatterSchema } from "./schema";
import { estimateReadingTimeMinutes } from "./reading-time";
import type { BlogPost, BlogPostMeta } from "./types";

function parsePost(post: (typeof generatedBlogPosts)[number]): BlogPost | null {
  const { slug, content } = post;
  const parsed = blogFrontmatterSchema.safeParse(post.frontmatter);

  if (!parsed.success) {
    console.warn(`[blog] Invalid frontmatter in ${slug}:`, parsed.error.flatten());
    return null;
  }

  const frontmatter = parsed.data;

  if (frontmatter.draft) {
    return null;
  }

  return {
    slug,
    ...frontmatter,
    content: content.trim(),
    readingTimeMinutes: estimateReadingTimeMinutes(content),
  };
}

function loadAllPosts(): BlogPost[] {
  return generatedBlogPosts
    .map(parsePost)
    .filter((post): post is BlogPost => post !== null)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}

export function getPublishedPosts(): BlogPostMeta[] {
  return loadAllPosts().map(({ content: _content, ...meta }) => meta);
}

/** 用于 /blog 列表页 sitemap lastModified：取已发布文章中最新的 updatedAt / publishedAt */
export function getLatestPublishedPostModifiedDate(): Date | null {
  const posts = getPublishedPosts();
  if (posts.length === 0) {
    return null;
  }

  const latestTimestamp = posts.reduce((latest, post) => {
    const timestamp = new Date(post.updatedAt ?? post.publishedAt).getTime();
    return timestamp > latest ? timestamp : latest;
  }, 0);

  return new Date(latestTimestamp);
}

export function getPostBySlug(slug: string): BlogPost | null {
  return loadAllPosts().find((post) => post.slug === slug) ?? null;
}

export function getAllPostSlugs(): string[] {
  return loadAllPosts().map((post) => post.slug);
}

export function getRelatedPosts(slug: string, limit = 3): BlogPostMeta[] {
  const current = getPostBySlug(slug);
  if (!current) {
    return [];
  }

  const currentTags = new Set(current.tags);

  return getPublishedPosts()
    .filter((post) => post.slug !== slug)
    .map((post) => ({
      post,
      score: post.tags.filter((tag) => currentTags.has(tag)).length,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        new Date(b.post.publishedAt).getTime() -
        new Date(a.post.publishedAt).getTime()
      );
    })
    .slice(0, limit)
    .map(({ post }) => post);
}
