import type { BlogPostMeta } from "@/lib/blog/types";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";

interface BlogJsonLdProps {
  post: BlogPostMeta;
}

export function BlogJsonLd({ post }: BlogJsonLdProps) {
  const baseUrl = getWebBaseUrl();
  const pageUrl = `${baseUrl}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      "@type": "Organization",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "MP3ToText",
      url: baseUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    url: pageUrl,
    keywords: post.tags.join(", "),
    ...(post.coverImage
      ? {
          image: post.coverImage.startsWith("http")
            ? post.coverImage
            : `${baseUrl}${post.coverImage}`,
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
