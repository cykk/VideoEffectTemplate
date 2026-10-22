"use client";

import { useEffect, useState } from "react";
import type { RaindanceHomeDictionary } from "@markless/shared/src/i18n/types";
import { cn } from "@markless/shared/src/lib/utils";
import { fillTemplate, formatPrice, type CreditPackInfo } from "./lib/format";
import { fetchRaindanceConfig } from "./lib/raindance-api";

interface PricingSummaryProps {
  dictionary: RaindanceHomeDictionary["pricing"];
  packs: CreditPackInfo[];
}

/** 价格摘要：让用户在点生成之前就知道要付费，以及每条视频消耗多少积分。 */
export function PricingSummary({ dictionary, packs }: PricingSummaryProps) {
  const [cost, setCost] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetchRaindanceConfig().then((config) => {
      if (active) setCost(config.credits);
    });
    return () => {
      active = false;
    };
  }, []);

  const popularId = packs.length > 1 ? packs[packs.length - 1].id : null;

  return (
    <section className="border-t border-slate-200 bg-slate-50/70" aria-labelledby="raindance-pricing">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 id="raindance-pricing" className="text-center text-2xl font-semibold text-slate-900">
          {dictionary.title}
        </h2>
        {cost ? (
          <p className="mt-2 text-center text-sm text-slate-600">{fillTemplate(dictionary.description, { credits: cost })}</p>
        ) : null}
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {packs.map((pack) => (
            <li
              key={pack.id}
              className={cn(
                "rounded-2xl border bg-white p-4",
                pack.id === popularId ? "border-primary ring-1 ring-primary" : "border-slate-200",
              )}
            >
              {pack.id === popularId ? <p className="mb-1 text-xs font-medium text-primary">{dictionary.popular}</p> : null}
              <p className="text-lg font-semibold text-slate-900">{fillTemplate(dictionary.pack, { credits: pack.credits })}</p>
              {cost ? (
                <p className="text-sm text-slate-600">
                  {fillTemplate(dictionary.packVideos, { videos: Math.max(1, Math.floor(pack.credits / cost)) })}
                </p>
              ) : null}
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPrice(pack.price, pack.currency)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 text-center">
          <a
            href="#raindance-generator"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white"
          >
            {dictionary.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
