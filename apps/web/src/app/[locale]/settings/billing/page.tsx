import type { Metadata } from "next";
import { SettingsOverviewContainer } from "@/components/settings/settings-overview-container";
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
  const memberCenter = dictionary.pages.membership.page.header;
  const pageUrl = `${getWebBaseUrl()}/settings`;

  return {
    title: buildMetadataTitle(memberCenter.title, dictionary),
    description: memberCenter.subtitle,
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

export default async function SettingsPageRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  const dictionary = getDictionary(locale);

  return <SettingsOverviewContainer locale={locale} dictionary={dictionary} />;
}
