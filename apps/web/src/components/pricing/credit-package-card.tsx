"use client";

import { cn } from "@markless/shared/src/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp } from "lucide-react";
import type { CreditPackage, UserPricingTier } from "@markless/shared/src/lib/products/config";
import { calculateDiscountRate } from "@markless/shared/src/lib/products/config";
import { useLocale } from "@/hooks/use-locale";
import { formatAppCurrency, formatAppNumber } from "@/lib/formatters";

interface CreditPackageCardProps {
  package: CreditPackage;
  userPricingTier: UserPricingTier;
  onPurchase: (packageId: string) => void;
  className?: string;
}

export function CreditPackageCard({
  package: pkg,
  userPricingTier,
  onPurchase,
  className
}: CreditPackageCardProps) {
  const { dictionary, locale } = useLocale();
  const dict = dictionary?.pages?.pricing?.creditPackageCard;

  const actualPrice = pkg.pricing[userPricingTier];
  const basePrice = pkg.pricing.free;
  const savings = basePrice - actualPrice;
  const savingsPercent = Math.round((savings / basePrice) * 100);
  const discountRate = calculateDiscountRate(pkg.credits, actualPrice);
  const hasMemberDiscount = userPricingTier !== "free";

  const isPopular = pkg.badge === "POPULAR";
  const isBestValue = pkg.badge === "BEST VALUE";
  const isProExclusive = pkg.badge === "PRO涓撲韩";

  return (
    <div
      className={cn(
        "relative group",
        "bg-gradient-to-br from-neutral-900/50 via-neutral-900/30 to-neutral-900/50",
        "backdrop-blur-sm border border-neutral-800",
        "rounded-2xl p-6 transition-all duration-300",
        "hover:border-neutral-700 hover:shadow-xl hover:shadow-indigo-500/10",
        isPopular && "border-amber-500/50 shadow-lg shadow-amber-500/20 scale-105",
        isBestValue && "border-cyan-500/50 shadow-lg shadow-cyan-500/20 scale-105",
        isProExclusive && "border-indigo-500/50 shadow-lg shadow-indigo-500/20",
        className
      )}
    >
      {pkg.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge
            className={cn(
              "px-4 py-1 text-xs font-bold shadow-lg",
              isPopular && "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
              isBestValue && "bg-gradient-to-r from-brand-500 to-brand-600 text-white",
              isProExclusive && "bg-gradient-to-r from-brand-600 to-brand-800 text-white"
            )}
          >
            {pkg.badge}
          </Badge>
        </div>
      )}

      {hasMemberDiscount && savings > 0 && (
        <div className="absolute -top-3 -right-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur animate-pulse" />
            <Badge className="relative bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-1 text-xs font-bold border border-green-400/50">
              <TrendingUp className="w-3 h-3 mr-1 inline" />
              {savingsPercent}
              {dict?.labels.off ?? ""}
            </Badge>
          </div>
        </div>
      )}

      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles
            className={cn(
              "w-5 h-5",
              isPopular && "text-amber-400",
              isBestValue && "text-cyan-400",
              isProExclusive && "text-indigo-400",
              !pkg.badge && "text-neutral-400"
            )}
          />
          <h3 className="text-2xl font-bold text-neutral-50">{formatAppNumber(pkg.credits, locale)}</h3>
          <span className="text-sm text-neutral-400">{dict?.labels.credits ?? ""}</span>
        </div>
        <p className="text-xs text-neutral-500">{pkg.description}</p>
      </div>

      <div className="text-center mb-6">
        {hasMemberDiscount && savings > 0 && (
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-sm text-neutral-500 line-through">{formatAppCurrency(basePrice, "USD", locale)}</span>
            <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
              {dict?.savings.saveMoney?.replace("{amount}", savings.toString()) ?? ""}
            </Badge>
          </div>
        )}

        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-4xl font-bold text-neutral-50">{formatAppCurrency(actualPrice, "USD", locale)}</span>
          <span className="text-sm font-medium text-neutral-400">USD</span>
        </div>

        {discountRate > 0 && (
          <div className="mt-2 flex justify-center">
            <span
              className={cn(
                "text-xs font-medium px-2.5 py-0.5 rounded-full border",
                discountRate >= 60
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : discountRate >= 40
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              )}
            >
              {dict?.savings.savePercent?.replace("{percent}", discountRate.toString()) ?? ""}
            </span>
          </div>
        )}
      </div>

      {hasMemberDiscount && (
        <div className="mb-4 p-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg border border-indigo-500/20">
          <p className="text-xs text-center text-indigo-300">
            <span className="font-semibold capitalize">{userPricingTier}</span> {dict?.labels.memberPrice ?? ""}
          </p>
        </div>
      )}

      <Button
        onClick={() => onPurchase(pkg.id)}
        className={cn(
          "w-full font-semibold transition-all duration-300 cursor-pointer",
          isPopular && "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600",
          isBestValue && "bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700",
          isProExclusive && "bg-gradient-to-r from-brand-600 to-brand-800 hover:from-brand-700 hover:to-brand-900",
          !pkg.badge && "bg-neutral-800 hover:bg-neutral-700"
        )}
      >
        {dict?.buttons.purchaseNow ?? ""}
      </Button>

      <div className="mt-4 text-center">
        <p className="text-xs text-neutral-500">{dict?.benefits.neverExpire ?? ""}</p>
      </div>
    </div>
  );
}
