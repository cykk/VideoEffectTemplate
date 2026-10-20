"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Flame, Loader2 } from "lucide-react";
import { AuthModal } from "@/components/tools/auth-modal";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks";
import { buildDashboardUrl, useAuthAction } from "@/hooks/use-auth-action";
import { usePayment } from "@/hooks/use-payment";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { getActiveCreditPackages } from "@markless/shared/src/lib/products/config";
import { cn } from "@markless/shared/src/lib/utils";
import { formatAppCurrency, formatAppNumber } from "@/lib/formatters";

const BASE_UNIT_PRICE = 0.049;

export function PricingTwoColumn() {
    const { locale } = useLocale();
    const creditPackages = getActiveCreditPackages("free");
    const [selectedId, setSelectedId] = useState(
        creditPackages.length > 2 ? creditPackages[2].id : creditPackages[0]?.id
    );
    const { createCheckout, isLoading } = usePayment();
    const { showAuthModal, authMode, openLogin, closeAuth, setAuthMode } = useAuthAction();
    const { dictionary } = useLocale();
    const dashboardUrl = buildDashboardUrl(locale);
    const pricingDict = dictionary.pages.pricing.pricingTwoColumn;
    const { data: bootstrap, loading: bootstrapLoading } = useUserBootstrap();
    const isAuthenticated = !!bootstrap?.authenticated;
    const freePlan = bootstrap?.freeTranscription.authenticated;
    const freePlanMinutes = freePlan?.durationLimitMinutes;
    const freePlanDescription = freePlan
        ? pricingDict.freePlan.description
            .replace("{dailyLimit}", String(freePlan.dailyLimit))
            .replace("{durationLimitMinutes}", String(freePlan.durationLimitMinutes))
        : "";
    const freePlanCta = pricingDict.freePlan.cta;
    const hasAutoCheckoutRef = useRef(false);
    const pendingCheckoutKey = "pending-credit-package-checkout";

    const handleBuyNow = async () => {
        if (!selectedId || bootstrapLoading) return;

        if (!isAuthenticated) {
            if (typeof window !== "undefined") {
                window.sessionStorage.setItem(
                    pendingCheckoutKey,
                    JSON.stringify({
                        packageId: selectedId,
                        timestamp: Date.now(),
                        entrySurface: "pricing_page",
                    })
                );
            }
            openLogin("resume_checkout", typeof window !== "undefined" ? window.location.href : undefined);
            return;
        }

        await createCheckout(selectedId, { entrySurface: "pricing_page" });
    };

    useEffect(() => {
        if (bootstrapLoading || !isAuthenticated || hasAutoCheckoutRef.current) return;

        try {
            if (typeof window === "undefined") return;

            const pendingData = window.sessionStorage.getItem(pendingCheckoutKey);
            if (!pendingData) return;

            const data = JSON.parse(pendingData);
            if (Date.now() - data.timestamp > 5 * 60 * 1000) {
                window.sessionStorage.removeItem(pendingCheckoutKey);
                return;
            }

            hasAutoCheckoutRef.current = true;
            window.sessionStorage.removeItem(pendingCheckoutKey);
            void createCheckout(data.packageId, {
                entrySurface: data.entrySurface ?? "pricing_page",
            });
        } catch {
            if (typeof window !== "undefined") {
                window.sessionStorage.removeItem(pendingCheckoutKey);
            }
        }
    }, [bootstrapLoading, isAuthenticated, createCheckout]);

    useEffect(() => {
        if (!bootstrapLoading && isAuthenticated && showAuthModal) {
            closeAuth(false);
        }
    }, [bootstrapLoading, isAuthenticated, showAuthModal, closeAuth]);

    return (
        <>
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                <div className="relative rounded-3xl bg-white border-2 border-slate-200 shadow-lg p-8 flex flex-col">
                    <div className="min-h-[140px] flex flex-col justify-start">
                        <h2 className="text-3xl font-bold text-center text-slate-900 mb-2">
                            {pricingDict.freePlan.title}
                        </h2>

                        <div className="text-center mb-2">
                            <span className="text-6xl font-extrabold text-slate-900">
                                {freePlanMinutes === undefined ? "—" : formatAppNumber(freePlanMinutes, locale)}
                            </span>
                            <span className="text-lg text-slate-500 ml-2">{pricingDict.freePlan.creditsLabel}</span>
                        </div>
                        <p className="text-center text-slate-600 text-sm">
                            {freePlanDescription}
                        </p>
                    </div>

                    <Button
                        className={cn(
                            "w-full font-bold py-3 text-base rounded-xl mb-8",
                            isAuthenticated
                                ? "bg-slate-100 text-slate-500 cursor-default border border-slate-200"
                                : "bg-accent-600 hover:bg-accent-700 text-white cursor-pointer"
                        )}
                        onClick={() => {
                            if (bootstrapLoading) return;
                            if (!isAuthenticated) openLogin("go_dashboard", dashboardUrl);
                        }}
                        disabled={bootstrapLoading || isAuthenticated}
                    >
                        {isAuthenticated ? pricingDict.freePlan.currentPlan : freePlanCta}
                    </Button>

                    <div className="space-y-5 flex-1">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-brand-500 flex-shrink-0" />
                            <span className="text-slate-700 font-medium">{freePlanDescription}</span>
                        </div>
                    </div>

                    <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                        <span className="text-sm text-slate-600">{pricingDict.freePlan.footerHint}</span>
                    </div>
                </div>

                <div className="relative rounded-3xl bg-white border border-primary/20 ring-1 ring-primary/10 shadow-lg p-8 flex flex-col">
                    <div className="min-h-[140px] flex flex-col justify-start">
                        <h2 className="text-3xl font-bold text-center text-slate-900 mb-3">
                            {pricingDict.oneTimePayment.title}
                        </h2>
                        <p className="text-center text-slate-500 text-sm mt-1">
                            {pricingDict.oneTimePayment.description}
                        </p>
                    </div>

                    <Button
                        className="w-full bg-accent-600 hover:bg-accent-700 text-white font-bold py-3 text-base rounded-xl mb-6 cursor-pointer disabled:opacity-100 disabled:pointer-events-none"
                        onClick={handleBuyNow}
                        disabled={isLoading || bootstrapLoading || !selectedId}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {pricingDict.oneTimePayment.processing}
                            </>
                        ) : (
                            pricingDict.oneTimePayment.buyNow
                        )}
                    </Button>

                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm font-semibold text-slate-700">{pricingDict.oneTimePayment.selectPackage}</span>
                    </div>

                    <div className="space-y-3">
                        {creditPackages.map((pkg) => {
                            const unitPrice = pkg.adjustedPrice / pkg.credits;
                            const discount = Math.round(
                                ((BASE_UNIT_PRICE - unitPrice) / BASE_UNIT_PRICE) * 100
                            );
                            const isSelected = selectedId === pkg.id;
                            const isBestValue = pkg.badge === "BEST VALUE";

                            return (
                                <button
                                    key={pkg.id}
                                    type="button"
                                    onClick={() => setSelectedId(pkg.id)}
                                    className={cn(
                                        "relative w-full text-left rounded-xl border-2 px-5 py-4 transition-all duration-300 cursor-pointer",
                                        isSelected
                                            ? "border-primary bg-primary/[0.03] shadow-md ring-1 ring-primary/20"
                                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                    )}
                                >
                                    {isBestValue && (
                                        <div className="absolute -top-2.5 -right-2.5 z-10 transition-transform duration-300 group-hover:scale-105">
                                            <span className="bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm text-white text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full flex items-center gap-0.5 ring-2 ring-white">
                                                <Flame className="w-3 h-3" /> {pricingDict.oneTimePayment.bestValueBadge}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-slate-900">
                                                    {formatAppNumber(pkg.credits, locale)} {pricingDict.oneTimePayment.creditsLabel}
                                                </span>
                                                {discount > 0 && (
                                                    <span className="text-sm font-semibold text-brand-600">
                                                        -{discount}%
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                ${unitPrice.toFixed(3)} {pricingDict.oneTimePayment.perCredit}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            {discount > 0 && (
                                                <p className="text-xs text-slate-400 line-through">
                                                    {formatAppCurrency(pkg.credits * BASE_UNIT_PRICE, "USD", locale)}
                                                </p>
                                            )}
                                            <p className="text-xl font-bold text-slate-900">
                                                {formatAppCurrency(pkg.adjustedPrice, "USD", locale)}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <AuthModal
                open={showAuthModal}
                onOpenChange={closeAuth}
                mode={authMode}
                onModeChange={setAuthMode}
                dictionary={dictionary.tools?.authModal}
            />
        </>
    );
}
