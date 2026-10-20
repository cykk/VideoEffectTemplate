import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import type { BlogsPageDictionary } from "@markless/shared/src/i18n/types";
import type { BlogPostMeta } from "@/lib/blog/types";

interface BlogPostCardProps {
  post: BlogPostMeta;
  dictionary: BlogsPageDictionary;
  locale: string;
}

function formatPublishedDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

function buildBlogPostHref(locale: string, slug: string): string {
  return locale === "en" ? `/blog/${slug}` : `/${locale}/blog/${slug}`;
}

export function BlogPostCard({ post, dictionary, locale }: BlogPostCardProps) {
  const href = buildBlogPostHref(locale, post.slug);
  const readingTimeLabel = dictionary.readingTime.replace(
    "{minutes}",
    String(post.readingTimeMinutes)
  );

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <time dateTime={post.publishedAt}>
            {dictionary.postedOn} {formatPublishedDate(post.publishedAt)}
          </time>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {readingTimeLabel}
        </span>
      </div>

      <h2 className="text-xl font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-brand-700">
        <Link href={href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          {post.title}
        </Link>
      </h2>

      <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{post.description}</p>

      {post.tags.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={dictionary.tagsLabel}>
          {post.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6">
        <Link
          href={href}
          className="inline-flex items-center text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {dictionary.readMore}
        </Link>
      </div>
    </article>
  );
}
