import { notFound } from "next/navigation";
import { PrivacyPageContent } from "@/components/legal/privacy-page-content";
import { getDictionary, locales, defaultLocale } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle, getMetadataSiteName, OG_IMAGE_URL, OG_IMAGE_SIZE } from "@/lib/metadata";

interface LocalePrivacyPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocalePrivacyPage({ params }: LocalePrivacyPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);
  return <PrivacyPageContent dictionary={dictionary.pages.privacy} />;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocalePrivacyPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((l) => l === locale);
  
  if (!normalizedLocale) {
    const fallback = getDictionary(defaultLocale);
    return {
      title: {
        absolute: buildMetadataTitle(fallback.pages.privacy.title, fallback),
      },
      description: fallback.pages.privacy.subtitle,
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
  const pageUrl = `${baseUrl}/privacy`;
  const pageTitle = buildMetadataTitle(dictionary.pages.privacy.title, dictionary);

  return {
    title: {
      absolute: pageTitle,
    },
    description: dictionary.pages.privacy.subtitle,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      description: dictionary.pages.privacy.subtitle,
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: dictionary.pages.privacy.subtitle,
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
