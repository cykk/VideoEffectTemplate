import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { ClientProviders } from "@/components/providers/client-providers";
import { getDictionary } from "@markless/shared/src/i18n";
import { defaultLocale } from "@markless/shared/src/i18n/types";
import { getMetadataBaseUrl, getMetadataSiteName, buildBrandedMetadataTitle } from "@/lib/metadata";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export function generateMetadata(): Metadata {
  const dictionary = getDictionary(defaultLocale);
  const homeMetadata = dictionary.page.marketing.landing.metadata;

  return {
    metadataBase: getMetadataBaseUrl(),
    applicationName: getMetadataSiteName(dictionary),
    title: buildBrandedMetadataTitle(homeMetadata.title, dictionary),
    description: homeMetadata.description,
    openGraph: {
      siteName: getMetadataSiteName(dictionary),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={defaultLocale} className={inter.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ClientProviders>
          <AppShell>{children}</AppShell>
        </ClientProviders>
      </body>
    </html>
  );
}
