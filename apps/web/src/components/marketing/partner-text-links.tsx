import { PARTNER_TEXT_LINKS } from "@/lib/partner-links";
import type { LinksPageDictionary } from "@markless/shared/src/i18n/types";

interface PartnerTextLinksProps {
  listAriaLabel: string;
  partnerLinkItems: LinksPageDictionary["partnerLinkItems"];
}

export function PartnerTextLinks({
  listAriaLabel,
  partnerLinkItems,
}: PartnerTextLinksProps) {
  if (PARTNER_TEXT_LINKS.length === 0) {
    return null;
  }

  return (
    <ul
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
      aria-label={listAriaLabel}
    >
      {PARTNER_TEXT_LINKS.map((link) => {
        const item = partnerLinkItems[link.id as keyof typeof partnerLinkItems];

        return (
          <li key={link.id}>
            <a
              href={link.href}
              title={item.linkTitle}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
            >
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
