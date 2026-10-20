"use client";

import { GA_READY_EVENT_NAME, isGaReady } from "@/lib/analytics/ga";

export { GA_READY_EVENT_NAME };

export function isProjectGaReady() {
    return isGaReady();
}
