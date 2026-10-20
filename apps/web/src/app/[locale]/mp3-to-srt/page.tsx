import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarketingMp3ToSrtLandingPageContent } from "@/components/marketing/marketing-mp3-to-srt-landing-page-content";
import { getDictionary, locales, defaultLocale, type Locale } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle, getMetadataSiteName, OG_IMAGE_URL, OG_IMAGE_SIZE } from "@/lib/metadata";

interface Mp3ToSrtPageProps {
  params: Promise<{
    locale: string;
  }>;
}

const PAGE_PATH = "/mp3-to-srt";

export default async function Mp3ToSrtPage({ params }: Mp3ToSrtPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);

  return <MarketingMp3ToSrtLandingPageContent landing={dictionary.marketing.mp3ToSrt} />;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Mp3ToSrtPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  const normalizedLocale = locales.find((item) => item === locale) ?? defaultLocale;
  const dictionary = getDictionary(normalizedLocale);
  const baseUrl = getWebBaseUrl();
  const metadata = dictionary.page.marketing.mp3ToSrt.metadata;
  const pageTitle = buildMetadataTitle(metadata.title);
  const pageDescription = metadata.description;
  const pageUrl = `${baseUrl}${PAGE_PATH}`;
  const socialTitle = pageTitle;

  return {
    title: {
      absolute: pageTitle,
    },
    description: pageDescription,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: socialTitle,
      description: pageDescription,
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, alt: socialTitle, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
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
