"use client";

import { Button } from "@/components/ui/button";

interface HowToUseStep {
  title: string;
  description: string;
}

interface HowToUseSectionProps {
  title: string;
  subtitle?: string;
  steps: HowToUseStep[];
  ctaText?: string;
}

export function HowToUseSection({
  title,
  subtitle,
  steps,
  ctaText,
}: HowToUseSectionProps) {
  const scrollToUpload = () => {
    document.getElementById("upload")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <section className="border-t border-slate-200/60 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {subtitle}
            </p>
          ) : null}
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
          {steps.map((step, index) => (
            <li key={step.title} className="h-full">
              <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
                <div
                  className="flex size-10 items-center justify-center rounded-full bg-primary/10"
                  aria-hidden="true"
                >
                  <span className="text-sm font-bold text-primary">{index + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
                  {step.title}
                </h3>
                <div className="mt-2 space-y-3 text-sm leading-6 text-slate-600">
                  {step.description.split("\n\n").map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ol>

        {ctaText ? (
          <div className="mt-10 flex justify-center">
            <Button
              size="lg"
              onClick={scrollToUpload}
              className="h-12 rounded-full px-8 text-base font-semibold sm:h-14 sm:px-10 sm:text-lg"
            >
              {ctaText}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
