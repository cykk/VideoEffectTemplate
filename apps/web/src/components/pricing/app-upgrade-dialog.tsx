"use client";

import { useCallback, useEffect, useState } from "react";
import { getUserPricingTier } from "@markless/shared/src/lib/products/config";
import { getDisplayPlanIdFromSubscriptionPlanId } from "@markless/shared/src/lib/pricing/display-plans";
import type { PricingPeriod } from "@markless/shared/src/lib/pricing/i18n-config";
import { cn } from "@markless/shared/src/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PricingSubscriptionGrid } from "@/components/pricing/pricing-subscription-grid";
import { CreditPacksPanel } from "@/components/pricing/credit-packs-panel";
import {
  SubscriptionUpgradeSuccessModal,
  type SubscriptionUpgradeSuccessSummary,
} from "@/components/pricing/subscription-upgrade-success-modal";
import { AuthModal } from "@/components/tools/auth-modal";
import { useAuthAction } from "@/hooks/use-auth-action";
import { useAuthenticatedUserCredits } from "@/hooks/use-authenticated-user-credits";
import { useLocale } from "@/hooks/use-locale";

export type AppUpgradeDialogTab = "subscription" | "creditPacks";

interface AppUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entrySurface?: string;
  defaultTab?: AppUpgradeDialogTab;
  defaultSubscriptionPeriod?: PricingPeriod;
}

export function AppUpgradeDialog({
  open,
  onOpenChange,
  entrySurface = "app_upgrade_dialog",
  defaultTab,
  defaultSubscriptionPeriod,
}: AppUpgradeDialogProps) {
  const { dictionary } = useLocale();
  const dialogDict = dictionary.pages.pricing.appUpgradeDialog;
  const { bootstrap, bootstrapLoading, creditsData, isAuthenticated } =
    useAuthenticatedUserCredits();
  const { showAuthModal, authMode, openSignUp, closeAuth, setAuthMode } = useAuthAction();
  const [activeTab, setActiveTab] = useState<AppUpgradeDialogTab>("subscription");
  const [upgradeSuccess, setUpgradeSuccess] =
    useState<SubscriptionUpgradeSuccessSummary | null>(null);

  const subscriptionPlanId = bootstrap?.subscription?.planId ?? null;
  const initialSubscriptionPeriod =
    defaultSubscriptionPeriod ??
    (bootstrap?.subscription?.interval === "month"
      ? "monthly"
      : bootstrap?.subscription?.interval === "year"
        ? "yearly"
        : undefined);
  const userPricingTier = getUserPricingTier(subscriptionPlanId);
  const currentPlanId = subscriptionPlanId
    ? getDisplayPlanIdFromSubscriptionPlanId(subscriptionPlanId)
    : undefined;

  useEffect(() => {
    if (!open) return;
    setActiveTab(defaultTab ?? "subscription");
  }, [defaultTab, open]);

  useEffect(() => {
    if (!bootstrapLoading && bootstrap?.authenticated && showAuthModal) {
      closeAuth(false);
    }
  }, [bootstrap?.authenticated, bootstrapLoading, closeAuth, showAuthModal]);

  const handleRequestAuth = useCallback(
    (intent: Parameters<typeof openSignUp>[0], redirectTo?: string | null) => {
      openSignUp(intent, redirectTo);
    },
    [openSignUp]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          overlayClassName="z-[10000]"
          className={cn(
            "z-[10001] flex max-h-[90vh] w-full max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 p-0 sm:max-w-6xl",
            "[&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4",
            "[&>[data-slot=dialog-close]]:z-10 [&>[data-slot=dialog-close]]:rounded-lg [&>[data-slot=dialog-close]]:p-2"
          )}
        >
          <DialogTitle className="sr-only">{dialogDict.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {activeTab === "subscription"
              ? dictionary.pages.pricing.planTypeToggle.subscriptionPlans
              : dictionary.pages.pricing.planTypeToggle.creditPacks}
          </DialogDescription>

          <div className="flex-1 overflow-y-auto px-6 pb-8 pt-10 sm:px-8 sm:pb-8 sm:pt-10">
            {activeTab === "subscription" ? (
              <PricingSubscriptionGrid
                dictionary={dictionary.pages.pricing.subscriptionGrid}
                entrySurface={entrySurface}
                currentPlanId={currentPlanId}
                embedded
                includeFreePlan={false}
                onRequestAuth={handleRequestAuth}
                onUpgradeComplete={() => onOpenChange(false)}
                onManageSubscription={() => onOpenChange(false)}
                onUpgradeSuccess={setUpgradeSuccess}
                isAuthenticated={isAuthenticated}
                isBootstrapLoading={bootstrapLoading}
                subscriptionPlanId={subscriptionPlanId}
                initialPeriod={initialSubscriptionPeriod}
                currentCredits={creditsData?.credits ?? null}
                showInlineAuthModal={false}
              />
            ) : (
              <CreditPacksPanel
                entrySurface={entrySurface}
                onRequestAuth={handleRequestAuth}
                isAuthenticated={isAuthenticated}
                isBootstrapLoading={bootstrapLoading}
                userPricingTier={userPricingTier}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AuthModal
        open={showAuthModal}
        onOpenChange={closeAuth}
        mode={authMode}
        onModeChange={setAuthMode}
        dictionary={dictionary.tools?.authModal}
      />

      {upgradeSuccess ? (
        <SubscriptionUpgradeSuccessModal
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setUpgradeSuccess(null);
            }
          }}
          planName={upgradeSuccess.planName}
          interval={upgradeSuccess.interval}
          totalCredits={upgradeSuccess.totalCredits}
          grantedCredits={upgradeSuccess.grantedCredits}
          carriedOverCredits={upgradeSuccess.carriedOverCredits}
        />
      ) : null}
    </>
  );
}
