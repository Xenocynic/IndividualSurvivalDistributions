/**
 * ----------------------------------------------------------------------------------
 * FolderCard
 * ----------------------------------------------------------------------------------
 * - Displays a folder with expand/collapse functionality
 * - Shows folder name, item count, privacy status, and owner information
 * - Supports drag and drop operations (drop target for items)
 * - Provides actions for folder owners (edit, delete, share)
 * - Expandable to show folder contents inline
 */

import { useState } from "react";
import type { Folder } from "../../../lib/folders";
import { canManageFolder, getVisibleItemCount } from "../../../lib/folders";
import FolderItemList from "./FolderItemList";
import DroppableFolder from "./DroppableFolder";
import FolderSharingModal from "../modals/FolderSharingModal";
import FolderEditModal from "../modals/FolderEditModal";
import FolderDuplicateModal from "../modals/FolderDuplicateModal";
import FolderContentSearch from "../navigation/FolderContentSearch";
import type { PredictorItem } from "../../PredictorCard";
import type { DatasetItem } from "../../DatasetCard";

export interface FolderCardProps {
  folder: Folder;
  expanded?: boolean;
  onToggleExpand?: (folderId: string) => void;
  onEdit?: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
  onShare?: (folderId: string) => void;
  onDuplicate?: (folderId: string) => void;
  onItemSelect?: (itemId: string, itemType: "predictor" | "dataset") => void;
  onItemEdit?: (itemId: string, itemType: "predictor" | "dataset") => void;
  onItemDelete?: (itemId: string, itemType: "predictor" | "dataset") => void;
  onItemView?: (itemId: string, itemType: "predictor" | "dataset") => void;
  onRemoveFromFolder?: (
    itemId: string,
    itemType: "predictor" | "dataset"
  ) => void;
  selectedItems?: Set<string>;
  currentUserId?: number;
  canEdit?: boolean;
  isLoading?: boolean;
}

