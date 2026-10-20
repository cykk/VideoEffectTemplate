import { notFound } from "next/navigation";
import { BlogPostContent } from "@/components/blog/blog-post-content";
import { BlogJsonLd } from "@/components/blog/blog-json-ld";
import { getDictionary, locales, defaultLocale } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import {
  getAllPostSlugs,
  getPostBySlug,
} from "@/lib/blog/load-posts";
import {
  buildMetadataTitle,
  getMetadataSiteName,
  OG_IMAGE_SIZE,
  OG_IMAGE_URL,
} from "@/lib/metadata";

interface LocaleBlogPostPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export default async function LocaleBlogPostPage({ params }: LocaleBlogPostPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const slug = resolvedParams.slug;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);

  return (
    <>
      <BlogJsonLd post={post} />
      <BlogPostContent
        post={post}
        dictionary={dictionary.pages.blogs}
        locale={normalizedLocale}
      />
    </>
  );
}

export function generateStaticParams() {
  const slugs = getAllPostSlugs();

  return locales.flatMap((locale) =>
    slugs.map((slug) => ({
      locale,
      slug,
    }))
  );
}

export async function generateMetadata({ params }: LocaleBlogPostPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const slug = resolvedParams.slug;
  const normalizedLocale = locales.find((item) => item === locale);
  const post = getPostBySlug(slug);

  if (!normalizedLocale || !post) {
    const fallback = getDictionary(defaultLocale);
    return {
      title: buildMetadataTitle(fallback.pages.blogs.title, fallback),
      description: fallback.pages.blogs.description,
    };
  }

  const dictionary = getDictionary(normalizedLocale);
  const baseUrl = getWebBaseUrl();
  const pageUrl = `${baseUrl}/blog/${post.slug}`;
  const pageTitle = buildMetadataTitle(post.title, dictionary);
  const ogImage = post.coverImage
    ? post.coverImage.startsWith("http")
      ? post.coverImage
      : `${baseUrl}${post.coverImage}`
    : OG_IMAGE_URL;

  return {
    title: pageTitle,
    description: post.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      description: post.description,
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      tags: post.tags,
      images: [{ url: ogImage, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: post.description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}
