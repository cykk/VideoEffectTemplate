import { redirect } from "next/navigation";
import { locales } from "@markless/shared/src/i18n";

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(locale === "en" || !locales.includes(locale as typeof locales[number])
    ? "/dashboard" : `/${locale}/dashboard`);
}
