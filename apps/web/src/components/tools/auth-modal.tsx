"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AuthModalDictionary } from "@markless/shared/src/i18n/types";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthOfferDescription } from "@/components/auth/auth-offer-description";
import { cn } from "@markless/shared/src/lib/utils";

interface AuthModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: "signin" | "signup";
    onModeChange?: (mode: "signin" | "signup") => void;
    locale?: string;
    dictionary: AuthModalDictionary;
}

export function AuthModal({
    open,
    onOpenChange,
    mode = "signin",
    onModeChange,
    dictionary,
}: AuthModalProps) {
    const [isSuccess, setIsSuccess] = useState(false);

    const headerCopy = mode === "signup"
        ? {
            title: dictionary.signup.fallbackTitle,
            description: dictionary.signup.fallbackDescription,
        }
        : { title: dictionary.signin.title, description: dictionary.signin.description };

    useEffect(() => {
        if (!open) {
            const timer = setTimeout(() => setIsSuccess(false), 300);
            return () => clearTimeout(timer);
        }
    }, [open]);

    useEffect(() => {
        setIsSuccess(false);
    }, [mode]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                overlayClassName="z-[10020]"
                className="z-[10021] animate-fade-in gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-2xl sm:max-w-[420px]"
            >
                <DialogTitle className="sr-only">{headerCopy.title}</DialogTitle>
                <DialogDescription className="sr-only">{headerCopy.description}</DialogDescription>

                <div
                    className={cn(
                        isSuccess
                            ? "px-8 py-10 sm:px-9"
                            : "flex flex-col gap-5 px-8 py-8 sm:px-9",
                    )}
                >
                    {!isSuccess ? (
                        (
                            <header className="space-y-2 text-center">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                                    {headerCopy.title}
                                </h2>
                                {headerCopy.description ? (
                                    <AuthOfferDescription
                                        description={headerCopy.description}
                                        className="mx-auto max-w-[300px] text-[15px]"
                                    />
                                ) : null}
                            </header>
                        )
                    ) : null}

                    <AuthForm
                        dictionary={dictionary}
                        isModal={true}
                        mode={mode}
                        className="space-y-0"
                        onSuccess={() => {
                            setIsSuccess(true);
                        }}
                    />

                    {!isSuccess ? (
                        <div className="border-t border-slate-100 pt-4 text-center text-sm text-muted-foreground">
                            {mode === "signin" ? (
                                <>
                                    {dictionary.modeSwitch.noAccount}{" "}
                                    <button
                                        type="button"
                                        onClick={() => onModeChange?.("signup")}
                                        className="cursor-pointer p-2 -m-2 inline-block font-medium text-primary hover:underline"
                                    >
                                        {dictionary.modeSwitch.signUp}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {dictionary.modeSwitch.hasAccount}{" "}
                                    <button
                                        type="button"
                                        onClick={() => onModeChange?.("signin")}
                                        className="cursor-pointer p-2 -m-2 inline-block font-medium text-primary hover:underline"
                                    >
                                        {dictionary.modeSwitch.logIn}
                                    </button>
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
