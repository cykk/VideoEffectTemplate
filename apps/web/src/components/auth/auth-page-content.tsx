"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AuthModalDictionary } from "@markless/shared/src/i18n/types";
import { Logo } from "@/components/ui/logo";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthOfferDescription } from "@/components/auth/auth-offer-description";
import { useLocale } from "@/hooks/use-locale";
import { buildDashboardUrl } from "@/hooks/use-auth-action";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { formatFreeTierCopy } from "@markless/shared/src/lib/marketing/free-tier-copy";

interface AuthPageContentProps {
    mode: "signin" | "signup";
}

import { buildAuthPath } from "@/lib/auth-url";
export function AuthPageContent({ mode }: AuthPageContentProps) {
    const { locale, dictionary } = useLocale();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo");
    const modalDictionary = dictionary.tools.authModal as AuthModalDictionary;
    const [isSuccess, setIsSuccess] = useState(false);
    const { data: bootstrap } = useUserBootstrap();
    const freeTierValues = {
        authenticatedDailyLimit: bootstrap?.freeTranscription.authenticated.dailyLimit,
        authenticatedDurationLimitMinutes:
            bootstrap?.freeTranscription.authenticated.durationLimitMinutes,
    };

    const homeHref = locale === "en" ? "/" : `/${locale}`;
    const alternateAuthHref =
        mode === "signin"
            ? buildAuthPath(locale, "signup", returnTo)
            : buildAuthPath(locale, "login", returnTo);
    const headerCopy = mode === "signup"
        ? {
            title: modalDictionary.signup.fallbackTitle,
            description: formatFreeTierCopy(modalDictionary.signup.fallbackDescription, freeTierValues),
        }
        : { title: modalDictionary.signin.title, description: modalDictionary.signin.description };

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        let targetUrl = buildDashboardUrl(locale);

        if (returnTo) {
            try {
                targetUrl = new URL(returnTo, window.location.origin).toString();
            } catch {
                targetUrl = buildDashboardUrl(locale);
            }
        }

        localStorage.setItem(
            "oauth-callback-target",
            JSON.stringify({
                url: targetUrl,
                timestamp: Date.now(),
            })
        );
    }, [locale, returnTo]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-4 py-12 sm:px-6">
                <div className="mb-6 flex flex-col items-center gap-4">
                    <Link href={homeHref} className="transition-opacity hover:opacity-80">
                        <Logo />
                    </Link>
                </div>

                <section className="w-full rounded-2xl border border-border bg-card p-0 shadow-2xl">
                    {!isSuccess && (
                        <header className="flex min-h-0 flex-col justify-center space-y-3 border-b border-slate-100/80 px-8 pb-5 pr-8 pt-8 text-center sm:px-9 sm:pt-9">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                {headerCopy.title}
                            </h1>
                            {headerCopy.description ? (
                                <AuthOfferDescription
                                    description={headerCopy.description}
                                    className="mx-auto max-w-[280px] text-sm"
                                />
                            ) : null}
                        </header>
                    )}

                    <div
                        className={
                            isSuccess
                                ? "px-8 py-10 sm:px-9"
                                : "space-y-6 px-8 pb-9 pt-5 sm:px-9 sm:pb-10"
                        }
                    >
                        <AuthForm
                            dictionary={modalDictionary}
                            isModal={true}
                            mode={mode}
                            onSuccess={() => {
                                setIsSuccess(true);
                            }}
                        />

                        {!isSuccess && (
                            <div className="pt-1 text-center text-sm text-muted-foreground">
                                {mode === "signin" ? (
                                    <>
                                        {modalDictionary.modeSwitch.noAccount}{" "}
                                        <Link
                                            href={alternateAuthHref}
                                            className="cursor-pointer font-medium text-primary hover:underline"
                                        >
                                            {modalDictionary.modeSwitch.signUp}
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        {modalDictionary.modeSwitch.hasAccount}{" "}
                                        <Link
                                            href={alternateAuthHref}
                                            className="cursor-pointer font-medium text-primary hover:underline"
                                        >
                                            {modalDictionary.modeSwitch.logIn}
                                        </Link>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
