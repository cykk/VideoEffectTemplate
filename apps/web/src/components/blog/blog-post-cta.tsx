import Link from "next/link";
import type { BlogsPageDictionary } from "@markless/shared/src/i18n/types";
import { Button } from "@/components/ui/button";

interface BlogPostCTAProps {
  locale: string;
  content: BlogsPageDictionary["cta"];
}

export function BlogPostCTA({ locale, content }: BlogPostCTAProps) {
  const homeHref = locale === "en" ? "/" : `/${locale}`;

  return (
    <section className="mt-12 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-white p-8 text-center shadow-sm">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        {content.title}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-base text-slate-600">
        {content.description}
      </p>
      <Button asChild size="lg" className="mt-6 bg-primary text-white hover:bg-primary/90">
        <Link href={homeHref}>{content.button}</Link>
      </Button>
    </section>
  );
}
