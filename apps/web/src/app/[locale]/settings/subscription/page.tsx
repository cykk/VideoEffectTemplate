import { Metadata } from "next";
import { SubscriptionPageClient } from "@/components/settings/subscription-page-client";
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
  const subscriptionPage = dictionary.pages.membership.subscriptionPage;
  const pageUrl = `${getWebBaseUrl()}/settings/subscription`;

  return {
    title: buildMetadataTitle(subscriptionPage.header.title, dictionary),
    description: subscriptionPage.header.description,
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

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;

  return <SubscriptionPageClient locale={locale} />;
}
