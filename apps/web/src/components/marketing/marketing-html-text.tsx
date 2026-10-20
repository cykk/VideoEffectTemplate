import { cn } from "@markless/shared/src/lib/utils";

type MarketingHtmlTextProps = {
  html: string;
  className?: string;
  as?: "p" | "span" | "div";
};

export function MarketingHtmlText({
  html,
  className,
  as: Component = "p",
}: MarketingHtmlTextProps) {
  return (
    <Component
      className={cn(
        "[&_strong]:font-semibold [&_strong]:text-slate-900",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
