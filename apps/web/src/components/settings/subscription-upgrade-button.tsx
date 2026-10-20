"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AppUpgradeDialog } from "@/components/pricing/app-upgrade-dialog";
import type { Locale } from "@markless/shared/src/i18n/types";

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
        {locale === "en" ? "Upgrade Plan" : "升级套餐"}
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
