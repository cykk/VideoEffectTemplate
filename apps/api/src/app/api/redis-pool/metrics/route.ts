import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionPool } from '@markless/server/src/lib/redis/subscription-pool';
import { requireAdminSession } from '@markless/server/src/lib/admin/require-admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession(req.headers);
    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin access required',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    const pool = getSubscriptionPool();
    const metrics = pool.getMetrics();
    const status = pool.getStatus();
    const redisEnabled = status.redisEnabled !== false;

    // 计算额外指标
    const efficiency = metrics.totalConnections > 0
      ? ((metrics.totalUsers / metrics.totalConnections) || 0).toFixed(2)
      : '0';

    const connectionSavings = metrics.totalUsers > 0
      ? (((metrics.totalUsers - metrics.totalConnections) / metrics.totalUsers) * 100).toFixed(2)
      : '0';

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        efficiency: parseFloat(efficiency),
        connectionSavings: parseFloat(connectionSavings),
        memoryUsageMB: (metrics.memoryUsage / 1024 / 1024).toFixed(2),
        health: {
          overall: redisEnabled && metrics.distributionBalance.every(d => d.isHealthy)
            ? 'healthy'
            : 'degraded',
          unhealthyConnections: redisEnabled
            ? metrics.distributionBalance.filter(d => !d.isHealthy).length
            : metrics.totalConnections,
        },

        loadBalanceScore: redisEnabled
          ? calculateLoadBalanceScore(metrics.distributionBalance)
          : 0,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[Redis Pool Metrics] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

function calculateLoadBalanceScore(
  distribution: Array<{ users: number; percentage: number }>
): number {
  if (distribution.length === 0) return 100;

  // 计算理想百分比
  const idealPercentage = 100 / distribution.length;

  // 计算标准差
  const variance = distribution.reduce((sum, d) => {
    const diff = d.percentage - idealPercentage;
    return sum + diff * diff;
  }, 0) / distribution.length;

  const stdDev = Math.sqrt(variance);

  // 转换为评分（标准差越小，评分越高）
  // 假设标准差 > 20 为不均衡
  const score = Math.max(0, 100 - (stdDev / 20) * 100);

  return Math.round(score);
}
