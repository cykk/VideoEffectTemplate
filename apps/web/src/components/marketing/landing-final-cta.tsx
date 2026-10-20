"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@markless/shared/src/lib/utils";

interface LandingFinalCTAProps {
    title: string;
    subtitle: string;
    buttonText: string;
    className?: string;
}

export function LandingFinalCTA({
    title,
    subtitle,
    buttonText,
    className,
}: LandingFinalCTAProps) {
    const scrollToUpload = () => {
        document.getElementById("upload")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    return (
        <div
            className={cn(
                "mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10 lg:px-12 lg:py-12",
                className
            )}
        >
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                        {title}
                    </h2>
                    <p className="text-base leading-7 text-slate-600 sm:text-lg">
                        {subtitle}
                    </p>
                </div>

                <Button
                    size="lg"
                    onClick={scrollToUpload}
                    className="h-12 rounded-full px-8 text-base font-semibold sm:h-14 sm:px-10 sm:text-lg"
                >
                    {buttonText}
                </Button>
            </div>
        </div>
    );
}
