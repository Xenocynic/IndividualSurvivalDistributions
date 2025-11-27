/**
 * ----------------------------------------------------------------------------------
 * FolderCard
 * ----------------------------------------------------------------------------------
 * - Shows a folder, its metadata, and optionally its contents.
 * - Can render inline actions (Edit / Share / Delete) if the user may manage.
 * - Uses DroppableFolder wrapper for drag/drop targets.
 *
 * Visual / accessibility cleanup:
 * - Replaces emojis / triangles with lucide-react icons.
 * - Uses <PrivacyBadge /> for consistent public/private chip.
 * - Raises text contrast (gray-900 / gray-600).
 * - Normalizes header action buttons to bordered pills.
 */

// FolderCard.tsx

import { useState } from "react";
import DroppableFolder from "./DroppableFolder";
import FolderItemList from "./FolderItemList";
import PrivacyBadge from "../../PrivacyBadge";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  FolderOpen,
  Users,
  Pencil,
  Trash2,
  Share,
} from "lucide-react";
import type { DragItem } from "../../../types/dragDrop"; 

export interface FolderCardProps {
  folder: any;
  expanded: boolean;
  onToggleExpand: (folderId: string) => void;

  onItemSelect?: (
    itemId: string,
    itemType: "predictor" | "dataset"
  ) => void;
  onItemEdit?: (
    itemId: string,
    itemType: "predictor" | "dataset"
  ) => void;
  onItemDelete?: (
    itemId: string,
    itemType: "predictor" | "dataset"
  ) => void;
  onItemView?: (
    itemId: string,
    itemType: "predictor" | "dataset"
  ) => void;
  onRemoveFromFolder?: (
    itemId: string,
    itemType: "predictor" | "dataset"
  ) => void;

  onEdit?: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
  onShare?: (folderId: string) => void;
  onDrop?: (item: DragItem, targetFolderId?: string) => void;

  selectedItems?: Set<string>;
  currentUserId?: string | number | undefined;

  canEdit: boolean;
  isLoading?: boolean;
}

export default function FolderCard({
  folder,
  expanded,
  onToggleExpand,
  onItemSelect,
  onItemEdit,
  onItemDelete,
  onItemView,
  onRemoveFromFolder,
  onEdit,
  onDelete,
  onShare,
  onDrop,              
  selectedItems,
  currentUserId,
  canEdit,
  isLoading,
}: FolderCardProps) {
  const [showActions, setShowActions] = useState(false);

  const handleToggleExpand = () => {
    onToggleExpand(folder.folder_id);
  };

  const isOwner =
    currentUserId && folder?.owner?.id
      ? String(folder.owner.id) === String(currentUserId)
      : false;

  const itemCount = folder.item_count ?? folder.items?.length ?? 0;

  const items = Array.isArray(folder.items) ? folder.items : [];

  return (
    <DroppableFolder
      folder={folder}
      isLoading={(_itemId: string) => Boolean(isLoading)}
      onDrop={onDrop} 
      className="rounded-xl border border-black/10 bg-white shadow-sm transition-all duration-200"
    >
      <div
        className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2 text-sm">
            <div className="flex items-center gap-2">
              {folder.is_private ? (
                <Lock className="h-4 w-4 text-gray-700" />
              ) : (
                <FolderOpen className="h-4 w-4 text-gray-700" />
              )}

              <button
                className="flex items-center gap-2 font-semibold text-gray-900 hover:underline"
                onClick={handleToggleExpand}
              >
                <span className="truncate">{folder.name}</span>
                <span className="inline-flex items-center text-xs font-normal text-gray-600">
                  {itemCount} item{itemCount !== 1 ? "s" : ""}
                </span>
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                )}
              </button>
            </div>

            <PrivacyBadge isPublic={!folder.is_private} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-600">
            {folder.description ? (
              <span className="truncate">{folder.description}</span>
            ) : null}

            {!isOwner && folder?.owner?.username ? (
              <>
                <span>•</span>
                <span>by {folder.owner.username}</span>
              </>
            ) : null}

            {Array.isArray(folder.permissions) &&
            folder.permissions.length > 0 ? (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-600">
                    shared with {folder.permissions.length} user
                    {folder.permissions.length !== 1 ? "s" : ""}
                  </span>
                </span>
              </>
            ) : null}
          </div>
        </div>

        {canEdit && (isOwner || folder.can_manage) && showActions && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {onEdit && (
              <button
                className="inline-flex items-center rounded-md border border-black/10 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(folder.folder_id);
                }}
              >
                <Pencil className="h-5 w-3" />
              </button>
            )}
            {onShare && (
              <button
                className="inline-flex items-center rounded-md border border-black/10 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(folder.folder_id);
                }}
              >
                <Share className="h-5 w-3" />
              </button>
            )}
            {onDelete && (
              <button
                className="inline-flex items-center rounded-md border border-black/10 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(folder.folder_id);
                }}
              >
                <Trash2 className="h-5 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-black/10 p-4">
          {items.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              {isLoading ? "Loading items..." : "No items in this folder"}
            </div>
          ) : (
            <FolderItemList
              items={items}
              selectedItems={selectedItems}
              onSelectItem={onItemSelect}
              onEditItem={onItemEdit}
              onDeleteItem={onItemDelete}
              onViewItem={onItemView}
              onRemoveFromFolder={onRemoveFromFolder}
            />
          )}
        </div>
      )}
    </DroppableFolder>
  );
}
