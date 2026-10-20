"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminResource } from "@/components/admin/use-admin-resource";

type AdminSystemStatus = {
  sseEnabled: boolean;
  sseEndpoint: string;
  redisConfigured: boolean;
  redisHealthy: boolean;
};

export function AdminSystemPage() {
  const { data: status, loading, error, reload } = useAdminResource<AdminSystemStatus>(
    "/api/admin/system"
  );

  if (loading) {
    return (
      <section className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">System Status</h1>
          <p className="text-sm text-slate-600">
            Realtime infrastructure and background workflow readiness.
          </p>
        </header>

        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            Loading system status...
          </div>
        </div>
      </section>
    );
  }

  if (error || !status) {
    return (
      <section className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">System Status</h1>
          <p className="text-sm text-slate-600">
            Realtime infrastructure and background workflow readiness.
          </p>
        </header>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">{error ?? "Failed to load system status"}</p>
          <Button className="mt-4" variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const redisStatus = !status.redisConfigured
    ? "Not configured"
    : status.redisHealthy
      ? "Healthy"
      : "Unhealthy";

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">System Status</h1>
        <p className="text-sm text-slate-600">
          Realtime infrastructure and background workflow readiness.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">SSE Stream</h2>
          <p className="mt-2 text-sm text-slate-600">
            Endpoint: <span className="text-slate-900">{status.sseEndpoint}</span>
          </p>
          <p className="mt-1 text-sm text-emerald-600">
            {status.sseEnabled ? "Enabled" : "Disabled"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Redis</h2>
          <p className="mt-2 text-sm text-slate-600">
            {status.redisConfigured ? "Configured" : "Missing REDIS_URL"}
          </p>
          <p className={`mt-1 text-sm ${status.redisHealthy ? "text-emerald-600" : "text-amber-600"}`}>
            {redisStatus}
          </p>
        </div>
      </div>

      {!status.redisConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Realtime events are disabled until REDIS_URL is configured.
        </div>
      )}
    </section>
  );
}
