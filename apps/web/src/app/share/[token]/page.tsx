import type { Metadata } from "next";
import { SharedTranscriptionPage } from "@/components/transcriptions/shared-transcription-page";
import { getDictionary, defaultLocale } from "@markless/shared/src/i18n";
import { buildMetadataTitle, getMetadataSiteName } from "@/lib/metadata";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function SharedTranscriptionRoute({ params }: PageProps) {
  const { token } = await params;
  return <SharedTranscriptionPage shareToken={token} />;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const dictionary = getDictionary(defaultLocale);
  const pageDict = dictionary.pages.transcriptions.sharedPage;
  const baseUrl = getWebBaseUrl();
  const path = `/share/${token}`;
  const title = buildMetadataTitle(pageDict.metadataTitle, dictionary);

  return {
    title: {
      absolute: title,
    },
    description: pageDict.metadataDescription,
    alternates: {
      canonical: `${baseUrl}${path}`,
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    openGraph: {
      title,
      description: pageDict.metadataDescription,
      url: `${baseUrl}${path}`,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
    },
  };
}
