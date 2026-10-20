"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { defaultLocale } from "@markless/shared/src/i18n";
import type { PricingPeriod } from "@markless/shared/src/lib/pricing/i18n-config";
import { getProductById, type SubscriptionProduct } from "@markless/shared/src/lib/products/config";
import {
  DISPLAY_PLAN_TIERS,
  ONE_TIME_DISPLAY_TIERS,
  getCheckoutProductId,
  getDisplayPlanIdFromSubscriptionPlanId,
  getDisplayPricingValues,
  getRepresentativeAnnualDiscountPercent,
  getSubscriptionMonthlyCredits,
  isLowerDisplayPlan,
  resolveSubscriptionPlanFeatures,
  type DisplayPlanId,
} from "@markless/shared/src/lib/pricing/display-plans";
import { toastErrorOptions } from "@markless/shared/src/lib/toast-options";
import { BillingToggle } from "@/components/pricing/billing-toggle";
import { PricingPlanCard } from "@/components/pricing/pricing-plan-card";
import { SubscriptionChangeConfirmModal } from "@/components/pricing/subscription-change-confirm-modal";
import type { SubscriptionUpgradeSuccessSummary } from "@/components/pricing/subscription-upgrade-success-modal";
import { AuthModal } from "@/components/tools/auth-modal";
import {
  formatFreeTierCopy,
  type FreeTierCopyValues,
} from "@markless/shared/src/lib/marketing/free-tier-copy";
import { useLocale } from "@/hooks/use-locale";
import {
  buildCheckoutResumeUrl,
  buildDashboardUrl,
  persistPendingCheckoutContext,
  useAuthAction,
  type PostAuthIntent,
} from "@/hooks/use-auth-action";
import { usePayment } from "@/hooks/use-payment";
import { useSubscriptionChange } from "@/hooks/use-subscription-change";
import {
  type UserCreditsData,
} from "@/hooks/use-user-credits";
import {
  refreshUserBootstrap,
  refreshUserCredits,
} from "@/lib/query/user-query-refresh";
import { USER_CREDITS_QUERY_KEY } from "@/hooks/use-user-credits";
import { cn } from "@markless/shared/src/lib/utils";
import type { PricingPageDictionary } from "@markless/shared/src/i18n/types";
import { sanitizeLocalReturnTo } from "@markless/shared/src/lib/payments/client-checkout";

interface PricingSubscriptionGridProps {
  dictionary: PricingPageDictionary["subscriptionGrid"];
  entrySurface?: string;
  currentPlanId?: DisplayPlanId;
  embedded?: boolean;
  includeFreePlan?: boolean;
  billingToggleClassName?: string;
  gridClassName?: string;
  onRequestAuth?: (intent: PostAuthIntent, redirectTo?: string | null) => void;
  onUpgradeComplete?: () => void;
  onManageSubscription?: () => void;
  onUpgradeSuccess?: (summary: SubscriptionUpgradeSuccessSummary) => void;
  isAuthenticated?: boolean;
  isBootstrapLoading?: boolean;
  subscriptionPlanId?: string | null;
  initialPeriod?: PricingPeriod;
  currentCredits?: number | null;
  showInlineAuthModal?: boolean;
  freeTierCopyValues?: Partial<FreeTierCopyValues>;
}

