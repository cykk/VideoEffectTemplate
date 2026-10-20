import { Metadata } from "next";
import { CreditsPageClient } from "@/components/settings/credits-page-client";
import { getDictionary } from "@markless/shared/src/i18n";
import type { Locale } from "@markless/shared/src/i18n/types";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  const dictionary = getDictionary(locale);
  const creditsTab = dictionary.pages.membership.page.creditsTab;
  const pageUrl = `${getWebBaseUrl()}/settings/credits`;

  return {
    title: buildMetadataTitle(creditsTab.title, dictionary),
    description: creditsTab.description,
    alternates: {
      canonical: pageUrl,
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

export default async function CreditsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;

  return <CreditsPageClient locale={locale} />;
}
