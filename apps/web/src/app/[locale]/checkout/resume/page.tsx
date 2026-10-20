import type { Metadata } from "next";
import { getDictionary } from "@markless/shared/src/i18n";
import type { Locale } from "@markless/shared/src/i18n/types";
import { buildMetadataTitle } from "@/lib/metadata";
import { CheckoutResumePage } from "@/components/payment/checkout-resume-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  const dictionary = getDictionary(locale);
  const page = dictionary.pages.checkoutResume;

  return {
    title: buildMetadataTitle(page.title, dictionary),
    description: page.description,
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

export default function CheckoutResumeRoute() {
  return <CheckoutResumePage />;
}
