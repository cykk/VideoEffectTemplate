import {
  Clock,
  FileDown,
  Globe,
  Shield,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import { MarketingHtmlText } from "@/components/marketing/marketing-html-text";

const ROLE_ICONS: LucideIcon[] = [
  Sparkles,
  Users,
  Globe,
  Shield,
  FileDown,
  Clock,
];

interface WorkflowRoleItem {
  title: string;
  description: string;
}

interface WorkflowRolesSectionProps {
  title: string;
  subtitle?: string;
  items: WorkflowRoleItem[];
  className?: string;
  id?: string;
}

export function WorkflowRolesSection({
  title,
  subtitle,
  items,
  className,
  id,
}: WorkflowRolesSectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8", className)}>
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mx-auto mt-3 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:gap-6">
          {items.map((item, index) => {
            const Icon = ROLE_ICONS[index % ROLE_ICONS.length];

            return (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"
              >
                <div
                  className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10"
                  aria-hidden="true"
                >
                  <Icon className="size-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                  {item.title}
                </h3>
                <MarketingHtmlText
                  as="div"
                  html={item.description}
                  className="mt-3 space-y-4 text-base leading-7 text-slate-600 [&_p+p]:mt-0"
                />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
