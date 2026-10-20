import Link from "next/link";
import type { BlogsPageDictionary } from "@markless/shared/src/i18n/types";
import type { BlogPostMeta } from "@/lib/blog/types";
import { BlogListCard } from "./blog-list-card";
import { BlogPostCard } from "./blog-post-card";

interface BlogListContentProps {
  posts: BlogPostMeta[];
  dictionary: BlogsPageDictionary;
  locale: string;
}

export function BlogListContent({ posts, dictionary, locale }: BlogListContentProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-brand-50/40 via-background to-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="pb-10 pt-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {dictionary.heading}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{dictionary.subtitle}</p>
        </section>

        <section className="pb-20" aria-labelledby="blog-posts-heading">
          <h2 id="blog-posts-heading" className="sr-only">
            {dictionary.heading}
          </h2>

          {posts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-slate-600">
              {dictionary.noBlogPosts}
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogListCard key={post.slug} post={post} locale={locale} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface RelatedPostsProps {
  posts: BlogPostMeta[];
  dictionary: BlogsPageDictionary;
  locale: string;
}

export function RelatedPosts({ posts, dictionary, locale }: RelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 border-t border-slate-200 pt-12" aria-labelledby="related-posts-heading">
      <h2
        id="related-posts-heading"
        className="text-2xl font-semibold tracking-tight text-slate-900"
      >
        {dictionary.relatedPosts}
      </h2>
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard
            key={post.slug}
            post={post}
            dictionary={dictionary}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

interface BlogBackLinkProps {
  dictionary: BlogsPageDictionary;
  locale: string;
}

export function BlogBackLink({ dictionary, locale }: BlogBackLinkProps) {
  const href = locale === "en" ? "/blog" : `/${locale}/blog`;

  return (
    <Link
      href={href}
      className="inline-flex items-center text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
    >
      ← {dictionary.backToBlog}
    </Link>
  );
}
