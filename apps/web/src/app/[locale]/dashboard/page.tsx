import type { Metadata } from "next";
import { getDictionary } from "@markless/shared/src/i18n";
import type { Locale } from "@markless/shared/src/i18n/types";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle } from "@/lib/metadata";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  const dictionary = getDictionary(locale);
  const page = dictionary.pages.dashboard;
  const pageUrl = `${getWebBaseUrl()}/dashboard`;

  return {
    title: buildMetadataTitle(page.title, dictionary),
    description: page.description,
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

export default function DashboardRoute() {
  return <DashboardPage />;
}
