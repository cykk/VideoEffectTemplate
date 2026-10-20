import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TranscriptionResultPage } from "@/components/transcriptions/transcription-result-page";
import { defaultLocale, getDictionary, locales, type Locale } from "@markless/shared/src/i18n";
import { buildMetadataTitle, getMetadataSiteName } from "@/lib/metadata";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export default async function LocaleTranscriptionResultPage({
  params,
}: PageProps) {
  const { locale, id } = await params;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  return <TranscriptionResultPage publicId={id} />;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const normalizedLocale = locales.find((item) => item === locale) ?? defaultLocale;
  const dictionary = getDictionary(normalizedLocale as Locale);
  const pageDict = dictionary.pages.transcriptions;
  const baseUrl = getWebBaseUrl();
  const path = normalizedLocale === "en" ? `/transcriptions/${id}` : `/${normalizedLocale}/transcriptions/${id}`;
  const title = buildMetadataTitle(pageDict.title, dictionary);

  return {
    title: {
      absolute: title,
    },
    description: pageDict.description,
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
      description: pageDict.description,
      url: `${baseUrl}${path}`,
      siteName: getMetadataSiteName(dictionary),
      locale: "en_US",
      type: "website",
    },
  };
}
