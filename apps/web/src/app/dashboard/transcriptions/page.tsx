import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary } from "@markless/shared/src/i18n";
import { defaultLocale } from "@markless/shared/src/i18n/types";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle } from "@/lib/metadata";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardTranscriptionsPage } from "@/components/dashboard/dashboard-transcriptions-page";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(defaultLocale);
  const page = dictionary.pages.dashboard.transcriptions;
  const pageUrl = `${getWebBaseUrl()}/dashboard/transcriptions`;

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

function DashboardTranscriptionsPageFallback() {
  return <div className="min-h-48 rounded-xl bg-white" />;
}

export default function DashboardTranscriptionsRoute() {
  return (
    <DashboardShell locale={defaultLocale}>
      <Suspense fallback={<DashboardTranscriptionsPageFallback />}>
        <DashboardTranscriptionsPage />
      </Suspense>
    </DashboardShell>
  );
}
