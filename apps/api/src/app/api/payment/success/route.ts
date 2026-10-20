import { NextRequest, NextResponse } from "next/server";
import { OrderService } from "@markless/server/src/lib/orders/service";
import { SubscriptionService } from "@markless/server/src/lib/subscriptions/service";
import { CreditService } from "@markless/server/src/lib/credits/service";
import { auth } from "@markless/server/src/lib/auth/server";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import { db } from "@markless/server/src/lib/db/client";
import { waffoOrders } from "@markless/server/src/lib/db/schema/waffo";
import { eq } from "drizzle-orm";

type ParamValue = string | string[] | undefined | null;

function getFirstParamValue(value: ParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.length > 0);
  }

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getPreferredOrderId(value: ParamValue): string | undefined {
  if (Array.isArray(value)) {
    const normalizedValues = value.filter((item): item is string => typeof item === "string" && item.length > 0);
    return normalizedValues.find((item) => !item.startsWith("ord_")) ?? normalizedValues[0];
  }

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function formatCredits(creditAccount: Awaited<ReturnType<typeof CreditService.getUserCreditAccount>>) {
  return {
    totalBalance: creditAccount?.totalBalance ?? 0,
    subscriptionCredits: creditAccount?.subscriptionCredits ?? 0,
    purchasedCredits: creditAccount?.purchasedCredits ?? 0,
    bonusCredits: creditAccount?.bonusCredits ?? 0,
  };
}

/**
 * 处理支付成功回调
 * 验证签名并更新订单状态
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestId = getFirstParamValue(body.request_id as ParamValue);
    const checkoutId = getFirstParamValue(body.checkout_id as ParamValue);
    const orderId = getPreferredOrderId(body.order_id as ParamValue);
    const signature = getFirstParamValue(body.signature as ParamValue);
    const isUpgrade = body.upgrade === true || body.upgrade === "true";

    // 获取当前用户会话
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false }, { status: 401 });

    // 特殊处理：内部升级成功（无 Payment Request ID）
    if (isUpgrade && userId) {
      // 获取最新订阅信息
      let subscription = null;
      const userSubscriptions = await SubscriptionService.getUserSubscriptions(userId);
      const activeSub = userSubscriptions.find(s => s.status === SUBSCRIPTION_STATUS.ACTIVE);
      
      if (activeSub) {
        subscription = {
          planId: activeSub.planId,
          planName: activeSub.planName,
          status: activeSub.status,
          creditsPerPeriod: activeSub.creditsPerPeriod,
          currentPeriodEnd: activeSub.currentPeriodEnd,
          interval: activeSub.interval,
        };
      }

      // 获取最新积分信息
      const userCredits = await CreditService.getUserCreditAccount(userId);
      const credits = formatCredits(userCredits);

      // 构造虚拟订单对象以适配前端 UI
      const virtualOrder = {
        id: 'upgrade-' + Date.now(),
        orderNumber: 'UPGRADE-' + Date.now().toString().slice(-6),
        status: 'paid',
        productName: subscription?.planName || 'Subscription Upgrade',
        amount: '0.00', // 升级差价难以在此处获取，暂时显示占位符或让前端隐藏
        currency: 'USD',
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        order: virtualOrder,
        subscription,
        credits,
        isUpgrade: true
      });
    }

    // 常规支付流程：验证必填参数
    if (!requestId && !orderId) {
      return NextResponse.json(
        { success: false, error: "Missing request_id or order_id" },
        { status: 400 }
      );
    }

    // Note: Creem redirect URL signatures are different from webhook signatures
    // Webhook signature verification is handled in /api/pay/callback/creem
    // Here we trust the webhook to be the source of truth for order status
    // In production, the redirect only provides context while webhook finalizes payment state

    if (signature) {
      console.log("[Payment Success API] Redirect params received:", {
        requestId,
        orderId,
        has_signature: !!signature,
      });
    }

    // Find the order by payment request id first, then fall back to internal order id
    let order = requestId
      ? await OrderService.findOrderByPaymentRequestId(requestId)
      : null;

    if (!order && orderId) {
      order = await OrderService.findOrderById(orderId);
    }

    if (!order) {
      console.error("[Payment Success API] Order not found:", {
        requestId,
        orderId,
        rawRequestId: body.request_id,
        rawOrderId: body.order_id,
      });
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (userId && order.userId !== userId) {
      console.error("订单不属于当前用户:", {
        orderUserId: order.userId,
        currentUserId: userId,
      });
      return NextResponse.json(
        { success: false, error: "无权访问此订单" },
        { status: 403 }
      );
    }

    const currentOrder = order;
    const [waffo] = currentOrder.paymentProvider === 'waffo'
      ? await db.select().from(waffoOrders).where(eq(waffoOrders.orderId, currentOrder.id)) : [];

    console.log("[Payment Success API] Loaded order snapshot:", {
      orderId: currentOrder.id,
      orderNumber: currentOrder.orderNumber,
      requestId,
      checkoutId,
      status: currentOrder.status,
      paymentProvider: currentOrder.paymentProvider,
      paidAt: currentOrder.paidAt,
    });

    // 获取订阅信息（如果是订阅订单）
    let subscription = null;
    let credits = null;

    if (userId) {
      // 查找用户的活跃订阅
      const activeSubscription = await SubscriptionService.getUserActiveSubscription(userId);
      if (activeSubscription) {
        subscription = {
          planId: activeSubscription.planId,
          planName: activeSubscription.planName,
          status: activeSubscription.status,
          creditsPerPeriod: activeSubscription.creditsPerPeriod,
          currentPeriodEnd: activeSubscription.currentPeriodEnd,
          interval: activeSubscription.interval,
        };
      }

      // 获取用户积分信息
      const userCredits = await CreditService.getUserCreditAccount(userId);
      credits = formatCredits(userCredits);
    }

    // 返回订单信息
    return NextResponse.json({
      success: true,
      settled: currentOrder.status === 'paid' && (currentOrder.paymentProvider !== 'waffo' || Boolean(waffo?.fulfilledAt)),
      requiresReview: Boolean(waffo?.reviewReason),
      order: {
        id: currentOrder.id,
        orderNumber: currentOrder.orderNumber,
        status: currentOrder.status,
        productName: currentOrder.productName,
        amount: currentOrder.amount,
        currency: currentOrder.currency,
        paidAt: currentOrder.paidAt,
        createdAt: currentOrder.createdAt,
      },
      subscription,
      credits,
    });
  } catch (error) {
    console.error("处理支付成功回调时发生错误:", error);
    return NextResponse.json(
      {
        success: false,
        error: "服务器内部错误",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// 支持 GET 请求用于测试
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("request_id");

  if (!requestId) {
    return NextResponse.json(
      { success: false, error: "缺少 request_id 参数" },
      { status: 400 }
    );
  }

  const order = await OrderService.findOrderByPaymentRequestId(requestId);

  if (!order) {
    return NextResponse.json(
      { success: false, error: "订单未找到" },
      { status: 404 }
    );
  }
  if (order.userId !== session.user.id) return NextResponse.json({ success: false }, { status: 403 });

  return NextResponse.json({
    success: true,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      productName: order.productName,
      amount: order.amount,
      currency: order.currency,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    },
  });
}

