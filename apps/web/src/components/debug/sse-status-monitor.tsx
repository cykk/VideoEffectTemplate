/**
 * SSE 连接状态监控组件（仅用于开发调试）
 *
 * 使用方式：
 * 在开发环境中，可以在任意页面添加此组件来监控 SSE 连接状态
 *
 * ```tsx
 * import { SSEStatusMonitor } from '@/components/debug/sse-status-monitor';
 *
 * <SSEStatusMonitor />
 * ```
 */

'use client';

import { useSSEStatus } from '@/hooks/use-user-stream';
import { useState } from 'react';
import { getPublicEnv } from '@markless/shared/src/lib/config/env';

export function SSEStatusMonitor() {
  const status = useSSEStatus();
  const [isExpanded, setIsExpanded] = useState(false);

  // 仅在开发环境显示
  if (getPublicEnv('NEXT_PUBLIC_APP_ENV') !== 'development') {
    return null;
  }

  const timeSinceHeartbeat = status.lastHeartbeat
    ? Math.floor((Date.now() - status.lastHeartbeat) / 1000)
    : null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* 收起状态：小图标 */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={`
            w-12 h-12 rounded-full shadow-lg
            flex items-center justify-center
            transition-colors
            ${status.isConnected ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
          `}
          title="SSE Connection Status"
        >
          <span className="text-white text-xl">
            {status.isConnected ? '✓' : '✗'}
          </span>
        </button>
      )}

      {/* 展开状态：详细信息 */}
      {isExpanded && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 w-80 border border-gray-200 dark:border-gray-700">
          {/* 标题栏 */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              SSE Connection Status
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          {/* 状态指示器 */}
          <div className="space-y-2 text-xs">
            {/* 连接状态 */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Connected:</span>
              <span className={status.isConnected ? 'text-green-600' : 'text-red-600'}>
                {status.isConnected ? '✓ Yes' : '✗ No'}
              </span>
            </div>

            {/* 正在连接 */}
            {status.isConnecting && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Connecting:</span>
                <span className="text-yellow-600">⏳ Yes</span>
              </div>
            )}

            {/* 引用计数 */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active Subscribers:</span>
              <span className="text-blue-600">{status.refCount}</span>
            </div>

            {/* 重连次数 */}
            {status.reconnectAttempts > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Reconnect Attempts:</span>
                <span className="text-orange-600">{status.reconnectAttempts}</span>
              </div>
            )}

            {/* 标签页状态 */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Tabs Hidden:</span>
              <span className={status.allTabsHidden ? 'text-yellow-600' : 'text-gray-400'}>
                {status.allTabsHidden ? 'Yes' : 'No'}
              </span>
            </div>

            {/* 心跳状态 */}
            {timeSinceHeartbeat !== null && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Last Heartbeat:</span>
                <span className={timeSinceHeartbeat < 60 ? 'text-green-600' : 'text-red-600'}>
                  {timeSinceHeartbeat}s ago
                </span>
              </div>
            )}
          </div>

          {/* 连接质量指示器 */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Connection Quality:
            </div>
            <div className="flex items-center space-x-1">
              <div
                className={`h-2 flex-1 rounded ${
                  status.isConnected && timeSinceHeartbeat !== null && timeSinceHeartbeat < 60
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
              />
              <div
                className={`h-2 flex-1 rounded ${
                  status.reconnectAttempts === 0 ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
              <div
                className={`h-2 flex-1 rounded ${
                  !status.allTabsHidden ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            </div>
          </div>

          {/* 提示信息 */}
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            💡 This monitor only shows in development
          </div>
        </div>
      )}
    </div>
  );
}
