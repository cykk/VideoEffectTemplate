"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import type { Locale } from "@markless/shared/src/i18n/types";
import { getDictionary } from "@markless/shared/src/i18n";
import { buildDashboardPath } from "@/lib/dashboard/paths";

interface DashboardSidebarProps {
  locale: Locale;
}

type SidebarMenuItem = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  exactMatch: boolean;
};

export function DashboardSidebar({ locale }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dictionary = getDictionary(locale);
  const labels = dictionary.component.membership.sidebar;

  const menuItems: SidebarMenuItem[] = [
    {
      id: "overview",
      label: labels.nav.overview,
      icon: LayoutDashboard,
      href: buildDashboardPath(locale),
      exactMatch: true,
    },
    {
      id: "jobs",
      label: dictionary.app.ai.jobs.page.title,
      icon: Sparkles,
      href: buildDashboardPath(locale, "/jobs"),
      exactMatch: false,
    },
  ];

  const isActive = (item: SidebarMenuItem) => {
    if (item.exactMatch) {
      return pathname === item.href;
    }

    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  };

  const renderMenuItems = () => (
    <>
      {menuItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
              active
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {labels.mobile.title}
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label={isMobileMenuOpen ? labels.actions.close_menu : labels.actions.open_menu}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-64 border-r border-neutral-200 bg-white transition-transform duration-300 dark:border-neutral-800 dark:bg-neutral-950 lg:sticky lg:z-0 lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="h-[60px] lg:hidden" />
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 lg:py-6">
            {renderMenuItems()}
          </nav>
        </div>
      </aside>
    </>
  );
}

