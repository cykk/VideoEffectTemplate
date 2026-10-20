/**
 * 国际化价格配置文件（滑动选择器模式）
 *
 * 架构说明：
 * 1. 价格数据从 src/lib/products/config.ts 导入（单一数据源）
 * 2. 支持 3 个积分档位的滑动选择
 * 3. 每个档位有年付和月付两种方式
 *
 * 维护说明：
 * - 调整价格：修改 src/lib/products/config.ts
 * - 更新汇率：修改 EXCHANGE_RATES（如需多货币支持）
 * - 添加新语言：在国际化配置中添加对应语言
 */

import { getPricingCopy } from "@markless/shared/src/i18n/components/pricing";
import { type Locale } from "@markless/shared/src/i18n/types";
import { getMonthlyEquivalentPrice, subscriptionPlans } from "@markless/shared/src/lib/products/config";

const FALLBACK_LOCALE: Locale = "en";

export type PricingPeriod = 'one-time' | 'monthly' | 'yearly';

/** 积分档位 */
export interface CreditTier {
  id: string;
  credits: number;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyMonthlyEquivalent: number; // 年付的月度等价价格
  features: string[];
  discount: number; // 年付相对月付的折扣百分比
  badge?: string; // 标签（如 "POPULAR", "BEST VALUE"）
}

/** 滑动选择器配置 */
export interface SliderPricingConfig {
  currency: string;
  tiers: CreditTier[];
  billingCycles: {
    monthly: {
      label: string;
      description: string;
    };
    yearly: {
      label: string;
      description: string;
    };
  };
}

// 兼容旧接口
export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  limitations?: string[];
  popular?: boolean;
  pricing: {
    [K in PricingPeriod]: {
      price: number;
      currency: string;
      period: string;
      originalPrice?: number;
      discount?: number;
    };
  };
}

export interface PricingConfig {
  currency: string;
  plans: PricingPlan[];
  billingCycles: {
    [K in PricingPeriod]: {
      label: string;
      description: string;
      discount?: string;
    };
  };
}

// ============================================================================
// 积分档位配置（从 config.ts 导入，确保单一数据源）
// ============================================================================

// 积分档位配置（与 config.ts 中活跃订阅计划一致）
const TIER_CONFIGS = [
  { tierId: 'tier1', credits: 800, badge: undefined },
  { tierId: 'tier2', credits: 2000, badge: 'POPULAR' },
  { tierId: 'tier3', credits: 6000, badge: undefined },
  { tierId: 'tier7', credits: 10000, badge: 'PRO' },
  { tierId: 'tier8', credits: 20000, badge: 'ULTIMATE' },
] as const;

/**
 * 生成积分档位数据
 * 只包含在 subscriptionPlans 中存在的档位（自动过滤未配置的计划）
 */
function generateCreditTiers(): CreditTier[] {
  // 统一使用 isActive 过滤，确保服务器端和客户端一致
  // 避免 Hydration Error
  const activePlans = subscriptionPlans.filter(p => p.isActive);

  return TIER_CONFIGS
    .map(({ tierId, credits, badge }) => {
      const monthlyPlan = activePlans.find(p => p.id === `${tierId}:monthly`);
      const yearlyPlan = activePlans.find(p => p.id === `${tierId}:yearly`);

      // 如果月付或年付计划任一缺失，跳过该档位
      if (!monthlyPlan || !yearlyPlan) {
        if (typeof window === 'undefined') {
          console.warn(`[PricingConfig] Tier ${tierId} is incomplete (monthly: ${!!monthlyPlan}, yearly: ${!!yearlyPlan}). Skipping.`);
        }
        return null;
      }

      const monthlyPrice = monthlyPlan.price;
      const yearlyPrice = yearlyPlan.price;
      const yearlyMonthlyEquivalent = getMonthlyEquivalentPrice(yearlyPlan);
      const discount = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

      return {
        id: tierId,
        credits,
        monthlyPrice,
        yearlyPrice,
        yearlyMonthlyEquivalent,
        features: monthlyPlan.features,
        discount,
        badge,
      };
    })
    .filter((tier) => tier !== null) as CreditTier[];
}

