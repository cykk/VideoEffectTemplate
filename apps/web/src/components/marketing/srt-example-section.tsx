"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@markless/shared/src/lib/utils";

type SrtExampleCue = {
  index: string;
  timecode: string;
  text: string;
};

interface SrtExampleSectionProps {
  title: string;
  intro: string[];
  audioExampleLabel: string;
  audioQuote: string;
  srtPreviewLabel: string;
  cues: SrtExampleCue[];
  afterSrtParagraphs: string[];
  ctaText?: string;
  className?: string;
}

export function SrtExampleSection({
  title,
  intro,
  audioExampleLabel,
  audioQuote,
  srtPreviewLabel,
  cues,
  afterSrtParagraphs,
  ctaText,
  className,
}: SrtExampleSectionProps) {
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
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
          <div className="mx-auto mt-4 max-w-3xl space-y-4">
            {intro.map((paragraph) => (
              <p key={paragraph} className="text-base leading-7 text-slate-600 sm:text-lg">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-6">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              {audioExampleLabel}
            </h3>
            <blockquote className="mt-3 border-l-4 border-brand-600/40 pl-4 text-base italic leading-7 text-slate-700 sm:text-lg">
              {audioQuote}
            </blockquote>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
                {srtPreviewLabel}
              </p>
            </div>
            <div className="space-y-6 px-4 py-5 font-mono text-sm leading-7 sm:px-6 sm:py-6">
              {cues.map((cue) => (
                <div key={`${cue.index}-${cue.timecode}`} className="space-y-1">
                  <p className="text-slate-400">{cue.index}</p>
                  <p className="text-emerald-400">{cue.timecode}</p>
                  <p className="text-slate-100">{cue.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-3xl space-y-4">
          {afterSrtParagraphs.map((paragraph) => (
            <p key={paragraph} className="text-base leading-7 text-slate-600 sm:text-lg">
              {paragraph}
            </p>
          ))}
        </div>

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
