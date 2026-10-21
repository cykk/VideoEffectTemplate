import { Clock } from "lucide-react";
import type { BlogsPageDictionary } from "@markless/shared/src/i18n/types";
import type { BlogPost } from "@/lib/blog/types";
import { formatBlogIsoDate } from "@/lib/blog/format-date";
import { BlogMarkdown } from "./blog-markdown";
import { BlogPostCTA } from "./blog-post-cta";
import { BlogBackLink } from "./blog-list-content";

interface BlogPostContentProps {
  post: BlogPost;
  dictionary: BlogsPageDictionary;
  locale: string;
}

export function BlogPostContent({
  post,
  dictionary,
  locale,
}: BlogPostContentProps) {
  const readingTimeLabel = dictionary.readingTime.replace(
    "{minutes}",
    String(post.readingTimeMinutes)
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-brand-50/40 via-background to-background">
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <BlogBackLink dictionary={dictionary} locale={locale} />

        <header className="mt-8 space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          <p className="text-lg leading-8 text-slate-600">{post.description}</p>

          <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 pb-8 text-sm text-slate-500">
            <time dateTime={post.publishedAt}>{formatBlogIsoDate(post.publishedAt)}</time>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {readingTimeLabel}
            </span>
            <span>{post.author}</span>
          </div>
        </header>

        <BlogMarkdown content={post.content} />

        <BlogPostCTA
          locale={locale}
          content={dictionary.cta}
        />
      </article>
    </div>
  );
}
