"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface RainbowButtonProps {
    href: string;
    children: ReactNode;
}

export function RainbowButton({ href, children }: RainbowButtonProps) {
    const isAnchor = href.startsWith("#");
    const Tag = isAnchor ? "a" : Link;

    return (
        <Tag
            href={href}
            className="group/cta relative inline-flex items-center justify-center
                px-8 py-3.5 rounded-full
                font-semibold text-base text-slate-800
                bg-white/95 backdrop-blur-sm
                transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-lg hover:shadow-brand-500/20"
        >
            {/* 1. Underlying Glow: Expands and brightens on hover */}
            <span className="absolute -inset-1 rounded-full blur-xl bg-gradient-to-r from-emerald-300 via-sky-300 to-indigo-400 opacity-20 group-hover/cta:opacity-100 group-hover/cta:blur-2xl transition-all duration-500 ease-out -z-10" />

            {/* 2. Colorful Border: Refined to 1.5px and scales on hover */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 p-[1.5px] transition-transform duration-500 z-10 group-hover/cta:scale-[1.01]">
                
                {/* 3. Button Surface Layer: Slightly off-white internally so the pure-white shimmer contrasts */}
                <span className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-50/95 shadow-inner overflow-hidden">
                    
                    {/* Glass Shimmer Sweep on Hover (Skewed solid white band) */}
                    <span className="absolute inset-0 -translate-x-[150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white to-transparent w-full opacity-0 group-hover/cta:opacity-100 group-hover/cta:animate-shimmer transition-opacity duration-300" />
                </span>
            </span>

            {/* Content Component */}
            <span className="relative z-20 flex items-center gap-2 drop-shadow-sm transition-transform duration-300 group-hover/cta:scale-[1.02]">
                {children}
            </span>
        </Tag>
    );
}



