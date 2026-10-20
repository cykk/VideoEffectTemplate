"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CancelSubscriptionModal } from "./cancel-modal";
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from "@markless/shared/src/constants/subscription";

interface SubscriptionActionsProps {
  status: SubscriptionStatus;
  periodEnd?: string;
  locale: string;
}

export function SubscriptionActions({ status, periodEnd, locale }: SubscriptionActionsProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  if (status !== SUBSCRIPTION_STATUS.ACTIVE) {
    return null; // For now, only handle active state cancellation
  }

  return (
    <>
      <Button 
        variant="ghost"
        className="text-neutral-500 cursor-pointer dark:text-neutral-400 hover:bg-transparent hover:text-neutral-500 dark:hover:text-neutral-400"
        onClick={() => setShowCancelModal(true)}
      >
        {locale === "en" ? "Cancel Plan" : "取消套餐"}
      </Button>
      <CancelSubscriptionModal 
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        periodEnd={periodEnd}
      />
    </>
  );
}

