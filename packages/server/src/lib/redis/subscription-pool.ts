/**
 * Redis 订阅池（方案 2：连接池 + 哈希分配）
 *
 * 架构：
 * - 维护 N 个 Redis 订阅连接（默认 5 个，适合初期 < 50 并发用户）
 * - 使用一致性哈希将用户分配到连接
 * - 每个连接订阅 event:user:*:* 模式
 * - 内存路由表将消息分发给对应用户的处理器
 *
 * 优势：
 * - 500 用户 → 5 个 Redis 连接（vs 500 个，节省 99%）
 * - 负载均衡：用户均匀分布到各连接
 * - 故障隔离：单个连接故障只影响 1/N 的用户
 * - 健康检查：自动检测和修复僵尸连接
 *
 * 扩展建议：
 * - < 50 并发：poolSize = 5
 * - 50-100 并发：poolSize = 10
 * - 100-500 并发：poolSize = 20
 * - > 500 并发：poolSize = 50
 */

import { createSubscriber, type StreamEventMessage } from '@markless/server/src/lib/redis/client-v2';
import type { Redis } from 'ioredis';
import { getEnv } from "@markless/shared/src/lib/config/env";
import { buildRedisChannel, buildRedisPattern } from "@markless/shared/src/lib/redis/namespace";

const REDIS_URL = getEnv("REDIS_URL");
const isBuildPhase =
    getEnv("NEXT_PHASE") === 'phase-production-build' ||
    getEnv("NEXT_IS_EXPORT_WORKER") === 'true';

export type MessageHandler = (data: StreamEventMessage) => void;
type SubscriptionKey = string;

interface ConnectionState {
    subscriber: Redis;
    userHandlers: Map<string, Map<SubscriptionKey, MessageHandler>>;
    userCount: number;
    isHealthy: boolean;
    lastPing: number;
    reconnectAttempts: number;
}

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
    memoryUsage: number;
}

export class RedisSubscriptionPool {
    private static instance: RedisSubscriptionPool | null = null;

    private readonly poolSize: number;
    private readonly redisEnabled: boolean;
    private connections: Array<ConnectionState | null> = [];
    private initPromises: Array<Promise<void> | null> = [];
    private recoveryPromises: Array<Promise<void> | null> = [];
    private maxClientsCooldownUntil = 0;
    private lastCooldownLogAt = 0;
    private userToConnection = new Map<string, number>(); // userId -> 连接索引

    // 健康检查
    private healthCheckTimer: NodeJS.Timeout | null = null;
    private readonly maxClientsCooldownMs = 120000;
    private readonly healthCheckInterval = 30000; // 30 秒
    private readonly healthCheckTimeout = 60000; // 60 秒未响应视为不健康

    // 统计信息
    private totalMessagesRouted = 0;
    private lastMetricsTime = Date.now();

    /**
     * ⚡ 唯一配置点：修改连接池大小
     * 
     * 根据并发用户数调整：
     * - < 50 并发：poolSize = 5  ← 当前配置
     * - 50-100 并发：poolSize = 10
     * - 100-500 并发：poolSize = 20
     * - > 500 并发：poolSize = 50
     */
    private constructor(poolSize: number = 5) {
        this.poolSize = poolSize;
        this.redisEnabled = Boolean(REDIS_URL) && !isBuildPhase;
        console.log(`[Redis Pool] Initializing pool with ${poolSize} connections`);

        if (!this.redisEnabled) {
            if (!isBuildPhase) {
                console.warn('[Redis Pool] REDIS_URL not configured. Subscription pool disabled.');
            }
            return;
        }

        this.startHealthCheck();
    }

