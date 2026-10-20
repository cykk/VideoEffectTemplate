import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@markless/shared/src/lib/utils";
import type { MarketingToolLabelKey } from "@/lib/marketing/tools-nav";

export interface MarketingExploreToolCardItem {
  label: string;
}

interface MarketingExploreToolsSectionProps {
  title: string;
  items: Record<MarketingToolLabelKey, MarketingExploreToolCardItem>;
  cards: Array<{
    key: MarketingToolLabelKey;
    href: string;
  }>;
  className?: string;
}

export function MarketingExploreToolsSection({
  title,
  items,
  cards,
  className,
}: MarketingExploreToolsSectionProps) {
  return (
    <section
      className={cn(
        "border-t border-slate-200/60 px-4 py-16 sm:px-6 lg:px-8 lg:py-20",
        className,
      )}
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h2>
        </div>

        <nav className="mt-10" aria-label={title}>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {cards.map((card) => {
              const item = items[card.key];

              return (
                <li key={card.key}>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 w-full rounded-full border border-primary bg-white px-4 text-sm font-semibold text-primary shadow-sm transition-all duration-200 hover:border-primary hover:bg-primary hover:text-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98] active:bg-primary/90"
                  >
                    <Link href={card.href}>{item.label}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </section>
  );
}
