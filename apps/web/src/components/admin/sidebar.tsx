"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@markless/shared/src/lib/utils";
import { LayoutDashboard, Users, Receipt, Repeat, Activity, ImageOff, Sparkles } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";

export function AdminSidebar() {
  const { dictionary } = useLocale();
  const dict = dictionary.admin.sidebar;
  const year = new Date().getFullYear();
  const pathname = usePathname();

  const sidebarItems = [
    { title: 'AI jobs', href: '/admin/ai-jobs', icon: Sparkles },
    { title: 'Waffo payments', href: '/admin/payments/waffo', icon: Receipt },
    {
      title: dict.nav.overview.label,
      href: "/admin",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      title: dict.nav.users.label,
      href: "/admin/users",
      icon: Users,
    },
    {
      title: dict.nav.subscriptions.label,
      href: "/admin/subscriptions",
      icon: Repeat,
    },
    {
      title: dict.nav.orders.label,
      href: "/admin/orders",
      icon: Receipt,
    },
    {
      title: dict.nav.contactMessages.label,
      href: "/admin/contact-messages",
      icon: ImageOff,
    },
    {
      title: dict.nav.system.label,
      href: "/admin/system",
      icon: Activity,
    },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="border-b border-slate-200 p-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div>
            <span className="block text-lg font-bold leading-none text-slate-900">{dict.title}</span>
            <span className="text-xs font-medium text-slate-500">{dict.subtitle}</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-brand-600" : "text-slate-500"
                )}
              />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="px-3 py-2 text-center text-xs text-slate-500">
          {dict.copyright.replace("{year}", String(year))}
        </div>
      </div>
    </aside>
  );
}