    /**
     * 获取单例实例
     * 
     * ⚡ HMR 安全：开发模式下使用 globalThis 缓存
     * 防止 Next.js 热重载时创建多个实例导致连接泄漏
     */
    static getInstance(poolSize?: number): RedisSubscriptionPool {
        // 开发环境：使用 globalThis 缓存
        if (getEnv("NODE_ENV") !== 'production') {
            const globalForPool = globalThis as unknown as {
                redisSubscriptionPool: RedisSubscriptionPool | undefined;
            };

            if (!globalForPool.redisSubscriptionPool) {
                globalForPool.redisSubscriptionPool = new RedisSubscriptionPool(poolSize);
            }
            return globalForPool.redisSubscriptionPool;
        }

        // 生产环境：使用静态变量
        if (!RedisSubscriptionPool.instance) {
            RedisSubscriptionPool.instance = new RedisSubscriptionPool(poolSize);
        }
        return RedisSubscriptionPool.instance;
    }

    /**
     * 重置单例（主要用于测试）
     */
    static resetInstance(): void {
        // 开发环境
        if (getEnv("NODE_ENV") !== 'production') {
            const globalForPool = globalThis as unknown as {
                redisSubscriptionPool: RedisSubscriptionPool | undefined;
            };
            if (globalForPool.redisSubscriptionPool) {
                globalForPool.redisSubscriptionPool.destroy();
                globalForPool.redisSubscriptionPool = undefined;
            }
        }

        // 生产环境
        if (RedisSubscriptionPool.instance) {
            RedisSubscriptionPool.instance.destroy();
            RedisSubscriptionPool.instance = null;
        }
    }

    /**
     * 订阅用户消息
     *
     * @param userId 用户 ID
     * @param handler 消息处理器
     * @returns 取消订阅函数
     */
    async subscribe(
        userId: string,
        handler: MessageHandler,
        subscriptionKey: SubscriptionKey = `subscription:${Date.now()}:${Math.random().toString(36).slice(2)}`
    ): Promise<() => void> {
        if (!this.redisEnabled) {
            console.warn('[Redis Pool] Redis not configured. Subscription skipped.');
            return () => {};
        }

        // 1. 使用一致性哈希分配用户到连接
        const connectionIndex = this.hashUserId(userId) % this.poolSize;

        console.log(`[Redis Pool] User ${userId} assigned to connection ${connectionIndex}`);

        // 2. 确保连接已初始化
        await this.ensureConnection(connectionIndex);

        const conn = this.connections[connectionIndex];
        if (!conn) {
            throw new Error(`Failed to initialize connection ${connectionIndex}`);
        }

        // 3. 注册处理器到内存路由表
        const isNewUser = !conn.userHandlers.has(userId);

        if (isNewUser) {
            conn.userHandlers.set(userId, new Map());
        }
        const userHandlerMap = conn.userHandlers.get(userId)!;
        const replacedExistingHandler = userHandlerMap.has(subscriptionKey);
        userHandlerMap.set(subscriptionKey, handler);

        // 只在新用户时增加计数
        if (isNewUser) {
            conn.userCount++;
            this.userToConnection.set(userId, connectionIndex);
        }

        console.log(
            `[Redis Pool] ✅ User ${userId} subscribed to connection ${connectionIndex} ` +
            `(${conn.userCount} users on this connection, ${this.userToConnection.size} total users)`
        );

        // 4. 返回取消订阅函数
        console.log(
            `[Redis Pool] User ${userId} handler count on connection ${connectionIndex}: ` +
            `${userHandlerMap.size}${replacedExistingHandler ? " (replaced same client subscription)" : ""}`
        );

        return () => this.unsubscribe(userId, subscriptionKey, handler);
    }

