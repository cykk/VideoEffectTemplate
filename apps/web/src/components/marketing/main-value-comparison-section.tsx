import Image from "next/image";
import { RainbowButton } from "@/components/ui/rainbow-button";

interface MainValueComparisonSectionProps {
    id?: string;
    title: string;
    paragraphs: string[];
    ctaLabel: string;
    ctaHref: string;
    comparison: {
        beforeImage: string;
        afterImage: string;
        beforeAlt: string;
        afterAlt: string;
        beforeLabel?: string;
        afterLabel?: string;
        aspectRatio?: string;
    };
}

export function MainValueComparisonSection({
    id,
    title,
    paragraphs,
    ctaLabel,
    ctaHref,
    comparison,
}: MainValueComparisonSectionProps) {
    return (
        <section id={id} className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(520px,560px)] lg:gap-14">
                <div className="max-w-2xl text-left">
                    <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        {title}
                    </h2>
                    <div className="mt-6 space-y-5 text-base leading-8 text-muted-foreground sm:text-lg">
                        {paragraphs.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                        ))}
                    </div>
                    <div className="mt-8">
                        <RainbowButton href={ctaHref}>
                            {ctaLabel}
                        </RainbowButton>
                    </div>
                </div>

                <div className="w-full">
                    <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card/80 p-4 shadow-[0_20px_60px_-28px_rgb(15_23_42_/_0.35)]">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-3">
                                <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    {comparison.beforeLabel ?? "Before"}
                                </div>
                                <div
                                    className="relative overflow-hidden rounded-2xl bg-muted"
                                    style={{ aspectRatio: comparison.aspectRatio ?? "4/3" }}
                                >
                                    <Image
                                        src={comparison.beforeImage}
                                        alt={comparison.beforeAlt}
                                        fill
                                        sizes="(min-width: 1024px) 25vw, 100vw"
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    {comparison.afterLabel ?? "After"}
                                </div>
                                <div
                                    className="relative overflow-hidden rounded-2xl bg-muted"
                                    style={{ aspectRatio: comparison.aspectRatio ?? "4/3" }}
                                >
                                    <Image
                                        src={comparison.afterImage}
                                        alt={comparison.afterAlt}
                                        fill
                                        sizes="(min-width: 1024px) 25vw, 100vw"
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
