import { notFound } from "next/navigation";
import { PrivacyPageContent } from "@/components/legal/privacy-page-content";
import { LegalPending } from "@/components/legal/legal-pending";
import { isLegalContentReady } from "@/lib/legal-content";
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
  if (!isLegalContentReady(dictionary)) {
    return <LegalPending {...dictionary.app.legal.pending.privacy} />;
  }
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
        absolute: fallback.app.legal.pending.privacy.title,
      },
      description: fallback.app.legal.pending.privacy.description,
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
  const legalReady = isLegalContentReady(dictionary);
  const copy = legalReady ? dictionary.pages.privacy : dictionary.app.legal.pending.privacy;
  const baseUrl = getWebBaseUrl();
  const pageUrl = `${baseUrl}/privacy`;
  const pageTitle = buildMetadataTitle(copy.title, dictionary);

  return {
    title: {
      absolute: pageTitle,
    },
    description: legalReady ? dictionary.pages.privacy.subtitle : copy.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      description: legalReady ? dictionary.pages.privacy.subtitle : copy.description,
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: legalReady ? dictionary.pages.privacy.subtitle : copy.description,
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
