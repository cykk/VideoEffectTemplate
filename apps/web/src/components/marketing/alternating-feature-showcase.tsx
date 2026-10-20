"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import {
    Clapperboard,
    FileAudio,
    GraduationCap,
    Languages,
    Mic2,
    Newspaper,
    Sparkles,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import { Button } from "@/components/ui/button";
import { MarketingRichTextBlock } from "@/components/marketing/marketing-rich-text-block";
import { MarketingHtmlText } from "@/components/marketing/marketing-html-text";

const ILLUSTRATION_ICON_SETS = {
    useCases: [GraduationCap, Mic2, Clapperboard, Newspaper],
    whyChoose: [Languages, Zap, FileAudio, Sparkles],
} satisfies Record<string, LucideIcon[]>;

type IllustrationIconSet = keyof typeof ILLUSTRATION_ICON_SETS;

function LazyVideo({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    video.src = src;
                    video.load();
                    video.play().catch(() => {});
                    observer.disconnect();
                }
            },
            { rootMargin: "200px" }
        );

        observer.observe(video);
        return () => observer.disconnect();
    }, [src]);

    return (
        <video
            ref={videoRef}
            poster={poster}
            preload="none"
            autoPlay={false}
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
            aria-label={alt}
        />
    );
}

export interface AlternatingFeatureMediaItem {
    title: string;
    subtitle?: string;
    lead?: string;
    description?: string;
    paragraphs?: string[];
    bulletsIntro?: string;
    bullets?: string[];
    closingParagraphs?: string[];
    supportingText?: string;
    media:
    | {
        type: "image";
        src: string;
        alt: string;
    }
    | {
        type: "video";
        src: string;
        alt: string;
        poster?: string;
    }
    | {
        type: "comparison";
        beforeSrc: string;
        afterSrc: string;
        beforeAlt: string;
        afterAlt: string;
        beforeLabel?: string;
        afterLabel?: string;
        aspectRatio?: string;
    }
    | {
        type: "illustration";
        alt: string;
    };
}

interface AlternatingFeatureShowcaseProps {
    title: string;
    subtitle?: string;
    subtitleHtml?: string;
    introParagraphs?: string[];
    items: AlternatingFeatureMediaItem[];
    className?: string;
    ctaText?: string;
    illustrationIconSet?: IllustrationIconSet;
}

export function AlternatingFeatureShowcase({
    title,
    subtitle,
    subtitleHtml,
    introParagraphs,
    items,
    className,
    ctaText,
    illustrationIconSet = "useCases",
}: AlternatingFeatureShowcaseProps) {
    const illustrationIcons = ILLUSTRATION_ICON_SETS[illustrationIconSet];
    const scrollToUpload = () => {
        document.getElementById("upload")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    return (
        <section className={cn("px-4 py-20 sm:px-6 lg:px-8", className)}>
            <div className="mx-auto max-w-6xl">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
                    {subtitleHtml ? (
                        <MarketingHtmlText
                            as="div"
                            html={subtitleHtml}
                            className="mx-auto mt-3 max-w-3xl space-y-4 text-base leading-relaxed text-slate-600 sm:text-lg [&_p+p]:mt-0"
                        />
                    ) : subtitle ? (
                        <p className="mx-auto mt-3 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
                            {subtitle}
                        </p>
                    ) : null}
                    {introParagraphs && introParagraphs.length > 0 ? (
                        <div className="mx-auto mt-3 max-w-3xl space-y-4 text-left sm:text-center">
                            {introParagraphs.map((paragraph) => (
                                <p
                                    key={paragraph}
                                    className="text-base leading-relaxed text-slate-600 sm:text-lg"
                                >
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div className="mt-14 space-y-12 sm:space-y-14">
                    {items.map((item, index) => {
                        const reversed = index % 2 === 1;

                        return (
                            <article
                                key={item.title}
                                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10"
                            >
                                <div className={cn("space-y-4", reversed && "lg:order-2")}>
                                    <h3 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                                        {item.title}
                                    </h3>
                                    {item.subtitle ? (
                                        <h4 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                                            {item.subtitle}
                                        </h4>
                                    ) : null}
                                    {item.lead ? (
                                        <p className="text-base font-semibold leading-7 text-slate-800">
                                            {item.lead}
                                        </p>
                                    ) : null}
                                    <MarketingRichTextBlock
                                        description={item.description}
                                        paragraphs={item.paragraphs}
                                        bulletsIntro={item.bulletsIntro}
                                        bullets={item.bullets}
                                        closingParagraphs={
                                            item.supportingText
                                                ? [
                                                      item.supportingText,
                                                      ...(item.closingParagraphs ?? []),
                                                  ]
                                                : item.closingParagraphs
                                        }
                                    />
                                </div>

                                <div className={cn(reversed && "lg:order-1")}>
                                    {item.media.type === "comparison" ? (
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                                    {item.media.beforeLabel ?? "Before"}
                                                </div>
                                                <div
                                                    className="relative overflow-hidden rounded-2xl bg-muted"
                                                    style={{ aspectRatio: item.media.aspectRatio || "16/9" }}
                                                >
                                                    <Image
                                                        src={item.media.beforeSrc}
                                                        alt={item.media.beforeAlt}
                                                        fill
                                                        sizes="(min-width: 1024px) 25vw, 100vw"
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                                    {item.media.afterLabel ?? "After"}
                                                </div>
                                                <div
                                                    className="relative overflow-hidden rounded-2xl bg-muted"
                                                    style={{ aspectRatio: item.media.aspectRatio || "16/9" }}
                                                >
                                                    <Image
                                                        src={item.media.afterSrc}
                                                        alt={item.media.afterAlt}
                                                        fill
                                                        sizes="(min-width: 1024px) 25vw, 100vw"
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : item.media.type === "illustration" ? (
                                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                            <div className="relative flex aspect-video w-full flex-col items-center justify-center px-8 text-center">
                                                {(() => {
                                                    const Icon = illustrationIcons[index % illustrationIcons.length];

                                                    return (
                                                        <>
                                                            <div className="mb-5 flex size-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
                                                                <Icon className="size-9 text-primary" aria-hidden="true" />
                                                            </div>
                                                            <p className="max-w-xs text-sm leading-6 text-slate-500">
                                                                {item.media.alt}
                                                            </p>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                            <div className="relative aspect-video w-full">
                                                {item.media.type === "video" ? (
                                                    <LazyVideo
                                                        src={item.media.src}
                                                        poster={item.media.poster}
                                                        alt={item.media.alt}
                                                    />
                                                ) : (
                                                    <Image
                                                        src={item.media.src}
                                                        alt={item.media.alt}
                                                        fill
                                                        sizes="(min-width: 1024px) 50vw, 100vw"
                                                        className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>

                {ctaText ? (
                    <div className="mt-10 flex justify-center lg:mt-12">
                        <Button
                            size="lg"
                            onClick={scrollToUpload}
                            className="h-12 rounded-full px-8 text-base font-semibold sm:h-14 sm:px-10 sm:text-lg"
                        >
                            {ctaText}
                        </Button>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
