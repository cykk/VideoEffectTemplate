import { cancelWaffoSubscription, resumeWaffoSubscription, cancelWaffoScheduledChange } from '@markless/server/src/lib/payments/providers/waffo/subscriptions'
﻿import { db } from "@markless/server/src/lib/db/client"
import {
  userSubscriptions,
  type UserSubscription,
  type NewUserSubscription,
  type SubscriptionStatus,
} from "@markless/server/src/lib/db/schema/subscriptions"
import { subscriptionLogs } from "@markless/server/src/lib/db/schema/subscription-logs"
import { eq, desc, and } from "drizzle-orm"
import { nanoid } from "nanoid"
import { CreditService } from "@markless/server/src/lib/credits/service"
import { getProductById, type SubscriptionProduct } from "@markless/shared/src/lib/products/config"
import { newCreemClient } from "@markless/server/src/lib/payments/creem"
import { differenceInDays } from "date-fns"
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription"
import { buildSubscriptionGrantKey, buildSubscriptionUpgradeKey } from "@markless/shared/src/lib/credits/idempotency"
import { getEnv } from "@markless/shared/src/lib/config/env"

export const SUBSCRIPTION_MESSAGE_KEYS = {
  noActiveSubscription: "subscription.visible.error.noActiveSubscription",
  invalidSubscriptionPlan: "subscription.visible.error.invalidSubscriptionPlan",
  currentPlanNotFound: "subscription.visible.error.currentPlanNotFound",
  productInfoNotFound: "subscription.visible.error.productInfoNotFound",
  upgradeRequiresHigherTier: "subscription.visible.error.upgradeRequiresHigherTier",
  downgradeRequiresLowerTier: "subscription.visible.error.downgradeRequiresLowerTier",
  planUnavailable: "subscription.visible.error.planUnavailable",
  onlyCreemSupported: "subscription.visible.error.onlyCreemSupported",
  previewNotImplemented: "subscription.visible.error.previewNotImplemented",
  unsupportedProvider: "subscription.visible.error.unsupportedProvider",
  internalPreviewError: "subscription.visible.error.internalPreviewError",
  upgradeRejected: "subscription.visible.error.upgradeRejected",
  upgradeSucceeded: "subscription.visible.success.upgradeSucceeded",
  downgradeScheduled: "subscription.visible.success.downgradeScheduled",
  downgradeFailed: "subscription.visible.error.downgradeFailed",
  providerCancellationFailed: "subscription.visible.error.providerCancellationFailed",
  resumeRequiresScheduledCancellation:
    "subscription.visible.error.resumeRequiresScheduledCancellation",
  resumeExpiredSubscription: "subscription.visible.error.resumeExpiredSubscription",
} as const

/**
 * 璁㈤槄绠＄悊鏈嶅姟
 */
