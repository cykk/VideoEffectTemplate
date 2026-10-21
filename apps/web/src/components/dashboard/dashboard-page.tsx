"use client";

import { AiJobsPage } from "@/components/ai/jobs-page";
import { DashboardPaymentSuccessHandler } from "@/components/payment/dashboard-payment-success-handler";

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardPaymentSuccessHandler />
      <AiJobsPage />
    </div>
  );
}
