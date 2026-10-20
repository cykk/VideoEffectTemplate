import type { LinksPageDictionary } from "@markless/shared/src/i18n/types";
import { DirectoryBadges } from "@/components/marketing/directory-badges";
import { PartnerTextLinks } from "@/components/marketing/partner-text-links";
import { PARTNER_TEXT_LINKS } from "@/lib/partner-links";

interface LinksPageContentProps {
  dictionary: LinksPageDictionary;
}

export function LinksPageContent({ dictionary }: LinksPageContentProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-brand-50/40 via-background to-background">
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {dictionary.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{dictionary.subtitle}</p>
        </header>

        <section
          className="mt-12 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm sm:p-10"
          aria-labelledby="directory-badges-heading"
        >
          <h2
            id="directory-badges-heading"
            className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500"
          >
            {dictionary.badgesHeading}
          </h2>

          <div className="mt-8">
            <DirectoryBadges
              listAriaLabel={dictionary.badgesAriaLabel}
              badgeItems={dictionary.badgeItems}
            />
          </div>

          {PARTNER_TEXT_LINKS.length > 0 ? (
            <div className="mt-10 border-t border-slate-100 pt-8">
              <h2
                id="partner-links-heading"
                className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500"
              >
                {dictionary.partnerLinksHeading}
              </h2>
              <div className="mt-6">
                <PartnerTextLinks
                  listAriaLabel={dictionary.partnerLinksAriaLabel}
                  partnerLinkItems={dictionary.partnerLinkItems}
                />
              </div>
            </div>
          ) : null}

          <p
            className={`text-center text-sm leading-6 text-slate-500 ${PARTNER_TEXT_LINKS.length > 0 ? "mt-8" : "mt-10"}`}
          >
            {dictionary.notice}
          </p>
        </section>
      </div>
    </div>
  );
}
