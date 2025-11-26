/**
 * DASHBOARD
 * (Predictors & Datasets)
 *
 * Purpose:
 * - Renders a two-tab workspace: "Predictors" and "Datasets".
 * - Shares a single search box and an ownership filter (All / Owner / Viewer) across both tabs.
 * - Has a sticky toolbar (tabs + search + filter + create) that stays visible while scrolling.
 * - Grid shows cards; clicking a card toggles its "selected" state:
 *   - If you OWN the item, you see Edit / Delete when selected.
 *   - If you are a VIEWER, you see a View button when selected.
 * - "Create" menu can add a Predictor or Dataset; after creating:
 *   - The new item is inserted at the top,
 *   - The page switches to the corresponding tab (for datasets),
 *   - The new card is selected.
 *
 * Implementation notes:
 * - Local state holds the data and UI state (activeTab, query, ownership, selection, etc.).
 * - useMemo filters each list by query + ownership.
 * - Clicking the page background clears any selection.
 * - A small modal handles delete confirmation.
 *
 * TO DO:
 * - Navigate to actual edit / view routes instead of alert() stubs.
 */

import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { DeletePredictor } from "../components/DeletePredictor";
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
  type Folder,
  type CreateFolderRequest,
  handleFolderApiError,
} from "../lib/folders";
import {
  sortFolders,
  filterFoldersByType,
  DEFAULT_FOLDER_SORT,
} from "../lib/folderUtils";
import type { FolderSortOption, FolderType } from "../components/folder";
import { searchAndSort, searchFolders } from "../lib/searchUtils";

type Tab = "predictors" | "datasets" | "folders";

// mock data - remove or comment out once we get frontend / backend connected
// const MOCK_PREDICTORS: PredictorItem[] = [
//   { id: "1", title: "Predictor A", status: "DRAFT", updatedAt: "2 days ago", owner: true,
//     notes:  "This is a description of Predictor A. It is quite frankly the worst predictor ever."
//     },
//   { id: "2", title: "Predictor B", status: "DRAFT", updatedAt: "5 days ago", owner: false,
//     notes: "This is a description of Predictor B. It is quite frankly the BEST predictor ever!"
//     },
//   { id: "3", title: "Super Magical Disease Detector", status: "DRAFT", updatedAt: "1 week ago", owner: false,
//         notes: "This is a description of the most super duper magical predictor ever!!! It works like... a charm!!!!!"
//     },
//   { id: "4", title: "Liver Cancer Remission", status: "PUBLISHED", updatedAt: "Mar 10, 2009", owner: true,
//     notes: "This is a description of the most serious predictor on the list."
//     },
// ];

// const MOCK_DATASETS: PredictorItem[] = [
//   { id: "d1", title: "Hospital Readmissions 2024", updatedAt: "3 days ago", owner: true,
//     notes: "This is a description of this very serious sounding dataset. Here's some more details about it that the uploader decided were important."
//     },
//   { id: "d2", title: "Cancer Registry Cohort", updatedAt: "Aug 20, 2023", owner: false,
//     notes: "This is a description of this very serious sounding dataset. Here's some more details about it that the uploader decided were important."
//     },
//   { id: "d3", title: "CERVICAL CANCER CSV Upload", updatedAt: "Jul 02, 2010", owner: false,
//     notes: "This is a description of this very serious sounding dataset. Here's some more details about it that the uploader decided were important."
//     },
// ];

