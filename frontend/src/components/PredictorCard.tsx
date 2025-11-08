/**
 * ----------------------------------------------------------------------------------
 * PredictorCard (thin)
 * ----------------------------------------------------------------------------------
 * - Composes CardShell to render a predictor.
 * - Shows status chip on the footer right (if provided).
 * - Owner sees Edit / Delete; Viewer sees View (only when selected).
 * - Supports drag and drop functionality for folder organization.
 *
 * Styling updates:
 * - Neutral greys to match Create/Upload pages.
 * - Actions use same button style as elsewhere (no emoji).
 */

import CardShell from "./CardShell";
import DraggableCard from "./DraggableCard";
import type { DragItem } from "../types/dragDrop";

export interface PredictorItem {
  id: string;
  title: string;
  status?: "DRAFT" | "PUBLISHED"; 
  updatedAt?: string;
  owner?: boolean;
  notes?: string;
  isPublic?: boolean;
  pinned?: boolean;
  folderId?: string;
  folderName?: string;
}

export default function PredictorCard({
  item,
  selected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onView,
  onDoubleClick,
  onDrop,
  isLoading = false,
}: {
  item: PredictorItem;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
  onDoubleClick?: (id: string) => void;
  onDrop?: (item: DragItem, folderId?: string) => void;
  isLoading?: boolean;
}) {
  const dragItem: DragItem = {
    id: item.id,
    type: 'predictor',
    title: item.title,
    owner: Boolean(item.owner),
    folderId: item.folderId,
  };

  const cardContent = (
    <CardShell
      title={item.title}
      description={item.notes}
      footerLeft={item.updatedAt ? <>Updated {item.updatedAt}</> : null}
      footerRight={
        item.status ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              item.status === "DRAFT"
                ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                : "border-green-300 bg-green-50 text-green-700"
            }`}>
            {item.status}
          </span>
        ) : null
      }
      selected={selected}
      onSelect={() => onToggleSelect?.(item.id)}
      onDoubleClick={() => onDoubleClick?.(item.id)}
      onActionAreaClick={(e) => e.stopPropagation()}
      actionVisibility="selected"
    >
      {selected && (
        <>
          <button
            onClick={() => onView?.(item.id)}
            className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
          >
            View
          </button>
          {item.owner ? (
            <>
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
            </>
          ) : null}
        </>
      )}
    </CardShell>
  );

  return (
    <DraggableCard item={dragItem} onDrop={onDrop} isLoading={isLoading}>
      {cardContent}
    </DraggableCard>
  );
}
