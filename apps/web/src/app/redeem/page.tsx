import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, defaultLocale } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle } from "@/lib/metadata";
import { RedeemPageClient } from "@/components/redeem/redeem-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(defaultLocale);
  const pageDict = dictionary.pages.redeem;
  const pageUrl = `${getWebBaseUrl()}/redeem`;

  return {
    title: buildMetadataTitle(pageDict.metadataTitle, dictionary),
    description: pageDict.metadataDescription,
    alternates: {
      canonical: pageUrl,
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

export default function RedeemPage() {
  return (
    <Suspense fallback={null}>
      <RedeemPageClient />
    </Suspense>
  );
}