export function PricingSubscriptionGrid({
  dictionary,
  entrySurface = "pricing_page",
  currentPlanId: currentPlanIdProp,
  embedded = false,
  includeFreePlan = true,
  billingToggleClassName,
  gridClassName,
  onRequestAuth,
  onUpgradeComplete,
  onManageSubscription,
  onUpgradeSuccess,
  isAuthenticated = false,
  isBootstrapLoading = false,
  subscriptionPlanId = null,
  initialPeriod,
  currentCredits = null,
  showInlineAuthModal = true,
  freeTierCopyValues,
}: PricingSubscriptionGridProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PricingPeriod>(
    initialPeriod ?? "yearly"
  );
  const [selectedPlanId, setSelectedPlanId] = useState<DisplayPlanId>("standard");
  const [loadingPlanId, setLoadingPlanId] = useState<DisplayPlanId | null>(null);
  const [pendingUpgradeProduct, setPendingUpgradeProduct] =
    useState<SubscriptionProduct | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const { locale, dictionary: fullDictionary } = useLocale();
  const queryClient = useQueryClient();
  const dashboardUrl = buildDashboardUrl(locale);
  const checkoutResumeUrl = buildCheckoutResumeUrl(locale);
  const subscriptionManagementHref =
    locale === defaultLocale
      ? "/settings/subscription"
      : `/${locale}/settings/subscription`;
  const { createCheckout } = usePayment();
  const { changePlan, isLoading: isChangingSubscription } = useSubscriptionChange();
  const {
    showAuthModal,
    authMode,
    openLogin: internalOpenLogin,
    closeAuth,
    setAuthMode,
  } = useAuthAction();
  const bootstrapLoading = isBootstrapLoading;
  const annualDiscountPercent = getRepresentativeAnnualDiscountPercent();
  const isOneTimePeriod = selectedPeriod === "one-time";
  const currentSubscriptionProduct = useMemo(() => {
    const currentProduct = subscriptionPlanId ? getProductById(subscriptionPlanId) : null;
    return currentProduct?.type === "subscription" ? currentProduct : null;
  }, [subscriptionPlanId]);
  const visiblePlans = useMemo(() => {
    const basePlans = isOneTimePeriod ? ONE_TIME_DISPLAY_TIERS : DISPLAY_PLAN_TIERS;

    if (includeFreePlan) {
      return basePlans;
    }

    return basePlans.filter((plan) => plan.id !== "free");
  }, [includeFreePlan, isOneTimePeriod]);

  const currentPlanId = useMemo(() => {
    if (currentPlanIdProp) {
      return currentPlanIdProp;
    }

    if (!isAuthenticated) {
      return null;
    }

    return getDisplayPlanIdFromSubscriptionPlanId(subscriptionPlanId);
  }, [currentPlanIdProp, isAuthenticated, subscriptionPlanId]);

  const openLogin = useCallback(
    (intent: PostAuthIntent, redirectTo?: string | null) => {
      if (onRequestAuth) {
        onRequestAuth(intent, redirectTo);
        return;
      }

      internalOpenLogin(intent, redirectTo);
    },
    [internalOpenLogin, onRequestAuth]
  );

  const priceLabels = {
    perMonth: dictionary.price.perMonth,
    perYear: dictionary.price.perYear,
    billedYearly: dictionary.price.billedYearly,
    billedOneTimeYearly: dictionary.price.billedOneTimeYearly,
    oneTimeUnavailable: dictionary.price.oneTimeUnavailable,
  };

  useEffect(() => {
    if (initialPeriod) {
      setSelectedPeriod(initialPeriod);
    }
  }, [initialPeriod]);

  useEffect(() => {
    if (!isOneTimePeriod) {
      return;
    }

    if (selectedPlanId !== "basic" && selectedPlanId !== "standard") {
      setSelectedPlanId("basic");
    }
  }, [isOneTimePeriod, selectedPlanId]);

  const handlePaidPlanSelect = useCallback(
    async (planId: DisplayPlanId, tierId: string) => {
      const productId = getCheckoutProductId(tierId, selectedPeriod);

      if (bootstrapLoading) {
        toast.error(dictionary.status.checkoutNotReady, toastErrorOptions);
        return;
      }

      if (!isAuthenticated) {
        if (productId && typeof window !== "undefined") {
          const currentLocation = sanitizeLocalReturnTo(
            `${window.location.pathname}${window.location.search}${window.location.hash}`
          );
          persistPendingCheckoutContext({
            productId,
            entrySurface,
            returnTo: currentLocation,
            locale,
            sourcePage: currentLocation,
          });
        }
        openLogin("resume_checkout", checkoutResumeUrl);
        return;
      }

      if (!productId) {
        toast.error(dictionary.status.checkoutConfigError, toastErrorOptions);
        return;
      }

      setLoadingPlanId(planId);
      try {
        await createCheckout(productId, { entrySurface });
      } finally {
        setLoadingPlanId(null);
      }
    },
    [
      bootstrapLoading,
      createCheckout,
      dictionary.status.checkoutConfigError,
      dictionary.status.checkoutNotReady,
      entrySurface,
      isAuthenticated,
      checkoutResumeUrl,
      locale,
      openLogin,
      selectedPeriod,
      subscriptionPlanId,
    ]
  );

  const handleUpgradeRequest = useCallback(
    (tierId: string) => {
      if (!subscriptionPlanId || !currentSubscriptionProduct) {
        return;
      }

      const targetPlanId = getCheckoutProductId(tierId, selectedPeriod);
      const targetProduct = targetPlanId ? getProductById(targetPlanId) : null;

      if (!targetProduct || targetProduct.type !== "subscription") {
        toast.error(dictionary.status.checkoutConfigError, toastErrorOptions);
        return;
      }

      setPendingUpgradeProduct(targetProduct);
      setIsUpgradeModalOpen(true);
    },
    [
      currentSubscriptionProduct,
      dictionary.status.checkoutConfigError,
      selectedPeriod,
      subscriptionPlanId,
    ]
  );

  const handleConfirmUpgrade = useCallback(async () => {
    if (!pendingUpgradeProduct) {
      return;
    }

    const result = await changePlan(pendingUpgradeProduct.id);
    if (result?.status === "checkout") return;
    if (!result || result.status !== "success") {
      toast.error(result?.message || dictionary.status.upgradeFailed, toastErrorOptions);
      return;
    }

    const previousTotalCredits = currentCredits ?? 0;
    const nextSubscriptionWindowCredits =
      pendingUpgradeProduct.interval === "year"
        ? Math.floor(pendingUpgradeProduct.creditsPerPeriod / 12)
        : pendingUpgradeProduct.creditsPerPeriod;
    const grantedCredits = nextSubscriptionWindowCredits;

    setIsUpgradeModalOpen(false);
    setPendingUpgradeProduct(null);
    onUpgradeComplete?.();

    await Promise.all([
      refreshUserBootstrap(queryClient),
      refreshUserCredits(queryClient),
    ]);

    const refreshedCredits = queryClient.getQueryData<UserCreditsData>(
      USER_CREDITS_QUERY_KEY
    );
    const totalCredits = refreshedCredits?.credits ?? previousTotalCredits + grantedCredits;
    const carriedOverCredits = Math.max(0, totalCredits - grantedCredits);

    onUpgradeSuccess?.({
      planName: pendingUpgradeProduct.tierName,
      interval: pendingUpgradeProduct.interval,
      totalCredits,
      grantedCredits,
      carriedOverCredits,
    });
  }, [
    changePlan,
    currentCredits,
    dictionary.status.upgradeFailed,
    onUpgradeComplete,
    onUpgradeSuccess,
    pendingUpgradeProduct,
    queryClient,
  ]);

  const handleCloseUpgradeModal = useCallback(() => {
    if (isChangingSubscription) {
      return;
    }

    setIsUpgradeModalOpen(false);
    setPendingUpgradeProduct(null);
  }, [isChangingSubscription]);

  return (
    <>
      <div className={cn(embedded ? "mb-8" : "mb-10", billingToggleClassName)}>
        <BillingToggle
          period={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          annualDiscountPercent={annualDiscountPercent}
          labels={dictionary.billingToggle}
        />
      </div>

      <div
        className={cn(
          "grid gap-x-6 gap-y-8",
          isOneTimePeriod
            ? "mx-auto max-w-3xl grid-cols-1 md:grid-cols-2"
            : includeFreePlan
              ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
              : "mx-auto max-w-5xl grid-cols-1 md:grid-cols-3",
          gridClassName
        )}
      >
        {visiblePlans.map((plan) => {
          const subscriptionCopy = dictionary.plans[plan.id];
          const oneTimeCopy =
            plan.id === "basic" || plan.id === "standard"
              ? dictionary.oneTimePlans?.[plan.id]
              : null;
          const planCopy = isOneTimePeriod && oneTimeCopy ? oneTimeCopy : subscriptionCopy;
          const isFree = plan.id === "free";

          if (!planCopy) {
            return null;
          }

          const pricing = isFree
            ? {
                amount: 0,
                periodSuffix: priceLabels.perMonth,
              }
            : getDisplayPricingValues(plan.tierId!, selectedPeriod, priceLabels);

          if (!pricing) {
            return null;
          }

          const baseFeatures =
            isOneTimePeriod && oneTimeCopy?.features?.length
              ? oneTimeCopy.features
              : subscriptionCopy?.features ?? [];
          const features =
            !isFree && !isOneTimePeriod && plan.tierId
              ? resolveSubscriptionPlanFeatures(
                  baseFeatures,
                  getSubscriptionMonthlyCredits(plan.tierId, selectedPeriod)
                )
              : baseFeatures;
          const displayFeatures = isFree
            ? features.map((feature) => formatFreeTierCopy(feature, freeTierCopyValues))
            : features;
          const targetProductId = !isFree && !isOneTimePeriod
            ? getCheckoutProductId(plan.tierId!, selectedPeriod)
            : null;
          const targetProduct = targetProductId ? getProductById(targetProductId) : null;

          const isCurrentPlan =
            !isOneTimePeriod &&
            (isFree
              ? currentPlanId === "free"
              : Boolean(targetProductId && targetProductId === subscriptionPlanId));
          const isFreeLocked =
            !isOneTimePeriod &&
            isFree &&
            isAuthenticated &&
            currentPlanId !== "free";
          const isUnavailable = pricing.unavailable === true;
          const isRestrictedPlanChange =
            !isOneTimePeriod &&
            !isFree &&
            Boolean(currentSubscriptionProduct) &&
            targetProduct?.type === "subscription" &&
            !isCurrentPlan &&
            (currentSubscriptionProduct.interval === "year" && targetProduct.interval === "month" ||
              isLowerDisplayPlan(plan.id, currentPlanId));
          const shouldManageSubscription = isRestrictedPlanChange || isFreeLocked;
          const isUpgrade =
            !isOneTimePeriod &&
            !isFree &&
            !isUnavailable &&
            isAuthenticated &&
            Boolean(currentSubscriptionProduct) &&
            !isCurrentPlan &&
            !isRestrictedPlanChange;
          const ctaLabel = isCurrentPlan
            ? dictionary.plans.free.currentPlan
            : bootstrapLoading && !isFree
              ? dictionary.status.loading
              : isUnavailable
                ? dictionary.status.unavailable
                : shouldManageSubscription
                  ? dictionary.status.manageSubscription
                  : isUpgrade
                    ? dictionary.status.upgrade
                  : planCopy.cta;

          return (
            <PricingPlanCard
              key={plan.id}
              name={planCopy.name}
              description={planCopy.description}
              features={displayFeatures}
              pricing={pricing}
              freeNote={isFree ? dictionary.price.noCreditCardRequired : undefined}
              ctaLabel={ctaLabel}
              processingLabel={dictionary.processing}
              popularLabel={
                !isOneTimePeriod && plan.popular ? dictionary.mostPopular : undefined
              }
              popular={!isOneTimePeriod && !!plan.popular}
              isSelected={selectedPlanId === plan.id}
              onSelect={() => setSelectedPlanId(plan.id)}
              isCurrentPlan={isCurrentPlan}
              isLoading={loadingPlanId === plan.id}
              checkoutDisabled={bootstrapLoading || isUnavailable}
              ctaHref={!isFree && shouldManageSubscription ? subscriptionManagementHref : undefined}
              onCtaNavigate={shouldManageSubscription ? onManageSubscription : undefined}
              onCtaClick={
                isFree
                  ? () => {
                      if (!bootstrapLoading && !isAuthenticated) {
                        openLogin("go_dashboard", dashboardUrl);
                      }
                    }
                  : () => {
                      if (isUpgrade) {
                        handleUpgradeRequest(plan.tierId!);
                        return;
                      }

                      void handlePaidPlanSelect(plan.id, plan.tierId!);
                    }
              }
            />
          );
        })}
      </div>

      {currentSubscriptionProduct && pendingUpgradeProduct ? (
        <SubscriptionChangeConfirmModal
          isOpen={isUpgradeModalOpen}
          onClose={handleCloseUpgradeModal}
          onConfirm={() => {
            void handleConfirmUpgrade();
          }}
          changeType="upgrade"
          currentPlan={{
            name: currentSubscriptionProduct.tierName,
            credits:
              currentSubscriptionProduct.interval === "year"
                ? Math.floor(currentSubscriptionProduct.creditsPerPeriod / 12)
                : currentSubscriptionProduct.creditsPerPeriod,
            price: currentSubscriptionProduct.price,
            interval: currentSubscriptionProduct.interval,
          }}
          newPlan={{
            id: pendingUpgradeProduct.id,
            name: pendingUpgradeProduct.tierName,
            credits:
              pendingUpgradeProduct.interval === "year"
                ? Math.floor(pendingUpgradeProduct.creditsPerPeriod / 12)
                : pendingUpgradeProduct.creditsPerPeriod,
            price: pendingUpgradeProduct.price,
            interval: pendingUpgradeProduct.interval,
          }}
          locale={locale}
          isLoading={isChangingSubscription}
          currentCredits={currentCredits ?? undefined}
          dictionary={fullDictionary.pages.pricing.subscriptionChangeModal}
        />
      ) : null}

      {!embedded && showInlineAuthModal ? (
        <AuthModal
          open={showAuthModal}
          onOpenChange={closeAuth}
          mode={authMode}
          onModeChange={setAuthMode}
          dictionary={fullDictionary.tools?.authModal}
        />
      ) : null}
    </>
  );
}
