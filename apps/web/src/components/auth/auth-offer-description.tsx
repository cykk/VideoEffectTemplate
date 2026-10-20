import { cn } from "@markless/shared/src/lib/utils";

function highlightFreeTierDescription(description: string): string {
  return description
    .replace(/(\d+)\s+free\s+transcriptions/g, "<strong>$1 free transcriptions</strong>")
    .replace(/(\d+)\s+minutes/g, "<strong>$1 minutes</strong>");
}

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
      dangerouslySetInnerHTML={{
        __html: highlightFreeTierDescription(description),
      }}
    />
  );
}
