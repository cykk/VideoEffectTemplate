"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AppUpgradeDialog } from "@/components/pricing/app-upgrade-dialog";
import type { Locale } from "@markless/shared/src/i18n/types";
import { getDictionary } from "@markless/shared/src/i18n";

interface CreditsRechargeButtonProps {
  locale: Locale;
}

export function CreditsRechargeButton({ locale }: CreditsRechargeButtonProps) {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  return (
    <>
      <Button 
        size="sm" 
        onClick={() => setIsUpgradeModalOpen(true)}
        className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 border-0 shadow-sm cursor-pointer"
      >
        {getDictionary(locale).app.settings.billing.actions.recharge}
      </Button>

      <AppUpgradeDialog
        open={isUpgradeModalOpen}
        onOpenChange={setIsUpgradeModalOpen}
        entrySurface="settings_page_recharge"
        defaultTab="creditPacks"
      />
    </>
  );
}
