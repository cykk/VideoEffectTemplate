"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminHeader } from "@/components/admin/header";
import { AdminSidebar } from "@/components/admin/sidebar";
import { useAdminResource } from "@/components/admin/use-admin-resource";

type AdminBootstrapData = {
  authenticated: boolean;
  isAdmin: boolean;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

export function AdminShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-900">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        <span className="text-sm text-slate-600">Loading admin workspace...</span>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: bootstrap, loading, error, reload } = useAdminResource<AdminBootstrapData>(
    "/api/user/bootstrap"
  );

  useEffect(() => {
    if (loading || !bootstrap) {
      return;
    }

    const search = searchParams.toString();
    const callbackUrl = `${pathname}${search ? `?${search}` : ""}`;

    if (!bootstrap.authenticated) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl || "/admin")}`);
      return;
    }

    if (!bootstrap.isAdmin) {
      router.replace("/");
    }
  }, [bootstrap, loading, pathname, router, searchParams]);

  if (loading) {
    return <AdminShellFallback />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Failed to initialize admin workspace</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <Button className="mt-4" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!bootstrap?.authenticated || !bootstrap.isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <AdminSidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <AdminHeader user={bootstrap.user} />
        <main className="flex-1 overflow-y-auto bg-slate-100 p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
