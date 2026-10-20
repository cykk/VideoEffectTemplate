import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarketingLandingPageContent } from "@/components/marketing/marketing-landing-page-content";
import { getDictionary, locales, defaultLocale, type Locale } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle, getMetadataSiteName, OG_IMAGE_URL, OG_IMAGE_SIZE } from "@/lib/metadata";

interface LocalePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleHome({ params }: LocalePageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);

  return (
    <MarketingLandingPageContent
      landing={dictionary.marketing.landing}
      locale={normalizedLocale}
    />
  );
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  const normalizedLocale = locales.find((item) => item === locale) ?? defaultLocale;
  const dictionary = getDictionary(normalizedLocale);
  const baseUrl = getWebBaseUrl();
  const metadata = dictionary.page.marketing.landing.metadata;
  const pageTitle = buildMetadataTitle(metadata.title);
  const pageDescription = metadata.description;

  return {
    title: {
      absolute: pageTitle,
    },
    description: pageDescription,
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: baseUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, alt: metadata.og_image_alt, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
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
