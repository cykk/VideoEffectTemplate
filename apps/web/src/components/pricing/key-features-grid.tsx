"use client";

import type { ReactNode } from "react";
import { cn } from "@markless/shared/src/lib/utils";

interface KeyFeature {
  icon: ReactNode;
  title: string;
  description: string;
}

interface KeyFeaturesGridProps {
  className?: string;
  title?: string;
  subtitle?: string;
  features?: KeyFeature[];
}

export function KeyFeaturesGrid({
  className,
  title,
  subtitle,
  features = [],
}: KeyFeaturesGridProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="text-center mb-12">
        {title ? (
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="text-lg text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-6xl mx-auto">
        {features.map((feature, index) => (
          <div
            key={index}
            className="group flex flex-col items-center text-center p-6 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          >
            <div className="mb-4 p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
              {feature.icon}
            </div>
            <h3 className="font-semibold text-sm mb-2 text-foreground">
              {feature.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
