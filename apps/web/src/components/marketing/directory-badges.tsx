import { DIRECTORY_BADGES } from "@/lib/directory-badges";
import type { LinksPageDictionary } from "@markless/shared/src/i18n/types";

interface DirectoryBadgesProps {
  listAriaLabel: string;
  badgeItems: LinksPageDictionary["badgeItems"];
}

export function DirectoryBadges({ listAriaLabel, badgeItems }: DirectoryBadgesProps) {
  if (DIRECTORY_BADGES.length === 0) {
    return null;
  }

  return (
    <ul
      className="flex flex-wrap items-center justify-center gap-6"
      aria-label={listAriaLabel}
    >
      {DIRECTORY_BADGES.map((badge) => (
        <li key={badge.id}>
          {badge.kind === "card" ? (
            <a
              href={badge.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 no-underline transition-all hover:border-slate-300 hover:shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 第三方目录徽章，域名不在 next/image 白名单 */}
              <img
                src={badge.logoSrc}
                alt={badgeItems[badge.id].logoAlt}
                className="size-10 shrink-0"
                loading="lazy"
                decoding="async"
              />
              <span className="flex flex-col">
                <span className="text-xs text-slate-500">
                  {badgeItems[badge.id].brandLabel}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {badgeItems[badge.id].titleLabel}
                </span>
              </span>
            </a>
          ) : (
            <a
              href={badge.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg transition-opacity hover:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 第三方目录徽章，域名不在 next/image 白名单 */}
              <img
                src={badge.src}
                alt={badge.alt}
                width={badge.width}
                height={badge.height}
                style={
                  badge.width
                    ? undefined
                    : { height: badge.height ? `${badge.height}px` : undefined, width: "auto" }
                }
                loading="lazy"
                decoding="async"
              />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
