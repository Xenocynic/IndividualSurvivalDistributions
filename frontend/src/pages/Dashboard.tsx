/**
 * DASHBOARD
 * (Predictors & Datasets)
 *
 * Purpose:
 * - Renders a two-tab workspace: "Predictors" and "Datasets".
 * - Shares a single search box and filters across tabs.
 * - Has a sticky toolbar (tabs + search + filter + create) that stays visible while scrolling.
 * - Grid shows cards; clicking a card toggles its "selected" state:
 * - "Create" menu can add a Predictor or Dataset; after creating:
 *   - The new item is inserted at the top,
 *   - The page switches to the corresponding tab (for datasets),
 *   - The new card is selected.
 *
 * Implementation notes (UPDATED):
 * - TanStack Query (useQuery) manages data fetching and caching.
 * - TanStack Query (useMutation) handles server-side updates.
 * - Local state holds UI state (activeTab, query, ownership, selection, etc.).
 * - useMemo filters each list by query + ownership.
 * - Clicking the page background clears any selection.
 * - A small modal handles delete confirmation.
 *
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
  FolderSortMenu,
} from "../components/folder";
import FolderEditModal from "../components/folder/modals/FolderEditModal";
import FolderSharingModal from "../components/folder/modals/FolderSharingModal";
import { addFolderToRecent } from "../components/folder/navigation/RecentFolders";
import { DeleteConfirmation } from "../components/DeleteConfirmation";
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
import { deletePredictor, mapApiPredictorToUi } from "../lib/predictors";
import {
  listMyFolders,
  createFolder,
  deleteFolder,
  removeItemFromFolder,
  mapApiFolderToUi,
  type CreateFolderRequest,
  handleFolderApiError,
  isOwnedOrSharedFolder,
  isOwner,
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
import { FolderOpen } from "lucide-react";

type Tab = "predictors" | "datasets" | "folders";
type DeleteType = "predictor" | "dataset" | "folder";
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
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set("tab", t);
        return sp;
      },
      { replace: true }
    ); // avoid history spam
    clearSelection();
    // Smooth scroll to top on tab change
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- TANSTACK QUERY INTEGRATION ---

  // 1. Fetch Predictors
  const {
    data: predictors = [],
    isLoading: isPredictorsLoading,
  } = useQuery({
    queryKey: ["predictors"],
    queryFn: async () => {
      const data = await api.get<PredictorItem[]>(`/api/predictors/`);
      return Array.isArray(data) ? data : [];
    },
    select: (data) => data.map((it) => mapApiPredictorToUi(it, currentUserId)),
    enabled: activeTab === "predictors",
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch Datasets
  const {
    data: datasets = [],
    isLoading: isDatasetsLoading,
  } = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      const data = await api.get<DatasetItem[]>(`/api/datasets/`);
      return Array.isArray(data) ? data : [];
    },
    select: (data) => data.map((it) => mapApiDatasetToUi(it, currentUserId)),
    enabled: activeTab === "datasets",
    staleTime: 1000 * 60 * 5,
  });

  // 3. Fetch Folders
  // Note: We always fetch folders because the Sidebar might need them, or for drag/drop targets
  const {
    data: folders = [],
    isLoading: isFoldersLoading,
  } = useQuery({
    queryKey: ["folders"],
    queryFn: listMyFolders,
    select: (data) => (Array.isArray(data) ? data.map(mapApiFolderToUi) : []),
    staleTime: 1000 * 60 * 2,
  });

  // Determine global loading state based on active tab
  const isLoading =
    (activeTab === "predictors" && isPredictorsLoading) ||
    (activeTab === "datasets" && isDatasetsLoading) ||
    (activeTab === "folders" && isFoldersLoading);

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

  // --- MUTATIONS ---

  const deletePredictorMutation = useMutation({
    mutationFn: deletePredictor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictors"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });

  const deleteDatasetMutation = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
    onError: (error: any) => {
      const folderError = handleFolderApiError(error);
      setFolderError(folderError.message);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: (_data, folderId) => {
      // Optimistically drop the deleted folder from cache for instant UI update
      queryClient.setQueryData(["folders"], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter(
          (f) =>
            f.folder_id !== folderId &&
            f.id !== folderId // fallback if backend uses id
        );
      });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });

  const removeFromFolderMutation = useMutation({
    mutationFn: ({
      folderId,
      itemType,
      itemId,
    }: {
      folderId: string;
      itemType: "predictor" | "dataset";
      itemId: string;
    }) => removeItemFromFolder(folderId, itemType, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      if (variables.itemType === "predictor") {
        queryClient.invalidateQueries({ queryKey: ["predictors"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["datasets"] });
      }
    },
  });

  // --- LOCAL STATE ---

  // Combined selection state
  const [selection, setSelection] = useState<{
    predictorId: string | null;
    datasetId: string | null;
  }>({
    predictorId: null,
    datasetId: null,
  });

  // Combined tab state (queries only)
  const [tabState, setTabState] = useState({
    predictorQuery: "",
    datasetQuery: "",
    folderQuery: "",
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

  // folder edit / share modals
  const [editingFolder, setEditingFolder] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sharingFolder, setSharingFolder] = useState<any | null>(null);
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  // folder-specific filters
  const [folderSortOption, setFolderSortOption] =
    useState<FolderSortOption>(DEFAULT_FOLDER_SORT);
  const [folderTypeFilter, setFolderTypeFilter] = useState<FolderType>("all");
  const [currentFolderView, setCurrentFolderView] = useState<string | null>(
    null
  );

  // drag and drop
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  const { moveItem, isItemLoading } = useDragDrop(() => {
    queryClient.invalidateQueries({ queryKey: ["folders"] });
    queryClient.invalidateQueries({ queryKey: ["predictors"] });
    queryClient.invalidateQueries({ queryKey: ["datasets"] });
  });

  // --- FILTERED LISTS (advanced system) ---

  const filteredPredictors = useMemo(() => {
    const keywords = tabState.predictorQuery.trim()
      ? tabState.predictorQuery.trim().split(/\s+/)
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
    tabState.predictorQuery,
    predictorOwnership,
    predictorKeywordTarget,
    predictorUpdatedWithin,
  ]);

  const filteredDatasets = useMemo(() => {
    const keywords = tabState.datasetQuery.trim()
      ? tabState.datasetQuery.trim().split(/\s+/)
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
    tabState.datasetQuery,
    datasetOwnership,
    datasetKeywordTarget,
    datasetUpdatedWithin,
  ]);

  // Pre-filter folders to only show owned or shared (with permissions) folders in Dashboard
  const accessibleFolders = useMemo(() => {
    if (!currentUserId) return [];
    return folders.filter((folder) =>
      isOwnedOrSharedFolder(folder, currentUserId)
    );
  }, [folders, currentUserId]);

  const filteredFolders = useMemo(() => {
    const keywords = tabState.folderQuery.trim()
      ? tabState.folderQuery.trim().split(/\s+/)
      : [];

    const filter: FolderFilterState = {
      keywords,
      keywordTarget: folderKeywordTarget,
      ownership: folderOwnership,
      visibility: "all",
      folderType: folderTypeFilter,
    };

    let list = filterFolders(accessibleFolders, filter, currentUserId);

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

    return sortFolders(list, folderSortOption);
  }, [
    accessibleFolders,
    tabState.folderQuery,
    folderOwnership,
    folderTypeFilter,
    folderSortOption,
    folderKeywordTarget,
    folderUpdatedWithin,
    currentUserId,
  ]);

  // --- SELECTION & NAV ---

  const toggleSelect = useCallback(
    (id: string) => {
      if (activeTab === "predictors") {
        setSelection((prev) => ({
          predictorId: prev.predictorId === id ? null : id,
          datasetId: null,
        }));
      } else {
        setSelection((prev) => ({
          datasetId: prev.datasetId === id ? null : id,
          predictorId: null,
        }));
      }
    },
    [activeTab]
  );

  const clearSelection = useCallback(() => {
    setSelection({ predictorId: null, datasetId: null });
  }, []);

  const createPredictor = useCallback(() => {
    navigate("/predictors/new");
  }, [navigate]);

  const addDataset = useCallback(() => {
    navigate("/datasets/new");
  }, [navigate]);

  // --- FOLDER MANAGEMENT ---

  const handleCreateFolder = useCallback(() => {
    setShowFolderModal(true);
    setFolderError(null);
  }, []);

  async function handleFolderCreation(data: CreateFolderRequest) {
    setFolderError(null);
    try {
      await createFolderMutation.mutateAsync(data);
      setShowFolderModal(false);
    } catch {
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
    setTimeout(() => {
      const element = document.getElementById(`folder-${folderId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }

  function handleFolderDelete(folderId: string) {
    const folder = folders.find((f) => f.folder_id === folderId);
    setPendingFolderDelete({
      id: folderId,
      name: folder?.name ?? "this folder",
    });
  }

  async function confirmFolderDelete() {
    if (!pendingFolderDelete || isDeletingFolder) return;

    const folderId = pendingFolderDelete.id;
    const prevFolders = queryClient.getQueryData(["folders"]);

    setIsDeletingFolder(true);
    setLoadingFolders((prev) => new Set(prev).add(folderId));

    // Optimistically remove from cache so UI drops immediately
    queryClient.setQueryData(["folders"], (prev: any) => {
      if (!Array.isArray(prev)) return prev;
      return prev.filter(
        (f) => f.folder_id !== folderId && f.id !== folderId
      );
    });

    try {
      await deleteFolderMutation.mutateAsync(folderId);
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
      setPendingFolderDelete(null);
    } catch (error: any) {
      console.error("Failed to delete folder:", error);
      // Roll back optimistic removal if it fails
      queryClient.setQueryData(["folders"], prevFolders);
    } finally {
      setLoadingFolders((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
      setIsDeletingFolder(false);
    }
  }

  const handleRemoveFromFolder = useCallback(
    async (
      itemId: string,
      itemType: "predictor" | "dataset",
      folderId: string
    ) => {
      setLoadingFolders((prev) => new Set(prev).add(folderId));

      try {
        await removeFromFolderMutation.mutateAsync({
          folderId,
          itemType,
          itemId,
        });
      } catch (error: any) {
        console.error("Failed to remove item from folder:", error);
      } finally {
        setLoadingFolders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(folderId);
          return newSet;
        });
      }
    },
    [removeFromFolderMutation]
  );

  const handleDrop = useCallback(
    (item: DragItem, folderId?: string) => {
      moveItem(item, folderId);
    },
    [moveItem]
  );

  const editItem = useCallback(
    (id: string) => {
      if (activeTab === "predictors") {
        navigate(`/predictors/${id}/edit`);
      } else {
        navigate(`/datasets/${id}/edit`);
      }
    },
    [activeTab, navigate]
  );

  const viewItem = useCallback(
    (id: string) => {
      if (activeTab === "predictors") {
        navigate(`/predictors/${id}`, { state: { from: "dashboard" } });
      } else {
        navigate(`/datasets/${id}/view`);
      }
    },
    [activeTab, navigate]
  );

  // --- DOWNLOAD ---

  async function downloadItem(
    id: string,
    allowAdminAccess: boolean,
    isOwner: boolean
  ) {
    try {
      if (!isOwner && !allowAdminAccess) {
        alert(
          "Download blocked: External access to this dataset has been disabled."
        );
        return;
      }
      const datasetId = parseInt(id, 10);
      const { blob, filename } = await downloadDatasetFile(datasetId);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanFilename = filename.replace(/^"|"$/g, "");
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

  // --- UNIFIED DELETE HANDLERS ---

  // prompt delete
  const promptDelete = useCallback(
    (id: string, title: string, type: DeleteType) => {
      setDeleteContext({ id, title, type });
    },
    []
  );

  // confirm delete
  async function handleConfirmDelete() {
    if (!deleteContext) return;
    const { id, type } = deleteContext;

    try {
      if (type === "predictor") {
        await deletePredictorMutation.mutateAsync(id);
        if (selection.predictorId === id) {
          setSelection((prev) => ({ ...prev, predictorId: null }));
        }
      } else if (type === "dataset") {
        await deleteDatasetMutation.mutateAsync(parseInt(id, 10));
        if (selection.datasetId === id) {
          setSelection((prev) => ({ ...prev, datasetId: null }));
        }
      } else if (type === "folder") {
        await deleteFolderMutation.mutateAsync(id);
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }

      setDeleteContext(null); // close modal on success
    } catch (error: any) {
      const msg =
        error?.details?.error || error?.message || "Failed to delete item";
      alert(`Delete failed: ${msg}`);
    }
  }

  // Determine if any delete operation is in progress
  const isDeleteLoading =
    deletePredictorMutation.isPending ||
    deleteDatasetMutation.isPending ||
    deleteFolderMutation.isPending;

  // --- RENDER ---

  return (
    <DragDropProvider>
      <section
        className="w-full space-y-6 bg-neutral-100 pt-4"
        onClick={clearSelection}
        role="presentation"
      >
        {/* welcome header */}
        <div
          className="mx-auto max-w-6xl px-3 pt-8 pb-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <h1 className="pb-1 pt-2 text-3xl font-extrabold tracking-tight text-neutral-900 md:text-4xl">
            Welcome{" "}
            {user
              ? user.first_name?.trim()
                ? user.first_name
                : user.username
              : "User"}
            !
          </h1>

          <h2 className="text-sm font-medium tracking-tight text-neutral-600 md:text-base">
            Find your datasets and predictors below.
          </h2>
        </div>

        {/* sticky toolbar under navbar (aligned with Browse width / colors) */}
        <div
          className="sticky top-[var(--app-nav-h,3.7rem)] z-40 w-full border-b bg-neutral-100/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-100/75"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-6xl px-3 py-4 pt-5">
            <Toolbar
              activeTab={activeTab}
              onTabChange={(t) => {
                selectTab(t);
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
                  setTabState((prev) => ({ ...prev, predictorQuery: value }));
                } else if (activeTab === "datasets") {
                  setTabState((prev) => ({ ...prev, datasetQuery: value }));
                } else {
                  setTabState((prev) => ({ ...prev, folderQuery: value }));
                }
              }}
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
        </div>

        {/* Main Content Area */}
        <div className="mx-auto flex max-w-6xl gap-4 px-3 pb-6">
          {/* Folder sidebar - always rendered for predictors/datasets tabs */}
          <FolderSidebar
            onItemMoved={async (_itemId, _folderId) => {
              queryClient.invalidateQueries({ queryKey: ["folders"] });
            }}
            className={
              activeTab === "folders"
                ? "hidden"
                : "w-64 shrink-0 overflow-hidden rounded-md border border-black bg-white shadow-sm"
            }
          />

          {/* Loading skeleton - shown when loading with no data */}
          {isLoading &&
          ((activeTab === "predictors" && predictors.length === 0) ||
            (activeTab === "datasets" && datasets.length === 0) ||
            (activeTab === "folders" && folders.length === 0)) ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-neutral-700" />
                <div className="text-sm text-neutral-700">
                  Loading {activeTab}...
                </div>
              </div>
              <div className={`mt-4 grid gap-4 ${activeTab === "folders" ? "sm:grid-cols-1 lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-lg border border-black bg-white p-4"
                  >
                    <div className="mb-3 h-5 w-3/4 rounded bg-neutral-200" />
                    <div className="mb-2 h-3 w-1/2 rounded bg-neutral-200" />
                    <div className="h-20 rounded bg-neutral-200" />
                  </div>
                ))}
              </div>
            </div>
          ) : (

          <div className="min-w-0 flex-1 transition-all duration-300">
            {activeTab === "folders" ? (
              <div
                className="space-y-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <RecentFolders
                    onFolderSelect={handleRecentFolderSelect}
                    currentFolderId={currentFolderView || undefined}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                  {filteredFolders.map((folder) => {
                    const isFolderOwner = isOwner(folder, currentUserId);

                    return (
                      <div
                        key={`folder-${folder.folder_id}`}
                        id={`folder-${folder.folder_id}`}
                        className={
                          currentFolderView === folder.folder_id
                            ? "rounded-xl ring-2 ring-neutral-500"
                            : ""
                        }
                      >
                        <FolderCard
                          folder={folder}
                          expanded={expandedFolders.has(folder.folder_id)}
                          onToggleExpand={handleToggleFolderExpansion}
                          onEdit={
                            isFolderOwner
                              ? (folderId) => {
                                  const f = folders.find(
                                    (x) => x.folder_id === folderId
                                  );
                                  if (f) {
                                    setEditingFolder(f);
                                    setIsEditModalOpen(true);
                                  }
                                }
                              : undefined
                          }
                          onDelete={
                            isFolderOwner ? handleFolderDelete : undefined
                          }
                          onShare={
                            isFolderOwner
                              ? (folderId) => {
                                  const f = folders.find(
                                    (x) => x.folder_id === folderId
                                  );
                                  if (f) {
                                    setSharingFolder(f);
                                    setIsSharingModalOpen(true);
                                  }
                                }
                              : undefined
                          }
                          // enable drag-and-drop directly on folder cards
                          onDrop={handleDrop}
                          onItemSelect={(itemId, itemType) => {
                            if (itemType === "predictor") {
                              setSelection((prev) => ({
                                predictorId:
                                  prev.predictorId === itemId ? null : itemId,
                                datasetId: null,
                              }));
                            } else {
                              setSelection((prev) => ({
                                datasetId:
                                  prev.datasetId === itemId ? null : itemId,
                                predictorId: null,
                              }));
                            }
                          }}
                          onItemEdit={
                            isFolderOwner
                              ? (itemId) => editItem(itemId)
                              : undefined
                          }
                          onItemDelete={
                            isFolderOwner
                              ? (itemId, itemType) => {
                                  const item =
                                    itemType === "predictor"
                                      ? predictors.find((p) => p.id === itemId)
                                      : datasets.find((d) => d.id === itemId);
                                  const foundItem =
                                    item ||
                                    (folder.items?.find(
                                      (i) => i.id === itemId
                                    ) as any);
                                  if (foundItem) {
                                    promptDelete(
                                      itemId,
                                      foundItem.title ?? "Item",
                                      itemType
                                    );
                                  }
                                }
                              : undefined
                          }
                          onItemView={(itemId) => viewItem(itemId)}
                          onRemoveFromFolder={
                            isFolderOwner
                              ? (itemId, itemType) =>
                                  handleRemoveFromFolder(
                                    itemId,
                                    itemType,
                                    folder.folder_id
                                  )
                              : undefined
                          }
                          selectedItems={
                            new Set([
                              ...(selection.predictorId
                                ? [selection.predictorId]
                                : []),
                              ...(selection.datasetId
                                ? [selection.datasetId]
                                : []),
                            ])
                          }
                          currentUserId={currentUserId}
                          canEdit={isFolderOwner}
                          isLoading={
                            loadingFolders.has(folder.folder_id) ||
                            removeFromFolderMutation.isPending
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                {filteredFolders.length === 0 && !isLoading && (
                  <div className="py-12 text-center">
                    <div className="text-lg text-neutral-500">
                      No folders found
                    </div>
                    <div className="mt-2 text-sm text-neutral-400">
                      Create a folder to organize your predictors and datasets
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <DroppableFolder
                folder={null}
                onDrop={handleDrop}
                isLoading={isItemLoading}
                className="rounded-xl p-2 transition-all duration-200"
              >
                <div
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  onClick={(e) => e.stopPropagation()}
                >
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
                            onDelete={(id) =>
                              promptDelete(id, it.title, "predictor")
                            }
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
                            onDelete={(id) =>
                              promptDelete(id, it.title, "dataset")
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

                  {(activeTab === "predictors"
                    ? filteredPredictors
                    : filteredDatasets
                  )
                    .filter((item) => !item.folderId).length === 0 &&
                    !isLoading && (
                      <div className="col-span-full flex items-center justify-center py-12 text-center">
                        <div className="max-w-sm">
                          <div className="mb-2 text-lg text-neutral-400">
                            <FolderOpen className="h-4 w-4 text-neutral-500" />
                          </div>
                          <p className="text-sm text-neutral-500">
                            No {activeTab} in your main collection
                          </p>
                          <p className="mt-1 text-xs text-neutral-400">
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

            <DeleteConfirmation
              open={!!pendingFolderDelete}
              name={pendingFolderDelete?.name ?? ""}
              description="Items inside this folder will be preserved."
              onCancel={() =>
                !isDeletingFolder && setPendingFolderDelete(null)
              }
              onConfirm={confirmFolderDelete}
              isLoading={isDeletingFolder}
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

            {editingFolder && (
              <FolderEditModal
                isOpen={isEditModalOpen}
                onClose={() => {
                  setIsEditModalOpen(false);
                  setEditingFolder(null);
                }}
                folder={editingFolder}
                onFolderUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ["folders"] });
                }}
              />
            )}

            {sharingFolder && (
              <FolderSharingModal
                isOpen={isSharingModalOpen}
                onClose={() => {
                  setIsSharingModalOpen(false);
                  setSharingFolder(null);
                }}
                folder={sharingFolder}
                onPermissionsUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ["folders"] });
                }}
              />
            )}
          </div>
          )}
        </div>
      </section>
    </DragDropProvider>
  );
}

/**
 * Advanced filter menu for predictors/datasets.
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
      <summary className="inline-flex h-9.5 cursor-pointer select-none items-center gap-1 rounded-md border bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
        Filters
        <span className="transition-transform text-[20px] text-neutral-500 group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border bg-white p-3 text-xs shadow-lg">
        {/* Ownership */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">Ownership</div>
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
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search in */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">Search in</div>
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
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Updated within */}
        <div>
          <div className="mb-1 font-semibold text-neutral-700">
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
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
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
      <summary className="inline-flex h-9.5 cursor-pointer select-none items-center gap-1 rounded-md border bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
        Filters
        <span className="transition-transform text-[20px] text-neutral-500 group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border bg-white p-3 text-xs shadow-lg">
        {/* Ownership - only show owned/shared options in Dashboard */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">
            Ownership & access
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "Owned or shared with me"],
                ["owner", "Owned by me"],
                ["viewer", "Shared (I can access)"],
              ] as [Ownership, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onOwnershipChange(value)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  ownership === value
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search in */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">Search in</div>
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
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Updated within */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">
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
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Folder type */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">Folder type</div>
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
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort by */}
        <div>
          <div className="mb-1 font-semibold text-neutral-700">Sort by</div>
          <FolderSortMenu value={sortOption} onChange={onSortOptionChange} />
        </div>
      </div>
    </details>
  );
}