    /**
     * 取消订阅
     */
    private unsubscribe(
        userId: string,
        subscriptionKey: SubscriptionKey,
        handler: MessageHandler
    ): void {
        const connectionIndex = this.userToConnection.get(userId);
        if (connectionIndex === undefined) {
            console.warn(`[Redis Pool] User ${userId} not found in connection map`);
            return;
        }

        const conn = this.connections[connectionIndex];
        if (!conn) {
            console.warn(`[Redis Pool] Connection ${connectionIndex} not found`);
            return;
        }

        const handlers = conn.userHandlers.get(userId);
        if (handlers) {
            const currentHandler = handlers.get(subscriptionKey);
            if (currentHandler === handler) {
                handlers.delete(subscriptionKey);
            }

            // 该用户没有处理器了，清理
            if (handlers.size === 0) {
                conn.userHandlers.delete(userId);
                conn.userCount--;
                this.userToConnection.delete(userId);

                console.log(
                    `[Redis Pool] User ${userId} unsubscribed from connection ${connectionIndex} ` +
                    `(${conn.userCount} users remaining on this connection)`
                );
            }
        }

        // 如果所有连接都没有用户了，可以考虑清理（但保留至少 1 个连接以加速下次订阅）
        if (this.userToConnection.size === 0) {
            console.log('[Redis Pool] No users remaining, pool idle');
        }
    }

    /**
     * 一致性哈希：将 userId 映射到连接索引
     */
    private hashUserId(userId: string): number {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }

    private isMaxClientsError(error: unknown): boolean {
        return this.getErrorMessage(error)
            .toLowerCase()
            .includes('max number of clients reached');
    }

    private isInMaxClientsCooldown(): boolean {
        return Date.now() < this.maxClientsCooldownUntil;
    }

    private logMaxClientsCooldown(context: string): void {
        const now = Date.now();
        if (now - this.lastCooldownLogAt < 10000) {
            return;
        }

        this.lastCooldownLogAt = now;
        const remainingMs = Math.max(0, this.maxClientsCooldownUntil - now);
        console.warn(
            `[Redis Pool] Max clients cooldown active (${Math.ceil(remainingMs / 1000)}s remaining, ${context})`
        );
    }

    private enterMaxClientsCooldown(source: string, error: unknown): void {
        this.maxClientsCooldownUntil = Date.now() + this.maxClientsCooldownMs;
        this.lastCooldownLogAt = 0;
        console.warn(
            `[Redis Pool] Entering max clients cooldown for ${this.maxClientsCooldownMs}ms (${source}): ` +
            this.getErrorMessage(error)
        );
    }

    private async ensureConnection(index: number): Promise<void> {
        if (this.connections[index]) {
            return;
        }

        if (this.isInMaxClientsCooldown()) {
            this.logMaxClientsCooldown(`ensureConnection:${index}`);
            throw new Error('Redis subscriber initialization paused during max clients cooldown');
        }

        if (this.initPromises[index]) {
            await this.initPromises[index];
            return;
        }

        const initPromise = this.initConnection(index)
            .catch((error) => {
                if (this.isMaxClientsError(error)) {
                    this.enterMaxClientsCooldown(`init:${index}`, error);
                }
                throw error;
            })
            .finally(() => {
                if (this.initPromises[index] === initPromise) {
                    this.initPromises[index] = null;
                }
            });

        this.initPromises[index] = initPromise;
        await initPromise;
    }

