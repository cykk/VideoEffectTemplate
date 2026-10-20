import { NextRequest, NextResponse } from "next/server"
import { auth } from "@markless/server/src/lib/auth/server"
import { SubscriptionService } from "@markless/server/src/lib/subscriptions/service"
import { getProductById } from "@markless/shared/src/lib/products/config"
import { createWaffoPlanChange } from "@markless/server/src/lib/payments/providers/waffo/subscriptions"

function respErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

function respData<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

/**
 * 变更订阅计划（升级或降级）
 * POST /api/subscriptions/change
 *
 * 请求体：
 * {
 *   "new_plan_id": "tier2:monthly",
 *   "change_type": "upgrade" | "downgrade" // 可选，自动判断
 * }
 *
 * 响应（升级）：
 * {
 *   "ok": true,
 *   "data": {
 *     "status": "success",
 *     "message": "Successfully upgraded to 1000 Credits Monthly",
 *     "change_type": "upgrade",
 *     "effective_immediately": true
 *   }
 * }
 *
 * 响应（降级）：
 * {
 *   "ok": true,
 *   "data": {
 *     "status": "success",
 *     "message": "Downgrade to 500 Credits Monthly scheduled for end of current period",
 *     "change_type": "downgrade",
 *     "effective_date": "2025-01-15T00:00:00.000Z",
 *     "effective_immediately": false
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { new_plan_id: newPlanId, change_type: requestedChangeType }: {
      new_plan_id?: string
      change_type?: "upgrade" | "downgrade"
    } = await req.json()

    if (!newPlanId) {
      return respErr("invalid params: new_plan_id is required")
    }

    // 验证用户登录
    const session = await auth.api.getSession({ headers: req.headers })
    const userId = session?.user?.id
    if (!userId) {
      return respErr("no auth, please sign-in", 401)
    }

    // 验证新计划存在
    const newProduct = getProductById(newPlanId)
    if (!newProduct || newProduct.type !== 'subscription') {
      return respErr("invalid new_plan_id: plan not found or not a subscription")
    }

    // 获取当前订阅
    const currentSubscription = await SubscriptionService.getUserActiveSubscription(userId)
    if (!currentSubscription) {
      return respErr("no active subscription found", 404)
    }

    // 检查是否尝试切换到相同计划
    if (currentSubscription.planId === newPlanId) {
      return respErr("new plan is the same as current plan")
    }

    if (currentSubscription.provider === 'waffo') {
      const result = await createWaffoPlanChange(currentSubscription, newPlanId)
      return respData({ status: 'checkout', ...result })
    }

    // 自动判断是升级还是降级（基于价格）
    const currentProduct = getProductById(currentSubscription.planId)
    if (!currentProduct || currentProduct.type !== 'subscription') {
      return respErr("current plan not found")
    }

    const currentMonthlyPrice = currentProduct.interval === 'month'
      ? currentProduct.price
      : currentProduct.price / 12
    const newMonthlyPrice = newProduct.interval === 'month'
      ? newProduct.price
      : newProduct.price / 12

    // 核心逻辑修正：
    // 1. 如果是月付转年付，且月积分未减少，视为升级（Upgrade）
    // 2. 否则，比较月均单价
    const currentMonthlyCredits = currentProduct.interval === 'month' 
      ? currentProduct.creditsPerPeriod 
      : currentProduct.creditsPerPeriod / 12;
    
    const newMonthlyCredits = newProduct.interval === 'month'
      ? newProduct.creditsPerPeriod
      : newProduct.creditsPerPeriod / 12;

    const isTermUpgrade = currentProduct.interval === 'month' && newProduct.interval === 'year';
    const isCreditUpgrade = newMonthlyCredits >= currentMonthlyCredits;

    const actualChangeType = (isTermUpgrade && isCreditUpgrade) || newMonthlyPrice > currentMonthlyPrice 
      ? 'upgrade' 
      : 'downgrade'

    // 如果用户指定了 change_type，验证是否匹配
    if (requestedChangeType && requestedChangeType !== actualChangeType) {
      return respErr(`invalid change_type: expected ${actualChangeType} but got ${requestedChangeType}`)
    }

    console.log("[Subscription Change API] Processing request:", {
      userId,
      currentPlan: currentSubscription.planId,
      newPlan: newPlanId,
      changeType: actualChangeType,
      currentPrice: currentMonthlyPrice,
      newPrice: newMonthlyPrice,
    })

    // 执行升级或降级
    if (actualChangeType === 'upgrade') {
      const result = await SubscriptionService.upgradeSubscription({
        userId,
        newPlanId,
      })

      if (result.status === 'error') {
        return respErr(result.message, 400)
      }

      return respData({
        status: result.status,
        message: result.message,
        change_type: 'upgrade',
        effective_immediately: true,
        subscription: result.subscription,
      })
    } else {
      // 降级
      const result = await SubscriptionService.downgradeSubscription({
        userId,
        newPlanId,
      })

      if (result.status === 'error') {
        return respErr(result.message, 400)
      }

      return respData({
        status: result.status,
        message: result.message,
        change_type: 'downgrade',
        effective_date: result.effectiveDate,
        effective_immediately: false,
        subscription: result.subscription,
      })
    }
  } catch (e: unknown) {
    console.error("[Subscription Change API] Failed:", e)
    const errorMessage = e instanceof Error ? e.message : String(e)
    return respErr("subscription change failed: " + errorMessage, 500)
  }
}

/**
 * 取消待变更的计划（仅适用于降级）
 * DELETE /api/subscriptions/change
 *
 * 响应：
 * {
 *   "ok": true,
 *   "data": {
 *     "status": "success",
 *     "message": "Scheduled plan change cancelled"
 *   }
 * }
 */
export async function DELETE(req: NextRequest) {
  try {
    // 验证用户登录
    const session = await auth.api.getSession({ headers: req.headers })
    const userId = session?.user?.id
    if (!userId) {
      return respErr("no auth, please sign-in", 401)
    }

    const success = await SubscriptionService.cancelScheduledChange(userId)

    if (!success) {
      return respErr("no scheduled change found", 404)
    }

    return respData({
      status: "success",
      message: "Scheduled plan change cancelled",
    })
  } catch (e: unknown) {
    console.error("[Subscription Change API] Cancel failed:", e)
    const errorMessage = e instanceof Error ? e.message : String(e)
    return respErr("cancel failed: " + errorMessage, 500)
  }
}
