import type { BlogFrontmatter } from "./schema";

export type BlogPostMeta = BlogFrontmatter & {
  slug: string;
  readingTimeMinutes: number;
};

export type BlogPost = BlogPostMeta & {
  content: string;
};
