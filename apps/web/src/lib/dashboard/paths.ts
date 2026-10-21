export function buildDashboardPath(locale: string, suffix = ""): string {
  const base = locale === "en" ? "/dashboard" : `/${locale}/dashboard`;
  return suffix ? `${base}${suffix}` : base;
}
