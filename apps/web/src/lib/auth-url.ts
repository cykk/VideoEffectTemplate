export function buildAuthPath(
  locale: string,
  segment: "login" | "signup",
  returnTo?: string | null
): string {
  const basePath = locale === "en" ? `/${segment}` : `/${locale}/${segment}`;

  if (!returnTo) {
    return basePath;
  }

  return `${basePath}?returnTo=${encodeURIComponent(returnTo)}`;
}
