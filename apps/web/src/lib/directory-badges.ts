export type DirectoryImageBadge = {
  /** 唯一标识，便于排查与去重 */
  id: string;
  kind: "image";
  href: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type DirectoryCardBadge = {
  id: string;
  kind: "card";
  href: string;
  logoSrc: string;
};

export type DirectoryBadge = DirectoryImageBadge | DirectoryCardBadge;

/**
 * 第三方 AI 目录 / 信任平台反向链接徽章。
 * 新增目录时在此数组追加一项即可，/partners 页面会自动渲染。
 */
export const DIRECTORY_BADGES: readonly DirectoryBadge[] = [
  {
    id: "toolfame",
    kind: "image",
    href: "https://toolfame.com/",
    src: "https://toolfame.com/badge-light.svg",
    alt: "Featured on toolfame.com",
    height: 54,
  },
] as const;
