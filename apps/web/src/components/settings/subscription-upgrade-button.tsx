"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AppUpgradeDialog } from "@/components/pricing/app-upgrade-dialog";
import type { Locale } from "@markless/shared/src/i18n/types";
import { getDictionary } from "@markless/shared/src/i18n";

interface SubscriptionUpgradeButtonProps {
  locale: Locale;
}

export function SubscriptionUpgradeButton({ locale }: SubscriptionUpgradeButtonProps) {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  return (
    <>
      <Button 
        onClick={() => setIsUpgradeModalOpen(true)}
        className="w-full sm:w-auto bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 cursor-pointer"
      >
        {getDictionary(locale).app.settings.billing.actions.upgradePlan}
      </Button>

      <AppUpgradeDialog
        open={isUpgradeModalOpen}
        onOpenChange={setIsUpgradeModalOpen}
        entrySurface="Settings_page"
        defaultTab="subscription"
      />
    </>
  );
}