    /**
     * 初始化连接
     */
    private async initConnection(index: number): Promise<void> {
        if (!this.redisEnabled) {
            throw new Error('Redis not configured');
        }

        if (this.connections[index]) {
            console.log(`[Redis Pool] Connection ${index} already initialized`);
            return;
        }

        console.log(`[Redis Pool] Initializing connection ${index}...`);

        try {
            console.log(`[Redis Pool] Creating Redis subscriber for connection ${index}...`);
            const subscriber = createSubscriber(`${index}`); // ⚡ 传递连接标识
            console.log(`[Redis Pool] Redis subscriber created for connection ${index}`);

            // 订阅所有用户的所有任务
            const userEventPattern = buildRedisPattern("event", "user", "*", "*");
            const userEventPrefix = buildRedisChannel("event", "user", "");
            console.log(`[Redis Pool] Subscribing to pattern ${userEventPattern} on connection ${index}...`);
            await subscriber.psubscribe(userEventPattern);

            console.log(`[Redis Pool] ✅ Connection ${index} subscribed to pattern: event:user:*:*`);

            // 消息路由：根据 userId 分发到对应的处理器
            subscriber.on('pmessage', (pattern, channel, message) => {
                try {
                    const data: StreamEventMessage = JSON.parse(message);

                    // ?? userId: event:user:{userId}:{eventId}
                    // userId ???? ":"???????? ":" ?? eventId ??
                    if (!channel.startsWith(userEventPrefix)) {
                        console.warn(`[Redis Pool] Invalid channel prefix: ${channel}`);
                        return;
                    }

                    const userId = data.userId;
                    if (!userId) {
                        console.warn(`[Redis Pool] Missing userId in message for channel: ${channel}`);
                        return;
                    }

                    // 检查该用户是否属于这个连接
                    const expectedIndex = this.userToConnection.get(userId);
                    if (expectedIndex !== index) {
                        // 消息不属于这个连接（可能是其他连接的用户）
                        // 这是正常的，因为所有连接都订阅了 event:user:*:*
                        return;
                    }

                    const conn = this.connections[index];
                    if (!conn) return;

                    // 找到该用户的所有处理器并调用
                    const handlers = conn.userHandlers.get(userId);
                    if (handlers && handlers.size > 0) {
                        // 🔥 诊断日志：检测重复 handlers
                        if (handlers.size > 1) {
                            console.warn(
                                `[Redis Pool] ⚠️ Multiple handlers detected for user ${userId}: ${handlers.size} handlers. ` +
                                `This may cause duplicate messages.`
                            );
                        }

                        handlers.forEach(h => {
                            try {
                                h(data);
                            } catch (error) {
                                console.error(`[Redis Pool] Handler error for user ${userId}:`, error);
                            }
                        });

                        this.totalMessagesRouted++;
                    }

                } catch (error) {
                    console.error(`[Redis Pool] Error parsing message on connection ${index}:`, error);
                }
            });

            // 错误处理
            subscriber.on('error', (err) => {
                console.error(`[Redis Pool] Connection ${index} error:`, err);
                if (this.isMaxClientsError(err)) {
                    this.enterMaxClientsCooldown(`subscriber-error:${index}`, err);
                }
                const conn = this.connections[index];
                if (conn) {
                    conn.isHealthy = false;
                    conn.reconnectAttempts++;
                }

                // 尝试重新初始化连接
                void this.handleConnectionFailure(index).catch((error) => {
                    console.error(`[Redis Pool] Recovery failed for connection ${index}:`, error);
                });
            });

            // 创建连接状态
            this.connections[index] = {
                subscriber,
                userHandlers: new Map(),
                userCount: 0,
                isHealthy: true,
                lastPing: Date.now(),
                reconnectAttempts: 0,
            };

            console.log(`[Redis Pool] ✅ Connection ${index} initialized successfully`);

        } catch (error) {
            console.error(`[Redis Pool] Failed to initialize connection ${index}:`, error);
            this.connections[index] = null;
            throw error;
        }
    }

