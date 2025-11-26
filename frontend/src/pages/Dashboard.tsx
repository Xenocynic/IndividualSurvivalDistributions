/**
 * DASHBOARD
 * (Predictors & Datasets)
 *
 * Purpose:
 * - Renders a two-tab workspace: "Predictors" and "Datasets".
 * - Shares a single search box and an ownership filter (All / Owner / Viewer) across both tabs.
 * - Has a sticky toolbar (tabs + search + filter + create) that stays visible while scrolling.
 * - Grid shows cards; clicking a card toggles its "selected" state:
 * - "Create" menu can add a Predictor or Dataset; after creating:
 *
 * Implementation notes (UPDATED):
 * - TanStack Query (useQuery) manages data fetching and caching.
 * - TanStack Query (useMutation) handles server-side updates.
 * - Local state holds UI state (activeTab, query, ownership, selection, etc.).
 * - useMemo filters each list by query + ownership.
 * - Clicking the page background clears any selection.
 * - A small modal handles delete confirmation.
 *
 * TO DO:
 * - Navigate to actual edit / view routes instead of alert() stubs.
 */

import { useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Toolbar from "../components/Toolbar";
import PredictorCard, { type PredictorItem } from "../components/PredictorCard";
import DatasetCard, { type DatasetItem } from "../components/DatasetCard";
import {
  FolderCard,
  FolderCreationModal,
  FolderSidebar,
  RecentFolders,
  DroppableFolder,
} from "../components/folder";
import { addFolderToRecent } from "../components/folder/navigation/RecentFolders";
import { DeleteConfirmation } from "../components/DeleteConfirmation"; // Ensure this import matches your filename
import DragDropProvider from "../components/DragDropProvider";

import type { Ownership } from "../components/FilterMenu";
import type { DragItem } from "../types/dragDrop";
import { useAuth } from "../auth/AuthContext";
import { useDragDrop } from "../hooks/useDragDrop";
import { api } from "../lib/apiClient";
import {
  downloadDatasetFile,
  deleteDataset,
  mapApiDatasetToUi,
  isUserOwner,
} from "../lib/datasets";
import { deletePredictor } from "../lib/predictors";
import { mapApiPredictorToUi } from "../lib/predictors";
import {
  listMyFolders,
  createFolder,
  deleteFolder,
  removeItemFromFolder,
  mapApiFolderToUi,
  type CreateFolderRequest,
  handleFolderApiError,
} from "../lib/folders";
import {
  sortFolders,
  filterFoldersByType,
  DEFAULT_FOLDER_SORT,
} from "../lib/folderUtils";
import type { FolderSortOption, FolderType } from "../components/folder";

type Tab = "predictors" | "datasets" | "folders";
type DeleteType = "predictor" | "dataset" | "folder";

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentUserId = useMemo(
    () => (user as any)?.id ?? (user as any)?.pk,
    [user]
  );
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // derive activeTab from URL (?tab=predictors|datasets|folders)
  const activeTab: Tab = (() => {
    const q = searchParams.get("tab");
    return q === "datasets" || q === "folders" ? (q as Tab) : "predictors";
  })();

  // when a tab button is clicked, update the URL
  const selectTab = (t: Tab) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      sp.set("tab", t);
      return sp;
    }, { replace: true }); // avoid history spam
    clearSelection();
  };

  // --- TANSTACK QUERY INTEGRATION ---

  // 1. Fetch Predictors
  const { 
    data: predictors = [], 
    isLoading: isPredictorsLoading, 
  } = useQuery({
    queryKey: ['predictors'],
    queryFn: async () => {
      const data = await api.get<PredictorItem[]>(`/api/predictors/`);
      return Array.isArray(data) ? data : [];
    },
    // Use select to transform data. This runs only when data changes.
    select: (data) => data.map((it) => mapApiPredictorToUi(it, currentUserId)),
    // Optimization: Only fetch predictors if we are on that tab (optional, but saves bandwidth)
    enabled: activeTab === 'predictors',
    staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
  });

  // 2. Fetch Datasets
  const { 
    data: datasets = [], 
    isLoading: isDatasetsLoading 
  } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const data = await api.get<DatasetItem[]>(`/api/datasets/`);
      return Array.isArray(data) ? data : [];
    },
    select: (data) => data.map((it) => mapApiDatasetToUi(it, currentUserId)),
    enabled: activeTab === 'datasets',
    staleTime: 1000 * 60 * 5,
  });

  // 3. Fetch Folders
  // Note: We always fetch folders because the Sidebar might need them, or for drag/drop targets
  const { 
    data: folders = [], 
    isLoading: isFoldersLoading,
  } = useQuery({
    queryKey: ['folders'],
    queryFn: listMyFolders,
    select: (data) => Array.isArray(data) ? data.map(mapApiFolderToUi) : [],
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Determine global loading state based on active tab
  const isLoading = 
    (activeTab === "predictors" && isPredictorsLoading) ||
    (activeTab === "datasets" && isDatasetsLoading) ||
    (activeTab === "folders" && isFoldersLoading);

  // --- MUTATIONS ---

  // Delete Predictor Mutation
  const deletePredictorMutation = useMutation({
    mutationFn: deletePredictor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictors'] });
      // Also invalidate folders as they might contain this predictor
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    }
  });

  // Delete Dataset Mutation
  const deleteDatasetMutation = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    }
  });

  // Create Folder Mutation
  const createFolderMutation = useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
    onError: (error: any) => {
      const folderError = handleFolderApiError(error);
      setFolderError(folderError.message);
    }
  });

  // Delete Folder Mutation
  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    }
  });

  // Remove Item From Folder Mutation
  const removeFromFolderMutation = useMutation({
    mutationFn: ({ folderId, itemType, itemId }: { folderId: string, itemType: "predictor" | "dataset", itemId: string }) => 
      removeItemFromFolder(folderId, itemType, itemId),
    onSuccess: (_, variables) => {
      // Refresh folders to update counts and item lists
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      // Refresh the specific list (predictors or datasets) to update the "folderId" property on items
      // so they reappear in the main list if that logic is based on folderId presence
      if (variables.itemType === 'predictor') {
        queryClient.invalidateQueries({ queryKey: ['predictors'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['datasets'] });
      }
    }
  });

  // --- LOCAL STATE ---

  // Combined selection state
  const [selection, setSelection] = useState({
    predictorId: null as string | null,
    datasetId: null as string | null,
  });

  // Combined tab state
  const [tabState, setTabState] = useState({
    predictorQuery: "",
    datasetQuery: "",
    folderQuery: "",
    predictorOwnership: "all" as Ownership,
    datasetOwnership: "all" as Ownership,
    folderOwnership: "all" as Ownership,
  });

  // UNIFIED DELETE STATE
  const [deleteContext, setDeleteContext] = useState<{
    id: string;
    title: string;
    type: DeleteType;
  } | null>(null);

  // folder management
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // folder-specific filters (search will use main query state)
  const [folderSortOption, setFolderSortOption] =
    useState<FolderSortOption>(DEFAULT_FOLDER_SORT);
  const [folderTypeFilter, setFolderTypeFilter] = useState<FolderType>("all");
  const [currentFolderView, setCurrentFolderView] = useState<string | null>(
    null
  );

  // drag and drop
  // Note: We use mutation state instead of manual loading sets, 
  // but keeping a local set for granular UI feedback if needed is fine.
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  const { moveItem, isItemLoading } = useDragDrop(
    () => {
      // Callback after successful drop/move
      // We simply tell Query to refresh the relevant data
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['predictors'] });
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    }
  );

  // filter functionality for predictors and datasets
  const filteredPredictors = useMemo(() => {
    if (!tabState.predictorQuery && tabState.predictorOwnership === 'all') {
      return predictors;
    }
    
    const q = tabState.predictorQuery.trim().toLowerCase();
    return predictors.filter(it => {
      if (q && !it.title.toLowerCase().includes(q)) return false;
      if (tabState.predictorOwnership === 'owner' && !it.owner) return false;
      if (tabState.predictorOwnership === 'viewer' && it.owner) return false;
      return true;
    });
  }, [predictors, tabState.predictorQuery, tabState.predictorOwnership]);

  const filteredDatasets = useMemo(() => {
    if (!tabState.datasetQuery && tabState.datasetOwnership === 'all') {
      return datasets;
    }
    
    const q = tabState.datasetQuery.trim().toLowerCase();
    return datasets.filter(it => {
      const title = it?.title ?? "";
      if (q && !title.toLowerCase().includes(q)) return false;
      if (tabState.datasetOwnership === 'owner' && !it.owner) return false;
      if (tabState.datasetOwnership === 'viewer' && it.owner) return false;
      return true;
    });
  }, [datasets, tabState.datasetQuery, tabState.datasetOwnership]);

  // filter folders based on search, ownership, type, and sorting
  const filteredFolders = useMemo(() => {
    let list = folders;

    // Apply ownership filter
    list = list.filter((folder) => {
      const isOwner = currentUserId ? folder.owner.id === currentUserId : false;
      if (tabState.folderOwnership === "owner") return isOwner;
      if (tabState.folderOwnership === "viewer") return !isOwner;
      return true;
    });

    // Apply search query (searches both folders and items)
    if (tabState.folderQuery.trim()) {
      const q = tabState.folderQuery.trim().toLowerCase();
      list = list.filter((folder) => {
        // Search in folder name and description
        const folderMatch =
          folder.name.toLowerCase().includes(q) ||
          (folder.description && folder.description.toLowerCase().includes(q));

        // Search in folder contents
        const contentMatch = folder.items?.some(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            (item.notes && item.notes.toLowerCase().includes(q))
        );

        return folderMatch || contentMatch;
      });
    }

    // Apply type filter
    list = filterFoldersByType(list, folderTypeFilter);

    // Apply sorting
    list = sortFolders(list, folderSortOption);

    return list;
  }, [
    folders,
    tabState.folderQuery,
    tabState.folderOwnership,
    folderTypeFilter,
    folderSortOption,
    currentUserId,
  ]);

  // if you click, you select it and can choose to edit or delete / view
  const toggleSelect = useCallback((id: string) => {
    if (activeTab === "predictors") {
      setSelection(prev => ({
        predictorId: prev.predictorId === id ? null : id,
        datasetId: null
      }));
    } else {
      setSelection(prev => ({
        datasetId: prev.datasetId === id ? null : id,
        predictorId: null
      }));
    }
  }, [activeTab]);

  // remove selection established above
  const clearSelection = useCallback(() => {
    setSelection({ predictorId: null, datasetId: null });
  }, []);

  // create Predictor - navigate to the Create Predictor page
  const createPredictor = useCallback(() => {
    navigate("/predictors/new");
  }, [navigate]);

  // create Dataset - navigate to the Upload/Create Dataset page
  const addDataset = useCallback(() => {
    navigate("/datasets/new");
  }, [navigate]);

  // Folder management functions
  const handleCreateFolder = useCallback(() => {
    setShowFolderModal(true);
    setFolderError(null);
  }, []);

  async function handleFolderCreation(data: CreateFolderRequest) {
    // Rely on Mutation loading state
    setFolderError(null);
    try {
      await createFolderMutation.mutateAsync(data);
      setShowFolderModal(false);
    } catch (error) {
       // handled in onError of mutation
    }
  }

  function handleToggleFolderExpansion(folderId: string) {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
        // Add to recent folders when expanded
        const folder = folders.find((f) => f.folder_id === folderId);
        if (folder) {
          addFolderToRecent(folder);
        }
      }
      return newSet;
    });
  }

  function handleRecentFolderSelect(folderId: string) {
    setCurrentFolderView(folderId);
    setExpandedFolders((prev) => new Set(prev).add(folderId));
    // Scroll to the folder
    setTimeout(() => {
      const element = document.getElementById(`folder-${folderId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }

  const handleRemoveFromFolder = useCallback(async (
    itemId: string,
    itemType: "predictor" | "dataset",
    folderId: string
  ) => {
    setLoadingFolders((prev) => new Set(prev).add(folderId));

    try {
      await removeFromFolderMutation.mutateAsync({ folderId, itemType, itemId });
      // No manual local state updates needed; Query cache invalidation handles it
    } catch (error: any) {
      console.error("Failed to remove item from folder:", error);
    } finally {
      setLoadingFolders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
    }
  }, [removeFromFolderMutation]);

  const handleDrop = useCallback((item: DragItem, folderId?: string) => {
    moveItem(item, folderId);
  }, [moveItem]);

  // navigate to edit page
  const editItem = useCallback((id: string) => {
    if (activeTab === "predictors") {
      navigate(`/predictors/${id}/edit`);
    } else {
      navigate(`/datasets/${id}/edit`);
    }
  }, [activeTab, navigate]);

  // navigate to view page
  const viewItem = useCallback((id: string) => {
    if (activeTab === "predictors") {
      navigate(`/predictors/${id}`, { state: { from: "dashboard" } });
    } else {
      navigate(`/datasets/${id}/view`);
    }
  }, [activeTab, navigate]);

  // download dataset file
  async function downloadItem(id: string, allowAdminAccess: boolean, isOwner: boolean) {
    try {
      // if admin access blocked, show alert and return
      if (!isOwner && !allowAdminAccess){
        alert("Download blocked: External access to this dataset has been disabled.");
        return;
      }
      const datasetId = parseInt(id);
      const { blob, filename } = await downloadDatasetFile(datasetId);

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanFilename = filename.replace(/^"|"$/g, '');
      link.href = url;
      link.download = cleanFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Download failed: ${error.message || "Unknown error"}`);
    }
  }

  // Delete Handler

  // prompt delete
  const promptDelete = useCallback((id: string, title: string, type: DeleteType) => {
    setDeleteContext({ id, title, type });
  }, []);

  // confirm delete 
  async function handleConfirmDelete() {
    if (!deleteContext) return;
    const { id, type } = deleteContext;

    try {
      if (type === "predictor") {
        await deletePredictorMutation.mutateAsync(id);
        if (selection.predictorId === id) setSelection(prev => ({ ...prev, predictorId: null }));
      } 
      else if (type === "dataset") {
        await deleteDatasetMutation.mutateAsync(parseInt(id));
        if (selection.datasetId === id) setSelection(prev => ({ ...prev, datasetId: null }));
      } 
      else if (type === "folder") {
        await deleteFolderMutation.mutateAsync(id);
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }

      setDeleteContext(null); // close modal on success
    } catch (error: any) {
      const msg = error?.details?.error || error?.message || "Failed to delete item";
      alert(`Delete failed: ${msg}`);
    }
  }

  // Determine if any delete operation is in progress
  const isDeleteLoading = 
    deletePredictorMutation.isPending || 
    deleteDatasetMutation.isPending || 
    deleteFolderMutation.isPending;

  return (
    <DragDropProvider>
      {/* Main Content */}
      <section
        className='space-y-6'
        onClick={clearSelection}
        role='presentation'
      >
        {/* welcome header */}
        <div className='py-6 text-center' onClick={(e) => e.stopPropagation()}>
          <h1 className='text-3xl font-extrabold tracking-tight md:text-4xl'>
            Welcome,{" "}
            {user
              ? user.first_name?.trim()
                ? user.first_name
                : user.username
              : "User"}
            !
          </h1>
          <div className='mx-auto mt-4 max-w-2xl space-y-2'>
            <h2 className='text-2xl tracking-tight md:text-2xl'>
              Find your datasets and predictors below.
            </h2>
          </div>
        </div>
        
        {/* sticky toolbar under navbar - stays on top when you scroll */}
        <div
          className='sticky top-14 md:top-16 z-40 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='py-3'>
            <Toolbar
              activeTab={activeTab}
              onTabChange={(t) => {
                selectTab(t);
                // No need to manually fetchFolders(), Query handles cache/refetch
              }}
              query={
                activeTab === "predictors"
                  ? tabState.predictorQuery
                  : activeTab === "datasets"
                  ? tabState.datasetQuery
                  : tabState.folderQuery
              }
              onQueryChange={(value) => {
                if (activeTab === "predictors") {
                  setTabState(prev => ({ ...prev, predictorQuery: value }));
                } else if (activeTab === "datasets") {
                  setTabState(prev => ({ ...prev, datasetQuery: value }));
                } else {
                  setTabState(prev => ({ ...prev, folderQuery: value }));
                }
              }}
              onCreatePredictor={createPredictor}
              onCreateDataset={addDataset}
              onCreateFolder={handleCreateFolder}
              ownership={
                activeTab === "predictors"
                  ? tabState.predictorOwnership
                  : activeTab === "datasets"
                  ? tabState.datasetOwnership
                  : tabState.folderOwnership
              }
              onOwnershipChange={(value) => {
                if (activeTab === "predictors") {
                  setTabState(prev => ({ ...prev, predictorOwnership: value }));
                } else if (activeTab === "datasets") {
                  setTabState(prev => ({ ...prev, datasetOwnership: value }));
                } else {
                  setTabState(prev => ({ ...prev, folderOwnership: value }));
                }
              }}
              folderTypeFilter={
                activeTab === "folders" ? folderTypeFilter : undefined
              }
              onFolderTypeFilterChange={
                activeTab === "folders" ? setFolderTypeFilter : undefined
              }
              folderSortOption={
                activeTab === "folders" ? folderSortOption : undefined
              }
              onFolderSortChange={
                activeTab === "folders" ? setFolderSortOption : undefined
              }
            />
          </div>
          <div className='border-t border-black/10' />
        </div>

        {/* loading indicator or skeleton - only show if loading AND no data */}
        {isLoading &&
        ((activeTab === "predictors" && predictors.length === 0) ||
          (activeTab === "datasets" && datasets.length === 0) ||
          (activeTab === "folders" && folders.length === 0)) ? (
          <div className='mx-auto max-w-6xl px-4 py-6'>
            {/* simple spinner + hint */}
            <div className='flex items-center gap-3'>
              <div className='animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-700' />
              <div className='text-sm text-gray-700'>
                Loading {activeTab}...
              </div>
            </div>

            {/* optional skeleton grid — placeholders matching your card layout */}
            <div className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className='p-4 border rounded-lg animate-pulse'>
                  <div className='h-5 bg-gray-200 rounded w-3/4 mb-3' />
                  <div className='h-3 bg-gray-200 rounded w-1/2 mb-2' />
                  <div className='h-20 bg-gray-200 rounded' />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        
        {/* Main Content Area */}
        <div className='flex gap-6'>
          {/* Folder Sidebar - always render but hide when not needed */}
          <FolderSidebar
            onItemMoved={async (_itemId, _folderId) => {
              // Simply invalidate folders to refresh the sidebar
              queryClient.invalidateQueries({ queryKey: ['folders'] });
            }}
            className={activeTab === "folders" ? "hidden" : ""}
          />

          {/* Main Content */}
          <div className='flex-1 transition-all duration-300'>
            {activeTab === "folders" ? (
              /* Folders Tab Content */
              <div className='space-y-6' onClick={(e) => e.stopPropagation()}>
                {/* Recent Folders Quick Access */}
                <div>
                  <RecentFolders
                    onFolderSelect={handleRecentFolderSelect}
                    currentFolderId={currentFolderView || undefined}
                  />
                </div>

                {/* Folders Grid */}
                <div className='grid gap-4 sm:grid-cols-1 lg:grid-cols-2'>
                  {filteredFolders.map((folder) => {
                    return (
                      <div
                        key={`folder-${folder.folder_id}`}
                        id={`folder-${folder.folder_id}`}
                        className={
                          currentFolderView === folder.folder_id
                            ? "ring-2 ring-blue-500 rounded-xl"
                            : ""
                        }
                      >
                        <FolderCard
                          folder={folder}
                          expanded={expandedFolders.has(folder.folder_id)}
                          onToggleExpand={handleToggleFolderExpansion}
                          onEdit={(folderId) => {
                             // Folder edit handled internally
                             console.log("Folder edit initiated for:", folderId);
                          }}
                          // UNIFIED DELETE:
                          onDelete={(id) => promptDelete(id, folder.name, "folder")}
                          onShare={(folderId) => {
                            // Folder share handled internally
                            console.log("Folder sharing initiated for:", folderId);
                          }}
                          onItemSelect={(itemId, itemType) => {
                            // Handle item selection within folders
                            if (itemType === "predictor") {
                              setSelection(prev => ({
                                predictorId: prev.predictorId === itemId ? null : itemId,
                                datasetId: null
                              }));
                            } else {
                              setSelection(prev => ({
                                datasetId: prev.datasetId === itemId ? null : itemId,
                                predictorId: null
                              }));
                            }
                          }}
                          onItemEdit={(itemId, _itemType) => editItem(itemId)}
                          onItemDelete={(itemId, itemType) => {
                            const item =
                              itemType === "predictor"
                                ? predictors.find((p) => p.id === itemId)
                                : datasets.find((d) => d.id === itemId);
                            // We might need to find items deep within folders if they aren't in the main lists
                            const foundItem = item || folder.items?.find(i => i.id === itemId) as any;
                            if (foundItem) {
                              promptDelete(foundItem.id, foundItem.title, itemType);
                            }
                          }}
                          onItemView={(itemId, _itemType) => viewItem(itemId)}
                          onRemoveFromFolder={(itemId, itemType) =>
                            handleRemoveFromFolder(
                              itemId,
                              itemType,
                              folder.folder_id
                            )
                          }
                          selectedItems={
                            new Set([
                              ...(selection.predictorId ? [selection.predictorId] : []),
                              ...(selection.datasetId ? [selection.datasetId] : []),
                            ])
                          }
                          currentUserId={currentUserId}
                          canEdit={true}
                          isLoading={loadingFolders.has(folder.folder_id) || removeFromFolderMutation.isPending}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Empty state for folders - only show if not loading */}
                {filteredFolders.length === 0 && !isLoading && (
                  <div className='text-center py-12'>
                    <div className='text-gray-500 text-lg'>
                      No folders found
                    </div>
                    <div className='text-gray-400 text-sm mt-2'>
                      Create a folder to organize your predictors and datasets
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Predictors and Datasets Tab Content */
              <DroppableFolder
                folder={null}
                onDrop={handleDrop}
                isLoading={isItemLoading}
                className='min-h-[200px] p-4 rounded-xl transition-all duration-200'
              >
                <div
                  className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Individual Items - show items not in folders */}
                  {activeTab === "predictors"
                    ? filteredPredictors
                        .filter((item) => !item.folderId)
                        .map((it) => (
                          <PredictorCard
                            key={it.id}
                            item={it}
                            selected={selection.predictorId === it.id} 
                            onToggleSelect={toggleSelect}
                            onEdit={editItem}
                            onDelete={(id) => promptDelete(id, it.title, "predictor")}
                            onView={viewItem}
                            onDrop={handleDrop}
                            isLoading={isItemLoading(it.id)}
                          />
                        ))
                    : filteredDatasets
                        .filter((item) => !item.folderId)
                        .map((it) => (
                          <DatasetCard
                            key={it.id}
                            item={{ ...it, owner: Boolean(it.owner) }}
                            selected={selection.datasetId === it.id}
                            onToggleSelect={toggleSelect}
                            onEdit={editItem}
                            onDelete={(id) => promptDelete(id, it.title, "dataset")}
                            onView={viewItem}
                            onDownload={() => {
                              const isOwner = isUserOwner(
                                it.owner,
                                currentUserId
                              );
                              downloadItem(
                                it.id,
                                "allow_admin_access" in it
                                  ? it.allow_admin_access ?? false
                                  : false,
                                isOwner
                              );
                            }}
                            onDrop={handleDrop}
                            isLoading={isItemLoading(it.id)}
                          />
                        ))}

                  {/* Empty state hint */}
                  {(activeTab === "predictors" ? filteredPredictors : filteredDatasets)
                    .filter((item) => !item.folderId).length === 0 &&
                    !isLoading && (
                      <div className='col-span-full flex items-center justify-center py-12 text-center'>
                        <div className='max-w-sm'>
                          <div className='text-gray-400 text-lg mb-2'>📁</div>
                          <p className='text-gray-500 text-sm'>
                            No {activeTab} in your main collection
                          </p>
                          <p className='text-gray-400 text-xs mt-1'>
                            Drag items from folders here to move them back to
                            your main collection
                          </p>
                        </div>
                      </div>
                    )}
                </div>
              </DroppableFolder>
            )}

            {/* UNIFIED DELETE MODAL */}
            <DeleteConfirmation
              open={!!deleteContext}
              name={deleteContext?.title ?? ""}
              description={
                deleteContext?.type === "folder" 
                  ? "Items inside this folder will be preserved." 
                  : "This action cannot be undone."
              }
              onCancel={() => setDeleteContext(null)}
              onConfirm={handleConfirmDelete}
              isLoading={isDeleteLoading}
            />

            <FolderCreationModal
              isOpen={showFolderModal}
              onClose={() => {
                setShowFolderModal(false);
                setFolderError(null);
              }}
              onCreateFolder={handleFolderCreation}
              availablePredictors={predictors.filter((p) => !p.folderId)}
              availableDatasets={datasets.filter((d) => !d.folderId)}
              isLoading={createFolderMutation.isPending}
              error={folderError}
            />
          </div>
        </div>
      </section>
    </DragDropProvider>
  );
}