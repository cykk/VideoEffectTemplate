import type { Metadata } from "next";
import { AccountPageClient } from "@/components/settings/account-page-client";
import { getDictionary } from "@markless/shared/src/i18n";
import { type Locale } from "@markless/shared/src/i18n/types";
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
  const pageUrl = `${getWebBaseUrl()}/settings/account`;

  return {
    title: buildMetadataTitle(dictionary.pages.profile.title, dictionary),
    description: dictionary.pages.profile.description,
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

export default async function SettingsAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;

  return <AccountPageClient locale={locale} />;
}