    /**
     * 处理连接故障
     *
     * ⚡ 内存泄漏修复：重连前移除旧的事件监听器
     */
    private async handleConnectionFailure(index: number): Promise<void> {
        if (this.recoveryPromises[index]) {
            await this.recoveryPromises[index];
            return;
        }

        const recoveryPromise = (async () => {
        console.warn(`[Redis Pool] Handling failure for connection ${index}`);

        const conn = this.connections[index];
        if (!conn) return;

        if (this.isInMaxClientsCooldown()) {
            this.logMaxClientsCooldown(`recoverConnection:${index}`);
            return;
        }

        // 标记为不健康
        conn.isHealthy = false;

        // 如果重连次数太多，延迟重连
        const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts), 30000);
        console.log(`[Redis Pool] Will attempt reconnect in ${delay}ms (attempt ${conn.reconnectAttempts + 1})`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // ✅ 内存泄漏修复：移除旧连接的所有事件监听器
        try {
            conn.subscriber.removeAllListeners('pmessage');
            conn.subscriber.removeAllListeners('error');
            conn.subscriber.removeAllListeners('ready');
            conn.subscriber.removeAllListeners('connect');
            conn.subscriber.removeAllListeners('close');
            conn.subscriber.removeAllListeners('reconnecting');
            console.log(`[Redis Pool] Removed all event listeners from connection ${index}`);
        } catch (error) {
            console.error(`[Redis Pool] Error removing listeners from connection ${index}:`, error);
        }

        // 关闭旧连接
        try {
            await conn.subscriber.quit();
        } catch (error) {
            console.error(`[Redis Pool] Error closing failed connection ${index}:`, error);
        }

        // 保存用户列表和处理器（用于恢复）
        const savedUserHandlers = new Map(conn.userHandlers);
        const savedUserCount = conn.userCount;

        // 清除旧连接
        this.connections[index] = null;

        // 重新初始化
        try {
            await this.ensureConnection(index);

            // 恢复用户处理器到新连接
            const newConn = this.connections[index];
            if (newConn) {
                newConn.userHandlers = savedUserHandlers;
                newConn.userCount = savedUserCount;
                newConn.reconnectAttempts = conn.reconnectAttempts + 1;
                console.log(`[Redis Pool] ✅ Connection ${index} recovered, ${savedUserHandlers.size} users restored`);
            }

        } catch (error) {
            if (this.isMaxClientsError(error)) {
                this.enterMaxClientsCooldown(`recover:${index}`, error);
            }
            console.error(`[Redis Pool] Failed to recover connection ${index}:`, error);
        }

        })();

        this.recoveryPromises[index] = recoveryPromise;

        try {
            await recoveryPromise;
        } finally {
            if (this.recoveryPromises[index] === recoveryPromise) {
                this.recoveryPromises[index] = null;
            }
        }
    }

    /**
     * 启动健康检查
     */
    private startHealthCheck(): void {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckInterval);

        console.log(`[Redis Pool] Health check started (interval: ${this.healthCheckInterval}ms)`);
    }

    /**
     * 执行健康检查
     */
    private async performHealthCheck(): Promise<void> {
        if (!this.redisEnabled) {
            return;
        }

        const now = Date.now();

        for (let i = 0; i < this.poolSize; i++) {
            const conn = this.connections[i];
            if (!conn) continue;

            // 检查心跳超时
            const timeSinceLastPing = now - conn.lastPing;

            if (timeSinceLastPing > this.healthCheckTimeout) {
                console.warn(
                    `[Redis Pool] Connection ${i} unhealthy: no ping for ${timeSinceLastPing}ms`
                );
                conn.isHealthy = false;

                // 触发故障处理
                void this.handleConnectionFailure(i).catch((error) => {
                    console.error(`[Redis Pool] Health check recovery failed for connection ${i}:`, error);
                });
            } else {
                // 尝试 PING
                try {
                    await conn.subscriber.ping();
                    conn.lastPing = now;
                    conn.isHealthy = true;
                    conn.reconnectAttempts = 0;
                } catch (error) {
                    console.error(`[Redis Pool] Connection ${i} PING failed:`, error);
                    if (this.isMaxClientsError(error)) {
                        this.enterMaxClientsCooldown(`ping:${i}`, error);
                    }
                    conn.isHealthy = false;
                    void this.handleConnectionFailure(i).catch((recoveryError) => {
                        console.error(`[Redis Pool] PING recovery failed for connection ${i}:`, recoveryError);
                    });
                }
            }
        }
    }

    /**
     * 停止健康检查
     */
    private stopHealthCheck(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
            console.log('[Redis Pool] Health check stopped');
        }
    }

    /**
     * 获取监控指标
     */
    getMetrics(): PoolMetrics {
        if (!this.redisEnabled) {
            return {
                totalConnections: 0,
                activeConnections: 0,
                totalUsers: 0,
                distributionBalance: [],
                memoryUsage: 0,
            };
        }

        const activeConnections = this.connections.filter(c => c !== null).length;
        const totalUsers = this.userToConnection.size;

        // 计算每个连接的用户分布
        const distribution = this.connections.map((conn, index) => ({
            index,
            users: conn?.userCount || 0,
            percentage: totalUsers > 0 ? ((conn?.userCount || 0) / totalUsers * 100) : 0,
            isHealthy: conn?.isHealthy || false,
            lastPing: conn?.lastPing || 0,
        }));

        // 估算内存使用（粗略）
        // 每个用户约 10KB（处理器 + Map 开销）
        const memoryUsage = totalUsers * 10 * 1024;

        return {
            totalConnections: this.poolSize,
            activeConnections,
            totalUsers,
            distributionBalance: distribution,
            memoryUsage,
        };
    }

    /**
     * 获取详细状态（用于调试）
     */
    getStatus() {
        const metrics = this.getMetrics();
        const timeSinceLastMetrics = Date.now() - this.lastMetricsTime;
        const messagesPerSecond = timeSinceLastMetrics > 0
            ? (this.totalMessagesRouted / (timeSinceLastMetrics / 1000)).toFixed(2)
            : '0';

        return {
            ...metrics,
            redisEnabled: this.redisEnabled,
            messagesRouted: this.totalMessagesRouted,
            messagesPerSecond: parseFloat(messagesPerSecond),
            uptime: Date.now() - this.lastMetricsTime,
        };
    }

    /**
     * 销毁连接池
     */
    async destroy(): Promise<void> {
        console.log('[Redis Pool] Destroying pool...');

        this.stopHealthCheck();

        // 关闭所有连接（先移除监听器防止内存泄漏）
        const closePromises = this.connections.map(async (conn, index) => {
            if (conn) {
                try {
                    // ✅ 移除所有事件监听器
                    conn.subscriber.removeAllListeners();
                    await conn.subscriber.quit();
                    console.log(`[Redis Pool] Connection ${index} closed`);
                } catch (error) {
                    console.error(`[Redis Pool] Error closing connection ${index}:`, error);
                }
            }
        });

        await Promise.all(closePromises);

        // 清理状态
        this.connections = [];
        this.initPromises = [];
        this.recoveryPromises = [];
        this.userToConnection.clear();
        this.totalMessagesRouted = 0;
        this.maxClientsCooldownUntil = 0;
        this.lastCooldownLogAt = 0;

        console.log('[Redis Pool] ✅ Pool destroyed');
    }
}

