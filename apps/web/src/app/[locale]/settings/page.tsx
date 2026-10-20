import { redirect } from "next/navigation";
import type { Locale } from "@markless/shared/src/i18n/types";

export default async function SettingsRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  
  if (locale === "en") {
    redirect("/settings/billing");
  } else {
    redirect(`/${locale}/settings/billing`);
  }
}
