import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AuthPageContent } from "@/components/auth/auth-page-content";
import { getDictionary, locales, defaultLocale } from "@markless/shared/src/i18n";
import { formatFreeTierCopy } from "@markless/shared/src/lib/marketing/free-tier-copy";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { buildMetadataTitle } from "@/lib/metadata";

interface LocaleSignupPageProps {
    params: Promise<{
        locale: string;
    }>;
}

export default async function LocaleSignupPage({ params }: LocaleSignupPageProps) {
    const resolvedParams = await params;
    const locale = resolvedParams.locale;
    const normalizedLocale = locales.find((item) => item === locale);

    if (!normalizedLocale) {
        notFound();
    }

    return (
        <Suspense fallback={null}>
            <AuthPageContent mode="signup" />
        </Suspense>
    );
}

export function generateStaticParams() {
    return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleSignupPageProps) {
    const resolvedParams = await params;
    const locale = resolvedParams.locale;
    const normalizedLocale = locales.find((item) => item === locale);

    if (!normalizedLocale) {
        const fallback = getDictionary(defaultLocale);
        return {
            title: buildMetadataTitle(fallback.pages.signup.title, fallback),
            description: formatFreeTierCopy(fallback.pages.signup.description),
            alternates: {
                canonical: `${getWebBaseUrl()}/signup`,
            },
            robots: {
                index: false,
                follow: true,
                googleBot: {
                    index: false,
                    follow: true,
                },
            },
        };
    }

    const dictionary = getDictionary(normalizedLocale);
    const pageUrl = `${getWebBaseUrl()}/signup`;

    return {
        title: buildMetadataTitle(dictionary.pages.signup.title, dictionary),
        description: formatFreeTierCopy(dictionary.pages.signup.description),
        alternates: {
            canonical: pageUrl,
        },
        robots: {
            index: false,
            follow: true,
            googleBot: {
                index: false,
                follow: true,
            },
        },
    };
}
