"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@markless/shared/src/lib/utils";

type TranscriptExampleLine = {
  timestamp: string;
  speaker: string;
  text: string;
};

interface TranscriptExampleSectionProps {
  title: string;
  previewLabel: string;
  intro: string[];
  lines: TranscriptExampleLine[];
  closing: string;
  ctaText?: string;
  className?: string;
}

export function TranscriptExampleSection({
  title,
  previewLabel,
  intro,
  lines,
  closing,
  ctaText,
  className,
}: TranscriptExampleSectionProps) {
  const scrollToUpload = () => {
    document.getElementById("upload")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <section className={cn("border-t border-slate-200/60 px-4 py-20 sm:px-6 lg:px-8", className)}>
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h2>
          <div className="mx-auto mt-4 max-w-3xl space-y-4">
            {intro.map((paragraph) => (
              <p key={paragraph} className="text-base leading-7 text-slate-600 sm:text-lg">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
              {previewLabel}
            </p>
          </div>
          <div className="space-y-4 px-4 py-5 font-mono text-sm leading-7 sm:px-6 sm:py-6">
            {lines.map((line) => (
              <p key={`${line.timestamp}-${line.speaker}`} className="text-slate-100">
                <span className="text-emerald-400">[{line.timestamp}]</span>{" "}
                <span className="font-semibold text-white">{line.speaker}</span>
                <br />
                <span className="text-slate-300">{line.text}</span>
              </p>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          {closing}
        </p>

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