export default function Dashboard() {
  const { user } = useAuth();
  const currentUserId = (user as any)?.id ?? (user as any)?.pk;
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  // dderive activeTab from URL (?tab=predictors|datasets|folders)
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

  const [predictors, setPredictors] = useState<PredictorItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // error and loading
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which tabs have been loaded
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());

  // selection is per-tab
  const [selectedPredictorId, setSelectedPredictorId] = useState<string | null>(
    null
  );
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  );

  // separate search states for each tab
  const [predictorQuery, setPredictorQuery] = useState("");
  const [datasetQuery, setDatasetQuery] = useState("");
  const [folderQuery, setFolderQuery] = useState("");

  // separate ownership filters for each tab
  const [predictorOwnership, setPredictorOwnership] =
    useState<Ownership>("all");
  const [datasetOwnership, setDatasetOwnership] = useState<Ownership>("all");
  const [folderOwnership, setFolderOwnership] = useState<Ownership>("all");

  // delete modal
  const [pendingDelete, setPendingDelete] = useState<PredictorItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // folder management
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // folder-specific filters (search will use main query state)
  const [folderSortOption, setFolderSortOption] =
    useState<FolderSortOption>(DEFAULT_FOLDER_SORT);
  const [folderTypeFilter, setFolderTypeFilter] = useState<FolderType>("all");
  const [currentFolderView, setCurrentFolderView] = useState<string | null>(
    null
  );

  // drag and drop
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  const { moveItem, isItemLoading } = useDragDrop(
    // Don't update local state for copy behavior - items should stay in main view
    () => {
      // Empty callback - the sidebar handles its own updates
    }
  );

  // Separate function to fetch folders
  const fetchFolders = async () => {
    try {
      const folderData = await listMyFolders();
      const mapped = Array.isArray(folderData)
        ? folderData.map((it) => mapApiFolderToUi(it))
        : [];
      setFolders(mapped);
      console.log("mapped folders:", JSON.parse(JSON.stringify(mapped)));
    } catch (err: any) {
      console.error("Failed to fetch folders:", err);
      // Don't set error for folders as it's not critical
    }
  };

  useEffect(() => {
    let mounted = true;
    // AbortController for cleanup if component unmounts or user changes rapidly
    const controller = new AbortController();

    // Track whether the fetch finished
    let didFinish = false;

    setError(null);

    // After 300 ms, show the loading screen
    const SHOW_LOADING_DELAY = 300;

    // track whether we’ve already fetched data for this tab
    const isInitialPredictorFetch =
      predictors.length === 0 && activeTab === "predictors";
    const isInitialDatasetFetch =
      datasets.length === 0 && activeTab === "datasets";
    const isInitialFolderFetch =
      folders.length === 0 && activeTab === "folders";
    const isInitialFetch =
      isInitialPredictorFetch || isInitialDatasetFetch || isInitialFolderFetch;

    // Define loadingTimer
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchActive() {
      // If we already have data for this tab, don't fetch and clear loading
      if (!isInitialFetch) {
        setIsLoading(false);
        return;
      }

      // Only trigger loader delay if it's the first fetch of the data
      loadingTimer = setTimeout(() => {
        if (!didFinish && mounted) setIsLoading(true);
      }, SHOW_LOADING_DELAY);

      try {
        // Always fetch folders alongside the active tab data
        const promises = [];

        if (activeTab === "predictors") {
          promises.push(
            api
              .get<PredictorItem[]>(`/api/predictors/`)
              .then((predictorData) => {
                if (!mounted) return;
                const currentUserId =
                  (user as any)?.id ?? (user as any)?.pk ?? undefined;
                const mapped = Array.isArray(predictorData)
                  ? predictorData.map((it) =>
                      mapApiPredictorToUi(it, currentUserId)
                    )
                  : [];
                setPredictors(mapped);
                console.log(
                  "mapped predictors:",
                  JSON.parse(JSON.stringify(mapped))
                );
              })
          );
        } else if (activeTab === "datasets") {
          promises.push(
            api.get<DatasetItem[]>(`/api/datasets/`).then((data) => {
              if (!mounted) return;
              const currentUserId =
                (user as any)?.id ?? (user as any)?.pk ?? undefined;
              const mapped = Array.isArray(data)
                ? data.map((it) => mapApiDatasetToUi(it, currentUserId))
                : [];
              setDatasets(mapped);
              console.log(
                "mapped datasets:",
                JSON.parse(JSON.stringify(mapped))
              );
            })
          );
        }
        // For folders tab, we only need to fetch folders (handled below)

        // Always fetch folders
        promises.push(fetchFolders());

        await Promise.all(promises);
      } catch (err: any) {
        if (err?.status === 0) {
          setError("Network error");
        } else {
          setError(
            err?.details?.message ?? err?.statusText ?? "Failed to load"
          );
        }
        console.error("Fetch error", error);
      } finally {
        // clear the timeout no matter what
        didFinish = true;
        if (loadingTimer) clearTimeout(loadingTimer);
        if (mounted) setIsLoading(false);
      }
    }

    // debounce fetch start by 250 ms
    const t = window.setTimeout(() => fetchActive(), 250);

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(t);
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [user, activeTab]);

  // Simple loading state management
  useEffect(() => {
    const hasData =
      (activeTab === "predictors" && predictors.length > 0) ||
      (activeTab === "datasets" && datasets.length > 0) ||
      (activeTab === "folders" && folders.length > 0);

    const tabWasLoaded = loadedTabs.has(activeTab);

    if (hasData && !tabWasLoaded) {
      // Mark this tab as loaded
      setLoadedTabs((prev) => new Set(prev).add(activeTab));
      setIsLoading(false);
    } else if (hasData && tabWasLoaded) {
      // Tab has data and was already loaded, no loading needed
      setIsLoading(false);
    }
  }, [
    activeTab,
    predictors.length,
    datasets.length,
    folders.length,
    loadedTabs,
  ]);

  // filter functionality for predictors and datasets - uses tab-specific states
  const filteredPredictors = useMemo(() => {
    // Apply ownership filter first
    let list = predictors;
    if (predictorOwnership === "owner") list = list.filter((it) => it.owner);
    if (predictorOwnership === "viewer") list = list.filter((it) => !it.owner);

    // Apply smart search with prioritization
    const q = predictorQuery.trim();
    if (q) {
      list = searchAndSort(list, q);
    } else {
      // Sort alphabetically when no search query
      list = [...list].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      );
    }

    return list;
  }, [predictors, predictorQuery, predictorOwnership]);

  const filteredDatasets = useMemo(() => {
    // Apply ownership filter first
    let list = datasets;
    if (datasetOwnership === "owner") list = list.filter((it) => it.owner);
    if (datasetOwnership === "viewer") list = list.filter((it) => !it.owner);

    // Apply smart search with prioritization
    const q = datasetQuery.trim();
    if (q) {
      list = searchAndSort(list, q);
    } else {
      // Sort alphabetically when no search query
      list = [...list].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      );
    }

    return list;
  }, [datasets, datasetQuery, datasetOwnership]);

  // filter folders based on search, ownership, type, and sorting
  const filteredFolders = useMemo(() => {
    const currentUserId = (user as any)?.id ?? (user as any)?.pk ?? undefined;

    // Start with all folders
    let list = folders;

    // Apply ownership filter
    list = list.filter((folder) => {
      const isOwner = currentUserId ? folder.owner.id === currentUserId : false;
      if (folderOwnership === "owner") return isOwner;
      if (folderOwnership === "viewer") return !isOwner;
      return true;
    });

    // Apply smart search with prioritization (searches folders and their contents)
    const q = folderQuery.trim();
    if (q) {
      list = searchFolders(list, q);
    }

    // Apply type filter
    list = filterFoldersByType(list, folderTypeFilter);

    // Apply sorting (only if no search query, as search already sorts by relevance)
    if (!q) {
      list = sortFolders(list, folderSortOption);
    }

    return list;
  }, [
    folders,
    folderQuery,
    folderOwnership,
    folderTypeFilter,
    folderSortOption,
    user,
  ]);

  // if you click, you select it and can choose to edit or delete / view
  function toggleSelect(id: string) {
    if (activeTab === "predictors") {
      setSelectedPredictorId((curr) => (curr === id ? null : id));
      setSelectedDatasetId(null);
    } else {
      setSelectedDatasetId((curr) => (curr === id ? null : id));
      setSelectedPredictorId(null);
    }
  }

  // remove selection established above
  function clearSelection() {
    setSelectedPredictorId(null);
    setSelectedDatasetId(null);
  }

  // create Predictor - navigate to the Create Predictor page
  function createPredictor() {
    navigate("/predictors/new");
  }

  // create Dataset - navigate to the Upload/Create Dataset page
  function addDataset() {
    navigate("/datasets/new");
  }

  // Folder management functions
  function handleCreateFolder() {
    setShowFolderModal(true);
    setFolderError(null);
  }

  async function handleFolderCreation(data: CreateFolderRequest) {
    setIsCreatingFolder(true);
    setFolderError(null);

    try {
      const newFolder = await createFolder(data);
      setFolders((prev) => [mapApiFolderToUi(newFolder), ...prev]);
      setShowFolderModal(false);

      // Refresh data to update item assignments
      await fetchFolders();
    } catch (error: any) {
      const folderError = handleFolderApiError(error);
      setFolderError(folderError.message);
    } finally {
      setIsCreatingFolder(false);
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

  async function handleFolderDelete(folderId: string) {
    if (
      !confirm(
        "Are you sure you want to delete this folder? Items will be preserved."
      )
    ) {
      return;
    }

    try {
      await deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.folder_id !== folderId));
      setExpandedFolders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
    } catch (error: any) {
      console.error("Failed to delete folder:", error);
      setError("Failed to delete folder");
    }
  }

  async function handleRemoveFromFolder(
    itemId: string,
    itemType: "predictor" | "dataset",
    folderId: string
  ) {
    // Set loading states
    setLoadingFolders((prev) => new Set(prev).add(folderId));

    try {
      await removeItemFromFolder(folderId, itemType, itemId);

      // Update local state immediately
      if (itemType === "predictor") {
        setPredictors((prev) =>
          prev.map((p) => (p.id === itemId ? { ...p, folderId: undefined } : p))
        );
      } else {
        setDatasets((prev) =>
          prev.map((d) => (d.id === itemId ? { ...d, folderId: undefined } : d))
        );
      }

      // Update folder contents immediately by removing the item
      setFolders((prev) =>
        prev.map((folder) => {
          if (folder.folder_id === folderId && folder.items) {
            return {
              ...folder,
              items: folder.items.filter(
                (folderItem) => folderItem.id !== itemId
              ),
              item_count: Math.max(0, folder.item_count - 1),
            };
          }
          return folder;
        })
      );
    } catch (error: any) {
      console.error("Failed to remove item from folder:", error);
      setError("Failed to remove item from folder");
    } finally {
      // Clear loading state
      setLoadingFolders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
    }
  }

  const handleDrop = (item: DragItem, folderId?: string) => {
    moveItem(item, folderId);
  };

  // navigate to edit page
  function editItem(id: string) {
    if (activeTab === "predictors") {
      // Navigate to predictor edit page
      navigate(`/predictors/${id}/edit`);
    } else {
      // Navigate to dataset edit page
      navigate(`/datasets/${id}/edit`);
    }
  }

  // navigate to view page - WIRED
  function viewItem(id: string) {
    if (activeTab === "predictors") {
      navigate(`/predictors/${id}`, { state: { from: "dashboard" } });
    } else {
      navigate(`/datasets/${id}/view`);
    }
  }

  // Handle double-click navigation - commented ot because its not meant tp do anything now
  //function handleCardDoubleClick(id: string) {
  //}

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
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Download failed: ${error.message || "Unknown error"}`);
    }
  }

  // delete dataset / predictor prompt and deletion
  async function confirmDelete() {
    if (!pendingDelete || isDeleting) return;

    setIsDeleting(true);

    try {
      if (activeTab === "predictors") {
        // Delete predictor via API
        const predictorId = pendingDelete.id;
        await deletePredictor(predictorId);

        // Remove from local state after successful API call
        setPredictors((arr) => arr.filter((x) => x.id !== pendingDelete.id));

        if (selectedPredictorId == predictorId) {
          setSelectedPredictorId(null);
        }
      } else {
        // Delete dataset via API
        const datasetId = parseInt(pendingDelete.id);
        await deleteDataset(datasetId);

        // Remove from local state after successful API call
        setDatasets((arr) => arr.filter((x) => x.id !== pendingDelete.id));
        if (selectedDatasetId === pendingDelete.id) setSelectedDatasetId(null);
      }

      setPendingDelete(null);
    } catch (error: any) {
      // Show error message
      const errorMessage =
        error?.details?.error || error?.message || "Failed to delete dataset";
      alert(`Delete failed: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  }

  const list =
    activeTab === "predictors"
      ? filteredPredictors
      : activeTab === "datasets"
      ? filteredDatasets
      : [];
  const selectedId =
    activeTab === "predictors" ? selectedPredictorId : selectedDatasetId;

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
          {/* REPLACE WITH ACTUAL TEXT EVENTUALLY */}
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
                if (t === "folders") {
                  void fetchFolders();        
                }
              }}
              query={
                activeTab === "predictors"
                  ? predictorQuery
                  : activeTab === "datasets"
                  ? datasetQuery
                  : folderQuery
              }
              onQueryChange={
                activeTab === "predictors"
                  ? setPredictorQuery
                  : activeTab === "datasets"
                  ? setDatasetQuery
                  : setFolderQuery
              }
              onCreatePredictor={createPredictor}
              onCreateDataset={addDataset}
              onCreateFolder={handleCreateFolder}
              ownership={
                activeTab === "predictors"
                  ? predictorOwnership
                  : activeTab === "datasets"
                  ? datasetOwnership
                  : folderOwnership
              }
              onOwnershipChange={
                activeTab === "predictors"
                  ? setPredictorOwnership
                  : activeTab === "datasets"
                  ? setDatasetOwnership
                  : setFolderOwnership
              }
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
              // Refresh folder data for the folder tab (but don't reload the whole tab)
              try {
                await fetchFolders();
              } catch (error) {
                console.error('Failed to refresh folder data:', error);
              }
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
                    const currentUserId =
                      (user as any)?.id ?? (user as any)?.pk ?? undefined;
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
                            // Folder editing is now handled by the FolderCard component's internal modal
                            console.log("Folder edit initiated for:", folderId);
                          }}
                          onDelete={handleFolderDelete}
                          onShare={(folderId) => {
                            // Folder sharing is now handled by the FolderCard component's internal modal
                            console.log(
                              "Folder sharing initiated for:",
                              folderId
                            );
                          }}
                          onItemSelect={(itemId, itemType) => {
                            // Handle item selection within folders
                            if (itemType === "predictor") {
                              setSelectedPredictorId((prev) =>
                                prev === itemId ? null : itemId
                              );
                              setSelectedDatasetId(null);
                            } else {
                              setSelectedDatasetId((prev) =>
                                prev === itemId ? null : itemId
                              );
                              setSelectedPredictorId(null);
                            }
                          }}
                          onItemEdit={(itemId, _itemType) => editItem(itemId)}
                          onItemDelete={(itemId, itemType) => {
                            const item =
                              itemType === "predictor"
                                ? predictors.find((p) => p.id === itemId)
                                : datasets.find((d) => d.id === itemId);
                            if (item) setPendingDelete(item);
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
                              ...(selectedPredictorId
                                ? [selectedPredictorId]
                                : []),
                              ...(selectedDatasetId ? [selectedDatasetId] : []),
                            ])
                          }
                          currentUserId={currentUserId}
                          canEdit={true}
                          isLoading={loadingFolders.has(folder.folder_id)}
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
                    ? list
                        .filter((item) => !item.folderId) // Only show items not in folders
                        .map((it) => (
                          <PredictorCard
                            key={it.id}
                            item={it}
                            selected={selectedId === it.id}
                            onToggleSelect={toggleSelect}
                            onEdit={editItem}
                            onDelete={(id) =>
                              setPendingDelete(
                                predictors.find((x) => x.id === id) ?? null
                              )
                            }
                            onView={viewItem}
                            onDrop={handleDrop}
                            isLoading={isItemLoading(it.id)}
                          />
                        ))
                    : list
                        .filter((item) => !item.folderId) // Only show items not in folders
                        .map((it) => (
                          <DatasetCard
                            key={it.id}
                            item={{ ...it, owner: Boolean(it.owner) }}
                            selected={selectedId === it.id}
                            onToggleSelect={toggleSelect}
                            onEdit={editItem}
                            onDelete={(id) =>
                              setPendingDelete(
                                datasets.find((x) => x.id === id) ?? null
                              )
                            }
                            onView={viewItem}
                            onDownload={() => {
                              const isOwner = isUserOwner(it.owner, currentUserId);
                              downloadItem(
                                it.id,
                                'allow_admin_access' in it ? it.allow_admin_access ?? false : false,
                                isOwner
                              );
                            }}
                            onDrop={handleDrop}
                            isLoading={isItemLoading(it.id)}
                          />
                        ))}

                  {/* Empty state hint for drag and drop - only show if not loading */}
                  {list.filter((item) => !item.folderId).length === 0 &&
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

            <DeletePredictor
              open={!!pendingDelete}
              name={pendingDelete?.title ?? ""}
              onCancel={() => !isDeleting && setPendingDelete(null)}
              onConfirm={confirmDelete}
              isLoading={isDeleting}
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
              isLoading={isCreatingFolder}
              error={folderError}
            />
          </div>
        </div>
      </section>
    </DragDropProvider>
  );
}
