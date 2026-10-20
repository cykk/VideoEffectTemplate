"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getActiveCreditPackages,
  type UserPricingTier,
  getUserPricingTier,
} from "@markless/shared/src/lib/products/config";
import { usePayment } from "@/hooks/use-payment";
import { useAuthAction, type PostAuthIntent } from "@/hooks/use-auth-action";
import { useLocale } from "@/hooks";
import { formatAppCurrency, formatAppNumber } from "@/lib/formatters";

const BASE_UNIT_PRICE = 0.049;
const PENDING_CHECKOUT_KEY = "pending-credit-package-checkout";

interface CreditPacksPanelProps {
  entrySurface?: string;
  className?: string;
  onRequestAuth?: (intent: PostAuthIntent, redirectTo?: string | null) => void;
  isAuthenticated?: boolean;
  isBootstrapLoading?: boolean;
  userPricingTier?: UserPricingTier;
}

export function CreditPacksPanel({
  entrySurface = "unknown",
  className,
  onRequestAuth,
  isAuthenticated = false,
  isBootstrapLoading = false,
  userPricingTier: userPricingTierProp,
}: CreditPacksPanelProps) {
  const { dictionary, locale } = useLocale();
  const pricingDict = dictionary.pages.pricing.pricingTwoColumn.oneTimePayment;
  const bootstrapLoading = isBootstrapLoading;
  const userPricingTier = userPricingTierProp ?? getUserPricingTier(null);
  const creditPackages = useMemo(
    () => getActiveCreditPackages(userPricingTier),
    [userPricingTier]
  );
  const [selectedId, setSelectedId] = useState(
    () => creditPackages[0]?.id
  );
  const { createCheckout, isLoading } = usePayment();
  const { openLogin: internalOpenLogin } = useAuthAction();
  const hasAutoCheckoutRef = useRef(false);

  const openLogin = (intent: PostAuthIntent, redirectTo?: string | null) => {
    if (onRequestAuth) {
      onRequestAuth(intent, redirectTo);
      return;
    }

    internalOpenLogin(intent, redirectTo);
  };

  useEffect(() => {
    const defaultId = creditPackages[0]?.id;
    setSelectedId(defaultId);
  }, [creditPackages]);

  const handleBuyNow = async () => {
    if (!selectedId || bootstrapLoading) return;

    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          PENDING_CHECKOUT_KEY,
          JSON.stringify({
            packageId: selectedId,
            timestamp: Date.now(),
            entrySurface,
          })
        );
      }
      openLogin("resume_checkout", typeof window !== "undefined" ? window.location.href : undefined);
      return;
    }

    await createCheckout(selectedId, { entrySurface });
  };

  useEffect(() => {
    if (bootstrapLoading || !isAuthenticated || hasAutoCheckoutRef.current) return;

    try {
      if (typeof window === "undefined") return;
      const pendingData = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
      if (!pendingData) return;

      const data = JSON.parse(pendingData) as {
        packageId: string;
        timestamp: number;
        entrySurface?: string;
      };

      if (Date.now() - data.timestamp > 5 * 60 * 1000) {
        window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
        return;
      }

      hasAutoCheckoutRef.current = true;
      window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
      void createCheckout(data.packageId, {
        entrySurface: data.entrySurface ?? entrySurface,
      });
    } catch {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
      }
    }
  }, [bootstrapLoading, createCheckout, entrySurface, isAuthenticated]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center">
        <p className="text-sm text-slate-500">{pricingDict.description}</p>
      </div>

      <Button
        className="w-full cursor-pointer rounded-xl bg-accent-600 py-3 text-base font-bold text-white hover:bg-accent-700 disabled:pointer-events-none disabled:opacity-100"
        onClick={handleBuyNow}
        disabled={isLoading || bootstrapLoading || !selectedId}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {pricingDict.processing}
          </>
        ) : (
          pricingDict.buyNow
        )}
      </Button>

      <div>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{pricingDict.selectPackage}</span>
        </div>

        <div className="space-y-3">
          {creditPackages.map((pkg) => {
            const unitPrice = pkg.adjustedPrice / pkg.credits;
            const discount = Math.round(((BASE_UNIT_PRICE - unitPrice) / BASE_UNIT_PRICE) * 100);
            const isSelected = selectedId === pkg.id;
            const isHot = pkg.badge === "BEST VALUE";

            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedId(pkg.id)}
                className={cn(
                  "relative w-full cursor-pointer rounded-xl border-2 px-5 py-4 text-left transition-all duration-300",
                  isSelected
                    ? "border-primary bg-primary/[0.03] shadow-md ring-1 ring-primary/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                )}
              >
                {isHot ? (
                  <div className="absolute -right-2.5 -top-2.5 z-10">
                    <span className="flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm ring-2 ring-white">
                      <Flame className="h-3 w-3" /> {pricingDict.bestValueBadge}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-900">
                        {formatAppNumber(pkg.credits, locale)} {pricingDict.creditsLabel}
                      </span>
                      {discount > 0 ? (
                        <span className="text-sm font-semibold text-brand-600">-{discount}%</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      ${unitPrice.toFixed(3)} {pricingDict.perCredit}
                    </p>
                  </div>

                  <div className="text-right">
                    {discount > 0 ? (
                      <p className="text-xs text-slate-400 line-through">
                        {formatAppCurrency(pkg.credits * BASE_UNIT_PRICE, "USD", locale)}
                      </p>
                    ) : null}
                    <p className="text-xl font-bold text-slate-900">{formatAppCurrency(pkg.adjustedPrice, "USD", locale)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
