import type { ReactNode } from "react";
import { Globe, Mail, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@markless/shared/src/lib/utils";

export interface LegalNavItem {
    id: string;
    title: string;
}

export function LegalParagraphs({ paragraphs }: { paragraphs: string[] }) {
    return (
        <div className="space-y-4">
            {paragraphs.map((paragraph, index) => (
                <p key={index} className="text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                    {paragraph}
                </p>
            ))}
        </div>
    );
}

export function LegalBulletList({
    items,
    bulletClassName = "bg-brand-500/80",
}: {
    items: string[];
    bulletClassName?: string;
}) {
    return (
        <ul className="space-y-3">
            {items.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                    <span className={cn("mt-2.5 h-2.5 w-2.5 flex-none rounded-full", bulletClassName)} />
                    <span className="text-[15px] leading-7 text-slate-600 dark:text-slate-300">{item}</span>
                </li>
            ))}
        </ul>
    );
}

export function renderLegalContactItem(item: string, index: number) {
    const [labelPart, ...valueParts] = item.split(":");
    const label = labelPart.trim();
    const value = valueParts.join(":").trim();
    const normalizedLabel = label.toLowerCase();
    const isEmail = normalizedLabel === "email" && value.length > 0;
    const isWebsite = normalizedLabel === "website" && value.length > 0;
    const href = isEmail ? `mailto:${value}` : isWebsite ? value : null;
    const Icon = isEmail ? Mail : isWebsite ? Globe : Shield;

    return (
        <div
            key={index}
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
        >
            <Icon
                className={cn(
                    "mt-0.5 h-5 w-5 flex-none",
                    isEmail ? "text-sky-600" : isWebsite ? "text-teal-600" : "text-slate-600"
                )}
            />
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {label}
                </p>
                {href ? (
                    <a
                        href={href}
                        className="mt-1 block break-all text-[15px] font-medium leading-6 text-slate-700 transition-colors hover:text-brand-600"
                    >
                        {value}
                    </a>
                ) : (
                    <p className="mt-1 text-[15px] font-medium leading-6 text-slate-700">
                        {value || item}
                    </p>
                )}
            </div>
        </div>
    );
}

export function LegalPageShell({
    title,
    description,
    lastUpdated,
    sections,
    summary,
    children,
}: {
    title: string;
    description: string;
    lastUpdated: string;
    sections: LegalNavItem[];
    summary?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 shadow-2xl shadow-slate-950/10 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/75 dark:shadow-black/20">
                <div className="absolute -left-16 top-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="absolute -bottom-12 right-0 h-44 w-44 rounded-full bg-teal-500/10 blur-3xl" />
                <div className="relative px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge
                            variant="outline"
                            className="rounded-full border-slate-300 bg-white/80 px-4 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                        >
                            {title}
                        </Badge>
                        <span className="rounded-full border border-slate-200 bg-white/70 px-4 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                            {lastUpdated}
                        </span>
                    </div>
                    <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
                        {title}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                        {description}
                    </p>
                    {summary ? <div className="mt-8 max-w-4xl">{summary}</div> : null}
                    <div className="mt-8 flex flex-wrap gap-2.5">
                        {sections.map((section) => (
                            <a
                                key={section.id}
                                href={`#${section.id}`}
                                className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                            >
                                {section.title}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
                <div className="rounded-[2rem] border border-slate-200/80 bg-white/88 p-6 shadow-2xl shadow-slate-950/10 backdrop-blur sm:p-8 lg:p-10 dark:border-slate-800/80 dark:bg-slate-950/72 dark:shadow-black/20">
                    <div className="space-y-10 sm:space-y-12">{children}</div>
                </div>

                <aside className="hidden lg:block">
                    <div className="sticky top-24 rounded-[1.5rem] border border-slate-200/80 bg-white/88 p-4 shadow-xl shadow-slate-950/10 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/72 dark:shadow-black/20">
                        <div className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                            {lastUpdated}
                        </div>
                        <nav className="space-y-1.5">
                            {sections.map((section) => (
                                <a
                                    key={section.id}
                                    href={`#${section.id}`}
                                    className="block rounded-2xl px-4 py-3 text-sm leading-6 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/80 dark:hover:text-slate-100"
                                >
                                    {section.title}
                                </a>
                            ))}
                        </nav>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export function LegalSection({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-28">
            <div className="mb-5 flex items-center gap-4">
                <div className="h-10 w-1 rounded-full bg-gradient-to-b from-teal-500 to-sky-500" />
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">
                    {title}
                </h2>
            </div>
            {children}
        </section>
    );
}

export const legalCardClassName =
    "border-slate-200/80 bg-white/78 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:border-slate-800/80 dark:bg-slate-950/70";
