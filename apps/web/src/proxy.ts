import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, type Locale } from "@markless/shared/src/i18n/types";

function detectLocale(pathname: string): Locale {
  const segment = pathname.split("/")[1];
  return (locales as readonly string[]).includes(segment)
    ? (segment as Locale)
    : defaultLocale;
}

function withContentLanguage(response: NextResponse, locale: Locale): NextResponse {
  response.headers.set("Content-Language", locale);
  response.headers.set("x-locale", locale);
  return response;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const profileLocale = locales.find(
    (locale) => pathname === `/${locale}/profile` || pathname.startsWith(`/${locale}/profile/`)
  );
  if (profileLocale) {
    const url = request.nextUrl.clone();
    url.pathname = "/settings/account";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/settings/account";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/redeem" || pathname.startsWith("/redeem/")) {
    return withContentLanguage(NextResponse.next(), defaultLocale);
  }

  if (pathname.startsWith("/en/") || pathname === "/en") {
    const pathWithoutLocale = pathname.replace(/^\/en/, "") || "/";
    const url = request.nextUrl.clone();
    url.pathname = pathWithoutLocale;
    return NextResponse.redirect(url, 308);
  }

  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale) {
    const url = new URL(`/${defaultLocale}${pathname}${request.nextUrl.search}`, request.url);
    return withContentLanguage(NextResponse.rewrite(url), defaultLocale);
  }

  return withContentLanguage(NextResponse.next(), detectLocale(pathname));
}

export const config = {
  matcher: [
    "/((?!admin|api|redeem(?:/.*)?$|_next/static|_next/image|favicon.ico|icon\\.svg|icon\\.png|apple-icon\\.png|og-image\\.png|sitemap\\.xml|robots\\.txt|llms\\.txt|startupranking1371684721257210\\.html$|\\.well-known|model-logo|model-video|marketing|images|videos|blog/covers|blog/default-cover\\.svg).*)",
  ],
};
