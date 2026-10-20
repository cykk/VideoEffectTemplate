import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AuthPageContent } from "@/components/auth/auth-page-content";
import { defaultLocale, getDictionary, locales } from "@markless/shared/src/i18n";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle } from "@/lib/metadata";

interface LocaleLoginPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleLoginPage({ params }: LocaleLoginPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <AuthPageContent mode="signin" />
    </Suspense>
  );
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLoginPageProps) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const normalizedLocale = locales.find((item) => item === locale);
  const dictionary = getDictionary(normalizedLocale ?? defaultLocale);
  const pageUrl = `${getWebBaseUrl()}/login`;

  return {
    title: buildMetadataTitle(dictionary.pages.login.title, dictionary),
    description: dictionary.pages.login.description,
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
