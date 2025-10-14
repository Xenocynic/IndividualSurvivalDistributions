/**
 * ----------------------------------------------------------------------------------
 * PredictorCard (thin)
 * ----------------------------------------------------------------------------------
 * - Composes CardShell to render a predictor.
 * - Shows status chip on the footer right (if provided).
 * - Owner sees Edit / Delete; Viewer sees View (only when selected).
 *
 * TS pattern:
 * - Define an exported `PredictorItem` interface so both tabs and other components
 *   (like DatasetCard) can reuse the same shape for search / filter consistency.
 */

import CardShell from "./CardShell";

export interface PredictorItem {
  id: string;
  title: string;
  status?: "DRAFT" | "PUBLISHED"; 
  updatedAt?: string;  // last edited date
  owner?: boolean; // permissions
  notes?: string; // description text
  isPublic?: boolean;     // privacy 
  pinned?: boolean;       // show pin state
}

export default function PredictorCard({
  item,
  selected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onView,
}: {
  item: PredictorItem;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
}) {
  return (
    <CardShell
      title={item.title}
      description={item.notes}
      footerLeft={item.updatedAt ? <>Updated {item.updatedAt}</> : null}
      footerRight={
        item.status ? (
          <span className="rounded-full border border-black/10 px-2 py-0.5 text-gray-600">
            {item.status}
          </span>
        ) : null
      }
      selected={selected}
      onSelect={() => onToggleSelect?.(item.id)}
      onActionAreaClick={(e) => e.stopPropagation()}
    >
      {selected &&
        (item.owner ? (
          <>
            <button
              onClick={() => onEdit?.(item.id)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete?.(item.id)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
            >
              Delete
            </button>
          </>
        ) : (
          <button
            onClick={() => onView?.(item.id)}
            className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
          >
            View
          </button>
        ))}
    </CardShell>
  );
}