export class SubscriptionService {
  /**
   * 创建订阅
   */
  static async createSubscription({
    userId,
    planId,
    planName,
    provider,
    providerSubscriptionId,
    providerCustomerId,
    interval,
    creditsPerPeriod,
    currentPeriodStart,
    currentPeriodEnd,
  }: {
    userId: string
    planId: string
    planName: string
    provider: string
    providerSubscriptionId: string
    providerCustomerId?: string
    interval: "month" | "year"
    creditsPerPeriod: number
    currentPeriodStart: Date
    currentPeriodEnd: Date
  }): Promise<UserSubscription> {

    // 1. 检查是否已存在相同 providerSubscriptionId 的记录（复活逻辑）
    // 只有当 Provider 真的生成了新 ID 时，才创建新记录
    const existingSub = await this.findByProviderSubscriptionId(providerSubscriptionId);
    
    if (existingSub) {
      console.log('[SubscriptionService] Reactivating existing subscription:', {
        id: existingSub.id,
        providerSubscriptionId
      });

      const [reactivatedSubscription] = await db
        .update(userSubscriptions)
        .set({
          status: SUBSCRIPTION_STATUS.ACTIVE,
          planId,
          planName,
          creditsPerPeriod,
          interval,
          currentPeriodStart,
          currentPeriodEnd,
          updatedAt: new Date(),
          cancelAt: null, // 清除取消标记
          cancelledAt: null,
          cancelAtPeriodEnd: 0
        })
        .where(eq(userSubscriptions.id, existingSub.id))
        .returning();

      // 发放积分逻辑保持不变
      // 策略调整：复活时也遵循 Monthly Drip，但无上限
      const monthlyCredits = interval === 'year' ? Math.floor(creditsPerPeriod / 12) : creditsPerPeriod

      if (monthlyCredits > 0) {
        const grantTime = new Date()
        await db.transaction(async (tx) => {
          await CreditService.grantCredits({
            userId,
            amount: monthlyCredits,
            source: 'subscription',
            type: 'subscription_grant',
            subscriptionId: reactivatedSubscription.id,
            description: "SUBSCRIPTION_REACTIVATED",
            metadata: {
              subscription_id: reactivatedSubscription.id,
              plan_id: planId,
              interval,
              is_reactivation: true,
              monthly_quota: monthlyCredits,
            },
            idempotencyKey: buildSubscriptionGrantKey(reactivatedSubscription.id, currentPeriodStart),
            // expiresAt: currentPeriodEnd, // 移除过期
            tx,
          });

          await tx
            .update(userSubscriptions)
            .set({
              lastCreditGrantAt: grantTime,
              creditGrantCount: interval === 'year' ? 1 : 0,
            })
            .where(eq(userSubscriptions.id, reactivatedSubscription.id))
        })
      }

      return reactivatedSubscription;
    }

    // 2. 如果是全新的 Provider ID，则创建新记录
    const newSubscription: NewUserSubscription = {
      id: nanoid(),
      userId,
      planId,
      planName,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      provider,
      providerSubscriptionId,
      providerCustomerId,
      interval,
      currentPeriodStart,
      currentPeriodEnd,
      creditsPerPeriod,
      cancelAtPeriodEnd: 0,
    }

    const [subscription] = await db.insert(userSubscriptions).values(newSubscription).returning()

    console.log('[SubscriptionService] Subscription created:', {
      subscriptionId: subscription.id,
      userId,
      planId,
      creditsPerPeriod,
    })

    // 记录日志
    await this.logChange({
      subscriptionId: subscription.id,
      userId,
      action: 'create',
      newPlanId: planId,
      newStatus: SUBSCRIPTION_STATUS.ACTIVE,
      metadata: { 
        provider, 
        interval,
        provider_subscription_id: providerSubscriptionId 
      }
    })

    // 发放首期积分
    // 年付订阅按月发放额度；未使用的订阅积分会在下一次月度发放前过期。
    // 购买积分包独立于订阅周期，不会随订阅积分一起清除。
    const monthlyCredits = interval === 'year' ? Math.floor(creditsPerPeriod / 12) : creditsPerPeriod

    if (monthlyCredits > 0) {
      const grantTime = new Date()
      await db.transaction(async (tx) => {
        await CreditService.grantCredits({
          userId,
          amount: monthlyCredits,
          source: 'subscription',
          type: 'subscription_grant',
          subscriptionId: subscription.id,
          description: "SUBSCRIPTION_CREDITS_GRANTED",
          metadata: {
            subscription_id: subscription.id,
            plan_id: planId,
            interval,
            is_monthly_drip: interval === 'year',
            monthly_quota: monthlyCredits,
          },
          idempotencyKey: buildSubscriptionGrantKey(subscription.id, currentPeriodStart),
          // 年付首期额度由后续月度发放任务在下个周期开始前统一过期。
          tx,
        })

        await tx
          .update(userSubscriptions)
          .set({
            lastCreditGrantAt: grantTime,
            creditGrantCount: interval === 'year' ? 1 : 0,
          })
          .where(eq(userSubscriptions.id, subscription.id))
      })
    }

    return subscription
  }
  /**
   * 缁湡璁㈤槄锛堝彂鏀炬柊鍛ㄦ湡绉垎锛?
   * 鏀寔璁″垝鍒囨崲锛氬鏋滄湁寰呭彉鏇磋鍒掞紙闄嶇骇锛夛紝鍦ㄧ画鏈熸椂鑷姩鍒囨崲
   */
  static async renewSubscription({
    providerSubscriptionId,
    currentPeriodStart,
    currentPeriodEnd,
  }: {
    providerSubscriptionId: string
    currentPeriodStart: Date
    currentPeriodEnd: Date
  }): Promise<UserSubscription | null> {
    // 鏌ユ壘璁㈤槄
    const subscription = await this.findByProviderSubscriptionId(providerSubscriptionId)

    if (!subscription) {
      console.error("[SubscriptionService] Subscription not found:", providerSubscriptionId)
      return null
    }

    // 妫€鏌ユ槸鍚︽湁寰呭垏鎹㈢殑璁″垝锛堥檷绾у満鏅級
    const hasScheduledChange = !!subscription.scheduledPlanId
    let planToUse = subscription.planId
    let planNameToUse = subscription.planName
    let creditsToGrant = subscription.creditsPerPeriod
    let intervalToUse = subscription.interval

    if (hasScheduledChange && subscription.scheduledChangeAt) {
      const now = new Date()
      // 濡傛灉璁″垝鍙樻洿鏃堕棿宸插埌锛屽垏鎹㈠埌鏂拌鍒?
      if (subscription.scheduledChangeAt <= now || subscription.scheduledChangeAt <= currentPeriodEnd) {
        planToUse = subscription.scheduledPlanId!
        planNameToUse = subscription.scheduledPlanName!
        creditsToGrant = subscription.scheduledCreditsPerPeriod!
        intervalToUse = subscription.scheduledInterval as "month" | "year"

        console.log("[SubscriptionService] Applying scheduled plan change:", {
          subscriptionId: subscription.id,
          oldPlan: subscription.planId,
          newPlan: planToUse,
          changeType: subscription.scheduledChangeType,
        })
      }
    }

    // 鏇存柊璁㈤槄鍛ㄦ湡锛堝鏋滄湁璁″垝鍙樻洿锛屽悓鏃舵洿鏂拌鍒掍俊鎭級
    const shouldGrantCredits = intervalToUse === 'month' || intervalToUse === 'year'
    const grantIdempotencyKey = buildSubscriptionGrantKey(subscription.id, currentPeriodStart)
    const existingGrant = shouldGrantCredits
      ? await CreditService.getTransactionByIdempotencyKey(grantIdempotencyKey)
      : null

    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set({
        currentPeriodStart,
        currentPeriodEnd,
        status: SUBSCRIPTION_STATUS.ACTIVE, // 纭繚鐘舵€佷负active
        updatedAt: new Date(),
        ...(hasScheduledChange && {
          planId: planToUse,
          planName: planNameToUse,
          creditsPerPeriod: creditsToGrant,
          interval: intervalToUse,
          scheduledPlanId: null,
          scheduledPlanName: null,
          scheduledCreditsPerPeriod: null,
          scheduledInterval: null,
          scheduledChangeAt: null,
          scheduledChangeType: null,
        }),
      })
      .where(eq(userSubscriptions.id, subscription.id))
      .returning()

    console.log("[SubscriptionService] Subscription renewed:", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      newPeriodEnd: currentPeriodEnd,
      planChanged: hasScheduledChange,
      newPlan: planToUse,
    })

