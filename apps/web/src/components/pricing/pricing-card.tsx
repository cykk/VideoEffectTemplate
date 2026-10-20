"use client";

import { Check, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, type PricingPlan, type PricingPeriod } from "@markless/shared/src/lib/pricing/i18n-config";
import { usePayment } from "@/hooks/use-payment";
import type { PricingCopy } from "@markless/shared/src/i18n/components/pricing";
import { useLocale } from "@/hooks/use-locale";

interface PricingCardProps {
    plan: PricingPlan;
    period: PricingPeriod;
    copy: PricingCopy["card"];
    onSelect?: (planId: string, period: PricingPeriod) => void;
    className?: string;
}

export function PricingCard({
    plan,
    period,
    copy,
    className
}: PricingCardProps) {
    const pricing = plan.pricing[period];
    const hasDiscount = pricing.discount && pricing.originalPrice;
    const { isLoading, error, createCheckout } = usePayment();
    const { dictionary } = useLocale();
    const dict = dictionary?.pages?.pricing?.pricingCard;

    const handleSelect = async () => {
        // 付费计划调用支付接口
        await createCheckout(plan.id, { entrySurface: "pricing_page" });
    };

    return (
        <div
            className={cn(
                "group relative flex flex-col rounded-3xl bg-white transition-all duration-300",
                plan.popular
                    ? "ring-2 ring-primary shadow-xl scale-100 md:scale-105 z-10"
                    : "border border-slate-200 shadow-sm hover:shadow-md",
                className
            )}
        >
            {/* 卡片内容 */}
            <div className="relative z-10 flex flex-col h-full p-8">
                {/* Popular 标签 */}
                {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <Badge
                            className="px-4 py-1.5 text-sm font-semibold shadow-sm bg-primary text-white border-none"
                        >
                            <Sparkles className="w-3.5 h-3.5 mr-1 inline" />
                            {copy.popular}
                        </Badge>
                    </div>
                )}

                {/* Flash Sale 标签 - 年付且有折扣时显示 */}
                {period === 'yearly' && hasDiscount && pricing.discount && plan.popular && (
                    <div className="absolute top-4 right-4 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-brand-50 text-brand-600 px-3 py-1 rounded-full border border-brand-100 shadow-sm">
                            <span className="text-xs font-bold tracking-wide">{copy.save} {pricing.discount}%</span>
                        </div>
                    </div>
                )}

                {/* 头部 */}
                <div className="text-center mt-2 mb-4">
                    <h3 className="text-2xl font-bold text-slate-900">
                        {plan.name}
                    </h3>
                </div>

                {/* 价格 */}
                <div className="text-center mb-8">
                    {hasDiscount && (
                        <div className="text-sm font-medium text-slate-400 line-through mb-1">
                            {formatPrice(pricing.originalPrice!, pricing.currency)}
                        </div>
                    )}
                    <div className="flex items-baseline justify-center">
                        <span className="text-5xl font-extrabold tracking-tight text-slate-900">
                            {formatPrice(pricing.price, pricing.currency)}
                        </span>
                        <span className="text-slate-500 font-medium ml-2">
                            {pricing.period}
                        </span>
                    </div>
                    {period === 'yearly' && (
                        <div className="text-sm font-medium text-slate-400 mt-2">
                            {dict?.billedAnnually ?? ""}
                        </div>
                    )}
                </div>

                {/* 功能列表 */}
                <div className="flex-1 space-y-4 mb-8 text-left">
                    {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-3">
                            <Check className={cn("h-5 w-5 flex-shrink-0 mt-0.5", plan.popular ? "text-primary" : "text-slate-400")} />
                            <span className="text-sm font-medium text-slate-600 leading-relaxed">
                                {feature}
                            </span>
                        </div>
                    ))}
                </div>

                {/* CTA 按钮 */}
                <div className="space-y-3 mt-auto">
                    <Button
                        className={cn(
                            "w-full h-12 text-base font-semibold transition-all duration-300 cursor-pointer rounded-xl",
                            plan.popular
                                ? "bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5"
                                : "bg-white border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700"
                        )}
                        onClick={handleSelect}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {copy.processing}
                            </>
                        ) : (
                            copy.buyNow
                        )}
                    </Button>

                    {error && (
                        <div className="text-sm text-red-500 font-medium text-center">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
