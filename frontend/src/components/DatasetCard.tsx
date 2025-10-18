/**
 * ----------------------------------------------------------------------------------
 * DatasetCard (thin)
 * ----------------------------------------------------------------------------------
 * - Composes CardShell to render a dataset.
 * - Reuses PredictorItem shape to keep search / filter logic identical across tabs.
 * - Shows rows / size metadata in the right side of the footer (if provided).
 * - Owner sees Edit / Delete; Viewer sees View (only when selected).
 */

import CardShell from "./CardShell";
// import type { PredictorItem } from "./PredictorCard";

// // Reuse PredictorItem shape so search / filter logic remains unchanged.
// export type DatasetItem = PredictorItem & {
//   rows?: number;
//   sizeMB?: number;
// };

export type DatasetItem = {
  id: string;
  title: string;
  owner: boolean;        // true if current user is owner
  ownerId?: number | null;
  ownerName?: string | null;
  updatedAt?: string;
  notes?: string;
  rows?: number;
  sizeMB?: number;
  hasFile?: boolean;     // whether dataset has an associated file
  originalFilename?: string; // original filename for display
  __raw?: any;           // keep the raw API object if you need it later
};

export default function DatasetCard({
  item,
  selected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onView,
  onDownload,
}: {
  item: DatasetItem;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
}) {
  return (
    <CardShell
      title={item.title}
      description={item.notes}
      footerLeft={item.updatedAt ? <>Updated {item.updatedAt}</> : null}
      footerRight={
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {item.rows !== undefined && <span>{item.rows.toLocaleString()} rows</span>}
          {item.sizeMB !== undefined && <span>{item.sizeMB} MB</span>}
          {item.hasFile && item.originalFilename && (
            <span title={`File: ${item.originalFilename}`}>📄</span>
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
            {item.hasFile && onDownload && (
              <button
                onClick={() => onDownload(item.id)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
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
              className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
            >
              View
            </button>
            {item.hasFile && onDownload && (
              <button
                onClick={() => onDownload(item.id)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                title="Download file"
              >
                Download
              </button>
            )}
          </>
        ))}
    </CardShell>
  );
}
