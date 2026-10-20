"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminResource } from "@/components/admin/use-admin-resource";

type ContactMessageRow = {
  id: string;
  status: "new" | "in_progress" | "resolved" | string;
  email: string;
  message: string;
  reporter: string;
  metadata: {
    pageUrl?: string | null;
    source?: string | null;
  } | null;
  createdAt: string | Date | null;
};

type ContactMessagesData = {
  rows: ContactMessageRow[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

function StatusBadge({ status }: { status: string }) {
  if (status === "resolved") {
    return <Badge variant="secondary">Resolved</Badge>;
  }

  if (status === "in_progress") {
    return <Badge variant="outline">In Progress</Badge>;
  }

  return <Badge>New</Badge>;
}

export function AdminContactMessagesPage() {
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page") ?? "1";
  const parsedPage = Number.parseInt(pageParam, 10);
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const { data, loading, error, reload } = useAdminResource<ContactMessagesData>(
    `/api/admin/contact-messages?page=${currentPage}`,
  );

  const rows = data?.rows ?? [];
  const pagination =
    data?.pagination ??
    ({
      totalCount: 0,
      totalPages: 1,
      currentPage,
      pageSize: 20,
      hasPrev: false,
      hasNext: false,
    } as ContactMessagesData["pagination"]);

  const buildHref = (page: number) => `/admin/contact-messages?page=${page}`;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Contact Messages</h1>
        <p className="text-sm text-slate-600">
          Review inbound messages submitted from the result feedback contact dialog.
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            Loading contact messages...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableCaption className="text-slate-500">
                Showing {rows.length} of {pagination.totalCount.toLocaleString()} contact messages.
              </TableCaption>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="border-slate-200 hover:bg-white">
                    <TableCell colSpan={6} className="text-slate-500">
                      No contact messages found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((item) => (
                    <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50/70">
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-slate-700">
                        {item.email}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-slate-700">
                        {item.reporter}
                      </TableCell>
                      <TableCell className="max-w-[420px] truncate text-slate-700">
                        {item.message}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-slate-700">
                        {item.metadata?.source || "-"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-sm text-slate-600">
                Page {pagination.currentPage} of {pagination.totalPages}
              </div>
              <div className="flex items-center gap-2">
                {pagination.hasPrev ? (
                  <Button asChild variant="outline">
                    <Link href={buildHref(pagination.currentPage - 1)}>Previous</Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Previous
                  </Button>
                )}
                {pagination.hasNext ? (
                  <Button asChild variant="outline">
                    <Link href={buildHref(pagination.currentPage + 1)}>Next</Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
