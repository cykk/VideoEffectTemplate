"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePayment } from "@/hooks/use-payment";
import { cn } from "@markless/shared/src/lib/utils";
import type { RaindanceHomeDictionary } from "@markless/shared/src/i18n/types";
import { fillTemplate, formatPrice, type CreditPackInfo } from "./lib/format";
import { trackRaindance } from "./lib/track";

interface CreditsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: RaindanceHomeDictionary["gates"]["credits"];
  packs: CreditPackInfo[];
  /** 单次生成消耗的积分，未知时不展示可生成数量。 */
  cost: number | null;
  balance: number;
  /** 支付完成后回到首页的地址，包含照片令牌。 */
  resumePath: string;
}

/** 积分不足时的底部弹层：只给两个选项，选中后直接跳转支付，支付完成后回到首页自动续跑。 */
export function CreditsSheet({ open, onOpenChange, dictionary, packs, cost, balance, resumePath }: CreditsSheetProps) {
  const { createCheckout, isLoading } = usePayment();
  const [selected, setSelected] = useState<string | null>(null);
  const popularId = packs.length > 1 ? packs[packs.length - 1].id : null;
  const active = packs.find((pack) => pack.id === (selected ?? popularId ?? packs[0]?.id)) ?? null;

  const handlePay = async () => {
    if (!active) return;
    trackRaindance("raindance_checkout_start", { product_id: active.id });
    await createCheckout(active.id, { entrySurface: "raindance_credits_sheet", returnTo: resumePath });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[10021] max-h-[92dvh] gap-0 overflow-y-auto rounded-t-2xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2"
      >
        <SheetHeader className="px-0 pr-8">
          <SheetTitle className="text-lg">{dictionary.title}</SheetTitle>
          <SheetDescription>
            {cost ? fillTemplate(dictionary.description, { credits: cost }) : dictionary.description.replace(/\{credits\}\s*/, "")}
          </SheetDescription>
          <p className="text-xs text-muted-foreground">{fillTemplate(dictionary.balance, { credits: balance })}</p>
        </SheetHeader>

        <div className="grid gap-3 py-3" role="radiogroup" aria-label={dictionary.title}>
          {packs.map((pack) => {
            const isActive = active?.id === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setSelected(pack.id)}
                className={cn(
                  "relative flex min-h-16 cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                  isActive ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border bg-card hover:bg-muted",
                )}
              >
                <span>
                  <span className="block text-base font-semibold text-foreground">
                    {fillTemplate(dictionary.pack, { credits: pack.credits })}
                  </span>
                  {cost ? (
                    <span className="block text-sm text-muted-foreground">
                      {fillTemplate(dictionary.packVideos, { videos: Math.max(1, Math.floor(pack.credits / cost)) })}
                    </span>
                  ) : null}
                </span>
                <span className="text-right">
                  {pack.id === popularId ? (
                    <span className="mb-1 block text-xs font-medium text-primary">{dictionary.popular}</span>
                  ) : null}
                  <span className="text-lg font-semibold text-foreground">{formatPrice(pack.price, pack.currency)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!active || isLoading}
          onClick={() => void handlePay()}
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {isLoading
            ? dictionary.redirecting
            : active
              ? fillTemplate(dictionary.pay, { price: formatPrice(active.price, active.currency) })
              : null}
        </button>
      </SheetContent>
    </Sheet>
  );
}
