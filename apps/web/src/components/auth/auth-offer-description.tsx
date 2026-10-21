import { cn } from "@markless/shared/src/lib/utils";

type AuthOfferDescriptionProps = {
  description: string;
  className?: string;
};

export function AuthOfferDescription({
  description,
  className,
}: AuthOfferDescriptionProps) {
  return (
    <p
      className={cn(
        "leading-relaxed text-slate-500 [&_strong]:font-semibold [&_strong]:text-primary",
        className
      )}
    >
      {description}
    </p>
  );
}
