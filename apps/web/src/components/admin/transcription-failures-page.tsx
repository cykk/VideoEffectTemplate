"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminResource } from "@/components/admin/use-admin-resource";

type FailureArchive = {
  id: string;
  recordType: "transcription_failure" | "upload_failure";
  publicId: string | null;
  sourceFileName: string | null;
  sourceContentType: string | null;
  sourceFileSize: number | null;
  failureStage: string;
  errorCode: string;
  errorMessage: string;
  replicateVersion: string | null;
  createdAt: string;
};

type FailureArchivesData = {
  rows: FailureArchive[];
  pagination: { totalCount: number; totalPages: number; currentPage: number; hasPrev: boolean; hasNext: boolean };
};

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function AdminTranscriptionFailuresPage() {
  const { data, loading, error, reload } = useAdminResource<FailureArchivesData>("/api/admin/transcription-failures");
  const rows = data?.rows ?? [];

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Transcription Failure Archives</h1>
        <p className="text-sm text-slate-600">Internal diagnostics for terminal transcription failures, retained for 180 days. Source files are available while the task media remains stored.</p>
      </header>
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white"><Loader2 className="h-4 w-4 animate-spin text-brand-600" /></div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}<Button className="ml-3" variant="outline" onClick={() => void reload()}>Retry</Button></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50"><TableRow><TableHead>File</TableHead><TableHead>Failure</TableHead><TableHead>Error</TableHead><TableHead>Created</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-slate-500">No failure archives found.</TableCell></TableRow> : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[240px]"><p className="truncate font-medium text-slate-800">{row.sourceFileName ?? "(no file created)"}</p><p className="text-xs text-slate-500">{row.sourceContentType ?? row.recordType}{row.sourceFileSize != null ? ` · ${formatBytes(row.sourceFileSize)}` : ""}</p></TableCell>
                  <TableCell><Badge variant="outline">{row.failureStage}</Badge><p className="mt-1 text-xs text-slate-500">{row.publicId ?? "Upload request"}</p></TableCell>
                  <TableCell className="max-w-[330px]"><p className="text-xs font-medium text-red-700">{row.errorCode}</p><details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer select-none">View details</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-2 font-mono text-[11px] leading-5">{row.errorMessage}</pre></details></TableCell>
                  <TableCell className="text-xs text-slate-600">{new Date(row.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{row.recordType === "transcription_failure" ? <Button asChild size="sm" variant="outline"><Link href={`/api/admin/transcription-failures/${row.id}/source`} target="_blank">Download source</Link></Button> : <span className="text-xs text-slate-400">No source</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
