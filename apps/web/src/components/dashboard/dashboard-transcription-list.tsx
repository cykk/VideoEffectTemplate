"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";
import type { DashboardTranscriptionListItem } from "@markless/shared/src/lib/transcriptions/dashboard-list";
import type { DashboardPageDictionary } from "@markless/shared/src/i18n/types";
import { formatAppDateTime } from "@/lib/formatters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DashboardTranscriptionActionDialogs,
  type DashboardTranscriptionActionTarget,
} from "@/components/dashboard/dashboard-transcription-action-dialogs";

type TranscriptionStatus = DashboardTranscriptionListItem["status"];

const IN_PROGRESS_STATUSES: ReadonlySet<TranscriptionStatus> = new Set([
  "queued",
  "preprocessing",
  "transcribing",
]);

function formatDuration(durationMs: number | null, fallback: string): string {
  if (!durationMs || durationMs <= 0) {
    return fallback;
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function buildLocalizedTranscriptionPath(locale: string, publicId: string): string {
  const basePath = `/transcriptions/${publicId}`;
  return locale === "en" ? basePath : `/${locale}${basePath}`;
}

function getStatusBadgeClassName(status: TranscriptionStatus): string {
  switch (status) {
    case "succeeded":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "preprocessing":
    case "transcribing":
      return "bg-blue-100 text-blue-700";
    case "queued":
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function stopRowNavigation(event: React.MouseEvent | React.PointerEvent | Event) {
  event.stopPropagation();
}

const ROW_ACTION_SELECTOR = "[data-row-action]";

function TranscriptionStatusBadge({
  status,
  label,
}: {
  status: TranscriptionStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        getStatusBadgeClassName(status)
      )}
    >
      {label}
    </span>
  );
}

function TranscriptionRowActionsMenu({
  actionsDict,
  canUseShareExport,
  onShare,
  onExport,
  onRename,
  onDelete,
  onOpenChange,
}: {
  actionsDict: DashboardPageDictionary["list"]["actions"];
  canUseShareExport: boolean;
  onShare: () => void;
  onExport: () => void;
  onRename: () => void;
  onDelete: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label={actionsDict.menuAria}
        onClick={stopRowNavigation}
        onPointerDown={stopRowNavigation}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onClick={stopRowNavigation}
        onPointerDown={stopRowNavigation}
      >
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={!canUseShareExport}
          onSelect={() => {
            onShare();
          }}
        >
          <Share2 className="size-4" aria-hidden="true" />
          {actionsDict.share}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={!canUseShareExport}
          onSelect={() => {
            onExport();
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          {actionsDict.export}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => {
            onRename();
          }}
        >
          <Pencil className="size-4" aria-hidden="true" />
          {actionsDict.rename}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onSelect={() => {
            onDelete();
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {actionsDict.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getTranscriptionRowData(
  item: DashboardTranscriptionListItem,
  listDict: DashboardPageDictionary["list"],
  locale: string,
  renamedTitles: Record<string, string>
) {
  const displayName =
    renamedTitles[item.publicId] ?? item.displayTitle ?? item.fileName;
  const href = buildLocalizedTranscriptionPath(locale, item.publicId);
  const durationLabel = formatDuration(
    item.processedDurationMs ?? item.sourceDurationMs,
    listDict.items.durationUnknown
  );
  const createdLabel = formatAppDateTime(item.createdAt, locale);
  const statusLabel = IN_PROGRESS_STATUSES.has(item.status)
    ? listDict.status.processing
    : listDict.status[item.status];

  return { href, durationLabel, createdLabel, statusLabel, displayName };
}

export function DashboardTranscriptionList({
  items,
  listDict,
  locale,
  onTranscriptionRenamed,
  onDeleted,
}: {
  items: DashboardTranscriptionListItem[];
  listDict: DashboardPageDictionary["list"];
  locale: string;
  onTranscriptionRenamed?: (publicId: string, displayTitle: string) => void;
  onDeleted?: (publicId: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const suppressRowNavigationRef = useRef(false);
  const [renamedTitles, setRenamedTitles] = useState<Record<string, string>>({});
  const [hiddenPublicIds, setHiddenPublicIds] = useState<Set<string>>(new Set());
  const [actionTarget, setActionTarget] = useState<DashboardTranscriptionActionTarget | null>(
    null
  );

  useEffect(() => {
    const currentPublicIds = new Set(items.map((item) => item.publicId));
    setHiddenPublicIds((current) => {
      const next = new Set<string>();
      current.forEach((publicId) => {
        if (currentPublicIds.has(publicId)) {
          next.add(publicId);
        }
      });
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => !hiddenPublicIds.has(item.publicId)),
    [hiddenPublicIds, items]
  );

  const handleRowActionMenuOpenChange = useCallback((open: boolean) => {
    if (open) {
      return;
    }

    suppressRowNavigationRef.current = true;
    window.setTimeout(() => {
      suppressRowNavigationRef.current = false;
    }, 0);
  }, []);

  const handleRowNavigate = useCallback(
    (event: React.MouseEvent, href: string) => {
      if (suppressRowNavigationRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest(ROW_ACTION_SELECTOR)) {
        return;
      }

      router.push(href);
    },
    [router]
  );

  const openExportDialog = useCallback((publicId: string, displayName: string) => {
    setActionTarget({ publicId, dialog: "export", displayName });
  }, []);

  const openRenameDialog = useCallback((publicId: string, displayName: string) => {
    setActionTarget({ publicId, dialog: "rename", displayName });
  }, []);

  const openShareDialog = useCallback((publicId: string, displayName: string) => {
    setActionTarget({ publicId, dialog: "share", displayName });
  }, []);

  const openDeleteDialog = useCallback((publicId: string, displayName: string) => {
    setActionTarget({ publicId, dialog: "delete", displayName });
  }, []);

  const closeActionDialog = useCallback(() => {
    setActionTarget(null);
  }, []);

  const getRowDisplayName = useCallback(
    (item: DashboardTranscriptionListItem) =>
      renamedTitles[item.publicId] ?? item.displayTitle ?? item.fileName,
    [renamedTitles]
  );

  const handleRenamed = useCallback(
    (publicId: string, displayTitle: string) => {
      setRenamedTitles((current) => ({
        ...current,
        [publicId]: displayTitle,
      }));
      onTranscriptionRenamed?.(publicId, displayTitle);
    },
    [onTranscriptionRenamed]
  );

  const handleDeleted = useCallback(
    (publicId: string) => {
      setHiddenPublicIds((current) => {
        if (current.has(publicId)) {
          return current;
        }

        const next = new Set(current);
        next.add(publicId);
        return next;
      });

      const reloadTask = onDeleted?.(publicId);
      if (reloadTask instanceof Promise) {
        return reloadTask;
      }

      return undefined;
    },
    [onDeleted]
  );

  const handleRowKeyDown = (event: React.KeyboardEvent, href: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl bg-white">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-100 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">{listDict.columns.name}</th>
                <th className="px-4 py-3 font-medium">{listDict.columns.duration}</th>
                <th className="px-4 py-3 font-medium">{listDict.columns.created}</th>
                <th className="px-4 py-3 font-medium">{listDict.columns.status}</th>
                <th className="w-12 px-4 py-3">
                  <span className="sr-only">{listDict.actions.menuAria}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleItems.map((item) => {
                const displayName = getRowDisplayName(item);
                const { href, durationLabel, createdLabel, statusLabel } = getTranscriptionRowData(
                  item,
                  listDict,
                  locale,
                  renamedTitles
                );

                return (
                  <tr
                    key={item.publicId}
                    role="link"
                    tabIndex={0}
                    aria-label={`${displayName}, ${statusLabel}, ${listDict.openCta}`}
                    className="cursor-pointer bg-white transition-colors hover:bg-slate-50/50"
                    onClick={(event) => {
                      handleRowNavigate(event, href);
                    }}
                    onKeyDown={(event) => {
                      handleRowKeyDown(event, href);
                    }}
                  >
                    <td className="max-w-0 px-6 py-4">
                      <span className="block truncate font-normal text-slate-900">
                        {displayName}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600 tabular-nums">
                      {durationLabel}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600">{createdLabel}</td>
                    <td className="px-4 py-4">
                      <TranscriptionStatusBadge status={item.status} label={statusLabel} />
                    </td>
                    <td
                      className="px-4 py-4 text-right"
                      data-row-action
                      onClick={stopRowNavigation}
                      onPointerDown={stopRowNavigation}
                    >
                      <TranscriptionRowActionsMenu
                        actionsDict={listDict.actions}
                        canUseShareExport={item.status === "succeeded"}
                        onShare={() => openShareDialog(item.publicId, displayName)}
                        onExport={() => openExportDialog(item.publicId, displayName)}
                        onRename={() => openRenameDialog(item.publicId, displayName)}
                        onDelete={() => openDeleteDialog(item.publicId, displayName)}
                        onOpenChange={handleRowActionMenuOpenChange}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-200 md:hidden">
          {visibleItems.map((item) => {
            const displayName = getRowDisplayName(item);
            const { href, durationLabel, createdLabel, statusLabel } = getTranscriptionRowData(
              item,
              listDict,
              locale,
              renamedTitles
            );

            return (
              <div
                key={item.publicId}
                role="link"
                tabIndex={0}
                aria-label={`${displayName}, ${statusLabel}, ${listDict.openCta}`}
                className="flex cursor-pointer items-start gap-3 bg-white px-4 py-4 transition-colors hover:bg-slate-50/50 sm:px-6"
                onClick={(event) => {
                  handleRowNavigate(event, href);
                }}
                onKeyDown={(event) => {
                  handleRowKeyDown(event, href);
                }}
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-normal text-slate-900">
                    {displayName}
                  </span>
                  <p className="mt-1 text-xs text-slate-500">
                    {durationLabel}
                    <span className="mx-2 text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    {createdLabel}
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center gap-2"
                  data-row-action
                  onClick={stopRowNavigation}
                  onPointerDown={stopRowNavigation}
                >
                  <TranscriptionStatusBadge status={item.status} label={statusLabel} />
                  <TranscriptionRowActionsMenu
                    actionsDict={listDict.actions}
                    canUseShareExport={item.status === "succeeded"}
                    onShare={() => openShareDialog(item.publicId, displayName)}
                    onExport={() => openExportDialog(item.publicId, displayName)}
                    onRename={() => openRenameDialog(item.publicId, displayName)}
                    onDelete={() => openDeleteDialog(item.publicId, displayName)}
                    onOpenChange={handleRowActionMenuOpenChange}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DashboardTranscriptionActionDialogs
        key={actionTarget?.publicId ?? "idle"}
        target={actionTarget}
        onClose={closeActionDialog}
        onRenamed={handleRenamed}
        onDeleted={handleDeleted}
      />
    </>
  );
}
