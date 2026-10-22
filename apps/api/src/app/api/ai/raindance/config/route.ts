import { NextResponse } from 'next/server'
import { listAiFeatures } from '@markless/server/src/lib/ai/features'
import { RAINDANCE_FEATURE_KEY } from '@markless/server/src/lib/ai/raindance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 公开接口：首页在登录前就能展示单次生成的积分消耗，以及服务是否可用。 */
export async function GET() {
  const feature = listAiFeatures().find(item => item.key === RAINDANCE_FEATURE_KEY && item.kind === 'image_pair')
  return NextResponse.json({
    ok: true,
    featureKey: RAINDANCE_FEATURE_KEY,
    available: Boolean(feature),
    credits: feature?.credits ?? null,
  })
}
