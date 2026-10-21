import { z } from "zod";
import enDictionary from "@markless/shared/src/i18n/locales/en.json";

export const blogFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: z.string().min(1),
  updatedAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  coverImage: z.string().optional(),
  author: z.string().default(enDictionary.component.layout.header.brand.identity.primary_name),
});

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
