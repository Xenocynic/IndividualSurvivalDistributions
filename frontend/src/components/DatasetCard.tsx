/**
 * ----------------------------------------------------------------------------------
 * DatasetCard (thin)
 * ----------------------------------------------------------------------------------
 * - Composes CardShell to render a dataset, styled to match Browse cards.
 * - Shows owner tag in the eyebrow row and rows/size/file icon in footer.
 * - Owner sees View / Edit / Download / Delete; viewer sees View / Download.
 * - Buttons appear with a staggered, “bubbly” animation when the card is selected.
 * - Supports drag and drop functionality for folder organization.
 */

import CardShell from "./CardShell";
import DraggableCard from "./DraggableCard";
import UsernameTag from "./UsernameTag";
import type { DragItem } from "../types/dragDrop";
import { Eye, Pencil, Trash2, Download as DownloadIcon } from "lucide-react";

export interface DatasetItem {
  id: string;
  title: string;
  owner: boolean;
  ownerId?: number | null;
  ownerName?: string | null;
  updatedAt?: string;
  updatedAtRaw?: string;
  notes?: string;
  rows?: number;
  sizeMB?: number;
  hasFile?: boolean;
  originalFilename?: string;
  folderId?: string;
  folderName?: string;
  allow_admin_access?: boolean;
  isPublic?: boolean;
  __raw?: any;
}

type DatasetCardProps = {
  item: DatasetItem;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
  onDownload?: (id: string, allowAdminAccess: boolean) => void;
  onDrop?: (item: DragItem, folderId?: string) => void;
  isLoading?: boolean;
};

export default function DatasetCard({
  item,
  selected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onView,
  onDownload,
  onDrop,
  isLoading = false,
}: DatasetCardProps) {
  const dragItem: DragItem = {
    id: item.id,
    type: "dataset",
    title: item.title,
    owner: Boolean(item.owner),
    folderId: item.folderId,
  };

  const ownerLabel =
    item.ownerName ?? (item.owner ? "You" : "Owner unknown");

  const visibilityLabel =
    typeof item.isPublic === "boolean"
      ? item.isPublic
        ? "Public"
        : "Private"
      : undefined;

  return (
    <DraggableCard item={dragItem} onDrop={onDrop} isLoading={isLoading}>
      <CardShell
        eyebrowLeft={
          <div className="inline-flex items-center gap-2 text-xs font-medium text-neutral-800">
            <UsernameTag name={ownerLabel} />
          </div>
        }
        title={
          <div className="truncate text-sm font-semibold text-neutral-900">
            {item.title}
          </div>
        }
        description={
          item.notes ? (
            <div className="mt-2 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
              {item.notes}
            </div>
          ) : (
            <div className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-xs italic text-neutral-400">
              No description provided.
            </div>
          )
        }
        footerLeft={
          item.updatedAt ? (
            <span className="text-[11px] text-neutral-500">
              Updated {item.updatedAt}
            </span>
          ) : null
        }
        footerRight={
          <div className="flex items-center gap-2 text-[11px] text-neutral-600">
            {typeof item.rows === "number" && (
              <span>{item.rows.toLocaleString()} rows</span>
            )}
            {typeof item.sizeMB === "number" && (
              <span>{item.sizeMB} MB</span>
            )}
            {item.hasFile && item.originalFilename && (
              <span
                className="inline-flex max-w-[9rem] items-center rounded-md border bg-neutral-50 px-2 py-[1px]"
                title={`File: ${item.originalFilename}`}
              >
                ▦
                <span className="ml-1 truncate">{item.originalFilename}</span>
              </span>
            )}
            {visibilityLabel && (
              <span
                className={`rounded-full border px-2 py-[2px] text-[10px] ${
                  item.isPublic
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-neutral-900 bg-neutral-900 text-white"
                }`}
              >
                {visibilityLabel}
              </span>
            )}
          </div>
        }
        selected={selected}
        onSelect={() => onToggleSelect?.(item.id)}
        onActionAreaClick={(e) => {
          e.stopPropagation();
        }}
        actionVisibility="always"
      >
        {/* Everyone can view */}
        <button
          type="button"
          onClick={() => onView?.(item.id)}
          className={bubbleButtonClass(selected)}
          style={bubbleDelayStyle(selected, 0)}
        >
          <Eye className="h-5 w-3" />
        </button>

        {/* Owner-only controls */}
        {item.owner ? (
          <>
            <button
              type="button"
              onClick={() => onEdit?.(item.id)}
              className={bubbleButtonClass(selected)}
              style={bubbleDelayStyle(selected, 60)}
            >
              <Pencil className="h-5 w-3" />
            </button>

            {item.hasFile && onDownload && (
              <button
                type="button"
                onClick={() =>
                  onDownload(
                    item.id,
                    item.allow_admin_access ?? true
                  )
                }
                className={bubbleButtonClass(selected)}
                style={bubbleDelayStyle(selected, 120)}
                title="Download file"
              >
                <DownloadIcon className="h-5 w-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onDelete?.(item.id)}
              className={bubbleDeleteButtonClass(selected)}
              style={bubbleDelayStyle(selected, 180)}
            >
              <Trash2 className="h-5 w-3" />
            </button>
          </>
        ) : (
          // Viewer-only controls
          item.hasFile &&
          onDownload && (
            <button
              type="button"
              onClick={() =>
                onDownload(item.id, item.allow_admin_access ?? true)
              }
              className={bubbleButtonClass(selected)}
              style={bubbleDelayStyle(selected, 60)}
              title="Download file"
            >
              <DownloadIcon className="h-3 w-3" />
            </button>
          )
        )}
      </CardShell>
    </DraggableCard>
  );
}

function bubbleButtonClass(selected: boolean) {
  return [
    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1",
    "text-[11px] font-medium text-neutral-700 bg-white shadow-sm hover:bg-neutral-200",
    "transform-gpu origin-left transition-all duration-200 ease-out",
    selected
      ? "opacity-100 translate-y-0 scale-100"
      : "pointer-events-none opacity-0 -translate-y-1 scale-90",
  ].join(" ");
}

function bubbleDeleteButtonClass(selected: boolean) {
  return [
    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1",
    "text-[11px] font-medium text-red-700 bg-red-50 border-red-200 shadow-sm",
    "hover:bg-red-100 hover:border-red-300 hover:text-red-800",
    "transform-gpu origin-left transition-all duration-200 ease-out",
    selected
      ? "opacity-100 translate-y-0 scale-100"
      : "pointer-events-none opacity-0 -translate-y-1 scale-90",
  ].join(" ");
}

function bubbleDelayStyle(selected: boolean, delayMs: number) {
  return selected
    ? { transitionDelay: `${delayMs}ms` }
    : { transitionDelay: "0ms" };
}
