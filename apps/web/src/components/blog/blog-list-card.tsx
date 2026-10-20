import Image from "next/image";
import Link from "next/link";
import type { BlogPostMeta } from "@/lib/blog/types";
import { formatBlogIsoDate } from "@/lib/blog/format-date";
import {
  BLOG_LIST_COVER_ASPECT_CLASS,
  DEFAULT_BLOG_COVER_IMAGE,
} from "@/lib/blog/constants";
import { cn } from "@markless/shared/src/lib/utils";

interface BlogListCardProps {
  post: BlogPostMeta;
  locale: string;
}

function buildBlogPostHref(locale: string, slug: string): string {
  return locale === "en" ? `/blog/${slug}` : `/${locale}/blog/${slug}`;
}

function resolveCoverImage(coverImage?: string): string {
  if (!coverImage?.trim()) {
    return DEFAULT_BLOG_COVER_IMAGE;
  }

  return coverImage;
}

export function BlogListCard({ post, locale }: BlogListCardProps) {
  const href = buildBlogPostHref(locale, post.slug);
  const coverSrc = resolveCoverImage(post.coverImage);

  return (
    <article className="group h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <Link
        href={href}
        className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        <div
          className={cn(
            "relative w-full overflow-hidden bg-slate-100",
            BLOG_LIST_COVER_ASPECT_CLASS
          )}
        >
          <Image
            src={coverSrc}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h2 className="text-lg font-semibold leading-snug tracking-tight text-slate-900 transition-colors group-hover:text-brand-700">
            {post.title}
          </h2>

          <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">
            {post.description}
          </p>

          <time
            dateTime={post.publishedAt}
            className="mt-5 block text-right text-sm text-slate-500"
          >
            {formatBlogIsoDate(post.publishedAt)}
          </time>
        </div>
      </Link>
    </article>
  );
}
