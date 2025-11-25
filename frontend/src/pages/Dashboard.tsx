/**
 * DASHBOARD
 * (Predictors & Datasets)
 *
 * Purpose:
 * - Renders a two-tab workspace: "Predictors" and "Datasets".
 * - Shares a single search box and filters across tabs.
 * - Has a sticky toolbar (tabs + search + filter + create) that stays visible while scrolling.
 * - Grid shows cards; clicking a card toggles its "selected" state:
 *   - If you OWN the item, you see Edit / Delete when selected.
 *   - If you are a VIEWER, you see a View button when selected.
 * - "Create" menu can add a Predictor or Dataset; after creating:
 *   - The new item is inserted at the top,
 *   - The page switches to the corresponding tab (for datasets),
 *   - The new card is selected.
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
  FolderSortMenu,
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
import { sortFolders, DEFAULT_FOLDER_SORT } from "../lib/folderUtils";
import {
  filterPredictors,
  sortPredictors,
  filterDatasets,
  sortDatasets,
  filterFolders,
} from "../lib/filtering";
import type {
  PredictorFilterState,
  DatasetFilterState,
  FolderFilterState,
  SortOption,
} from "../types/flitering";
import type { FolderSortOption, FolderType } from "../components/folder";

type Tab = "predictors" | "datasets" | "folders";
type KeywordTarget = "title" | "notes" | "both";
type TimeWindow = "any" | "7d" | "30d" | "365d";

const DEFAULT_PREDICTOR_SORT: SortOption = {
  field: "updatedAt",
  direction: "desc",
};

const DEFAULT_DATASET_SORT: SortOption = {
  field: "updatedAt",
  direction: "desc",
};

// helper: updatedWithin matcher
function matchesUpdatedWithin(
  updatedAt: string | null | undefined,
  window: TimeWindow
): boolean {
  if (!updatedAt || window === "any") return true;

  const parsed = Date.parse(updatedAt);
  // if we can't parse the date, don't exclude it
  if (Number.isNaN(parsed)) return true;

  const now = Date.now();
  const days =
    window === "7d" ? 7 : window === "30d" ? 30 : window === "365d" ? 365 : 0;
  if (days <= 0) return true;

  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return parsed >= cutoff;
}

// mock data - remove or comment out once we get frontend / backend connected
// const MOCK_PREDICTORS: PredictorItem[] = [ ... ];
// const MOCK_DATASETS: PredictorItem[] = [ ... ];

export default function Dashboard() {
  const { user } = useAuth();
  const currentUserId = (user as any)?.id ?? (user as any)?.pk;
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  // derive activeTab from URL (?tab=predictors|datasets|folders)
  const activeTab: Tab = (() => {
    const q = searchParams.get("tab");
    return q === "datasets" || q === "folders" ? (q as Tab) : "predictors";
  })();

  // when a tab button is clicked, update the URL
  const selectTab = (t: Tab) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set("tab", t);
        return sp;
      },
      { replace: true }
    ); // avoid history spam
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

  // separate keyword target states for each tab
  const [predictorKeywordTarget, setPredictorKeywordTarget] =
    useState<KeywordTarget>("title");
  const [datasetKeywordTarget, setDatasetKeywordTarget] =
    useState<KeywordTarget>("title");
  const [folderKeywordTarget, setFolderKeywordTarget] =
    useState<KeywordTarget>("both");

  // UPDATED WITHIN states per tab
  const [predictorUpdatedWithin, setPredictorUpdatedWithin] =
    useState<TimeWindow>("any");
  const [datasetUpdatedWithin, setDatasetUpdatedWithin] =
    useState<TimeWindow>("any");
  const [folderUpdatedWithin, setFolderUpdatedWithin] =
    useState<TimeWindow>("any");

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
        const promises: Promise<void>[] = [];

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
        promises.push(fetchFolders().then(() => {}));

        await Promise.all(promises);
      } catch (err: any) {
        if (err?.status === 0) {
          setError("Network error");
        } else {
          setError(
            err?.details?.message ?? err?.statusText ?? "Failed to load"
          );
        }
        console.error("Fetch error", err);
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
  }, [user, activeTab, predictors.length, datasets.length, folders.length]);

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

  // filter functionality for predictors and datasets
  const filteredPredictors = useMemo(() => {
    const keywords = predictorQuery.trim()
      ? predictorQuery.trim().split(/\s+/)
      : [];

    const filter: PredictorFilterState = {
      keywords,
      keywordTarget: predictorKeywordTarget,
      ownership: predictorOwnership,
      visibility: "all",
    };

    let base = filterPredictors(predictors, filter);

    if (predictorUpdatedWithin !== "any") {
      base = base.filter((item) =>
        matchesUpdatedWithin(
          (item as any).updatedAtRaw ??
            (item as any).updatedAtSort ??
            (item as any).updatedAt,
          predictorUpdatedWithin
        )
      );
    }

    return sortPredictors(base, DEFAULT_PREDICTOR_SORT);
  }, [
    predictors,
    predictorQuery,
    predictorOwnership,
    predictorKeywordTarget,
    predictorUpdatedWithin,
  ]);

  const filteredDatasets = useMemo(() => {
    const keywords = datasetQuery.trim()
      ? datasetQuery.trim().split(/\s+/)
      : [];

    const filter: DatasetFilterState = {
      keywords,
      keywordTarget: datasetKeywordTarget,
      ownership: datasetOwnership,
      visibility: "all",
    };

    let base = filterDatasets(datasets, filter);

    if (datasetUpdatedWithin !== "any") {
      base = base.filter((item) =>
        matchesUpdatedWithin(
          (item as any).updatedAtRaw ??
            (item as any).updatedAtSort ??
            (item as any).updatedAt,
          datasetUpdatedWithin
        )
      );
    }

    return sortDatasets(base, DEFAULT_DATASET_SORT);
  }, [
    datasets,
    datasetQuery,
    datasetOwnership,
    datasetKeywordTarget,
    datasetUpdatedWithin,
  ]);

  // filter folders based on search, ownership, type, updatedWithin, and sorting
  const filteredFolders = useMemo(() => {
    const currentUserId = (user as any)?.id ?? (user as any)?.pk ?? undefined;

    const keywords = folderQuery.trim()
      ? folderQuery.trim().split(/\s+/)
      : [];

    const filter: FolderFilterState = {
      keywords,
      keywordTarget: folderKeywordTarget,
      ownership: folderOwnership,
      visibility: "all",
      folderType: folderTypeFilter,
    };

    let list = filterFolders(folders, filter, currentUserId);

    if (folderUpdatedWithin !== "any") {
      list = list.filter((folder) =>
        matchesUpdatedWithin(
          (folder as any).updatedAtRaw ??
            (folder as any).updatedAtSort ??
            (folder as any).updated_at ??
            (folder as any).updatedAt,
          folderUpdatedWithin
        )
      );
    }

    // Keep existing folder sort behavior (FolderSortOption)
    return sortFolders(list, folderSortOption);
  }, [
    folders,
    folderQuery,
    folderOwnership,
    folderTypeFilter,
    folderSortOption,
    folderKeywordTarget,
    folderUpdatedWithin,
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

  // download dataset file
  async function downloadItem(
    id: string,
    allowAdminAccess: boolean,
    isOwner: boolean
  ) {
    try {
      // if admin access blocked, show alert and return
      if (!isOwner && !allowAdminAccess) {
        alert(
          "Download blocked: External access to this dataset has been disabled."
        );
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

        if (selectedPredictorId === predictorId) {
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
        className="space-y-6"
        onClick={clearSelection}
        role="presentation"
      >
        {/* welcome header */}
        <div
          className="py-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Welcome,{" "}
            {user
              ? user.first_name?.trim()
                ? user.first_name
                : user.username
              : "User"}
            !
          </h1>
          {/* REPLACE WITH ACTUAL TEXT EVENTUALLY */}
          <div className="mx-auto mt-4 max-w-2xl space-y-2">
            <h2 className="text-2xl tracking-tight md:text-2xl">
              Find your datasets and predictors below.
            </h2>
          </div>
        </div>
        {/* sticky toolbar under navbar - stays on top when you scroll */}
        <div
          className="sticky top-14 z-40 bg-white/80 backdrop-blur md:top-16 supports-[backdrop-filter]:bg-white/60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-3">
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
              filterControl={
                activeTab === "folders" ? (
                  <FolderAdvancedFilterMenu
                    keywordTarget={folderKeywordTarget}
                    onKeywordTargetChange={setFolderKeywordTarget}
                    updatedWithin={folderUpdatedWithin}
                    onUpdatedWithinChange={setFolderUpdatedWithin}
                    folderType={folderTypeFilter}
                    onFolderTypeChange={setFolderTypeFilter}
                    sortOption={folderSortOption}
                    onSortOptionChange={setFolderSortOption}
                    ownership={folderOwnership}
                    onOwnershipChange={setFolderOwnership}
                  />
                ) : (
                  <AdvancedFilterMenu
                    keywordTarget={
                      activeTab === "predictors"
                        ? predictorKeywordTarget
                        : datasetKeywordTarget
                    }
                    onKeywordTargetChange={
                      activeTab === "predictors"
                        ? setPredictorKeywordTarget
                        : setDatasetKeywordTarget
                    }
                    updatedWithin={
                      activeTab === "predictors"
                        ? predictorUpdatedWithin
                        : datasetUpdatedWithin
                    }
                    onUpdatedWithinChange={
                      activeTab === "predictors"
                        ? setPredictorUpdatedWithin
                        : setDatasetUpdatedWithin
                    }
                    ownership={
                      activeTab === "predictors"
                        ? predictorOwnership
                        : datasetOwnership
                    }
                    onOwnershipChange={
                      activeTab === "predictors"
                        ? setPredictorOwnership
                        : setDatasetOwnership
                    }
                  />
                )
              }
            />
          </div>

          <div className="border-t border-black/10" />
        </div>


        {/* loading indicator or skeleton - only show if loading AND no data */}
        {isLoading &&
        ((activeTab === "predictors" && predictors.length === 0) ||
          (activeTab === "datasets" && datasets.length === 0) ||
          (activeTab === "folders" && folders.length === 0)) ? (
          <div className="mx-auto max-w-6xl px-4 py-6">
            {/* simple spinner + hint */}
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-gray-700" />
              <div className="text-sm text-gray-700">
                Loading {activeTab}...
              </div>
            </div>

            {/* optional skeleton grid — placeholders matching your card layout */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border p-4"
                >
                  <div className="mb-3 h-5 w-3/4 rounded bg-gray-200" />
                  <div className="mb-2 h-3 w-1/2 rounded bg-gray-200" />
                  <div className="h-20 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {/* Main Content Area */}
        <div className="flex gap-6">
          {/* Folder Sidebar - always render but hide when not needed */}
          <FolderSidebar
            onItemMoved={async (_itemId, _folderId) => {
              // Refresh folder data for the folder tab (but don't reload the whole tab)
              try {
                await fetchFolders();
              } catch (error) {
                console.error("Failed to refresh folder data:", error);
              }
            }}
            className={activeTab === "folders" ? "hidden" : ""}
          />

          {/* Main Content */}
          <div className="flex-1 transition-all duration-300">
            {activeTab === "folders" ? (
              /* Folders Tab Content */
              <div
                className="space-y-6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Recent Folders Quick Access */}
                <div>
                  <RecentFolders
                    onFolderSelect={handleRecentFolderSelect}
                    currentFolderId={currentFolderView || undefined}
                  />
                </div>

                {/* Folders Grid */}
                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                  {filteredFolders.map((folder) => {
                    const currentUserId =
                      (user as any)?.id ?? (user as any)?.pk ?? undefined;
                    return (
                      <div
                        key={`folder-${folder.folder_id}`}
                        id={`folder-${folder.folder_id}`}
                        className={
                          currentFolderView === folder.folder_id
                            ? "rounded-xl ring-2 ring-blue-500"
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
                  <div className="py-12 text-center">
                    <div className="text-lg text-gray-500">
                      No folders found
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
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
                className="min-h-[200px] rounded-xl p-4 transition-all duration-200"
              >
                <div
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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

                  {/* Empty state hint for drag and drop - only show if not loading */}
                  {list.filter((item) => !item.folderId).length === 0 &&
                    !isLoading && (
                      <div className="col-span-full flex items-center justify-center py-12 text-center">
                        <div className="max-w-sm">
                          <div className="mb-2 text-lg text-gray-400">📁</div>
                          <p className="text-sm text-gray-500">
                            No {activeTab} in your main collection
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
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

/**
 * Advanced filter menu for predictors/datasets.
 * Consolidates:
 * - Ownership (all / owner / viewer)
 * - Search in (title/notes/both)
 * - Updated within (any / 7 days / 30 days / 1 year)
 */
type AdvancedFilterMenuProps = {
  keywordTarget: KeywordTarget;
  onKeywordTargetChange: (value: KeywordTarget) => void;

  updatedWithin: TimeWindow;
  onUpdatedWithinChange: (value: TimeWindow) => void;

  ownership: Ownership;
  onOwnershipChange: (value: Ownership) => void;
};

function AdvancedFilterMenu({
  keywordTarget,
  onKeywordTargetChange,
  updatedWithin,
  onUpdatedWithinChange,
  ownership,
  onOwnershipChange,
}: AdvancedFilterMenuProps) {
  return (
    <details className="group relative">
      <summary className="inline-flex h-8 cursor-pointer select-none items-center gap-1 rounded-md border bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
        Filters
        <span className="text-[10px] text-gray-500 group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 mt-1 w-72 rounded-md border bg-white p-3 text-xs shadow-lg z-20">
        {/* Ownership */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-gray-700">Ownership</div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "All items"],
                ["owner", "Owned by me"],
                ["viewer", "Shared with me"],
              ] as [Ownership, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onOwnershipChange(value)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  ownership === value
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search in */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-gray-700">Search in</div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["title", "Title"],
                ["notes", "Notes"],
                ["both", "Title + notes"],
              ] as [KeywordTarget, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onKeywordTargetChange(value)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  keywordTarget === value
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Updated within */}
        <div>
          <div className="mb-1 font-semibold text-gray-700">
            Updated within
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["any", "Any time"],
                ["7d", "7 days"],
                ["30d", "30 days"],
                ["365d", "1 year"],
              ] as [TimeWindow, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onUpdatedWithinChange(value)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  updatedWithin === value
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * Folder-specific filter menu.
 * Consolidates:
 * - Ownership
 * - Search in (title/notes/both)
 * - Updated within
 * - Folder type
 * - Sort option
 */
type FolderAdvancedFilterMenuProps = {
  keywordTarget: KeywordTarget;
  onKeywordTargetChange: (value: KeywordTarget) => void;

  updatedWithin: TimeWindow;
  onUpdatedWithinChange: (value: TimeWindow) => void;

  folderType: FolderType;
  onFolderTypeChange: (value: FolderType) => void;

  sortOption: FolderSortOption;
  onSortOptionChange: (value: FolderSortOption) => void;

  ownership: Ownership;
  onOwnershipChange: (value: Ownership) => void;
};

function FolderAdvancedFilterMenu({
  keywordTarget,
  onKeywordTargetChange,
  updatedWithin,
  onUpdatedWithinChange,
  folderType,
  onFolderTypeChange,
  sortOption,
  onSortOptionChange,
  ownership,
  onOwnershipChange,
}: FolderAdvancedFilterMenuProps) {
  return (
    <details className="group relative">
      <summary className="inline-flex h-8 cursor-pointer select-none items-center gap-1 rounded-md border bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
        Filters
        <span className="text-[10px] text-gray-500 group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 mt-1 w-72 rounded-md border bg-white p-3 text-xs shadow-lg z-20">
        {/* Ownership */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-gray-700">Ownership</div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "All folders"],
                ["owner", "Owned by me"],
                ["viewer", "Shared with me"],
              ] as [Ownership, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onOwnershipChange(value)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  ownership === value
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search in */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-gray-700">Search in</div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["title", "Title"],
                ["notes", "Notes"],
                ["both", "Title + notes"],
              ] as [KeywordTarget, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onKeywordTargetChange(value)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  keywordTarget === value
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Updated within */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-gray-700">
            Updated within
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["any", "Any time"],
                ["7d", "7 days"],
                ["30d", "30 days"],
                ["365d", "1 year"],
              ] as [TimeWindow, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onUpdatedWithinChange(value)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  updatedWithin === value
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Folder type */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-gray-700">
            Folder type
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "All"],
                ["predictors", "Predictors"],
                ["datasets", "Datasets"],
                ["mixed", "Mixed"],
              ] as [FolderType, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onFolderTypeChange(value)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  folderType === value
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort by (delegates to existing FolderSortMenu) */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-gray-700">Sort by</span>
          </div>
          <FolderSortMenu
            value={sortOption}
            onChange={onSortOptionChange}
          />
        </div>
      </div>
    </details>
  );
}
