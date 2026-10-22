"use client";

import { getWebAnalyticsClient } from "@/lib/analytics/ga";

/** RainDance 漏斗事件，统一前缀便于在 GA 中筛选。 */
export type RaindanceEvent =
    | "raindance_select_photo_1"
    | "raindance_select_photo_2"
    | "raindance_click_generate"
    | "raindance_auth_view"
    | "raindance_auth_success"
    | "raindance_credits_view"
    | "raindance_checkout_start"
    | "raindance_generation_start"
    | "raindance_generation_success"
    | "raindance_generation_failed"
    | "raindance_download";

export function trackRaindance(name: RaindanceEvent, params?: Record<string, string | number | boolean>) {
    try {
        getWebAnalyticsClient().track({ name, params });
    } catch {
        // 埋点失败不应影响主流程
    }
}
