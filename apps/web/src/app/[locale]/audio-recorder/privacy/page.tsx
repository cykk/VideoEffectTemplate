import { PrivacyPageContent } from "@/components/legal/privacy-page-content";
import { buildMetadataTitle, getMetadataSiteName, OG_IMAGE_SIZE, OG_IMAGE_URL } from "@/lib/metadata";
import { getDictionary, locales } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { notFound } from "next/navigation";

interface AudioRecorderPrivacyPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function AudioRecorderPrivacyPage({ params }: AudioRecorderPrivacyPageProps) {
  const { locale } = await params;
  const normalizedLocale = locales.find((candidate) => candidate === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);
  return <PrivacyPageContent dictionary={dictionary.pages.audioRecorderPrivacy} />;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: AudioRecorderPrivacyPageProps) {
  const { locale } = await params;
  const normalizedLocale = locales.find((candidate) => candidate === locale);

  if (!normalizedLocale) {
    return {};
  }

  const dictionary = getDictionary(normalizedLocale);
  const page = dictionary.pages.audioRecorderPrivacy;
  const pageUrl = `${getWebBaseUrl()}/audio-recorder/privacy`;
  const pageTitle = buildMetadataTitle(page.title, dictionary);

  return {
    title: {
      absolute: pageTitle,
    },
    description: page.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      description: page.description,
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: page.description,
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

