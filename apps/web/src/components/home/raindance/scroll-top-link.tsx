"use client";

import type { ReactNode } from "react";

/** 平滑滚回生成器；点击示例或收尾 CTA 时把用户带回上传格。 */
export function ScrollTopLink({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => document.getElementById("raindance-generator")?.scrollIntoView({ behavior: "smooth", block: "start" })}
    >
      {children}
    </button>
  );
}
