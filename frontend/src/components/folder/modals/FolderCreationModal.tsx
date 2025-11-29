/**
 * ----------------------------------------------------------------------------------
 * FolderCreationModal
 * ----------------------------------------------------------------------------------
 * - Modal for creating new folders with item selection
 * - Allows users to name the folder, set privacy, and select initial items
 * - Supports both predictor and dataset selection
 * - Provides search and filtering for item selection
 * - Validates folder name and handles creation errors
 */

import { useState, useEffect, useMemo } from "react";
import type { CreateFolderRequest } from "../../../lib/folders";
import type { PredictorItem } from "../../PredictorCard";
import type { DatasetItem } from "../../DatasetCard";
import FolderPrivacyToggle from "../ui/FolderPrivacyToggle";

export interface FolderCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (data: CreateFolderRequest) => Promise<void>;
  availablePredictors?: PredictorItem[];
  availableDatasets?: DatasetItem[];
  preselectedItems?: Array<{
    id: string;
    type: 'predictor' | 'dataset';
  }>;
  isLoading?: boolean;
  error?: string | null;
}

interface SelectedItem {
  id: string;
  type: 'predictor' | 'dataset';
  title: string;
}

export default function FolderCreationModal({
  isOpen,
  onClose,
  onCreateFolder,
  availablePredictors = [],
  availableDatasets = [],
  preselectedItems = [],
  isLoading = false,
  error = null,
}: FolderCreationModalProps) {
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);


  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'predictors' | 'datasets'>('predictors');
  const [nameError, setNameError] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFolderName("");
      setFolderDescription("");
      setIsPrivate(false);
      setSearchQuery("");
      setNameError("");
      
      // Set preselected items
      const preselectedIds = new Set(preselectedItems.map(item => item.id));
      setSelectedItems(preselectedIds);
    }
  }, [isOpen]); // Only depend on isOpen to avoid constant resets

  // Validate folder name
  useEffect(() => {
    if (folderName.length > 100) {
      setNameError("Folder name must be 100 characters or less");
    } else if (folderName.trim() && folderName.trim().length < 1) {
      setNameError("Folder name cannot be empty");
    } else {
      setNameError("");
    }
  }, [folderName]);

  // Filter items based on search query
  const filteredPredictors = useMemo(() => {
    if (!searchQuery) return availablePredictors;
    const query = searchQuery.toLowerCase();
    return availablePredictors.filter(item => 
      item.title.toLowerCase().includes(query) ||
      item.notes?.toLowerCase().includes(query)
    );
  }, [availablePredictors, searchQuery]);

  const filteredDatasets = useMemo(() => {
    if (!searchQuery) return availableDatasets;
    const query = searchQuery.toLowerCase();
    return availableDatasets.filter(item => 
      item.title.toLowerCase().includes(query) ||
      item.notes?.toLowerCase().includes(query)
    );
  }, [availableDatasets, searchQuery]);

  // Get selected items with details for display
  const selectedItemsWithDetails = useMemo(() => {
    const items: SelectedItem[] = [];
    
    selectedItems.forEach(id => {
      const predictor = availablePredictors.find(p => p.id === id);
      if (predictor) {
        items.push({ id, type: 'predictor', title: predictor.title });
        return;
      }
      
      const dataset = availableDatasets.find(d => d.id === id);
      if (dataset) {
        items.push({ id, type: 'dataset', title: dataset.title });
      }
    });
    
    return items;
  }, [selectedItems, availablePredictors, availableDatasets]);

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!folderName.trim() || nameError || isLoading) {
      return;
    }

    const initialItems = selectedItemsWithDetails.map(item => ({
      item_type: item.type,
      item_id: item.id,
    }));

    const createData: CreateFolderRequest = {
      name: folderName.trim(),
      description: folderDescription.trim() || undefined,
      is_private: isPrivate,
      initial_items: initialItems.length > 0 ? initialItems : undefined,
    };

    try {
      await onCreateFolder(createData);
      onClose();
    } catch (err) {
      // Error handling is managed by parent component
    }
  };

  const renderItemList = (items: (PredictorItem | DatasetItem)[], itemType: 'predictor' | 'dataset') => {
    if (items.length === 0) {
      return (
        <div className="text-center text-gray-500 text-sm py-4">
          No {itemType}s available
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {items.map(item => {
          const isSelected = selectedItems.has(item.id);
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                isSelected 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => handleItemToggle(item.id)}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleItemToggle(item.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.title}</div>
                {item.notes && (
                  <div className="text-xs text-gray-500 truncate">{item.notes}</div>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {itemType === 'predictor' ? '🔮' : '📊'}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Create New Folder</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Error Display */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {/* Folder Name */}
            <div>
              <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name *
              </label>
              <input
                id="folderName"
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
                maxLength={100}
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  nameError ? "border-red-300" : "border-gray-300"
                }`}
                disabled={isLoading}
              />
              {nameError && (
                <div className="text-sm text-red-600 mt-1">{nameError}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {folderName.length}/100 characters
              </div>
            </div>

            {/* Folder Description */}
            <div>
              <label htmlFor="folderDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                id="folderDescription"
                value={folderDescription}
                onChange={(e) => setFolderDescription(e.target.value)}
                placeholder="Describe what this folder contains"
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>

            {/* Privacy Setting */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Privacy Setting
              </label>
              <FolderPrivacyToggle
                isPrivate={isPrivate}
                onChange={setIsPrivate}
                disabled={isLoading}
                showLabel={true}
                showDescription={true}
                size="md"
              />
            </div>

            {/* Item Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Add Items to Folder (optional)
              </label>
              
              {/* Selected Items Summary */}
              {selectedItemsWithDetails.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-2">
                    Selected Items ({selectedItemsWithDetails.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedItemsWithDetails.map(item => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs"
                      >
                        {item.type === 'predictor' ? '🔮' : '📊'}
                        {item.title}
                        <button
                          type="button"
                          onClick={() => handleItemToggle(item.id)}
                          className="text-gray-400 hover:text-gray-600 ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>

              {/* Item Type Tabs */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('predictors')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'predictors'
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  disabled={isLoading}
                >
                  Predictors ({filteredPredictors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('datasets')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'datasets'
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  disabled={isLoading}
                >
                  Datasets ({filteredDatasets.length})
                </button>
              </div>

              {/* Item Lists */}
              {activeTab === 'predictors' && renderItemList(filteredPredictors, 'predictor')}
              {activeTab === 'datasets' && renderItemList(filteredDatasets, 'dataset')}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 cursor-pointer shadow-lg shadow-neutral-500/20 transition active:scale-[.95]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!folderName.trim() || Boolean(nameError) || isLoading}
              className="relative overflow-hidden rounded-md bg-blue-600 px-5 py-2.5 text-sm text-white duration-300 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[.95]"
            >
              {isLoading ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}