"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface DropdownItem {
    name: string;
    description: string;
    href: string;
    icon: LucideIcon;
}

interface NavDropdownProps {
    title: string;
    items: DropdownItem[];
}

/**
 * Header 导航下拉菜单组件
 * 
 * 功能：
 * - 鼠标悬停显示下拉菜单
 * - 精美的卡片式设计
 * - 图标 + 标题 + 描述
 * - 平滑动画效果
 * - 延迟关闭提升体验
 */
export function NavDropdown({ title, items }: NavDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        // 延迟关闭，提升用户体验
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 200);
    };

    // 清理定时器
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* 触发按钮 */}
            <button
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-foreground transition-all duration-200 py-2 px-3 rounded-lg hover:bg-slate-900/5"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {title}
                <ChevronDown
                    className={`w-4 h-4 transition-all duration-300 ${isOpen ? "rotate-180 text-foreground" : "text-slate-500"
                        }`}
                />
            </button>

            {/* 下拉菜单 */}
            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50">
                    <div
                        className="bg-card border-border rounded-xl shadow-2xl shadow-black/60 border overflow-hidden min-w-[360px] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                        <div className="p-2">
                            {items.map((item, index) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={index}
                                        href={item.href}
                                        className="flex items-start gap-3.5 p-4 rounded-xl hover:bg-slate-900/5 transition-all duration-200 group"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        {/* 图标 */}
                                        <div className="flex-shrink-0 p-2.5 bg-brand-100 rounded-xl group-hover:bg-brand-200 transition-all duration-200 ring-1 ring-brand-600/30 group-hover:ring-brand-600/40">
                                            <Icon className="w-5 h-5 text-brand-600 group-hover:text-brand-500 transition-colors" />
                                        </div>

                                        {/* 文本内容 */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-slate-800 group-hover:text-brand-600 mb-1 transition-colors">
                                                {item.name}
                                            </div>
                                            <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                {item.description}
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

