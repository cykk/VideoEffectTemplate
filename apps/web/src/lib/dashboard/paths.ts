export function buildDashboardPath(locale: string, suffix = ""): string {
  const base = locale === "en" ? "/dashboard" : `/${locale}/dashboard`;
  return suffix ? `${base}${suffix}` : base;
}

export type DashboardTranscriptionsPathOptions = {
  page?: number;
  q?: string;
};

export function buildDashboardTranscriptionsPath(
  locale: string,
  options?: DashboardTranscriptionsPathOptions | number
): string {
  const base = buildDashboardPath(locale, "/transcriptions");
  const normalizedOptions: DashboardTranscriptionsPathOptions =
    typeof options === "number" ? { page: options } : (options ?? {});
  const params = new URLSearchParams();
  const trimmedQuery = normalizedOptions.q?.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  if (normalizedOptions.page && normalizedOptions.page > 1) {
    params.set("page", String(normalizedOptions.page));
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
