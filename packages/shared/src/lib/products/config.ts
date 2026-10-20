/**
 * 产品配置 - 基于价格基准 $1 = 10积分 ($0.1/积分)
 * 定义所有订阅计划和积分充值包
 *
 * 定价策略（滑动式订阅 - 2025）：
 *
 * 订阅计划（3 个档位，每个档位有年付和月付两种方式）：
 * - 年付：年度总价，每月发放对应积分，性价比最高
 * - 月付：月度价格，每月发放对应积分，灵活但较贵
 *
 * 积分充值包（3种用户等级差异化定价）：
 * - Free用户：基准价或小幅折扣
 * - 月付订阅用户（monthly_subscriber）：中等价格
 * - 年付订阅用户（yearly_subscriber）：优惠价格，鼓励长期订阅
 *
 * 核心原则：
 * 1. 年付订阅成本 < 月付订阅 < 充值包（鼓励长期订阅）
 * 2. 订阅用户的充值包价格 < Free用户（订阅有额外价值）
 * 3. 高档位有更好的性价比（鼓励升级）
 */

import type { ProductType, SubscriptionInterval } from '@markless/shared/src/lib/payments'
import { getEnv } from '@markless/shared/src/lib/config/env'

/** 基础产品配置 */
export interface BaseProduct {
    id: string
    type: ProductType
    name: string
    description?: string
    price: number
    currency: string
    isActive: boolean
}

/** 订阅产品配置 */
export interface SubscriptionProduct extends BaseProduct {
    type: 'subscription'
    tierName: string          // 套餐层级名称（如 "Starter", "Pro"）
    interval: SubscriptionInterval
    creditsPerPeriod: number  // 每周期发放的积分
    features: string[]        // 功能列表
    discountRate: number      // 折扣率（相对于基准价$0.1/积分）
}

/** 充值产品配置 */
export interface CreditPackage extends BaseProduct {
    type: 'one_time'
    credits: number           // 积分数量
    bonusCredits: number      // 赠送积分
    badge?: string            // 标签（如 "POPULAR", "BEST VALUE"）
    // 差异化定价（按用户等级）
    pricing: {
        free: number                    // Free用户价格
        monthly_subscriber: number      // 月付订阅用户价格
        yearly_subscriber: number       // 年付订阅用户价格
    }
}

/** 所有产品类型 */
export type Product = SubscriptionProduct | CreditPackage

/**
 * 用户定价等级（用于充值包差异化定价）
 * - free: 无订阅用户，充值包价格最高（基准价或小幅折扣）
 * - monthly_subscriber: 月付订阅用户，充值包价格中等（任何档位的 monthly 订阅）
 * - yearly_subscriber: 年付订阅用户，充值包价格优惠（任何档位的 yearly 订阅）
 *
 * 注意：这是基于订阅周期的用户身份标识，不是套餐名称
 */
export type UserPricingTier = 'free' | 'monthly_subscriber' | 'yearly_subscriber'

// 功能列表常量 - 与 i18n-config.ts 保持一致
// 所有订阅计划共享的核心功能
const CORE_FEATURES = [
    'Authentication-ready user flows',
    'Payments and subscriptions foundation',
    'Realtime task infrastructure',
    'Admin and membership surfaces',
]

// 根据积分数生成功能列表
const getFeatures = (creditsPerMonth: number): string[] => {
    const parallelTasks = creditsPerMonth >= 5000 ? 5 : 3
    const estimatedVideoMinutes = Math.floor(creditsPerMonth / 30) // 30 credits/min
    const estimatedImages = Math.floor(creditsPerMonth / 2)        // 2 credits/image

    return [
        `${creditsPerMonth} minutes of transcription per month`,
        `Scales to ${parallelTasks} concurrent task workers`,
        `Supports ${estimatedVideoMinutes}+ runtime minutes of async processing`,
        `Supports ${estimatedImages}+ lightweight task executions`,
        `${parallelTasks} Parallel tasks`,
        ...CORE_FEATURES,
    ]
}

