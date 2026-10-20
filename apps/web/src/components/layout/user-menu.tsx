"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HeaderDictionary, Locale } from "@markless/shared/src/i18n/types";
import { defaultLocale } from "@markless/shared/src/i18n";
import { useSignOut } from "@/hooks/use-sign-out";
import { buildDashboardUrl } from "@/hooks/use-auth-action";

interface UserMenuProps {
  dictionary: HeaderDictionary;
  locale: Locale;
  isAdmin?: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export function UserMenu({
  dictionary,
  locale,
  isAdmin = false,
  user,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const signOut = useSignOut();
  const pathname = usePathname();

  if (!user) {
    return null;
  }

  const dashboardHref = buildDashboardUrl(locale);
  const settingsHref = locale === defaultLocale ? "/settings/billing" : `/${locale}/settings/billing`;
  const settingsPrefix = locale === defaultLocale ? "/settings" : `/${locale}/settings`;
  const localizedDashboardPrefix = locale === defaultLocale ? "/dashboard" : `/${locale}/dashboard`;
  const isProtectedSettingsPath =
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === settingsPrefix ||
    pathname.startsWith(`${settingsPrefix}/`) ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === localizedDashboardPrefix ||
    pathname.startsWith(`${localizedDashboardPrefix}/`);

  const handleSignOut = async () => {
    try {
      await signOut(
        isProtectedSettingsPath
          ? {
              redirectTo: locale === defaultLocale ? "/" : `/${locale}`,
            }
          : undefined
      );
    } catch (error) {
      console.error("[Better Auth] Sign out failed", error);
    }
  };

  const getUserAvatar = () => {
    if (user.image) {
      return (
        <Image
          src={user.image}
          alt={user.name || user.email || user.image}
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
      );
    }

    const initials = (user.name || user.email || "U")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700">
        <span className="text-sm font-semibold text-white">{initials}</span>
      </div>
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-8 w-8 cursor-pointer rounded-full p-0 hover:bg-slate-100"
        >
          {getUserAvatar()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuItem asChild>
          <Link href={dashboardHref} className="cursor-pointer">
            <span>{dictionary.userMenu.dashboard}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href={settingsHref} className="cursor-pointer">
            <span>{dictionary.userMenu.billing}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href={`${settingsPrefix}/subscription`} className="cursor-pointer">
            <span>{dictionary.userMenu.subscription}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href={`${settingsPrefix}/account`} className="cursor-pointer">
            <span>{dictionary.userMenu.account}</span>
          </Link>
        </DropdownMenuItem>

        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link
              href="/admin/"
              className="cursor-pointer"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{dictionary.userMenu.adminMenu}</span>
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <span>{dictionary.userMenu.signOut}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