// ============================================================================
// 汇率配置（统一使用 USD）
// ============================================================================

type Currency = 'USD';

// ============================================================================
// 订阅周期配置（按语言）
// ============================================================================

function getLocalizedBillingCycles(locale: Locale) {
  const { billingCycles } = getPricingCopy(locale);

  return {
    oneTime: billingCycles.oneTime,
    monthly: billingCycles.monthly,
    yearly: billingCycles.yearly,
  };
}

// ============================================================================
// 货币映射（语言 -> 货币）
// ============================================================================

const LOCALE_TO_CURRENCY: Record<Locale, Currency> = {
  en: 'USD',
};

// ============================================================================
// 价格转换工具函数
// ============================================================================

/**
 * 将 USD 价格转换为目标货币（当前统一返回 USD）
 */
function convertPrice(usdPrice: number, _currency: Currency): number {
  return usdPrice;
}

/**
 * 生成滑动选择器配置（新版）
 */
function generateSliderPricingConfig(locale: Locale): SliderPricingConfig {
  const currency = LOCALE_TO_CURRENCY[locale];
  const billingCycles = getLocalizedBillingCycles(locale);
  const tiers = generateCreditTiers();

  return {
    currency,
    tiers,
    billingCycles,
  };
}

/**
 * 生成指定语言的完整价格配置（兼容旧版接口）
 */
function generatePricingConfig(locale: Locale): PricingConfig {
  const currency = LOCALE_TO_CURRENCY[locale];
  const billingCycles = getLocalizedBillingCycles(locale);
  const tiers = generateCreditTiers();

  // 为了兼容性，返回 tier2 和 tier3 作为两个计划
  const tier2 = tiers.find((t) => t.id === 'tier2')!;
  const tier3 = tiers.find((t) => t.id === 'tier3')!;

  return {
    currency,
    billingCycles: {
      'one-time': billingCycles.oneTime,
      'monthly': billingCycles.monthly,
      'yearly': billingCycles.yearly,
    },
    plans: [
      // Pro Plan (6000 credits)
      {
        id: 'pro',
        name: 'Pro',
        description: 'Premium plan for power users',
        features: tier3.features,
        limitations: [],
        popular: true,
        pricing: {
          'one-time': {
            price: 0,
            currency,
            period: 'N/A'
          },
          'monthly': {
            price: convertPrice(tier3.monthlyPrice, currency),
            currency,
            period: '/month'
          },
          'yearly': {
            price: convertPrice(tier3.yearlyMonthlyEquivalent, currency),
            currency,
            period: '/month',
            originalPrice: convertPrice(tier3.monthlyPrice, currency),
            discount: tier3.discount
          }
        }
      },
      // Starter Plan (1000 credits)
      {
        id: 'starter',
        name: 'Starter',
        description: 'Perfect for individuals getting started',
        features: tier2.features,
        limitations: [],
        popular: false,
        pricing: {
          'one-time': {
            price: 0,
            currency,
            period: 'N/A'
          },
          'monthly': {
            price: convertPrice(tier2.monthlyPrice, currency),
            currency,
            period: '/month'
          },
          'yearly': {
            price: convertPrice(tier2.yearlyMonthlyEquivalent, currency),
            currency,
            period: '/month',
            originalPrice: convertPrice(tier2.monthlyPrice, currency),
            discount: tier2.discount
          }
        }
      }
    ]
  };
}

// ============================================================================
// 导出的价格配置
// ============================================================================

// 滑动选择器配置（新版）
export const sliderPricingConfigs: Partial<Record<Locale, SliderPricingConfig>> = {
  en: generateSliderPricingConfig('en'),
};

const fallbackSliderPricingConfig = sliderPricingConfigs[FALLBACK_LOCALE]!;

