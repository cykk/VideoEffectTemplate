import { Metadata } from "next";
import { OrdersPageClient } from "@/components/settings/orders-page-client";
import { getDictionary } from "@markless/shared/src/i18n";
import type { Locale } from "@markless/shared/src/i18n/types";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle } from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  const dictionary = getDictionary(locale);
  const billingHistory = dictionary.pages.membership.billingHistory;
  const pageUrl = `${getWebBaseUrl()}/settings/orders`;

  return {
    title: buildMetadataTitle(billingHistory.title, dictionary),
    description: billingHistory.pageDescription,
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

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;

  return <OrdersPageClient locale={locale} />;
}
