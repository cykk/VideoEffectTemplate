"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getPublicEnv } from "@markless/shared/src/lib/config/env";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // ✅ 使用 useState 创建 QueryClient，避免跨请求共享
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ 数据在 30 秒内认为是新鲜的，不会重新请求
            // 适配视频任务生成频率（几分钟级别），平衡实时性和性能
            staleTime: 30 * 1000,

            // ✅ 缓存时间 10 分钟（超过后从内存中删除）
            // 平衡用户体验和内存使用，用户切换页面后 10 分钟内返回可使用缓存
            gcTime: 10 * 60 * 1000,
            
            // ✅ 窗口重新获得焦点时不自动刷新
            // 项目使用 SSE 实时推送，无需额外轮询
            refetchOnWindowFocus: false,
            
            // ✅ 网络重连时自动刷新
            // 视频任务是长时任务，重连后需同步最新状态
            refetchOnReconnect: true,
            
            // ✅ 智能重试策略：认证/权限错误不重试，网络错误重试1次
            retry: (failureCount, error) => {
              // 401/403/404 等客户端错误不重试
              if (error instanceof Error && 'status' in error) {
                const status = (error as { status: number }).status;
                if ([401, 403, 404].includes(status)) {
                  return false;
                }
              }
              // 网络错误或服务端错误重试1次
              return failureCount < 1;
            },
            
            // ✅ 重试延迟：指数退避（1s, 2s）
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 2000),
          },
          mutations: {
            // ✅ Mutation 失败后不自动重试（用户操作需明确反馈）
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* ✅ 开发环境显示 DevTools */}
      {getPublicEnv("NEXT_PUBLIC_APP_ENV") === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
