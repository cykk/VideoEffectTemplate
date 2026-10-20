import { notFound } from "next/navigation";
import { TermsPageContent } from "@/components/legal/terms-page-content";
import { getDictionary, locales, defaultLocale } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle, getMetadataSiteName, OG_IMAGE_URL, OG_IMAGE_SIZE } from "@/lib/metadata";

interface LocaleTermsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleTermsPage({ params }: LocaleTermsPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);
  return <TermsPageContent dictionary={dictionary.pages.terms} />;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleTermsPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    const fallback = getDictionary(defaultLocale);
    return {
      title: buildMetadataTitle(fallback.pages.terms.title, fallback),
      description: fallback.pages.terms.subtitle,
      robots: {
        index: false,
        follow: true,
        googleBot: {
          index: false,
          follow: true,
        },
      },
    };
  }

  const dictionary = getDictionary(normalizedLocale);
  const baseUrl = getWebBaseUrl();
  const pageUrl = `${baseUrl}/terms`;
  const pageTitle = buildMetadataTitle(dictionary.pages.terms.title, dictionary);

  return {
    title: pageTitle,
    description: dictionary.pages.terms.subtitle,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      description: dictionary.pages.terms.subtitle,
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: dictionary.pages.terms.subtitle,
      images: [OG_IMAGE_URL],
    },
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  };
}
