"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { authClient } from "@markless/shared/src/lib/auth/client";
import { RichTextContent } from "@/components/i18n/rich-text";
import { AuthPanelDictionary } from "@markless/shared/src/i18n/types";
import { cn } from "@markless/shared/src/lib/utils";
import { formatFreeTierCopy } from "@markless/shared/src/lib/marketing/free-tier-copy";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { AuthForm } from "./auth-form";
import { useSignOut } from "@/hooks/use-sign-out";

interface AuthPanelProps {
    mode?: "signin" | "signup";
    dictionary: AuthPanelDictionary;
    variant?: "page" | "default";
    alternateAuthHref?: string;
}

export function AuthPanel({
    mode = "signin",
    dictionary,
    variant = "default",
    alternateAuthHref,
}: AuthPanelProps) {
    const session = authClient.useSession();
    const isAuthenticated = Boolean(session.data?.user);
    const modeDict = dictionary[mode];
    const [isSuccess, setIsSuccess] = useState(false);
    const signOut = useSignOut();
    const { data: bootstrap } = useUserBootstrap();
    const freeTierValues = {
        authenticatedDailyLimit: bootstrap?.freeTranscription.authenticated.dailyLimit,
        authenticatedDurationLimitMinutes:
            bootstrap?.freeTranscription.authenticated.durationLimitMinutes,
    };

    const headerCopy = mode === "signup"
        ? {
            title: dictionary.signup.fallbackTitle,
            description: formatFreeTierCopy(dictionary.signup.fallbackDescription, freeTierValues),
        }
        : { title: dictionary.signin.title, description: dictionary.signin.description };

    const cardClassName = cn(
        "w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 animate-fade-in",
        variant === "default" && "bg-card border-border shadow-2xl backdrop-blur-sm"
    );

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error("[Better Auth] Sign out failed", error);
        }
    };

    if (isAuthenticated) {
        return (
            <section className={cardClassName}>
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                        <span className="text-2xl">👋</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{modeDict.title}</h1>
                </div>

                <div className="space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-1 flex items-center gap-3">
                            <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
                            <p className="text-sm font-medium text-slate-500">
                                {dictionary.signedInAs.split("{")[0]}
                            </p>
                        </div>
                        <p className="truncate pl-5 text-base font-semibold text-slate-900">
                            {session.data?.user?.name ?? session.data?.user?.email}
                        </p>
                    </div>

                    <button
                        onClick={handleSignOut}
                        className="w-full cursor-pointer rounded-xl border border-transparent px-4 py-3 font-medium text-slate-500 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                    >
                        {dictionary.signOut}
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className={cardClassName}>
            {!isSuccess && (
                <header className="mb-8 space-y-3 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {headerCopy.title}
                    </h1>
                    {headerCopy.description ? (
                        <p className="text-sm leading-relaxed text-slate-600">
                            {headerCopy.description}
                        </p>
                    ) : null}
                </header>
            )}

            {variant === "page" && mode === "signup" && !isSuccess ? (
                <ul className="mb-6 space-y-2.5">
                    {dictionary.signupBenefits.map((item) => (
                        <li
                            key={item}
                            className="flex items-start gap-2.5 text-sm text-slate-600"
                        >
                            <Check
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <span>{formatFreeTierCopy(item, freeTierValues)}</span>
                        </li>
                    ))}
                </ul>
            ) : null}

            <AuthForm
                dictionary={dictionary}
                isModal={false}
                mode={mode}
                onSuccess={() => setIsSuccess(true)}
            />

            {!isSuccess && alternateAuthHref ? (
                <div className="mt-6 text-center text-sm text-slate-500">
                    {mode === "signin" ? (
                        <>
                            {dictionary.modeSwitch.noAccount}{" "}
                            <Link
                                href={alternateAuthHref}
                                className="font-medium text-primary hover:underline"
                            >
                                {dictionary.modeSwitch.signUp}
                            </Link>
                        </>
                    ) : (
                        <>
                            {dictionary.modeSwitch.hasAccount}{" "}
                            <Link
                                href={alternateAuthHref}
                                className="font-medium text-primary hover:underline"
                            >
                                {dictionary.modeSwitch.logIn}
                            </Link>
                        </>
                    )}
                </div>
            ) : null}

            {!isSuccess && dictionary.footer.length > 0 ? (
                <footer className="mt-8 text-center text-xs text-slate-500">
                    <RichTextContent segments={dictionary.footer} />
                </footer>
            ) : null}
        </section>
    );
}
