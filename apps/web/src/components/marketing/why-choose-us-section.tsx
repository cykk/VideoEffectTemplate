import {
  FileDown,
  Languages,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { MarketingRichTextBlock } from "@/components/marketing/marketing-rich-text-block";

const FEATURE_ICONS: LucideIcon[] = [Languages, Sparkles, Shield, FileDown];

interface WhyChooseUsItem {
  title: string;
  description?: string;
  paragraphs?: string[];
  bulletsIntro?: string;
  bullets?: string[];
  closingParagraphs?: string[];
}

interface WhyChooseUsSectionProps {
  title: string;
  subtitle?: string;
  items: WhyChooseUsItem[];
}

export function WhyChooseUsSection({ title, subtitle, items }: WhyChooseUsSectionProps) {
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

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:gap-6">
          {items.map((item, index) => {
            const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];

            return (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div
                  className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10"
                  aria-hidden="true"
                >
                  <Icon className="size-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <div className="mt-2">
                  <MarketingRichTextBlock
                    description={item.description}
                    paragraphs={item.paragraphs}
                    bulletsIntro={item.bulletsIntro}
                    bullets={item.bullets}
                    closingParagraphs={item.closingParagraphs}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
