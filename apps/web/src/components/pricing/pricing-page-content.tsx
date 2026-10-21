"use client";

import type { PricingPageDictionary } from "@markless/shared/src/i18n/types";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { PricingSubscriptionGrid } from "@/components/pricing";
import { useAuthenticatedUserCredits } from "@/hooks/use-authenticated-user-credits";

interface PricingPageContentProps {
    dictionary: PricingPageDictionary;
}

export function PricingPageContent({ dictionary }: PricingPageContentProps) {
    const { bootstrap, bootstrapLoading, creditsData, isAuthenticated } =
        useAuthenticatedUserCredits();

    const faqItems = dictionary.faqs.slice(0, 6);

    return (
        <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-brand-50/40 via-background to-background">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="space-y-0">
                    <section className="pb-10 pt-16 text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                            {dictionary.title}
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                            {dictionary.description}
                        </p>
                    </section>

                    <section className="pb-20" aria-labelledby="pricing-plans-heading">
                        <h2
                            id="pricing-plans-heading"
                            className="sr-only"
                        >
                            {dictionary.plansSectionTitle}
                        </h2>
                        <PricingSubscriptionGrid
                            dictionary={dictionary.subscriptionGrid}
                            isAuthenticated={isAuthenticated}
                            isBootstrapLoading={bootstrapLoading}
                            subscriptionPlanId={bootstrap?.subscription?.planId ?? null}
                            currentCredits={creditsData?.credits ?? null}
                        />
                    </section>
                </div>
            </div>
            <MarketingFAQ
                title={dictionary.faqTitle}
                subtitle={dictionary.faqSubtitle}
                items={faqItems}
            />
        </div>
    );
}
