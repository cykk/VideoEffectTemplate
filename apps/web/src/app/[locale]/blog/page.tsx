import { notFound } from "next/navigation";
import { BlogListContent } from "@/components/blog/blog-list-content";
import { getDictionary, locales, defaultLocale } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { getPublishedPosts } from "@/lib/blog/load-posts";
import {
  buildMetadataTitle,
  getMetadataSiteName,
  OG_IMAGE_SIZE,
  OG_IMAGE_URL,
} from "@/lib/metadata";

interface LocaleBlogPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleBlogPage({ params }: LocaleBlogPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);
  const posts = getPublishedPosts();

  return (
    <BlogListContent
      posts={posts}
      dictionary={dictionary.pages.blogs}
      locale={normalizedLocale}
    />
  );
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleBlogPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    const fallback = getDictionary(defaultLocale);
    return {
      title: buildMetadataTitle(fallback.pages.blogs.title, fallback),
      description: fallback.pages.blogs.description,
    };
  }

  const dictionary = getDictionary(normalizedLocale);
  const baseUrl = getWebBaseUrl();
  const pageUrl = `${baseUrl}/blog`;
  const pageTitle = buildMetadataTitle(dictionary.pages.blogs.title, dictionary);

  return {
    title: pageTitle,
    description: dictionary.pages.blogs.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      description: dictionary.pages.blogs.description,
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: dictionary.pages.blogs.description,
      images: [OG_IMAGE_URL],
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
