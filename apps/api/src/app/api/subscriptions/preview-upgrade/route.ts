import { NextRequest, NextResponse } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import { SubscriptionService } from "@markless/server/src/lib/subscriptions/service";
import { getProductById } from "@markless/shared/src/lib/products/config";

export async function POST(req: NextRequest) {
  try {
    const { new_plan_id: newPlanId } = await req.json();

    if (!newPlanId) {
      return NextResponse.json(
        { ok: false, message: "invalid params: new_plan_id is required" },
        { status: 400 }
      );
    }

    // 验证用户登录
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "no auth, please sign-in" },
        { status: 401 }
      );
    }

    // 验证新计划
    const newProduct = getProductById(newPlanId);
    if (!newProduct || newProduct.type !== 'subscription') {
      return NextResponse.json(
        { ok: false, message: "invalid new_plan_id" },
        { status: 400 }
      );
    }

    const current = await SubscriptionService.getUserActiveSubscription(userId);
    if (current?.provider === 'waffo') {
      return NextResponse.json({ ok: true, data: { requires_checkout: true, new_price: newProduct.price } });
    }

    // 获取预览数据
    const preview = await SubscriptionService.previewUpgrade({
      userId,
      newPlanId,
    });

    if (preview.status === 'error') {
      return NextResponse.json(
        { ok: false, message: preview.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: preview.data,
    });

  } catch (error) {
    console.error("[Preview API] Error:", error);
    return NextResponse.json(
      { ok: false, message: "internal server error" },
      { status: 500 }
    );
  }
}
