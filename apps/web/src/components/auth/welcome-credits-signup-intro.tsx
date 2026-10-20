import { Gift } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";

interface WelcomeCreditsSignupIntroProps {
  badgeLabel?: string;
  offerHighlight?: string;
  offerSuffix?: string;
  subtext?: string;
  noCreditCardHint?: string;
  variant?: "default" | "prominent" | "offer";
  className?: string;
}

function WelcomeCreditsBadge({
  badgeLabel,
  size = "default",
}: {
  badgeLabel: string;
  size?: "default" | "prominent";
}) {
  const isProminent = size === "prominent";

  return (
    <div
      className={cn(
        "animate-fade-in inline-flex items-center rounded-full border border-primary/15 bg-primary/10 motion-reduce:animate-none",
        isProminent
          ? "gap-2 border-primary/20 bg-primary/12 px-4 py-2.5"
          : "gap-1.5 px-3.5 py-1.5",
      )}
      role="status"
    >
      <Gift
        className={cn("shrink-0 text-primary", isProminent ? "size-5" : "size-4")}
        aria-hidden="true"
      />
      <span
        className={cn(
          "font-semibold tracking-tight text-primary",
          isProminent ? "text-base font-bold sm:text-lg" : "text-sm",
        )}
      >
        {badgeLabel}
      </span>
    </div>
  );
}

export function WelcomeCreditsSignupIntro({
  badgeLabel,
  offerHighlight,
  offerSuffix,
  subtext,
  noCreditCardHint,
  variant = "default",
  className,
}: WelcomeCreditsSignupIntroProps) {
  if (variant === "offer") {
    if (!offerHighlight) {
      return null;
    }

    return (
      <p
        className={cn(
          "mx-auto max-w-[320px] text-center text-sm leading-relaxed",
          className,
        )}
      >
        <span className="font-semibold text-primary">{offerHighlight}</span>
        {offerSuffix ? (
          <span className="text-slate-500">{offerSuffix}</span>
        ) : null}
      </p>
    );
  }

  if (!badgeLabel) {
    return null;
  }

  const isProminent = variant === "prominent";

  return (
    <div
      className={cn(
        "mx-auto flex max-w-[280px] flex-col items-center",
        isProminent ? "gap-2" : "gap-2.5",
        className,
      )}
    >
      <WelcomeCreditsBadge
        badgeLabel={badgeLabel}
        size={isProminent ? "prominent" : "default"}
      />
      {subtext ? (
        <p className="text-sm leading-relaxed text-slate-500">{subtext}</p>
      ) : null}
      {noCreditCardHint ? (
        <p className="text-xs text-slate-500">{noCreditCardHint}</p>
      ) : null}
    </div>
  );
}
