import { z } from "zod";

export const blogFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: z.string().min(1),
  updatedAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  coverImage: z.string().optional(),
  author: z.string().default("MP3ToText Team"),
});

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
