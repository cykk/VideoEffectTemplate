"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Bell, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Fragment } from "react";
import { useLocale } from "@/hooks/use-locale";
import { useSignOut } from "@/hooks/use-sign-out";

type AdminHeaderUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null;

export function AdminHeader({ user }: { user: AdminHeaderUser }) {
  const { dictionary } = useLocale();
  const dict = dictionary.admin.header;
  const pathname = usePathname();
  const signOut = useSignOut();
  
  // 生成面包屑
  // e.g. /admin/models/sora-2 -> Admin > Models > sora-2
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const isLast = index === segments.length - 1;
    
    // 格式化名称：首字母大写，连字符转空格
    const label = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    return { label, href, isLast };
  });

  const handleSignOut = async () => {
     await signOut({
        redirectTo: "/login",
        hardRedirect: true,
     });
  };

  const userInitials = user?.name
    ? user.name.substring(0, 2).toUpperCase()
    : (user?.email?.substring(0, 2).toUpperCase() || "AD");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-x-4 border-b border-slate-200/80 bg-white px-6">
      
      {/* 左侧：面包屑 */}
      <div className="flex flex-1 items-center gap-1.5 text-sm font-medium text-slate-500">
        {breadcrumbs.map((crumb, idx) => (
          <Fragment key={crumb.href}>
             {idx > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
             {crumb.isLast ? (
                <span className="text-slate-900">{crumb.label}</span>
             ) : (
                <Link href={crumb.href} className="transition-colors hover:text-slate-900">
                  {crumb.label}
                </Link>
             )}
          </Fragment>
        ))}
      </div>

      {/* 右侧：功能区 */}
      <div className="flex items-center gap-x-4">
        
        {/* Search Placeholder */}
        <div className="hidden md:flex relative">
           <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
           <input 
              type="text" 
              placeholder="Search..." 
              className="h-9 w-64 rounded-md border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-1 focus:ring-brand-600"
           />
        </div>

        <div className="hidden h-6 w-px bg-slate-200 md:block" />

        {/* View Site Button */}
        <Button variant="ghost" size="sm" className="hidden cursor-pointer text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:flex" asChild>
          <Link href="/" target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            {dict.viewSite}
          </Link>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="cursor-pointer text-slate-600 hover:bg-slate-100 hover:text-slate-900">
          <Bell className="h-5 w-5" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer hover:bg-slate-100">
              <Avatar className="h-8 w-8 border border-slate-200">
                <AvatarImage src={user?.image || undefined} alt={user?.name || "Admin"} />
                <AvatarFallback className="bg-brand-600 text-xs text-white">{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 border-slate-200 bg-white text-slate-700" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-slate-900">
                    {user?.name || "Admin User"}
                </p>
                <p className="truncate text-xs leading-none text-slate-500">
                    {user?.email || "loading..."}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-200" />
            <DropdownMenuItem className="cursor-pointer focus:bg-slate-100 focus:text-slate-900" asChild>
                <Link href="/settings/account" className="cursor-pointer">{dict.profile}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-200" />
            <DropdownMenuItem 
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                onClick={handleSignOut}
            >
              {dict.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