    // 璁板綍鏃ュ織
    await this.logChange({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      action: "renew",
      previousPlanId: subscription.planId, // 鏇存柊鍓嶇殑璁″垝
      newPlanId: planToUse,
      newStatus: SUBSCRIPTION_STATUS.ACTIVE,
      metadata: { 
        is_plan_change: hasScheduledChange,
        provider_subscription_id: providerSubscriptionId 
      }
    })

    // 鍙戞斁鏂板懆鏈熺Н鍒?
    // 鏈堜粯涓嬭繘鍏ユ柊鍛ㄦ湡鏃讹紝鍏堟竻绌轰笂鏈熻闃呯Н鍒嗗啀鍙戞斁鏂伴搴?
    if (shouldGrantCredits && !existingGrant) {
      const monthlyCredits =
        intervalToUse === 'year'
          ? Math.floor(creditsToGrant / 12)
          : creditsToGrant

      if (monthlyCredits > 0) {
        const grantTime = new Date()
        await db.transaction(async (tx) => {
          await CreditService.expireSubscriptionCredits(subscription.userId, tx)

          await CreditService.grantCredits({
            userId: subscription.userId,
            amount: monthlyCredits,
            source: 'subscription',
            type: 'subscription_grant',
            subscriptionId: subscription.id,
            description: "SUBSCRIPTION_RENEWAL_CREDITS",
            metadata: {
              subscription_id: subscription.id,
              plan_id: planToUse,
              interval: intervalToUse,
              plan_changed: hasScheduledChange,
              is_monthly_drip: intervalToUse === 'year',
              monthly_quota: monthlyCredits,
            },
            idempotencyKey: grantIdempotencyKey,
            tx,
          })

          await tx
            .update(userSubscriptions)
            .set({
              lastCreditGrantAt: grantTime,
              creditGrantCount: intervalToUse === 'year' ? 1 : 0,
            })
            .where(eq(userSubscriptions.id, subscription.id))
        })
      }
    } else if (shouldGrantCredits && existingGrant) {
      console.log("[SubscriptionService] Renewal credits already granted for period, skipping duplicate grant:", {
        subscriptionId: subscription.id,
        providerSubscriptionId,
        currentPeriodStart,
        currentPeriodEnd,
      })
    }

