"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { AuthButtons } from "@/components/header/auth-buttons";
import { HeaderLogo } from "@/components/header/header-logo";
import { UserActionBar } from "@/components/header/user-action-bar";
import { AuthModal } from "@/components/tools/auth-modal";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks";
import { buildDashboardUrl, useAuthAction } from "@/hooks/use-auth-action";
import { buildAuthPath } from "@/lib/auth-url";
import { cn } from "@markless/shared/src/lib/utils";
import { BLOG_NAV_ENABLED } from "@/lib/blog/constants";
import type { UserEntitlements } from "@markless/shared/src/types/user-entitlements";

interface HeaderUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

type HeaderVariant = "marketing" | "app";

export function Header({
  loading = false,
  authenticated = false,
  user = null,
  entitlements = null,
  isAdmin = false,
  variant = "marketing",
}: {
  loading?: boolean;
  authenticated?: boolean;
  user?: HeaderUser | null;
  entitlements?: UserEntitlements | null;
  isAdmin?: boolean;
  variant?: HeaderVariant;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { locale, dictionary } = useLocale();
  const {
    showAuthModal,
    authMode,
    openLogin,
    openSignUp,
    closeAuth,
    setAuthMode,
  } = useAuthAction();
  const headerLabels = dictionary.component.layout.header;
  const brandIdentity = headerLabels.brand.identity;
  const dashboardUrl = buildDashboardUrl(locale);
  const handleMarketingLogin = useCallback(() => {
    openLogin("go_dashboard", dashboardUrl);
  }, [dashboardUrl, openLogin]);
  const handleMarketingSignUp = useCallback(() => {
    openSignUp("go_dashboard", dashboardUrl);
  }, [dashboardUrl, openSignUp]);
  const marketingHomeUrl = locale === "en" ? "/" : `/${locale}`;
  const pricingHref = locale === "en" ? "/pricing" : `/${locale}/pricing`;
  const blogHref = locale === "en" ? "/blog" : `/${locale}/blog`;
  const marketingNavLinkClassName =
    "cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-primary/5 hover:text-primary";
  const signUpText = dictionary.header.signup;
  const loginHref = buildAuthPath(locale, "login", dashboardUrl);
  const signupHref = buildAuthPath(locale, "signup", dashboardUrl);

  const isMarketing = variant === "marketing";
  const showDesktopPricing = isMarketing;
  const logoHref = isMarketing ? marketingHomeUrl : dashboardUrl;

  useEffect(() => {
    if (!loading && authenticated && showAuthModal) {
      closeAuth(false);
    }
  }, [authenticated, closeAuth, loading, showAuthModal]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
      )}
    >
      <div className="relative mx-auto flex h-16 max-w-[1440px] items-center">
        <HeaderLogo
          locale={locale}
          href={logoHref}
          variant="dark"
          textSize="md"
          hideTextOnMobile={false}
          brandName={brandIdentity.primary_name}
          supportLabel={brandIdentity.support_label}
          homeAriaLabel={brandIdentity.home_aria_label}
        />

        {showDesktopPricing ? (
          <nav className="ml-12 hidden items-center gap-1 lg:flex">
            <Link href={pricingHref} className={marketingNavLinkClassName}>
              {dictionary.header.pricing}
            </Link>
            {BLOG_NAV_ENABLED ? (
              <Link href={blogHref} className={marketingNavLinkClassName}>
                {dictionary.header.blog}
              </Link>
            ) : null}
          </nav>
        ) : null}

        <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
          {loading ? (
            <div className="h-9 w-36 animate-pulse rounded-full bg-muted" />
          ) : authenticated ? (
            isMarketing ? (
              <Button asChild className="bg-primary text-white hover:bg-primary/90">
                <Link href={dashboardUrl}>{dictionary.header.userMenu.dashboard}</Link>
              </Button>
            ) : (
              <UserActionBar
                user={user}
                entitlements={entitlements}
                entitlementsLoading={loading}
                locale={locale}
                dictionary={dictionary.header}
                isAdmin={isAdmin}
                mode="app"
              />
            )
          ) : isMarketing ? (
            <AuthButtons
              loginText={dictionary.header.login}
              signUpText={signUpText}
              onLoginClick={handleMarketingLogin}
              onSignUpClick={handleMarketingSignUp}
            />
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href={loginHref}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-primary/5 hover:text-primary"
              >
                {dictionary.header.login}
              </Link>
              <Link
                href={signupHref}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                {signUpText}
              </Link>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-lg"
          className="ml-auto md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={headerLabels.actions.toggle_menu}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-border bg-card md:hidden">
          <div className="space-y-1 px-4 py-6">
            {isMarketing ? (
              <>
                <Link
                  href={pricingHref}
                  className={`block ${marketingNavLinkClassName}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {dictionary.header.pricing}
                </Link>
                {BLOG_NAV_ENABLED ? (
                  <Link
                    href={blogHref}
                    className={`block ${marketingNavLinkClassName}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {dictionary.header.blog}
                  </Link>
                ) : null}
              </>
            ) : null}

            <div className="space-y-3 border-t border-border pt-4">
              {loading ? (
                <div className="h-10 rounded-lg bg-muted animate-pulse" />
              ) : authenticated ? (
                isMarketing ? (
                  <Button asChild className="w-full bg-primary text-white hover:bg-primary/90">
                    <Link href={dashboardUrl} onClick={() => setIsMenuOpen(false)}>
                      {dictionary.header.userMenu.dashboard}
                    </Link>
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted p-3">
                      <UserActionBar
                        user={user}
                        entitlements={entitlements}
                        entitlementsLoading={loading}
                        locale={locale}
                        dictionary={dictionary.header}
                        isAdmin={isAdmin}
                        mode="app"
                      />
                    </div>
                  </div>
                )
              ) : isMarketing ? (
                <AuthButtons
                  loginText={dictionary.header.login}
                  signUpText={signUpText}
                  onLoginClick={() => {
                    setIsMenuOpen(false);
                    handleMarketingLogin();
                  }}
                  onSignUpClick={() => {
                    setIsMenuOpen(false);
                    handleMarketingSignUp();
                  }}
                  layout="vertical"
                />
              ) : (
                <div className="flex w-full flex-col gap-2">
                  <Link
                    href={loginHref}
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-primary/5 hover:text-primary"
                  >
                    {dictionary.header.login}
                  </Link>
                  <Link
                    href={signupHref}
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {signUpText}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isMarketing ? (
        <AuthModal
          open={showAuthModal}
          onOpenChange={closeAuth}
          mode={authMode}
          onModeChange={setAuthMode}
          locale={locale}
          dictionary={dictionary.tools.authModal}
        />
      ) : null}
    </header>
  );
}