// 旧版配置（兼容性）
export const pricingConfigs: Partial<Record<Locale, PricingConfig>> = {
  en: generatePricingConfig('en'),
};

const fallbackPricingConfig = pricingConfigs[FALLBACK_LOCALE]!;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取滑动选择器配置（推荐使用）
 */
export function getSliderPricingConfig(locale: Locale): SliderPricingConfig {
  return sliderPricingConfigs[locale] ?? fallbackSliderPricingConfig;
}

/**
 * 获取指定语言的价格配置（兼容旧版）
 */
export function getPricingConfig(locale: Locale): PricingConfig {
  return pricingConfigs[locale] ?? fallbackPricingConfig;
}

/**
 * 获取指定周期的价格
 */
export function getPricingForPeriod(planId: string, period: PricingPeriod, locale: Locale = 'en') {
  const config = getPricingConfig(locale);
  const plan = config.plans.find(p => p.id === planId);
  return plan?.pricing[period];
}

/**
 * 获取所有周期的价格
 */
export function getAllPricingForPlan(planId: string, locale: Locale = 'en') {
  const config = getPricingConfig(locale);
  const plan = config.plans.find(p => p.id === planId);
  return plan?.pricing;
}

/**
 * 获取推荐的价格周期（年付优先）
 */
export function getRecommendedPeriod(): PricingPeriod {
  return 'yearly';
}

/**
 * 格式化价格显示（统一使用 USD 格式）
 */
export function formatPrice(price: number, _currency: string): string {
  const symbol = '$';

  // 根据是否有小数决定显示格式
  if (price % 1 === 0) {
    return `${symbol}${price.toLocaleString()} USD`;
  }

  return `${symbol}${price.toFixed(2)} USD`;
}

/**
 * 获取价格周期标签
 */
export function getPeriodLabel(period: PricingPeriod, locale: Locale = 'en'): string {
  const config = getPricingConfig(locale);
  return config.billingCycles[period].label;
}

/**
 * 获取价格周期描述
 */
export function getPeriodDescription(period: PricingPeriod, locale: Locale = 'en'): string {
  const config = getPricingConfig(locale);
  return config.billingCycles[period].description;
}

/**
 * 计算年付相比月付的节省金额
 */
export function calculateYearlySavings(planId: string, locale: Locale = 'en'): number {
  const config = getPricingConfig(locale);
  const plan = config.plans.find(p => p.id === planId);

  if (!plan) return 0;

  const monthlyPrice = plan.pricing.monthly.price;
  const yearlyPrice = plan.pricing.yearly.price;

  return (monthlyPrice * 12) - yearlyPrice;
}

// ============================================================================
// 滑动选择器相关工具函数
// ============================================================================

/**
 * 获取指定档位的信息
 */
export function getCreditTier(tierId: string, locale: Locale = 'en'): CreditTier | undefined {
  const config = getSliderPricingConfig(locale);
  return config.tiers.find(t => t.id === tierId);
}

/**
 * 根据积分数量获取档位
 */
export function getCreditTierByCredits(credits: number, locale: Locale = 'en'): CreditTier | undefined {
  const config = getSliderPricingConfig(locale);
  return config.tiers.find(t => t.credits === credits);
}

/**
 * 获取所有档位列表
 */
export function getAllCreditTiers(locale: Locale = 'en'): CreditTier[] {
  const config = getSliderPricingConfig(locale);
  return config.tiers;
}

/**
 * 获取推荐的档位（第2档：2000积分）
 */
export function getRecommendedTier(locale: Locale = 'en'): CreditTier {
  const config = getSliderPricingConfig(locale);
  return config.tiers.find(t => t.credits === 2000) || config.tiers[1];
}

/**
 * 计算指定档位年付节省的金额
 */
export function calculateTierYearlySavings(tierId: string, locale: Locale = 'en'): number {
  const tier = getCreditTier(tierId, locale);
  if (!tier) return 0;
  return tier.monthlyPrice * 12 - tier.yearlyPrice;
}
