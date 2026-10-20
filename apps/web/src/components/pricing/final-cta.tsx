"use client";

import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@markless/shared/src/lib/utils";
import { useLocale } from "@/hooks/use-locale";

interface FinalCTAProps {
    className?: string;
    title?: string;
    showTitle?: boolean;
}

export function FinalCTA({
    className,
    title,
    showTitle = true,
}: FinalCTAProps) {
    const { dictionary } = useLocale();
    const dict = dictionary?.pages?.pricing?.finalCta;
    const resolvedTitle = title ?? dict?.title ?? "";

    // Smoothly scroll to top
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600/90 to-accent-600/90 backdrop-blur-sm py-20 lg:py-24 px-12 lg:px-16 text-center max-w-4xl mx-auto",
                className
            )}
        >
            {/* 绠€鍖栫殑鑳屾櫙瑁呴グ */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgb(255 255 255 / 0.1)_0%,_transparent_70%)]" />

            {/* 鍐呭 */}
            <div className="relative z-10 mx-auto max-w-2xl">
                {showTitle && resolvedTitle ? (
                    <h2 className="mb-8 text-3xl font-bold tracking-tight text-primary-foreground lg:text-4xl">
                        {resolvedTitle}
                    </h2>
                ) : null}

                <Button
                    size="lg"
                    onClick={scrollToTop}
                    className="group bg-white text-brand-600 hover:bg-slate-50 text-base lg:text-lg font-bold px-10 lg:px-12 h-14 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 rounded-full cursor-pointer"
                >
                    <span className="flex items-center gap-2">
                        {dict?.choosePlan ?? ""}
                        <ArrowUp className="h-5 w-5 group-hover:-translate-y-1 transition-transform" />
                    </span>
                </Button>
            </div>
        </div>
    );
}

