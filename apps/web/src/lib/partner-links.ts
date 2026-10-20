export type PartnerTextLink = {
  /** 唯一标识，便于排查与去重 */
  id: string;
  href: string;
};

/**
 * 第三方互链 / 文本反向链接。
 * 新增链接时在此数组追加一项，并在 i18n pages.links.partnerLinkItems 中补充文案。
 */
export const PARTNER_TEXT_LINKS: readonly PartnerTextLink[] = [] as const;
