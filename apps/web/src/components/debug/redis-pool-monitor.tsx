/**
 * Redis 订阅池监控面板组件
 *
 * 用于开发环境监控订阅池状态
 *
 * 使用方式：
 * ```tsx
 * import { RedisPoolMonitor } from '@/components/debug/redis-pool-monitor';
 *
 * <RedisPoolMonitor />
 * ```
 */

'use client';

import { useState, useEffect } from 'react';
import { getPublicEnv } from '@markless/shared/src/lib/config/env';
import { apiFetch } from '@markless/shared/src/lib/http/client';

interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  totalUsers: number;
  distributionBalance: Array<{
    index: number;
    users: number;
    percentage: number;
    isHealthy: boolean;
    lastPing: number;
  }>;
  messagesRouted: number;
  messagesPerSecond: number;
  efficiency: number;
  connectionSavings: number;
  memoryUsageMB: string;
  health: {
    overall: 'healthy' | 'degraded';
    unhealthyConnections: number;
  };
  loadBalanceScore: number;
  timestamp: string;
}

export function RedisPoolMonitor() {
  const [metrics, setMetrics] = useState<PoolMetrics | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      // 仅在开发环境运行
      if (getPublicEnv('NEXT_PUBLIC_APP_ENV') !== 'development') {
        return;
      }

      try {
        const response = await apiFetch('/api/redis-pool/metrics');
        const data = await response.json();

        if (data.success) {
          setMetrics(data.data);
          setError(null);
        } else {
          setError(data.error || 'Failed to fetch metrics');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // 如果不在开发环境，则不启动定时器
    if (getPublicEnv('NEXT_PUBLIC_APP_ENV') !== 'development') {
      return;
    }

    // 立即获取一次
    fetchMetrics();

    // 每 5 秒更新一次
    const interval = setInterval(fetchMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!metrics && !error) {
    return null;
  }

  const healthColor =
    metrics?.health.overall === 'healthy' ? 'bg-green-500' : 'bg-yellow-500';

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {/* 收起状态：小图标 */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={`
            w-12 h-12 rounded-full shadow-lg
            flex items-center justify-center
            transition-colors
            ${healthColor} hover:opacity-80
          `}
          title="Redis Pool Status"
        >
          <span className="text-white text-xl font-bold">R</span>
        </button>
      )}

      {/* 展开状态：详细信息 */}
      {isExpanded && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 w-96 border border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
          {/* 标题栏 */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Redis 订阅池监控
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-100 dark:bg-red-900 rounded text-xs text-red-600 dark:text-red-200">
              错误: {error}
            </div>
          )}

          {metrics && (
            <div className="space-y-3 text-xs">
              {/* 总览 */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">Redis 连接数</div>
                    <div className="text-lg font-bold text-blue-600">
                      {metrics.activeConnections} / {metrics.totalConnections}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">在线用户</div>
                    <div className="text-lg font-bold text-green-600">
                      {metrics.totalUsers}
                    </div>
                  </div>
                </div>
              </div>

              {/* 性能指标 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">效率（用户/连接）:</span>
                  <span className="font-semibold text-blue-600">
                    {metrics.efficiency.toFixed(1)}x
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">连接节省:</span>
                  <span className="font-semibold text-green-600">
                    {metrics.connectionSavings.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">消息吞吐:</span>
                  <span className="font-semibold text-purple-600">
                    {metrics.messagesPerSecond} msg/s
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">内存使用:</span>
                  <span className="font-semibold text-orange-600">
                    {metrics.memoryUsageMB} MB
                  </span>
                </div>
              </div>

              {/* 负载均衡评分 */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="text-gray-600 dark:text-gray-400 mb-1">
                  负载均衡评分:
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        metrics.loadBalanceScore > 80
                          ? 'bg-green-500'
                          : metrics.loadBalanceScore > 60
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${metrics.loadBalanceScore}%` }}
                    />
                  </div>
                  <span className="font-bold text-sm">{metrics.loadBalanceScore}</span>
                </div>
              </div>

              {/* 连接分布 */}
              <div>
                <div className="text-gray-600 dark:text-gray-400 mb-2 font-semibold">
                  连接分布:
                </div>
                <div className="space-y-1">
                  {metrics.distributionBalance.map((conn) => {
                    const timeSinceLastPing = conn.lastPing
                      ? Math.floor((Date.now() - conn.lastPing) / 1000)
                      : null;

                    return (
                      <div
                        key={conn.index}
                        className="p-2 bg-gray-50 dark:bg-gray-700 rounded flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              conn.isHealthy ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          />
                          <span className="font-mono">连接 {conn.index}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-blue-600 font-semibold">
                            {conn.users} 用户
                          </span>
                          <span className="text-gray-500">
                            ({conn.percentage.toFixed(1)}%)
                          </span>
                          {timeSinceLastPing !== null && (
                            <span className="text-gray-400 text-xs">
                              {timeSinceLastPing}s
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 健康状态 */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">整体健康:</span>
                  <span
                    className={`font-semibold ${
                      metrics.health.overall === 'healthy'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {metrics.health.overall === 'healthy' ? '✓ 健康' : '⚠ 降级'}
                  </span>
                </div>
                {metrics.health.unhealthyConnections > 0 && (
                  <div className="text-red-600 text-xs mt-1">
                    {metrics.health.unhealthyConnections} 个连接不健康
                  </div>
                )}
              </div>

              {/* 统计信息 */}
              <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                <div>总消息路由: {metrics.messagesRouted.toLocaleString()}</div>
                <div>更新时间: {new Date(metrics.timestamp).toLocaleTimeString()}</div>
              </div>

              {/* 提示信息 */}
              <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                💡 仅在开发环境显示
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
