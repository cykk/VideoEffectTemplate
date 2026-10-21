"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import { Button } from "@/components/ui/button";

type ReviewJob = {
  id: string;
  userId: string;
  status: string;
  predictionId: string | null;
  errorCode: string | null;
  createdAt: string;
};

export function AiJobsAdminPage() {
  const [jobs, setJobs] = useState<ReviewJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/ai-jobs");
      if (!response.ok) throw new Error("Could not load AI jobs");
      const data = await response.json();
      setJobs(data.jobs);
    } catch { toast.error("Could not load AI jobs"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function confirmNoPrediction(job: ReviewJob) {
    const note = evidence[job.id]?.trim() || "";
    if (note.length < 20 || job.predictionId) return;
    setBusyId(job.id);
    try {
      const response = await apiFetch("/api/admin/ai-jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm-no-prediction", id: job.id,
          evidence: note, confirmation: "NO_REMOTE_PREDICTION" }),
      });
      if (!response.ok) throw new Error("Could not settle the job");
      toast.success("Job settled and eligible credits released");
      await refresh();
    } catch { toast.error("Could not settle the job. Refresh its status and review the remote record."); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-6">
    <header className="flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">AI jobs requiring review</h1>
        <p className="mt-1 text-sm text-slate-600">Check Replicate before releasing any reserved credits.</p></div>
      <Button type="button" variant="outline" onClick={() => void refresh()} title="Refresh jobs">
        <RefreshCw className="size-4" /><span className="sr-only">Refresh jobs</span>
      </Button>
    </header>
    {loading ? <p className="text-sm text-slate-600">Loading jobs...</p> : jobs.length === 0 ?
      <p className="text-sm text-slate-600">No jobs require review.</p> :
      <div className="divide-y border-y border-slate-200">
        {jobs.map(job => <section key={job.id} className="space-y-3 py-5">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-1 size-4 text-amber-600" />
            <div className="min-w-0 text-sm"><p className="font-mono font-medium text-slate-900">{job.id}</p>
              <p className="break-all text-slate-600">User: {job.userId}</p>
              <p className="text-slate-600">{job.status} · {new Date(job.createdAt).toLocaleString()}</p>
              {job.predictionId ? <p className="break-all text-slate-600">Prediction: {job.predictionId}</p> : null}
              {job.errorCode ? <p className="text-slate-600">Reason: {job.errorCode}</p> : null}
            </div>
          </div>
          {!job.predictionId ? <div className="max-w-xl space-y-2 pl-7">
            <label htmlFor={`evidence-${job.id}`} className="block text-sm font-medium">Evidence that no remote prediction exists</label>
            <textarea id={`evidence-${job.id}`} maxLength={1000} value={evidence[job.id] || ""}
              onChange={event => setEvidence(current => ({ ...current, [job.id]: event.target.value }))}
              className="min-h-20 w-full rounded border border-slate-300 p-2 text-sm" />
            <Button type="button" disabled={busyId === job.id || (evidence[job.id]?.trim().length || 0) < 20}
              onClick={() => void confirmNoPrediction(job)}>Confirm no prediction and release credits</Button>
          </div> : null}
        </section>)}
      </div>}
  </div>;
}