    return updatedSubscription
  }

  /**
   * 鍙栨秷璁㈤槄
   */
  static async cancelSubscription(
    providerSubscriptionId: string,
    cancelAtPeriodEnd = true
  ): Promise<UserSubscription | null> {
    const subscription = await this.findByProviderSubscriptionId(providerSubscriptionId)

    if (!subscription) {
      console.error("[SubscriptionService] Subscription not found:", providerSubscriptionId)
      return null
    }

    if (subscription.provider === 'waffo') return cancelWaffoSubscription(subscription)

    // Call Creem API to cancel
    try {
      const creemClient = newCreemClient()
      await creemClient.cancelSubscription({
        subscriptionId: providerSubscriptionId,
        immediate: !cancelAtPeriodEnd
      })
    } catch (error: unknown) {
      // Check if error is "Subscription already canceled"
      // Creem returns 400 Bad Request with message "Subscription already canceled"
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage.includes("Subscription already canceled")) {
         console.warn("[SubscriptionService] Subscription was already canceled in Creem. Syncing local state.");
         // Continue to update local DB
      } else {
         console.error("[SubscriptionService] Failed to cancel in Creem:", error)
         // CRITICAL FIX: If API call fails (and it's not already canceled), do NOT update local DB.
         // This prevents "fake cancellation" where user thinks they cancelled but Creem/Stripe keeps charging.
         throw new Error(SUBSCRIPTION_MESSAGE_KEYS.providerCancellationFailed)
      }
    }

    const now = new Date()

    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set({
        status: cancelAtPeriodEnd ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.EXPIRED,
        cancelAtPeriodEnd: cancelAtPeriodEnd ? 1 : 0,
        cancelAt: cancelAtPeriodEnd ? subscription.currentPeriodEnd : now,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(userSubscriptions.id, subscription.id))
      .returning()

    console.log("[SubscriptionService] Subscription cancelled:", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      cancelAtPeriodEnd,
    })

    // 璁板綍鏃ュ織
    await this.logChange({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      action: cancelAtPeriodEnd ? "cancel_scheduled" : "cancel_immediate",
      previousStatus: subscription.status,
      newStatus: updatedSubscription.status,
      metadata: { cancel_at_period_end: cancelAtPeriodEnd }
    })

    // 濡傛灉绔嬪嵆鍙栨秷锛屾竻闄よ闃呯Н鍒?
    if (!cancelAtPeriodEnd) {
      await CreditService.expireSubscriptionCredits(subscription.userId)
    }

    return updatedSubscription
  }

  static async syncCancellationFromWebhook({
    providerSubscriptionId,
    cancelAtPeriodEnd = true,
    cancelAt,
  }: {
    providerSubscriptionId: string
    cancelAtPeriodEnd?: boolean
    cancelAt?: Date | null
  }): Promise<UserSubscription | null> {
    const subscription = await this.findByProviderSubscriptionId(providerSubscriptionId)

    if (!subscription) {
      console.error("[SubscriptionService] Subscription not found during webhook cancellation sync:", providerSubscriptionId)
      return null
    }

    const now = new Date()
    const effectiveCancelAt = cancelAtPeriodEnd
      ? cancelAt ?? subscription.currentPeriodEnd
      : cancelAt ?? now

    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set({
        status: cancelAtPeriodEnd ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.EXPIRED,
        cancelAtPeriodEnd: cancelAtPeriodEnd ? 1 : 0,
        cancelAt: effectiveCancelAt,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(userSubscriptions.id, subscription.id))
      .returning()

    console.log("[SubscriptionService] Subscription cancellation synced from webhook:", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      cancelAtPeriodEnd,
      cancelAt: effectiveCancelAt,
    })

    await this.logChange({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      action: cancelAtPeriodEnd ? "cancel_scheduled" : "cancel_immediate",
      previousStatus: subscription.status,
      newStatus: updatedSubscription.status,
      metadata: {
        cancel_at_period_end: cancelAtPeriodEnd,
        source: "creem_webhook",
      },
    })

    if (!cancelAtPeriodEnd) {
      await CreditService.expireSubscriptionCredits(subscription.userId)
    }

    return updatedSubscription
  }

  /**
   * 鎭㈠璁㈤槄
   * 鐢ㄤ簬鎾ら攢"鍙栨秷"鎿嶄綔锛屾仮澶嶈嚜鍔ㄧ画璐?
   */
  static async resumeSubscription(
    providerSubscriptionId: string
  ): Promise<UserSubscription | null> {
    const subscription = await this.findByProviderSubscriptionId(providerSubscriptionId)

    if (!subscription) {
      console.error("[SubscriptionService] Subscription not found:", providerSubscriptionId)
      return null
    }

    if (subscription.provider === 'waffo') return resumeWaffoSubscription(subscription)

    const now = new Date()
    // 鍙兘鎭㈠宸查绾﹀彇娑堜絾浠嶅湪鍛ㄦ湡鍐呯殑璁㈤槄
    if (!subscription.cancelAtPeriodEnd) {
      console.error("[SubscriptionService] Cannot resume subscription without scheduled cancellation:", {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      })
      throw new Error(SUBSCRIPTION_MESSAGE_KEYS.resumeRequiresScheduledCancellation)
    }

    if (subscription.currentPeriodEnd < now) {
      console.error("[SubscriptionService] Cannot resume expired subscription")
      throw new Error(SUBSCRIPTION_MESSAGE_KEYS.resumeExpiredSubscription)
    }

    if (subscription.provider !== "creem") {
      throw new Error(SUBSCRIPTION_MESSAGE_KEYS.unsupportedProvider)
    }

    const creemClient = newCreemClient()
    await creemClient.resumeSubscription({
      subscriptionId: providerSubscriptionId,
    })

    // 鏇存柊鏈湴鏁版嵁搴擄紝鎭㈠涓?active
    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        cancelAtPeriodEnd: 0,
        cancelAt: null,
        cancelledAt: null,
        updatedAt: now,
      })
      .where(eq(userSubscriptions.id, subscription.id))
      .returning()

    console.log("[SubscriptionService] Subscription resumed:", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
    })

    // 璁板綍鏃ュ織
    await this.logChange({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      action: "reactivate",
      previousStatus: subscription.status,
      newStatus: updatedSubscription.status,
      metadata: { resumed_at: now.toISOString() }
    })

    return updatedSubscription
  }

  /**
   * 閫氳繃鏀粯鎻愪緵鍟嗚闃匢D鏌ユ壘璁㈤槄
   */
  static async findByProviderSubscriptionId(
    providerSubscriptionId: string
  ): Promise<UserSubscription | null> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.providerSubscriptionId, providerSubscriptionId))
      .limit(1)

    return subscription || null
  }

  /**
   * 鑾峰彇鐢ㄦ埛鐨勬椿璺冭闃?
   */
  static async getUserActiveSubscription(userId: string): Promise<UserSubscription | null> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, SUBSCRIPTION_STATUS.ACTIVE)))
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1)

    return subscription || null
  }

  /**
   * 鑾峰彇鐢ㄦ埛鐨勬墍鏈夎闃?
   */
  static async getUserSubscriptions(userId: string): Promise<UserSubscription[]> {
    return await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .orderBy(desc(userSubscriptions.createdAt))
  }

  /**
   * 鏇存柊璁㈤槄鐘舵€?
   */
  static async updateSubscriptionStatus(
    providerSubscriptionId: string,
    status: SubscriptionStatus
  ): Promise<UserSubscription | null> {
    const subscription = await this.findByProviderSubscriptionId(providerSubscriptionId)

    if (!subscription) {
      return null
    }

    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, subscription.id))
      .returning()

    console.log("[SubscriptionService] Subscription status updated:", {
      subscriptionId: subscription.id,
      newStatus: status,
    })

    // 濡傛灉璁㈤槄杩囨湡锛屾竻闄よ闃呯Н鍒?
    if (status === SUBSCRIPTION_STATUS.EXPIRED) {
      await CreditService.expireSubscriptionCredits(subscription.userId);
    }

    return updatedSubscription
  }

  /**
   * 同步订阅周期（不发放积分，仅更新周期与状态）
   */
  static async syncSubscriptionPeriod(
    providerSubscriptionId: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date
  ): Promise<UserSubscription | null> {
    const subscription = await this.findByProviderSubscriptionId(providerSubscriptionId)

    if (!subscription) {
      return null
    }

    const [updatedSubscription] = await db
      .update(userSubscriptions)
      .set({
        currentPeriodStart,
        currentPeriodEnd,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, subscription.id))
      .returning()

    console.log("[SubscriptionService] Subscription period synced:", {
      subscriptionId: subscription.id,
      currentPeriodStart,
      currentPeriodEnd,
    })

    return updatedSubscription
  }

  /**
   * 棰勮鍗囩骇璐圭敤
   * 鏍规嵁褰撳墠璁㈤槄鎻愪緵鍟嗚皟鐢ㄧ浉搴旂殑棰勮閫昏緫
   */
  static async previewUpgrade({
    userId,
    newPlanId,
  }: {
    userId: string
    newPlanId: string
  }): Promise<{
    status: 'success' | 'error'
    message?: string
    data?: {
      proration_amount: number
      remaining_days: number
      current_price: number
      new_price: number
      currency: string
      effective_date: string
    }
  }> {
    try {
      // 1. 鑾峰彇褰撳墠璁㈤槄
      const currentSubscription = await this.getUserActiveSubscription(userId)
      if (!currentSubscription) {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.noActiveSubscription }
      }

      // 2. 鑾峰彇鏂版棫浜у搧淇℃伅
      const newProduct = getProductById(newPlanId) as SubscriptionProduct | null
      const currentProduct = getProductById(currentSubscription.planId) as SubscriptionProduct | null

      if (!newProduct || !currentProduct) {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.productInfoNotFound }
      }

      // 3. 鏍规嵁鎻愪緵鍟嗗垎鍙?
      if (currentSubscription.provider === 'creem') {
        return this.previewCreemUpgrade(currentSubscription, currentProduct, newProduct)
      } else if (currentSubscription.provider === 'stripe') {
        // TODO: 瀹炵幇 Stripe 棰勮閫昏緫
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.previewNotImplemented }
      } else {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.unsupportedProvider }
      }

    } catch (error) {
      console.error("[SubscriptionService] Preview failed:", error)
      return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.internalPreviewError }
    }
  }

  /**
   * Creem 鍗囩骇棰勮 (鎵嬪姩璁＄畻)
   * 绛栫暐锛氭墍鏈夊崌绾ч兘鎸夋瘮渚嬫姷鎵ｏ紙鏂规A锛?
   * 閫昏緫锛?鏂颁环鏍?- 鏃т环鏍? * (鍓╀綑澶╂暟 / 鎬诲ぉ鏁?
   */
  private static previewCreemUpgrade(
    subscription: UserSubscription,
    currentProduct: SubscriptionProduct,
    newProduct: SubscriptionProduct
  ) {
    const now = new Date()
    const currentPeriodEnd = subscription.currentPeriodEnd
    
    // 濡傛灉宸茬粡杩囨湡锛屽叏棰濇敮浠?
    if (now >= currentPeriodEnd) {
      return {
        status: 'success' as const,
        data: {
          proration_amount: newProduct.price,
          remaining_days: 0,
          current_price: currentProduct.price,
          new_price: newProduct.price,
          currency: 'USD',
          effective_date: now.toISOString()
        }
      }
    }

    const totalDays = subscription.interval === 'month' ? 30 : 365
    const remainingDays = Math.max(0, differenceInDays(currentPeriodEnd, now))
    
    // 璁＄畻鏃ュ潎鍗曚环
    // 娉ㄦ剰锛氬鏋滅敤鎴蜂箣鍓嶅凡缁忕敱浜庡崌绾ф垨鍏朵粬鍘熷洜鏀粯浜嗕笉鍚岄噾棰濓紝杩欓噷渚濈劧鎸夋爣鍑嗘湀璐硅绠楀樊浠?
    // 杩欐槸涓€涓畝鍖栫殑浼扮畻锛孋reem 瀹為檯鍙兘浼氭湁鏇村鏉傜殑閫昏緫锛堜緥濡傜簿纭埌绉掞級
    
    const currentDailyRate = currentProduct.price / totalDays
    // 鏍稿績淇锛?
    // 1. 濡傛灉鏄湀浠樿浆骞翠粯锛屾柊濂楅鏄叏鏂扮殑骞磋垂鍛ㄦ湡銆?
    // 2. Proration 閲戦搴斾负锛氭柊濂楅骞磋垂 - 鏃у椁愬墿浣欎环鍊笺€?
    // 3. 鏃у椁愬墿浣欎环鍊?= 鏃ф湀璐?/ 30 * 鍓╀綑澶╂暟
    // 4. 涔嬪墠鐨勫叕寮?(diff * remaining) 鍙€傜敤浜庡悓鍛ㄦ湡鍒囨崲銆?

    const isTermUpgrade = currentProduct.interval === 'month' && newProduct.interval === 'year';
    
    let prorationAmount = 0;

    if (isTermUpgrade) {
      // 鏈堜粯杞勾浠橈細鏂板椁愬叏浠?- 鏃у椁愬墿浣欎环鍊?
      const unusedValue = currentDailyRate * remainingDays;
      // 纭繚涓嶄綆浜?锛屼笖涓嶈秴杩囨柊浠锋牸锛堥槻姝㈣礋鏁伴€€娆炬儏鍐碉紝铏界劧鐞嗚涓婂崌绾т笉浼氾級
      prorationAmount = Math.max(0, newProduct.price - unusedValue);
    } else {
      // 鍚屽懆鏈熷垏鎹紙鏈?>鏈?鎴?骞?>骞达級锛氳ˉ宸环妯″紡
      const newDailyRate = newProduct.price / totalDays
      const dailyDifference = newDailyRate - currentDailyRate
      prorationAmount = Math.max(0, Number((dailyDifference * remainingDays).toFixed(2)))
    }

    return {
      status: 'success' as const,
      data: {
        proration_amount: prorationAmount,
        remaining_days: remainingDays,
        current_price: currentProduct.price,
        new_price: newProduct.price,
        currency: 'USD',
        effective_date: now.toISOString()
      }
    }
  }

  /**
   * 鍗囩骇璁㈤槄锛堢珛鍗崇敓鏁?+ 鎸夋瘮渚嬭璐癸級
   * 1. 璋冪敤 Creem API 鍗囩骇璁㈤槄锛堣嚜鍔ㄥ鐞?proration锛?
   * 2. 鏇存柊鏁版嵁搴撹闃呬俊鎭?
   * 3. 鎸夋瘮渚嬭ˉ鍙戠Н鍒?
   */
  static async upgradeSubscription({
    userId,
    newPlanId,
  }: {
    userId: string
    newPlanId: string
  }): Promise<{
    status: 'success' | 'error'
    message: string
    subscription?: UserSubscription
  }> {
    try {
      // 1. 鑾峰彇鐢ㄦ埛褰撳墠璁㈤槄
      const currentSubscription = await this.getUserActiveSubscription(userId)
      if (!currentSubscription) {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.noActiveSubscription }
      }

      // 2. 楠岃瘉鏂拌鍒?
      const newProduct = getProductById(newPlanId) as SubscriptionProduct | null
      if (!newProduct || newProduct.type !== 'subscription') {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.invalidSubscriptionPlan }
      }

      // 3. 妫€鏌ユ槸鍚︾湡鐨勬槸鍗囩骇锛堟寜浠锋牸鍒ゆ柇锛?
      const currentProduct = getProductById(currentSubscription.planId) as SubscriptionProduct | null
      if (!currentProduct) {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.currentPlanNotFound }
      }

      const currentMonthlyPrice = currentProduct.interval === 'month'
        ? currentProduct.price
        : currentProduct.price / 12
      const newMonthlyPrice = newProduct.interval === 'month'
        ? newProduct.price
        : newProduct.price / 12

      // 鍏佽鐗逛緥锛氭湀浠樿浆骞翠粯锛屽嵆浣挎湀鍧囧崟浠烽檷浣庯紝鍙绉垎涓嶅噺灏戯紝涔熻涓哄崌绾?
      const currentMonthlyCredits = currentProduct.interval === 'month' 
        ? currentProduct.creditsPerPeriod 
        : currentProduct.creditsPerPeriod / 12;
      const newMonthlyCredits = newProduct.interval === 'month'
        ? newProduct.creditsPerPeriod
        : newProduct.creditsPerPeriod / 12;
      
      const isTermUpgrade = currentSubscription.interval === 'month' && newProduct.interval === 'year';
      const isCreditsSafe = newMonthlyCredits >= currentMonthlyCredits;

      if (newMonthlyPrice <= currentMonthlyPrice && !(isTermUpgrade && isCreditsSafe)) {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.upgradeRequiresHigherTier }
      }

      // 4. 鑾峰彇 Creem 浜у搧 ID
      const creemProducts = this.getCreemProductMapping()
      const newCreemProductId = creemProducts[newPlanId]
      if (!newCreemProductId) {
        console.error(`[SubscriptionService] Creem product mapping not found for plan: ${newPlanId}`)
        console.error(`[SubscriptionService] Available mappings:`, Object.keys(creemProducts))
        return {
          status: 'error',
          message: SUBSCRIPTION_MESSAGE_KEYS.planUnavailable
        }
      }

      // 5. 璋冪敤 Creem API 鍗囩骇璁㈤槄
      if (currentSubscription.provider !== 'creem') {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.onlyCreemSupported }
      }

      // 升级策略：proration-charge-immediately（立即按比例扣费）
      const updateBehavior = "proration-charge-immediately";

      console.log("[SubscriptionService] Upgrading with strategy:", {
        userId,
        behavior: updateBehavior,
      });

      const creemClient = newCreemClient()
      const upgradeResult = await creemClient.upgradeSubscription({
        subscriptionId: currentSubscription.providerSubscriptionId,
        newProductId: newCreemProductId,
        updateBehavior: updateBehavior,
      })

      console.log("[SubscriptionService] Creem upgrade result:", upgradeResult)

      const remainingDays = differenceInDays(
        new Date(upgradeResult.current_period_end_date),
        new Date()
      )
      const totalDays = currentSubscription.interval === 'month' ? 30 : 365
      const nextPeriodStart = new Date(upgradeResult.current_period_start_date)
      const nextPeriodEnd = new Date(upgradeResult.current_period_end_date)
      const currentPlanWindowCredits = currentProduct.interval === 'year'
        ? Math.floor(currentProduct.creditsPerPeriod / 12)
        : currentProduct.creditsPerPeriod
      const currentWindowCredits = newProduct.interval === 'year'
        ? Math.floor(newProduct.creditsPerPeriod / 12)
        : newProduct.creditsPerPeriod
      const upgradeGrantCredits = currentWindowCredits
      const upgradeIdempotencyKey = buildSubscriptionUpgradeKey(
        currentSubscription.id,
        newPlanId,
        nextPeriodEnd
      )
      const existingUpgradeGrant = await CreditService.getTransactionByIdempotencyKey(
        upgradeIdempotencyKey
      )
      const grantTime = new Date()
      const shouldGrantCredits = !existingUpgradeGrant

      const updatedSubscription = await db.transaction(async (tx) => {
        const [subscriptionRecord] = await tx
          .update(userSubscriptions)
          .set({
            planId: newPlanId,
            planName: newProduct.name,
            creditsPerPeriod: newProduct.creditsPerPeriod,
            interval: newProduct.interval,
            currentPeriodStart: nextPeriodStart,
            currentPeriodEnd: nextPeriodEnd,
            updatedAt: new Date(),
            lastPlanChangeAt: new Date(),
            ...(shouldGrantCredits && {
              lastCreditGrantAt: grantTime,
              creditGrantCount: newProduct.interval === 'year' ? 1 : 0,
            }),
          })
          .where(eq(userSubscriptions.id, currentSubscription.id))
          .returning()

        if (shouldGrantCredits) {
          if (upgradeGrantCredits > 0) {
            await CreditService.grantCredits({
              userId,
              amount: upgradeGrantCredits,
              source: 'subscription',
              type: 'subscription_upgrade',
              subscriptionId: subscriptionRecord.id,
              description: "SUBSCRIPTION_UPGRADE_CARRYOVER_GRANT",
              metadata: {
                subscription_id: subscriptionRecord.id,
                old_plan_id: currentSubscription.planId,
                new_plan_id: newPlanId,
                proration_days: remainingDays,
                total_days: totalDays,
                strategy: 'full_current_window',
                previous_window_quota: currentPlanWindowCredits,
                current_window_quota: currentWindowCredits,
                granted_window_credits: upgradeGrantCredits,
                is_term_upgrade: isTermUpgrade,
              },
              idempotencyKey: upgradeIdempotencyKey,
              tx,
            })
          }
        }

        return subscriptionRecord
      })

      if (existingUpgradeGrant) {
        console.log("[SubscriptionService] Upgrade credits already processed, skipping reset/grant:", {
          subscriptionId: currentSubscription.id,
          newPlanId,
          upgradeIdempotencyKey,
        })
      } else {
        console.log("[SubscriptionService] Upgrade grant completed:", {
          subscriptionId: currentSubscription.id,
          newPlanId,
          currentPlanWindowCredits,
          currentWindowCredits,
          upgradeGrantCredits,
          isTermUpgrade,
        })
      }

      await this.logChange({
        subscriptionId: updatedSubscription.id,
        userId,
        action: "upgrade",
        previousPlanId: currentSubscription.planId,
        newPlanId: newPlanId,
        newStatus: SUBSCRIPTION_STATUS.ACTIVE,
        metadata: {
          strategy: "full_current_window",
          current_window_quota: currentWindowCredits,
          previous_window_quota: currentPlanWindowCredits,
          granted_window_credits: upgradeGrantCredits,
          credits_granted: shouldGrantCredits,
        }
      })

      return {
        status: 'success',
        message: SUBSCRIPTION_MESSAGE_KEYS.upgradeSucceeded,
        subscription: updatedSubscription,
      }
    } catch (error) {
      console.error("[SubscriptionService] Upgrade failed:", error)
      const message = error instanceof Error ? error.message : 'Upgrade failed'
      if (message.includes("Creem subscription upgrade failed: 403")) {
        return {
          status: 'error',
          message: SUBSCRIPTION_MESSAGE_KEYS.upgradeRejected,
        }
      }
      return { status: 'error', message }
    }
  }

  /**
   * 闄嶇骇璁㈤槄锛堝懆鏈熸湯鐢熸晥锛?
   * 1. 楠岃瘉鏂拌鍒掓槸鍚︾‘瀹炰负闄嶇骇
   * 2. 鍦ㄦ暟鎹簱涓爣璁板緟鍙樻洿璁″垝
   * 3. 涓嬫缁湡鏃惰嚜鍔ㄥ垏鎹?
   */
  static async downgradeSubscription({
    userId,
    newPlanId,
  }: {
    userId: string
    newPlanId: string
  }): Promise<{
    status: 'success' | 'error'
    message: string
    effectiveDate?: Date
    subscription?: UserSubscription
  }> {
    try {
      // 1. 鑾峰彇鐢ㄦ埛褰撳墠璁㈤槄
      const currentSubscription = await this.getUserActiveSubscription(userId)
      if (!currentSubscription) {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.noActiveSubscription }
      }

      // 2. 楠岃瘉鏂拌鍒?
      const newProduct = getProductById(newPlanId) as SubscriptionProduct | null
      if (!newProduct || newProduct.type !== 'subscription') {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.invalidSubscriptionPlan }
      }

      // 3. 妫€鏌ユ槸鍚︾湡鐨勬槸闄嶇骇锛堟寜浠锋牸鍒ゆ柇锛?
      const currentProduct = getProductById(currentSubscription.planId) as SubscriptionProduct | null
      if (!currentProduct) {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.currentPlanNotFound }
      }

      const currentMonthlyPrice = currentProduct.interval === 'month'
        ? currentProduct.price
        : currentProduct.price / 12
      const newMonthlyPrice = newProduct.interval === 'month'
        ? newProduct.price
        : newProduct.price / 12

      if (newMonthlyPrice >= currentMonthlyPrice) {
        return { status: 'error', message: SUBSCRIPTION_MESSAGE_KEYS.downgradeRequiresLowerTier }
      }

      // 4. 鏍囪寰呭彉鏇磋鍒掞紙鍛ㄦ湡鏈敓鏁堬級
      const [updatedSubscription] = await db
        .update(userSubscriptions)
        .set({
          scheduledPlanId: newPlanId,
          scheduledPlanName: newProduct.name,
          scheduledCreditsPerPeriod: newProduct.creditsPerPeriod,
          scheduledInterval: newProduct.interval,
          scheduledChangeAt: currentSubscription.currentPeriodEnd,
          scheduledChangeType: 'downgrade',
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, currentSubscription.id))
        .returning()

      console.log("[SubscriptionService] Downgrade scheduled:", {
        userId,
        currentPlan: currentProduct.name,
        newPlan: newProduct.name,
        effectiveDate: currentSubscription.currentPeriodEnd,
      })

      // 璁板綍鏃ュ織
      await this.logChange({
        subscriptionId: updatedSubscription.id,
        userId,
        action: "downgrade_scheduled",
        previousPlanId: currentSubscription.planId,
        newPlanId: newPlanId,
        metadata: {
          scheduled_for: currentSubscription.currentPeriodEnd
        }
      })

      return {
        status: 'success',
        message: SUBSCRIPTION_MESSAGE_KEYS.downgradeScheduled,
        effectiveDate: currentSubscription.currentPeriodEnd,
        subscription: updatedSubscription,
      }
    } catch (error) {
      console.error("[SubscriptionService] Downgrade failed:", error)
      return {
        status: 'error',
        message: error instanceof Error ? error.message : SUBSCRIPTION_MESSAGE_KEYS.downgradeFailed,
      }
    }
  }

  /**
   * 鍙栨秷璁″垝鍙樻洿
   */
  static async cancelScheduledChange(userId: string): Promise<boolean> {
    const subscription = await this.getUserActiveSubscription(userId)
    if (!subscription || !subscription.scheduledPlanId) {
      return false
    }

    if (subscription.provider === 'waffo') return cancelWaffoScheduledChange(subscription)

    await db
      .update(userSubscriptions)
      .set({
        scheduledPlanId: null,
        scheduledPlanName: null,
        scheduledCreditsPerPeriod: null,
        scheduledInterval: null,
        scheduledChangeAt: null,
        scheduledChangeType: null,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, subscription.id))

    console.log("[SubscriptionService] Scheduled change cancelled:", {
      userId,
      subscriptionId: subscription.id,
    })

    return true
  }

  /**
   * 鑾峰彇 Creem 浜у搧鏄犲皠
   * 浠庣幆澧冨彉閲忚鍙栦骇鍝?ID 鏄犲皠
   */
  private static getCreemProductMapping(): Record<string, string> {
    const envProducts = getEnv("CREEM_SUBSCRIPTIONS")

    console.log('[SubscriptionService] Reading Creem product mapping...')
    console.log('[SubscriptionService] CREEM_SUBSCRIPTIONS exists:', !!envProducts)
    console.log('[SubscriptionService] Raw env value:', envProducts?.substring(0, 100))

    if (!envProducts) {
      console.warn('[SubscriptionService] No CREEM_SUBSCRIPTIONS found in environment')
      return {}
    }

    try {
      const mapping = JSON.parse(envProducts)
      console.log('[SubscriptionService] Successfully parsed mapping. Keys:', Object.keys(mapping))
      return mapping
    } catch (error) {
      console.error('[SubscriptionService] Failed to parse Creem products:', error)
      console.error('[SubscriptionService] Raw value was:', envProducts)
      return {}
    }
  }

  /**
   * 璁板綍璁㈤槄鍙樻洿鏃ュ織
   */
  private static async logChange({
    subscriptionId,
    userId,
    action,
    previousPlanId,
    previousStatus,
    newPlanId,
    newStatus,
    metadata,
  }: {
    subscriptionId: string
    userId: string
    action: string
    previousPlanId?: string
    previousStatus?: string
    newPlanId?: string
    newStatus?: string
    metadata?: Record<string, unknown>
  }) {
    try {
      await db.insert(subscriptionLogs).values({
        subscriptionId,
        userId,
        action,
        previousPlanId,
        previousStatus,
        newPlanId,
        newStatus,
        metadata,
      })
    } catch (error) {
      // 鏃ュ織璁板綍澶辫触涓嶅簲闃绘柇涓讳笟鍔℃祦绋嬶紝鍙墦鍗伴敊璇?
      console.error("[SubscriptionService] Failed to log change:", error)
    }
  }
}