export default function FolderCard({
  folder,
  expanded = false,
  onToggleExpand,
  onEdit,
  onDelete,
  onShare,
  onDuplicate,
  onItemSelect,
  onItemEdit,
  onItemDelete,
  onItemView,
  onRemoveFromFolder,
  selectedItems = new Set(),
  currentUserId,
  canEdit = false,
  isLoading = false,
}: FolderCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [folderData, setFolderData] = useState(folder);
  const [filteredItems, setFilteredItems] = useState<
    Array<PredictorItem | DatasetItem>
  >(folder.items || []);
  const isOwner = currentUserId ? folder.owner.id === currentUserId : false;
  const canManage = canEdit && canManageFolder(folder, currentUserId);

  // Determine visible item count based on user permissions
  const visibleItemCount = getVisibleItemCount(folder, currentUserId);

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand(folder.folder_id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Close any other modals first
    setShowSharingModal(false);
    setShowDuplicateModal(false);
    // Then open edit modal
    setShowEditModal(true);
    // Also call the parent callback if provided
    if (onEdit && canManage) {
      onEdit(folder.folder_id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && canManage) {
      onDelete(folder.folder_id);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canManage) {
      // Close any other modals first
      setShowEditModal(false);
      setShowDuplicateModal(false);
      // Then open sharing modal
      setShowSharingModal(true);
      // Also call the parent callback if provided
      if (onShare) {
        onShare(folder.folder_id);
      }
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canManage) {
      // Close any other modals first
      setShowEditModal(false);
      setShowSharingModal(false);
      // Then open duplicate modal
      setShowDuplicateModal(true);
      // Also call the parent callback if provided
      if (onDuplicate) {
        onDuplicate(folder.folder_id);
      }
    }
  };

  const handleFolderUpdated = (updatedFolder: Folder) => {
    setFolderData(updatedFolder);
  };

  const handleFolderDuplicated = (_duplicatedFolder: Folder) => {
    // The parent component should handle refreshing the folder list
    // This callback is mainly for UI feedback
  };

  return (
    <DroppableFolder
      folder={folder}
      isLoading={(_itemId) => isLoading}
      className='rounded-xl'
    >
      <div
        className={`group relative rounded-xl border bg-white shadow-card transition-all duration-200 border-black/10 hover:ring-1 hover:ring-black/30 ${
          isLoading ? "opacity-90 pointer-events-none" : ""
        }`}
        onMouseEnter={() => !isLoading && setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Folder Header */}
        <div className='p-4'>
          <div className='flex items-start justify-between'>
            {/* Left side: Folder icon, name, and info */}
            <div
              className={`flex items-center gap-3 min-w-0 flex-1 ${
                isLoading ? "cursor-not-allowed opacity-75" : "cursor-pointer"
              }`}
              onClick={isLoading ? undefined : handleToggleExpand}
            >
              {/* Folder Icon and Expand/Collapse */}
              <div className='flex items-center gap-2 flex-shrink-0'>
                <div className='text-lg'>
                  {folderData.is_private ? "🔒" : "📁"}
                </div>
                {visibleItemCount > 0 && (
                  <button
                    disabled={isLoading}
                    className='text-gray-400 hover:text-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isLoading) handleToggleExpand();
                    }}
                  >
                    {expanded ? "▼" : "▶"}
                  </button>
                )}
              </div>

              {/* Folder Info */}
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2 mb-1'>
                  <h3 className='font-medium text-sm leading-snug truncate'>
                    {folderData.name}
                  </h3>
                  {/* Privacy Status Badge */}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      folderData.is_private
                        ? "bg-gray-100 text-gray-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {folderData.is_private ? "Private" : "Public"}
                  </span>
                </div>
                <div className='flex items-center gap-2 text-xs text-gray-500'>
                  <span>
                    {visibleItemCount} item{visibleItemCount !== 1 ? "s" : ""}
                  </span>
                  {!isOwner && (
                    <>
                      <span>•</span>
                      <span>by {folder.owner.username}</span>
                    </>
                  )}
                  {folder.permissions && folder.permissions.length > 0 && (
                    <>
                      <span>•</span>
                      <span className='flex items-center gap-1'>
                        <span className='text-blue-600'>👥</span>
                        shared with {folder.permissions.length} user
                        {folder.permissions.length !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  {!isOwner && (
                    <>
                      <span>•</span>
                      <span className='flex items-center gap-1 text-blue-600'>
                        <span>👥</span>
                        shared with you
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Action Menu */}
            {canManage && (
              <div
                className={`flex items-center gap-1 ml-3 bg-white rounded-md px-2 py-1 shadow-sm transition-opacity ${
                  showActions && !isLoading
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <button
                  onClick={handleEdit}
                  disabled={isLoading}
                  className='rounded px-2 py-1 text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  title='Edit folder'
                >
                  Edit
                </button>
                <button
                  onClick={handleDuplicate}
                  disabled={isLoading}
                  className='rounded px-2 py-1 text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  title='Duplicate folder'
                >
                  Duplicate
                </button>
                <button
                  onClick={handleShare}
                  disabled={isLoading}
                  className='rounded px-2 py-1 text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  title='Share folder'
                >
                  Share
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className='rounded px-2 py-1 text-xs hover:bg-gray-50 text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  title='Delete folder'
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Folder Description */}
        {folderData.description && (
          <div className='px-4 pb-4 border-t border-gray-50 pt-3 mt-1'>
            <p
              className='text-sm text-gray-600'
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {folderData.description}
            </p>
          </div>
        )}

        {/* Expanded Content */}
        {expanded && visibleItemCount > 0 && (
          <div className='border-t border-gray-100'>
            {/* Content Search */}
            {(folder.items || []).length > 3 && (
              <div className='p-4 border-b border-gray-100'>
                <FolderContentSearch
                  items={folder.items || []}
                  onFilteredItemsChange={setFilteredItems}
                  placeholder={`Search ${folder.items?.length || 0} items...`}
                />
              </div>
            )}

            <FolderItemList
              items={filteredItems}
              selectedItems={selectedItems}
              onItemSelect={onItemSelect}
              onItemEdit={onItemEdit}
              onItemDelete={onItemDelete}
              onItemView={onItemView}
              onRemoveFromFolder={onRemoveFromFolder}
              canEdit={canEdit}
              showRemoveAction={canManage}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Empty State for Expanded Folder */}
        {expanded && visibleItemCount === 0 && (
          <div className='border-t border-gray-100 p-4 text-center text-gray-500 text-sm'>
            {isOwner ? "No items in this folder" : "No visible items"}
          </div>
        )}
      </div>

      {/* Folder Sharing Modal */}
      <FolderSharingModal
        isOpen={showSharingModal}
        onClose={() => setShowSharingModal(false)}
        folder={folderData}
        onPermissionsUpdated={() => {
          // Refresh folder data if needed
          // This could trigger a parent component refresh
        }}
      />

      {/* Folder Edit Modal */}
      <FolderEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        folder={folderData}
        onFolderUpdated={handleFolderUpdated}
      />

      {/* Folder Duplicate Modal */}
      <FolderDuplicateModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        folder={folderData}
        onFolderDuplicated={handleFolderDuplicated}
      />
    </DroppableFolder>
  );
}
