/**
 * ----------------------------------------------------------------------------------
 * DatasetCard (thin)
 * ----------------------------------------------------------------------------------
 * - Composes CardShell to render a dataset.
 * - Reuses a similar shape to PredictorCard for search/filter consistency.
 * - Shows rows / size metadata in the right side of the footer (if provided).
 * - Owner sees Edit / Delete; Viewer sees View (only when selected).
 * - Supports drag and drop functionality for folder organization.
 *
 * Styling updates:
 * - Neutral greys to match Create/Upload pages.
 * - Replaced emoji 📄 with Unicode ▦.
 */

import CardShell from "./CardShell";
import DraggableCard from "./DraggableCard";
import type { DragItem } from "../types/dragDrop";

export interface DatasetItem {
  id: string;
  title: string;
  owner: boolean;
  ownerId?: number | null;
  ownerName?: string | null;
  updatedAt?: string;
  notes?: string;
  rows?: number;
  sizeMB?: number;
  hasFile?: boolean;
  originalFilename?: string;
  folderId?: string;
  folderName?: string;
  allow_admin_access?: boolean;
  __raw?: any;
}

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
}: {
  item: DatasetItem;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
  onDownload?: (id: string, allowAdminAccess: boolean) => void;
  onDrop?: (item: DragItem, folderId?: string) => void;
  isLoading?: boolean;
}) {
  const dragItem: DragItem = {
    id: item.id,
    type: 'dataset',
    title: item.title,
    owner: Boolean(item.owner),
    folderId: item.folderId,
  };

  const cardContent = (
    <CardShell
      actionVisibility="selected"
      title={item.title}
      description={item.notes}
      footerLeft={item.updatedAt ? <>Updated {item.updatedAt}</> : null}
      footerRight={
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          {item.rows !== undefined && <span>{item.rows.toLocaleString()} rows</span>}
          {item.sizeMB !== undefined && <span>{item.sizeMB} MB</span>}
          {item.hasFile && item.originalFilename && (
            <span className="text-neutral-600" title={`File: ${item.originalFilename}`}>▦</span>
          )}
        </div>
      }
      selected={selected}
      onSelect={() => onToggleSelect?.(item.id)}
      onActionAreaClick={(e) => e.stopPropagation()}
    >
      {selected &&
        (item.owner ? (
          <>
            <button
              onClick={() => onView?.(item.id)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
            >
              View
            </button>
            <button
              onClick={() => onEdit?.(item.id)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete?.(item.id)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
            >
              Delete
            </button>
            {item.hasFile && onDownload && (
              <button
                onClick={() => onDownload(item.id, item.allow_admin_access ?? true)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                title="Download file"
              >
                Download
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => onView?.(item.id)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
            >
              View
            </button>
            {item.hasFile && onDownload && (
              <button
                onClick={() => onDownload(item.id, item.allow_admin_access ?? true)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                title="Download file"
              >
                Download
              </button>
            )}
          </>
        ))}
    </CardShell>
  );

  return (
    <DraggableCard item={dragItem} onDrop={onDrop} isLoading={isLoading}>
      {cardContent}
    </DraggableCard>
  );
}
