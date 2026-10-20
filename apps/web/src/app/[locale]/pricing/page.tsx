import { notFound } from "next/navigation";
import { PricingPageContent } from "@/components/pricing/pricing-page-content";
import { getDictionary, locales, defaultLocale } from "@markless/shared/src/i18n";
import { formatFreeTierCopy } from "@markless/shared/src/lib/marketing/free-tier-copy";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { getMetadataSiteName, buildMetadataTitle, OG_IMAGE_URL, OG_IMAGE_SIZE } from "@/lib/metadata";

interface LocalePricingPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocalePricingPage({ params }: LocalePricingPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dictionary.pages.pricing.faqs.slice(0, 6).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: formatFreeTierCopy(item.answer),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PricingPageContent dictionary={dictionary.pages.pricing} />
    </>
  );
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocalePricingPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    const fallback = getDictionary(defaultLocale);
    return {
      title: buildMetadataTitle(fallback.pages.pricing.title, fallback),
      description: fallback.pages.pricing.subtitle,
    };
  }

  const dictionary = getDictionary(normalizedLocale);
  const baseUrl = getWebBaseUrl();
  const pageUrl = `${baseUrl}/pricing`;
  const pageTitle = buildMetadataTitle(dictionary.pages.pricing.title, dictionary);

  return {
    title: pageTitle,
    description: dictionary.pages.pricing.subtitle,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      description: dictionary.pages.pricing.subtitle,
      url: pageUrl,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
      images: [{ url: OG_IMAGE_URL, ...OG_IMAGE_SIZE }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: dictionary.pages.pricing.subtitle,
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
