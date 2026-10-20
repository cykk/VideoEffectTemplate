"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import type { Locale } from "@markless/shared/src/i18n/types";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";

interface DashboardShellProps {
  children: React.ReactNode;
  locale: Locale;
}

export function DashboardShell({ children, locale }: DashboardShellProps) {
  const router = useRouter();
  const { data: bootstrap, loading, isFetched } = useUserBootstrap();

  useEffect(() => {
    if (loading || !isFetched || !bootstrap) {
      return;
    }

    if (!bootstrap.authenticated) {
      router.replace(locale === "en" ? "/login" : `/${locale}/login`);
    }
  }, [bootstrap, isFetched, loading, locale, router]);

  if (loading || !isFetched || !bootstrap?.authenticated) {
    return <div className="min-h-screen bg-background dark:bg-neutral-950" />;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-neutral-950">
      <div className="flex">
        <DashboardSidebar locale={locale} />
        <main className="flex-1 lg:ml-0">
          <div className="lg:hidden h-[60px]" />
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

