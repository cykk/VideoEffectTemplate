import { AlternatingFeatureShowcase } from "@/components/marketing/alternating-feature-showcase";
import { HowToUseSection } from "@/components/marketing/how-to-use-section";
import { WorkflowRolesSection } from "@/components/marketing/workflow-roles-section";
import { TranscriptionHeroUpload } from "@/components/marketing/transcription-hero-upload";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { MarketingHtmlText } from "@/components/marketing/marketing-html-text";
import { SrtExampleSection } from "@/components/marketing/srt-example-section";
import { LandingFinalCTA } from "@/components/marketing/landing-final-cta";
import type { Mp3ToSrtLandingDictionary } from "@markless/shared/src/i18n/types";

type MarketingMp3ToSrtLandingPageContentProps = {
  landing: Mp3ToSrtLandingDictionary;
};

export function MarketingMp3ToSrtLandingPageContent({
  landing,
}: MarketingMp3ToSrtLandingPageContentProps) {
  const hero = landing.hero;
  const howToUse = landing.howToUse;
  const whyChooseUs = landing.whyChooseUs;
  const workflows = landing.useCases;
  const srtExample = landing.srtExample;
  const faq = landing.faq;
  const finalCta = landing.finalCta;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
            <div className="mb-8">
              <div className="flex flex-col items-center space-y-4">
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-balance text-slate-900 sm:text-4xl lg:text-5xl">
                  {hero.title}
                </h1>
                <MarketingHtmlText
                  html={hero.descriptionHtml}
                  className="max-w-2xl text-lg leading-8 text-slate-600"
                />
              </div>
            </div>

            <div id="upload" className="flex w-full justify-center scroll-mt-24">
              <TranscriptionHeroUpload enableLinkTab={false} showFooter={false} />
            </div>
          </div>
        </section>

        <SrtExampleSection
          title={srtExample.title}
          intro={srtExample.intro}
          audioExampleLabel={srtExample.audioExampleLabel}
          audioQuote={srtExample.audioQuote}
          srtPreviewLabel={srtExample.srtPreviewLabel}
          cues={srtExample.cues}
          afterSrtParagraphs={srtExample.afterSrtParagraphs}
          ctaText={srtExample.ctaText}
          className="border-t-0"
        />

        <AlternatingFeatureShowcase
          title={workflows.title}
          subtitleHtml={workflows.descriptionHtml}
          items={workflows.items.map((item) => ({
            title: item.title,
            subtitle: item.subtitle,
            lead: item.lead,
            paragraphs: item.paragraphs,
            bulletsIntro: item.bulletsIntro,
            bullets: item.bullets,
            media: item.illustrationSrc
              ? {
                  type: "image" as const,
                  src: item.illustrationSrc,
                  alt: item.illustrationAlt,
                }
              : {
                  type: "illustration" as const,
                  alt: item.illustrationAlt,
                },
          }))}
          ctaText={workflows.ctaText}
        />

        <HowToUseSection
          title={howToUse.title}
          subtitle={howToUse.subtitle}
          steps={howToUse.steps}
          ctaText={howToUse.ctaText}
        />

        <WorkflowRolesSection
          id="features"
          title={whyChooseUs.title}
          subtitle={whyChooseUs.subtitle}
          items={whyChooseUs.items}
          className="border-t border-slate-200/60"
        />

        <MarketingFAQ id="faq" title={faq.title} items={faq.items} />

        <section className="px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pb-24">
          <LandingFinalCTA
            title={finalCta.title}
            subtitle={finalCta.subtitle}
            buttonText={finalCta.button}
          />
        </section>
      </div>
    </>
  );
}
