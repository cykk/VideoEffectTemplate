import { notFound } from "next/navigation";
import { LinksPageContent } from "@/components/marketing/links-page-content";
import { getDictionary, locales, defaultLocale } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import {
  buildMetadataTitle,
  getMetadataSiteName,
  OG_IMAGE_SIZE,
  OG_IMAGE_URL,
} from "@/lib/metadata";

interface LocalePartnersPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocalePartnersPage({ params }: LocalePartnersPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);
  return <LinksPageContent dictionary={dictionary.pages.links} />;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocalePartnersPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    const fallback = getDictionary(defaultLocale);
    const fallbackDescription = fallback.pages.links.description.trim();
    return {
      title: buildMetadataTitle(fallback.pages.links.title, fallback),
      ...(fallbackDescription ? { description: fallbackDescription } : {}),
    };
  }

  const dictionary = getDictionary(normalizedLocale);
  const baseUrl = getWebBaseUrl();
  const pageUrl = `${baseUrl}/partners`;
  const pageTitle = buildMetadataTitle(dictionary.pages.links.title, dictionary);
  const pageDescription = dictionary.pages.links.description.trim();

  return {
    title: pageTitle,
    ...(pageDescription ? { description: pageDescription } : {}),
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      ...(pageDescription ? { description: pageDescription } : {}),
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      ...(pageDescription ? { description: pageDescription } : {}),
      images: [OG_IMAGE_URL],
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}
