import { notFound } from "next/navigation";
import { getDictionary, locales } from "@markless/shared/src/i18n";
import { RaindanceHome } from "@/components/home/raindance/raindance-home";
import { FirstTouchCapture } from "@/components/analytics/first-touch-capture";
import type { Locale } from "@markless/shared/src/i18n/types";

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const normalizedLocale = locales.find((item) => item === locale);

  if (!normalizedLocale) {
    notFound();
  }

  const dictionary = getDictionary(normalizedLocale);

  return (
    <>
      <FirstTouchCapture />
      <RaindanceHome
        dictionary={dictionary.marketing.raindanceHome}
        authDictionary={dictionary.tools.authModal}
        locale={normalizedLocale as Locale}
      />
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const normalizedLocale = locales.find((item) => item === locale) ?? locales[0];
  const dictionary = getDictionary(normalizedLocale);
  const page = dictionary.marketing.raindanceHome.metadata;

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: page.title,
      description: page.description,
      type: "website",
    },
  };
}
