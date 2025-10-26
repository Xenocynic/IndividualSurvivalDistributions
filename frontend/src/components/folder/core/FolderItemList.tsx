/**
 * ----------------------------------------------------------------------------------
 * FolderItemList
 * ----------------------------------------------------------------------------------
 * - Displays items within a folder with type distinction
 * - Shows predictors and datasets with appropriate icons and styling
 * - Supports item selection, editing, deletion, and removal from folder
 * - Groups items by type for better organization
 */

import type { PredictorItem } from "../../PredictorCard";
import type { DatasetItem } from "../../DatasetCard";

export interface FolderItemListProps {
  items: Array<PredictorItem | DatasetItem>;
  selectedItems?: Set<string>;
  onItemSelect?: (itemId: string, itemType: "predictor" | "dataset") => void;
  onItemEdit?: (itemId: string, itemType: "predictor" | "dataset") => void;
  onItemDelete?: (itemId: string, itemType: "predictor" | "dataset") => void;
  onItemView?: (itemId: string, itemType: "predictor" | "dataset") => void;
  onRemoveFromFolder?: (
    itemId: string,
    itemType: "predictor" | "dataset"
  ) => void;
  canEdit?: boolean;
  showRemoveAction?: boolean;
  isLoading?: boolean;
}

// Type guard to distinguish between predictor and dataset items
function isPredictorItem(
  item: PredictorItem | DatasetItem
): item is PredictorItem {
  return "status" in item;
}

function isDatasetItem(item: PredictorItem | DatasetItem): item is DatasetItem {
  return "rows" in item || "sizeMB" in item;
}

export default function FolderItemList({
  items,
  selectedItems = new Set(),
  onItemSelect,
  onItemEdit,
  onItemDelete,
  onItemView,
  onRemoveFromFolder,
  canEdit = false,
  showRemoveAction = false,
  isLoading = false,
}: FolderItemListProps) {
  // Separate items by type
  const predictors = items.filter(isPredictorItem);
  const datasets = items.filter(isDatasetItem);

  const handleItemClick = (
    item: PredictorItem | DatasetItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (onItemSelect) {
      const itemType = isPredictorItem(item) ? "predictor" : "dataset";
      onItemSelect(item.id, itemType);
    }
  };

  const handleItemEdit = (
    item: PredictorItem | DatasetItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (onItemEdit) {
      const itemType = isPredictorItem(item) ? "predictor" : "dataset";
      onItemEdit(item.id, itemType);
    }
  };

  const handleItemDelete = (
    item: PredictorItem | DatasetItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (onItemDelete) {
      const itemType = isPredictorItem(item) ? "predictor" : "dataset";
      onItemDelete(item.id, itemType);
    }
  };

  const handleItemView = (
    item: PredictorItem | DatasetItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (onItemView) {
      const itemType = isPredictorItem(item) ? "predictor" : "dataset";
      onItemView(item.id, itemType);
    }
  };

  const handleRemoveFromFolder = (
    item: PredictorItem | DatasetItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (onRemoveFromFolder) {
      const itemType = isPredictorItem(item) ? "predictor" : "dataset";
      onRemoveFromFolder(item.id, itemType);
    }
  };

  const renderItem = (
    item: PredictorItem | DatasetItem,
    itemType: "predictor" | "dataset"
  ) => {
    const isSelected = selectedItems.has(item.id);
    const isOwner = item.owner;

    return (
      <div
        key={`${itemType}-${item.id}`}
        className={`group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
          isSelected
            ? "border-black bg-gray-50"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}
        onClick={(e) => handleItemClick(item, e)}
      >
        <div className='flex items-center gap-3 min-w-0 flex-1'>
          {/* Item Type Icon */}
          <div className='text-lg flex-shrink-0'>
            {itemType === "predictor" ? "🔮" : "📊"}
          </div>

          {/* Item Info */}
          <div className='min-w-0 flex-1'>
            <h4 className='font-medium text-sm truncate'>{item.title}</h4>
            <div className='flex items-center gap-2 text-xs text-gray-500 mt-1'>
              <span className='capitalize'>{itemType}</span>
              {isPredictorItem(item) && item.status && (
                <>
                  <span>•</span>
                  <span className='px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600'>
                    {item.status}
                  </span>
                </>
              )}
              {isDatasetItem(item) &&
                (item.rows !== undefined || item.sizeMB !== undefined) && (
                  <>
                    <span>•</span>
                    <div className='flex items-center gap-1'>
                      {item.rows !== undefined && (
                        <span>{item.rows.toLocaleString()} rows</span>
                      )}
                      {item.sizeMB !== undefined && (
                        <span>{item.sizeMB} MB</span>
                      )}
                    </div>
                  </>
                )}
            </div>
          </div>
        </div>

        {/* Item Actions */}
        {isSelected && (
          <div className='flex items-center gap-1 ml-2'>
            {isOwner && canEdit ? (
              <>
                <button
                  onClick={(e) => handleItemEdit(item, e)}
                  disabled={isLoading}
                  className='rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                >
                  Edit
                </button>
                <button
                  onClick={(e) => handleItemDelete(item, e)}
                  disabled={isLoading}
                  className='rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={(e) => handleItemView(item, e)}
                disabled={isLoading}
                className='rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                View
              </button>
            )}
            {showRemoveAction && (
              <button
                onClick={(e) => handleRemoveFromFolder(item, e)}
                disabled={isLoading}
                className='rounded px-2 py-1 text-xs hover:bg-gray-100 text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                title={isLoading ? "Processing..." : "Remove from folder"}
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <div className='p-4 text-center text-gray-500 text-sm'>
        No items in this folder
      </div>
    );
  }

  return (
    <div className='p-4 space-y-4'>
      {/* Predictors Section */}
      {predictors.length > 0 && (
        <div>
          <h5 className='text-xs font-medium text-gray-700 uppercase tracking-wide mb-2'>
            Predictors ({predictors.length})
          </h5>
          <div className='space-y-2'>
            {predictors.map((item) => renderItem(item, "predictor"))}
          </div>
        </div>
      )}

      {/* Datasets Section */}
      {datasets.length > 0 && (
        <div>
          <h5 className='text-xs font-medium text-gray-700 uppercase tracking-wide mb-2'>
            Datasets ({datasets.length})
          </h5>
          <div className='space-y-2'>
            {datasets.map((item) => renderItem(item, "dataset"))}
          </div>
        </div>
      )}
    </div>
  );
}
