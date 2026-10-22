import { Suspense } from "react";
import { getActiveCreditPackages } from "@markless/shared/src/lib/products/config";
import type { Locale, RaindanceHomeDictionary, AuthModalDictionary } from "@markless/shared/src/i18n/types";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { RaindanceGenerator } from "./generator";
import { PricingSummary } from "./pricing-summary";
import { ShowcaseCarousel } from "./showcase-carousel";
import { SHOWCASE_ITEMS } from "./showcase-config";
import { ScrollTopLink } from "./scroll-top-link";

interface RaindanceHomeProps {
  dictionary: RaindanceHomeDictionary;
  authDictionary: AuthModalDictionary;
  locale: Locale;
}

/** 首页：首屏就是生成器（客户端），其余板块保持服务端渲染以减少首屏 JS。 */
export function RaindanceHome({ dictionary, authDictionary, locale }: RaindanceHomeProps) {
  const termsHref = locale === "en" ? "/terms" : `/${locale}/terms`;
  const packs = getActiveCreditPackages().map((pack) => ({
    id: pack.id,
    credits: pack.credits + pack.bonusCredits,
    price: pack.adjustedPrice,
    currency: pack.currency,
  }));
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dictionary.faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer.replace(/<[^>]+>/g, "") },
    })),
  };

  return (
    <div className="bg-white text-slate-950">
      <section id="raindance-generator" className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-8 pt-6 sm:px-6 sm:pt-12">
        <header className="mx-auto mb-5 max-w-md text-center">
          <h1 className="text-3xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-4xl">
            {dictionary.hero.title}
          </h1>
          <p className="mt-2 text-base text-slate-700">{dictionary.hero.subtitle}</p>
          <p className="mt-1 text-xs text-slate-500">{dictionary.hero.microcopy}</p>
        </header>
        <Suspense fallback={<div className="mx-auto aspect-[2/1] w-full max-w-sm" aria-hidden="true" />}>
          <RaindanceGenerator dictionary={dictionary} authDictionary={authDictionary} packs={packs} termsHref={termsHref} />
        </Suspense>
      </section>

      {SHOWCASE_ITEMS.length > 0 ? (
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6" aria-labelledby="raindance-showcase">
          <h2 id="raindance-showcase" className="text-2xl font-semibold text-slate-900">
            {dictionary.showcase.title}
          </h2>
          <p className="mb-5 mt-1 text-sm text-slate-600">{dictionary.showcase.description}</p>
          <ShowcaseCarousel items={SHOWCASE_ITEMS} alts={dictionary.showcase.items.map((item) => item.alt)} />
        </section>
      ) : null}

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6" aria-labelledby="raindance-steps">
        <h2 id="raindance-steps" className="text-2xl font-semibold text-slate-900">
          {dictionary.steps.title}
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {dictionary.steps.items.map((item, index) => (
            <li key={item.title} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                {index + 1}
              </span>
              <span>
                <span className="block text-base font-semibold text-slate-900">{item.title}</span>
                <span className="mt-0.5 block text-sm text-slate-600">{item.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <details className="rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-base font-semibold text-slate-900">{dictionary.tips.title}</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            {dictionary.tips.items.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </details>
      </section>

      {packs.length > 0 ? <PricingSummary dictionary={dictionary.pricing} packs={packs} /> : null}

      <MarketingFAQ title={dictionary.faq.title} items={dictionary.faq.items} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />

      <section className="px-4 py-12 text-center sm:px-6">
        <h2 className="text-2xl font-semibold text-slate-900">{dictionary.closing.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{dictionary.closing.description}</p>
        <ScrollTopLink className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white">
          {dictionary.closing.cta}
        </ScrollTopLink>
      </section>

      {/* 给移动端吸底按钮留出空间，避免遮住页脚内容 */}
      <div className="h-28 sm:hidden" aria-hidden="true" />
    </div>
  );
}
