/**
 * 网络状态检测 Hook
 *
 * 用途：
 * - 检测用户是否在线
 * - 监听浏览器的在线/离线状态变化
 * - 用于优化轮询策略（离线时停止轮询）
 *
 * 使用：
 * ```tsx
 * const isOnline = useOnline();
 * if (!isOnline) {
 *   console.log('User is offline');
 * }
 * ```
 */

import { useState, useEffect } from 'react';

/**
 * 检测用户是否在线
 * @returns boolean - true 为在线，false 为离线
 */
export function useOnline(): boolean {
  // 初始状态：从 navigator.onLine 获取
  // SSR 兼容：服务端默认返回 true
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    // 只在浏览器环境运行
    if (typeof window === 'undefined') return;

    // 在线事件处理
    const handleOnline = () => {
      console.log('[useOnline] 🟢 Network online');
      setIsOnline(true);
    };

    // 离线事件处理
    const handleOffline = () => {
      console.log('[useOnline] 🔴 Network offline');
      setIsOnline(false);
    };

    // 监听网络状态变化
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 清理监听器
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
