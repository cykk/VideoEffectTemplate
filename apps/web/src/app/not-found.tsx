import Link from "next/link";
import { headers } from "next/headers";
import { getDictionary, defaultLocale } from "@markless/shared/src/i18n";
import { locales, type Locale } from "@markless/shared/src/i18n/types";

function resolveHref(locale: Locale, path: string) {
  return locale === defaultLocale ? path : `/${locale}${path}`;
}

export default async function NotFound() {
  const headersList = await headers();
  const locale = (locales as readonly string[]).includes(headersList.get("x-locale") ?? "")
    ? (headersList.get("x-locale") as Locale)
    : defaultLocale;
  const dict = getDictionary(locale).errorPages.notFound;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-8xl font-extrabold tracking-tighter text-neutral-200 dark:text-neutral-800">
        {dict.heading}
      </p>
      <h1 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        {dict.title}
      </h1>
      <p className="mt-2 max-w-md text-base text-neutral-600 dark:text-neutral-400">
        {dict.description}
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href={resolveHref(locale, "/")}
          className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {dict.backHome}
        </Link>
        <Link
          href={resolveHref(locale, "/pricing")}
          className="rounded-lg border border-neutral-300 bg-white px-6 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {dict.tryTools}
        </Link>
      </div>
    </div>
  );
}