/** 订阅计划列表 - 3 个档位，每个档位有年付和月付 */
export const subscriptionPlans: SubscriptionProduct[] = [
    // 第一档位：800积分/月 (Basic)
    {
        id: 'tier1:yearly',
        type: 'subscription',
        tierName: 'Basic',
        name: '800 Minutes of Transcription Yearly',
        description: 'Basic yearly plan at $5/mo billed yearly',
        price: 60,
        currency: 'USD',
        interval: 'year',
        creditsPerPeriod: 9600,
        discountRate: 0.10,
        features: getFeatures(800),
        isActive: true,
    },
    {
        id: 'tier1:monthly',
        type: 'subscription',
        tierName: 'Basic',
        name: '800 Minutes of Transcription Monthly',
        description: 'Basic monthly plan with 800 minutes of transcription every month',
        price: 9,
        currency: 'USD',
        interval: 'month',
        creditsPerPeriod: 800,
        discountRate: 0.18,
        features: getFeatures(800),
        isActive: true,
    },

    // 第二档位：2000积分/月 (Standard)
    {
        id: 'tier2:yearly',
        type: 'subscription',
        tierName: 'Standard',
        name: '2000 Minutes of Transcription Yearly',
        description: 'Standard yearly plan at $10/mo billed yearly',
        price: 120,
        currency: 'USD',
        interval: 'year',
        creditsPerPeriod: 24000,
        discountRate: 0.10,
        features: getFeatures(2000),
        isActive: true,
    },
    {
        id: 'tier2:monthly',
        type: 'subscription',
        tierName: 'Standard',
        name: '2000 Minutes of Transcription Monthly',
        description: 'Standard monthly plan with 2000 minutes of transcription every month',
        price: 18,
        currency: 'USD',
        interval: 'month',
        creditsPerPeriod: 2000,
        discountRate: 0.09,
        features: getFeatures(2000),
        isActive: true,
    },

    // 第三档位：6000积分/月 (Pro)
    {
        id: 'tier3:yearly',
        type: 'subscription',
        tierName: 'Pro',
        name: '6000 Minutes of Transcription Yearly',
        description: 'Pro yearly plan at $20/mo billed yearly',
        price: 240,
        currency: 'USD',
        interval: 'year',
        creditsPerPeriod: 72000,
        discountRate: 0.10,
        features: getFeatures(6000),
        isActive: true,
    },
    {
        id: 'tier3:monthly',
        type: 'subscription',
        tierName: 'Pro',
        name: '6000 Minutes of Transcription Monthly',
        description: 'Pro monthly plan with 6000 minutes of transcription every month',
        price: 36,
        currency: 'USD',
        interval: 'month',
        creditsPerPeriod: 6000,
        discountRate: 0.06,
        features: getFeatures(6000),
        isActive: true,
    },

    // 第七档位：10000积分/月 (暂时禁用 - 未在 Creem 中配置)
    {
        id: 'tier7:yearly',
        type: 'subscription',
        tierName: 'Enterprise',
        name: '10000 Minutes of Transcription Yearly',
        description: 'Enterprise yearly plan at $166/mo billed yearly (Save $600/year)',
        price: 1992, // $166 * 12
        currency: 'USD',
        interval: 'year',
        creditsPerPeriod: 120000, // 10000 * 12
        discountRate: 0.834,
        features: getFeatures(10000),
        isActive: false, // 暂时禁用
    },
    {
        id: 'tier7:monthly',
        type: 'subscription',
        tierName: 'Enterprise',
        name: '10000 Minutes of Transcription Monthly',
        description: 'Enterprise monthly plan with 10000 minutes of transcription every month',
        price: 216,
        currency: 'USD',
        interval: 'month',
        creditsPerPeriod: 10000,
        discountRate: 0.784,
        features: getFeatures(10000),
        isActive: false, // 暂时禁用
    },

    // 第八档位：20000积分/月 (暂时禁用 - 未在 Creem 中配置)
    {
        id: 'tier8:yearly',
        type: 'subscription',
        tierName: 'Ultimate',
        name: '20000 Minutes of Transcription Yearly',
        description: 'Ultimate yearly plan at $296/mo billed yearly (Save $1068/year)',
        price: 3552, // $296 * 12
        currency: 'USD',
        interval: 'year',
        creditsPerPeriod: 240000, // 20000 * 12
        discountRate: 0.852,
        features: getFeatures(20000),
        isActive: false, // 暂时禁用
    },
    {
        id: 'tier8:monthly',
        type: 'subscription',
        tierName: 'Ultimate',
        name: '20000 Minutes of Transcription Monthly',
        description: 'Ultimate monthly plan with 20000 minutes of transcription every month',
        price: 385,
        currency: 'USD',
        interval: 'month',
        creditsPerPeriod: 20000,
        discountRate: 0.8075,
        features: getFeatures(20000),
        isActive: false, // 暂时禁用
    },
]

