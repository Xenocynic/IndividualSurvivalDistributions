/**
 * ----------------------------------------------------------------------------------
 * RecentFolders
 * ----------------------------------------------------------------------------------
 * - Quick access panel for recently accessed folders
 * - Stores recent folder access in localStorage
 * - Provides one-click navigation to recent folders
 */

import { useState, useEffect } from "react";
import { Clock, Folder as FolderIcon, Lock } from "lucide-react";
import type { Folder } from "../../../lib/folders";

interface RecentFolder {
  folder_id: string;
  name: string;
  is_private: boolean;
  last_accessed: string;
}

interface RecentFoldersProps {
  onFolderSelect: (folderId: string) => void;
  currentFolderId?: string;
  className?: string;
}

const RECENT_FOLDERS_KEY = "kiro_recent_folders";
const MAX_RECENT_FOLDERS = 5;

export default function RecentFolders({
  onFolderSelect,
  currentFolderId,
  className = "",
}: RecentFoldersProps) {
  const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load recent folders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_FOLDERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentFolders(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Failed to load recent folders:", error);
    }
  }, []);

  // Save recent folders to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(recentFolders));
    } catch (error) {
      console.error("Failed to save recent folders:", error);
    }
  }, [recentFolders]);

  // Function to add a folder to recent list
  const addToRecent = (folder: Folder) => {
    const recentFolder: RecentFolder = {
      folder_id: folder.folder_id,
      name: folder.name,
      is_private: folder.is_private,
      last_accessed: new Date().toISOString(),
    };

    setRecentFolders((prev) => {
      // Remove if already exists
      const filtered = prev.filter((f) => f.folder_id !== folder.folder_id);
      // Add to beginning
      const updated = [recentFolder, ...filtered];
      // Keep only the most recent ones
      return updated.slice(0, MAX_RECENT_FOLDERS);
    });
  };

  // Expose the addToRecent function globally so other components can use it
  useEffect(() => {
    (window as any).addFolderToRecent = addToRecent;
    return () => {
      delete (window as any).addFolderToRecent;
    };
  }, []);

  const handleFolderClick = (folderId: string) => {
    onFolderSelect(folderId);
  };

  if (recentFolders.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className='w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-t-lg'
      >
        <div className='flex items-center gap-2'>
          <Clock className='h-4 w-4 text-gray-500' />
          <span className='text-sm font-medium text-gray-900'>
            Recent Folders
          </span>
          <span className='text-xs text-gray-500'>
            ({recentFolders.length})
          </span>
        </div>
        <span className='text-gray-400 text-sm'>{isExpanded ? "▼" : "▶"}</span>
      </button>

      {isExpanded && (
        <div className='border-t border-gray-200'>
          {recentFolders.map((folder) => (
            <button
              key={folder.folder_id}
              onClick={() => handleFolderClick(folder.folder_id)}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                currentFolderId === folder.folder_id
                  ? "bg-blue-50 border-l-2 border-l-blue-500"
                  : ""
              }`}
            >
              <div className='flex items-center gap-2 flex-1 min-w-0'>
                <div className='flex items-center gap-1'>
                  <FolderIcon className='h-4 w-4 text-gray-400' />
                  {folder.is_private && (
                    <Lock className='h-3 w-3 text-gray-400' />
                  )}
                </div>
                <span className='text-sm text-gray-900 truncate'>
                  {folder.name}
                </span>
              </div>
              <span className='text-xs text-gray-500 whitespace-nowrap'>
                {new Date(folder.last_accessed).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Export the function to add folders to recent list
export function addFolderToRecent(folder: Folder) {
  if ((window as any).addFolderToRecent) {
    (window as any).addFolderToRecent(folder);
  }
}
