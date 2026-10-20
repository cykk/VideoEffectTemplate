import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import type { Locale } from "@markless/shared/src/i18n/types";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;

  return <SettingsShell locale={locale}>{children}</SettingsShell>;
}
