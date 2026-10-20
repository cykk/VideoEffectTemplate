"use client";

import { cn } from "@markless/shared/src/lib/utils";

interface AuthButtonsProps {
    /**
     * 登录按钮文本
     */
    loginText: string;
    /**
     * 注册按钮文本
     */
    signUpText: string;
    /**
     * 登录按钮点击回调
     */
    onLoginClick: () => void;
    /**
     * 注册按钮点击回调
     */
    onSignUpClick: () => void;
    /**
     * 视觉变体
     * - dark: 深色背景
     * - light: 浅色背景
     */
    variant?: 'dark' | 'light';
    /**
     * 布局方向
     * - horizontal: 水平排列（默认）
     * - vertical: 垂直排列（移动端菜单）
     */
    layout?: 'horizontal' | 'vertical';
    /**
     * 自定义 className
     */
    className?: string;
    /**
     * 是否显示注册按钮
     */
    showSignUp?: boolean;
}

/**
 * 统一的登录/注册按钮组件
 *
 * 用于所有 Header 变体中未登录用户的操作按钮
 * 支持深色/浅色主题和水平/垂直布局
 */
export function AuthButtons({
    loginText,
    signUpText,
    onLoginClick,
    onSignUpClick,
    variant: _variant = 'dark',
    layout = 'horizontal',
    className,
    showSignUp = true,
}: AuthButtonsProps) {
    return (
        <div className={cn(
            "flex items-center",
            layout === 'horizontal' ? "gap-3" : "flex-col gap-2 w-full",
            className
        )}>
            <button
                onClick={onLoginClick}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg text-sm transition-all duration-200 cursor-pointer",
                    layout === 'vertical' && "w-full",
                        showSignUp
                            ? "px-4 py-2 font-medium text-slate-700 hover:text-primary hover:bg-primary/5"
                            : "bg-primary px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-primary/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                )}
            >
                {loginText}
            </button>
            {showSignUp && (
                <button
                    onClick={onSignUpClick}
                    className={cn(
                        "inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
                        layout === 'vertical' && "w-full"
                    )}
                >
                    {signUpText}
                </button>
            )}
        </div>
    );
}
