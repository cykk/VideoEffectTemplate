/**
 * 邮件模板统一颜色常量
 *
 * 邮件客户端不支持 CSS 变量，因此必须使用内联样式。
 * 将所有颜色集中在此处，便于统一管理和品牌一致性。
 */
export const emailColors = {
    // 基础色
    background: '#FFFFFF',
    foreground: '#0F172A',

    // 品牌色
    primary: '#0C7A7C',         // brand-600 (Teal)
    primaryDark: '#26676A',     // brand-700 (Teal)

    // 中性色
    muted: '#64748B',           // slate-500
    mutedLight: '#94A3B8',      // slate-400
    border: '#E2E8F0',          // slate-200

    // 功能色
    warning: '#FBBF24',         // amber-400
    warningBg: 'rgba(245, 158, 11, 0.1)',
    warningBorder: 'rgba(245, 158, 11, 0.2)',

    // 按钮
    buttonGradient: 'linear-gradient(135deg, #39A5AD 0%, #0C7A7C 100%)',
    buttonText: '#FFFFFF',
    buttonBorder: '1px solid rgba(255,255,255,0.1)',
    buttonShadow: '0 8px 20px -6px rgba(12, 122, 124, 0.4)',
} as const;
