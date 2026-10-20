"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import type { FAQItem } from "@markless/shared/src/i18n/types";
import { MarketingHtmlText } from "@/components/marketing/marketing-html-text";

interface MarketingFAQProps {
    title: string;
    subtitle?: string;
    items: FAQItem[];
    className?: string;
    id?: string;
}

export function MarketingFAQ({
    title,
    subtitle,
    items,
    className = "",
    id,
}: MarketingFAQProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section
            id={id}
            className={cn(
                "scroll-mt-24 border-t border-slate-200/60 px-4 py-20 sm:px-6 lg:px-8 lg:py-24",
                className
            )}
        >

            <div className="max-w-4xl mx-auto">
                {/* Section Header */}
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* FAQ Accordion */}
                <div className="space-y-4">
                    {items.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <div
                                key={index}
                                className={cn(
                                    "group rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-slate-300",
                                    isOpen && "border-slate-300"
                                )}
                            >
                                <button
                                    className="w-full px-6 py-5 text-left flex items-center justify-between cursor-pointer"
                                    onClick={() => setOpenIndex(isOpen ? null : index)}
                                    aria-expanded={isOpen}
                                >
                                    <h3 className={`text-xl font-medium pr-8 transition-colors duration-300 ${isOpen ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                                        }`}>
                                        {faq.question}
                                    </h3>
                                    <div className={`p-1 rounded-full border transition-all duration-300 flex-shrink-0 ${isOpen
                                        ? 'border-slate-200 bg-slate-500/5 rotate-45'
                                        : 'border-slate-200 group-hover:border-slate-300 rotate-0'
                                        }`}>
                                        <Plus
                                            className={`w-5 h-5 transition-colors duration-300 ${isOpen ? "text-slate-900" : "text-slate-500 group-hover:text-slate-600"
                                                }`}
                                            aria-hidden="true"
                                        />
                                    </div>
                                </button>
                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-[48rem] opacity-100" : "max-h-0 opacity-0"
                                        }`}
                                >
                                    <div className="px-6 pb-6 pt-0">
                                        <MarketingHtmlText
                                            as="div"
                                            html={faq.answer}
                                            className="space-y-4 border-t border-slate-200/60 pt-4 text-base leading-7 text-slate-600 [&_p+p]:mt-4"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

