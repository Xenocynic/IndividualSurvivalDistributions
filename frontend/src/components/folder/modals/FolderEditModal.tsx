/**
 * ----------------------------------------------------------------------------------
 * FolderEditModal
 * ----------------------------------------------------------------------------------
 * Modal for editing folder name and description
 * Provides form validation and error handling
 */

import { useState, useEffect } from "react";
import type { Folder } from "../../../lib/folders";
import { updateFolder } from "../../../lib/folders";

export interface FolderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder;
  onFolderUpdated: (updatedFolder: Folder) => void;
}

export default function FolderEditModal({
  isOpen,
  onClose,
  folder,
  onFolderUpdated,
}: FolderEditModalProps) {
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description || "");
  const [isPrivate, setIsPrivate] = useState(folder.is_private);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when folder changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(folder.name);
      setDescription(folder.description || "");
      setIsPrivate(folder.is_private);
      setError(null);
    }
  }, [isOpen, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Folder name is required");
      return;
    }

    if (name.trim().length > 100) {
      setError("Folder name cannot exceed 100 characters");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedFolder = await updateFolder(folder.folder_id, {
        name: name.trim(),
        description: description.trim(),
        is_private: isPrivate,
      });

      onFolderUpdated(updatedFolder);
      onClose();
    } catch (err: any) {
      console.error("Failed to update folder:", err);
      
      if (err.status === 400 && err.details?.name) {
        setError("You already have a folder with this name");
      } else if (err.status === 403) {
        setError("You don't have permission to edit this folder");
      } else {
        setError("Failed to update folder. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[9999]" 
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Edit Folder</h2>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Folder Name */}
            <div>
              <label htmlFor="folder-name" className="block text-sm font-medium text-gray-700 mb-1">
                Folder Name *
              </label>
              <input
                id="folder-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Enter folder name"
                maxLength={100}
                required
              />
              <div className="text-xs text-gray-500 mt-1">
                {name.length}/100 characters
              </div>
            </div>

            {/* Folder Description */}
            <div>
              <label htmlFor="folder-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="folder-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Optional description for this folder"
                rows={3}
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1">
                {description.length}/500 characters
              </div>
            </div>

            {/* Privacy Setting */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  disabled={isLoading}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Make this folder private
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Private folders are only visible to you and people you share them with
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}