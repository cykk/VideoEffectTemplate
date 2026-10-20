import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;

  return <DashboardShell locale={locale}>{children}</DashboardShell>;
}
