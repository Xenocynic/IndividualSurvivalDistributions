/**
 * ----------------------------------------------------------------------------------
 * FolderSidebar
 * ----------------------------------------------------------------------------------
 * - Sidebar component that displays all folders for drag-and-drop organization
 * - Only shown on predictor and dataset tabs in dashboard view
 * - Allows dragging items to folders without removing from origin
 * - Supports folder creation and management
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  listMyFolders,
  createFolder,
  type Folder,
  type CreateFolderRequest,
} from "../../../lib/folders";
import { useDragDrop } from "../../../hooks/useDragDrop";
import DroppableFolder from "./DroppableFolder";
import FolderCreationModal from "../modals/FolderCreationModal";

export interface FolderSidebarProps {
  onItemMoved?: (itemId: string, folderId?: string) => void;
  className?: string;
}

export default function FolderSidebar({
  onItemMoved,
  className = "",
}: FolderSidebarProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [processingItems, setProcessingItems] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");

  const handleDrop = async (item: any, targetFolderId?: string) => {
    const itemKey = `${item.id}-${targetFolderId || "main"}`;

    // Prevent duplicate processing
    if (processingItems.has(itemKey)) {
      return;
    }

    // Set processing state
    setProcessingItems((prev) => new Set(prev).add(itemKey));

    // Set loading state for the specific folder
    if (targetFolderId) {
      setLoadingFolders((prev) => new Set(prev).add(targetFolderId));
    }

    try {
      // Call the useDragDrop moveItem function - it will update counts via callback
      await moveItem(item, targetFolderId);

      // Call the parent callback (non-blocking)
      if (onItemMoved) {
        onItemMoved(item.id, targetFolderId); // Don't await this
      }
    } catch (error) {
      console.error("Failed to process drop:", error);

      setError("Failed to move item");
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      // Clear processing state
      setProcessingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemKey);
        return newSet;
      });

      // Note: Loading state is cleared in the useDragDrop callback after data updates
    }
  };

  const { moveItem } = useDragDrop(
    async (_itemId, folderId, _folderData, originalFolderId) => {
      // After API call, refresh the affected folder(s) to get accurate count
      try {
        const updatedFolders = await listMyFolders();

        setFolders((prev) =>
          prev.map((folder) => {
            // Update target folder (when adding to folder)
            if (folderId && folder.folder_id === folderId) {
              const updatedFolder = updatedFolders.find(
                (f) => f.folder_id === folderId
              );
              return updatedFolder || folder;
            }

            // Update source folder (when removing from folder)
            if (originalFolderId && folder.folder_id === originalFolderId) {
              const updatedFolder = updatedFolders.find(
                (f) => f.folder_id === originalFolderId
              );
              return updatedFolder || folder;
            }

            return folder;
          })
        );

        // Clear loading state after folder data is updated
        if (folderId) {
          setLoadingFolders((prev) => {
            const newSet = new Set(prev);
            newSet.delete(folderId);
            return newSet;
          });
        }
        if (originalFolderId) {
          setLoadingFolders((prev) => {
            const newSet = new Set(prev);
            newSet.delete(originalFolderId);
            return newSet;
          });
        }
      } catch (error) {
        console.error("Failed to refresh folder data:", error);
        // Clear loading state even on error
        if (folderId) {
          setLoadingFolders((prev) => {
            const newSet = new Set(prev);
            newSet.delete(folderId);
            return newSet;
          });
        }
        if (originalFolderId) {
          setLoadingFolders((prev) => {
            const newSet = new Set(prev);
            newSet.delete(originalFolderId);
            return newSet;
          });
        }
      }
    }
  );

  // Load user's folders
  useEffect(() => {
    // Load folders immediately without delay
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      setError(null);
      const userFolders = await listMyFolders();
      setFolders(userFolders);
    } catch (err: any) {
      console.error("Failed to load folders:", err);
      setError("Failed to load folders");
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (data: CreateFolderRequest) => {
    try {
      setCreatingFolder(true);
      const newFolder = await createFolder(data);
      setFolders((prev) => [newFolder, ...prev]);
      setShowCreateModal(false);
    } catch (err: any) {
      console.error("Failed to create folder:", err);
      throw err;
    } finally {
      setCreatingFolder(false);
    }
  };

  // Check if a specific folder is loading
  const isFolderLoading = useCallback(
    (folderId: string) => {
      return loadingFolders.has(folderId);
    },
    [loadingFolders]
  );

  // Filter folders based on search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) {
      return folders;
    }

    const query = searchQuery.trim().toLowerCase();
    return folders.filter(
      (folder) =>
        folder.name.toLowerCase().includes(query) ||
        (folder.description && folder.description.toLowerCase().includes(query))
    );
  }, [folders, searchQuery]);

  return (
    <>
      <aside className={`w-64 shrink-0 ${className}`}>
        <div className='rounded-md border border-black/10 bg-gray-50 h-full'>
          {/* Header */}
          <div className='border-b border-black/10 bg-gray-100'>
            <div className='flex items-center justify-between px-3 py-2'>
              <div className='text-sm font-semibold text-gray-700'>
                📁 Folders
              </div>
              <div className='flex items-center gap-1'>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className='rounded border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100'
                  title='Create new folder'
                >
                  ➕
                </button>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className='rounded border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100'
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed ? "▸" : "▾"}
                </button>
              </div>
            </div>

            {/* Search Input */}
            {!isCollapsed && (
              <div className='px-3 pb-2 relative'>
                <input
                  type='text'
                  placeholder='Search folders...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full rounded border border-black/10 px-2 py-1 pr-6 text-xs outline-none focus:border-black/30 focus:ring-1 focus:ring-black/10'
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className='absolute right-4 top-1 text-gray-400 hover:text-gray-600 text-xs'
                    title='Clear search'
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {!isCollapsed && (
            <div className='p-2 space-y-2 max-h-96 overflow-y-auto'>
              {loading ? (
                <div className='text-xs text-gray-500 text-center py-4'>
                  Loading folders...
                </div>
              ) : error ? (
                <div className='text-xs text-red-600 text-center py-4'>
                  <div>{error}</div>
                  <button
                    onClick={loadFolders}
                    className='mt-2 underline hover:no-underline'
                  >
                    Retry
                  </button>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className='text-xs text-gray-500 text-center py-4'>
                  {searchQuery.trim() ? (
                    <>
                      <div>No folders match "{searchQuery}"</div>
                      <button
                        onClick={() => setSearchQuery("")}
                        className='mt-2 text-blue-600 underline hover:no-underline'
                      >
                        Clear search
                      </button>
                    </>
                  ) : (
                    <>
                      <div>No folders yet</div>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className='mt-2 text-blue-600 underline hover:no-underline'
                      >
                        Create your first folder
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Folder List */}
                  {filteredFolders.map((folder) => (
                    <DroppableFolder
                      key={folder.folder_id}
                      folder={folder}
                      onDrop={handleDrop}
                      isLoading={() => isFolderLoading(folder.folder_id)}
                      className={`rounded-md border border-black/10 bg-white p-3 hover:bg-gray-50 transition-opacity ${
                        isFolderLoading(folder.folder_id) ? "opacity-60" : ""
                      }`}
                    >
                      <div className='text-xs'>
                        <div className='font-medium text-gray-700 truncate'>
                          📁 {folder.name}
                        </div>
                        <div className='text-gray-500 mt-1 flex items-center justify-between'>
                          <span className='flex items-center gap-1'>
                            {folder.item_count} items
                            {isFolderLoading(folder.folder_id) && (
                              <div className='animate-spin rounded-full h-2 w-2 border border-gray-400 border-t-transparent'></div>
                            )}
                          </span>
                          {folder.is_private && (
                            <span title='Private folder'>🔒</span>
                          )}
                        </div>
                        {folder.description && (
                          <div className='text-gray-400 mt-1 text-[10px] truncate'>
                            {folder.description}
                          </div>
                        )}
                      </div>
                    </DroppableFolder>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Search Results / Drag Instructions */}
          {!isCollapsed && !loading && (
            <div className='border-t border-black/10 px-3 py-2 bg-gray-100'>
              {searchQuery.trim() ? (
                <div className='text-[10px] text-gray-500 text-center'>
                  {filteredFolders.length} folder
                  {filteredFolders.length !== 1 ? "s" : ""} found
                </div>
              ) : filteredFolders.length > 0 ? (
                <div className='text-[10px] text-gray-500 text-center'>
                  Drag items to copy to folders
                </div>
              ) : null}
            </div>
          )}
        </div>
      </aside>

      {/* Folder Creation Modal */}
      <FolderCreationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateFolder={handleCreateFolder}
        isLoading={creatingFolder}
      />
    </>
  );
}