/** 积分充值包列表（一次性购买） */
export const creditPackages: CreditPackage[] = [
    {
        id: 'credit_pack_800',
        type: 'one_time',
        name: '800 Minutes of Transcription',
        description: 'One-time purchase of 800 minutes of transcription',
        price: 15,
        currency: 'USD',
        credits: 800,
        bonusCredits: 0,
        pricing: {
            free: 15,
            monthly_subscriber: 15,
            yearly_subscriber: 15,
        },
        isActive: true,
    },
    {
        id: 'credit_pack_2000',
        type: 'one_time',
        name: '2000 Minutes of Transcription',
        description: 'One-time purchase of 2000 minutes of transcription',
        price: 30,
        currency: 'USD',
        credits: 2000,
        bonusCredits: 0,
        pricing: {
            free: 30,
            monthly_subscriber: 30,
            yearly_subscriber: 30,
        },
        isActive: true,
    },
]

/** 所有产品列表（统一） */
export const allProducts: Product[] = [
    ...subscriptionPlans,
    ...creditPackages,
]

/**
 * 根据产品ID和用户等级获取价格
 */
export function getProductPrice(
    productId: string,
    userPlan: UserPricingTier = 'free'
): number {
    const product = allProducts.find(p => p.id === productId)
    if (!product) return 0

    // 订阅产品价格固定
    if (product.type === 'subscription') {
        return product.price
    }

    // 充值包根据用户等级返回差异化价格
    return product.pricing[userPlan]
}

/**
 * 根据产品ID查找产品
 */
export function getProductById(productId: string): Product | null {
    return allProducts.find(p => p.id === productId) || null
}

/**
 * 获取 Creem 产品映射（从环境变量）
 */
function getCreemProductMapping(): Record<string, string> {
    if (typeof window !== 'undefined') {
        // 客户端：无法访问环境变量，返回空对象
        return {}
    }

    const envProducts = getEnv("CREEM_SUBSCRIPTIONS")
    if (!envProducts) return {}

    try {
        return JSON.parse(envProducts)
    } catch (error) {
        console.error('Failed to parse Creem products:', error)
        return {}
    }
}

/**
 * 获取所有活跃的订阅计划
 * 只返回在 Creem 中已配置的计划（服务器端会过滤）
 */
export function getActiveSubscriptionPlans(): SubscriptionProduct[] {
    const activePlans = subscriptionPlans.filter(p => p.isActive)

    // 服务器端：过滤掉未配置 Creem 产品 ID 的计划
    if (typeof window === 'undefined' && getEnv("CREEM_ENABLED") === 'true') {
        const creemMapping = getCreemProductMapping()
        if (Object.keys(creemMapping).length > 0) {
            return activePlans.filter(plan => creemMapping[plan.id])
        }
    }

    return activePlans
}

/**
 * 获取所有活跃的充值包（根据用户等级）
 */
export function getActiveCreditPackages(
    userPlan: UserPricingTier = 'free'
): Array<CreditPackage & { adjustedPrice: number }> {
    return creditPackages
        .filter(p => p.isActive)
        .map(pkg => ({
            ...pkg,
            adjustedPrice: pkg.pricing[userPlan],
        }))
}

/**
 * 计算充值包的折扣率
 */
export function calculateDiscountRate(
    credits: number,
    price: number
): number {
    const basePrice = credits * 0.1 // $0.1/credit
    return Math.round(((basePrice - price) / basePrice) * 100)
}

/**
 * 获取用户的订阅等级（用于定价）
 * - free: 无订阅用户
 * - monthly_subscriber: 月付订阅用户（任何档位的monthly计划）
 * - yearly_subscriber: 年付订阅用户（任何档位的yearly计划）
 */
export function getUserPricingTier(
    subscriptionPlanId: string | null
): UserPricingTier {
    if (!subscriptionPlanId) return 'free'
    if (subscriptionPlanId.endsWith(':monthly')) return 'monthly_subscriber'
    if (subscriptionPlanId.endsWith(':yearly')) return 'yearly_subscriber'
    return 'free'
}

/**
 * 计算年付节省的金额
 */
export function calculateYearlySavings(
    monthlyPrice: number,
    yearlyPrice: number
): number {
    return monthlyPrice * 12 - yearlyPrice
}

/**
 * 获取订阅计划的月度等价价格
 */
export function getMonthlyEquivalentPrice(plan: SubscriptionProduct): number {
    if (plan.interval === 'month') {
        return plan.price
    }
    // 年付计划，返回月度等价价格
    return plan.price / 12
}