/**
 * 便捷函数：获取全局订阅池实例
 */
export function getSubscriptionPool(poolSize?: number): RedisSubscriptionPool {
    return RedisSubscriptionPool.getInstance(poolSize);
}

/**
 * 🧹 进程退出时的优雅关闭
 * 
 * ⚡ HMR 安全：使用 globalThis 防止重复注册
 */
const globalForPoolSignals = globalThis as unknown as {
    poolSignalHandlersRegistered?: boolean;
};

if (typeof process !== 'undefined' && !globalForPoolSignals.poolSignalHandlersRegistered) {
    globalForPoolSignals.poolSignalHandlersRegistered = true;

    let isShuttingDown = false;

    const gracefulShutdown = async (signal: string) => {
        if (isShuttingDown) {
            console.log('[Redis Pool] Shutdown already in progress...');
            return;
        }

        isShuttingDown = true;
        console.log(`[Redis Pool] 🛑 Received ${signal}, starting graceful shutdown...`);

        try {
            const pool = RedisSubscriptionPool.getInstance();
            await pool.destroy();
            console.log('[Redis Pool] ✅ Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            console.error('[Redis Pool] ❌ Error during graceful shutdown:', error);
            process.exit(1);
        }
    };

    // 监听进程退出信号
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 在开发环境监听 uncaughtException 和 unhandledRejection
    if (getEnv("NODE_ENV") === 'development') {
        process.on('uncaughtException', (error) => {
            console.error('[Redis Pool] Uncaught Exception:', error);
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });

        process.on('unhandledRejection', (reason) => {
            console.error('[Redis Pool] Unhandled Rejection:', reason);
            gracefulShutdown('UNHANDLED_REJECTION');
        });
    }
}
