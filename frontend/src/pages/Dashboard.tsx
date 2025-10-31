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
 */

import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

type Tab = "predictors" | "datasets" | "folders";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // tabs + data
  const [activeTab, setActiveTab] = useState<Tab>("predictors");
  const [predictors, setPredictors] = useState<PredictorItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // error and loading
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which tabs have been loaded
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());

  // selection (per tab)
  const [selectedPredictorId, setSelectedPredictorId] = useState<string | null>(
    null
  );
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  );

  // per-tab search
  const [predictorQuery, setPredictorQuery] = useState("");
  const [datasetQuery, setDatasetQuery] = useState("");
  const [folderQuery, setFolderQuery] = useState("");

  // per-tab ownership
  const [predictorOwnership, setPredictorOwnership] =
    useState<Ownership>("all");
  const [datasetOwnership, setDatasetOwnership] = useState<Ownership>("all");
  const [folderOwnership, setFolderOwnership] = useState<Ownership>("all");

  // delete modal (predictors/datasets only)
  const [pendingDelete, setPendingDelete] = useState<PredictorItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // folder mgmt
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // folder filters
  const [folderSortOption, setFolderSortOption] =
    useState<FolderSortOption>(DEFAULT_FOLDER_SORT);
  const [folderTypeFilter, setFolderTypeFilter] = useState<FolderType>("all");
  const [currentFolderView, setCurrentFolderView] = useState<string | null>(
    null
  );

  // drag+drop tracking
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  const { moveItem, isItemLoading } = useDragDrop(() => {
    // sidebar handles its own updates; no-op here
  });

  async function fetchFolders() {
    try {
      const folderData = await listMyFolders();
      const mapped = Array.isArray(folderData)
        ? folderData.map((it) => mapApiFolderToUi(it))
        : [];
      setFolders(mapped);
      // console.log for debug only
      console.log("mapped folders:", JSON.parse(JSON.stringify(mapped)));
    } catch (err: any) {
      console.error("Failed to fetch folders:", err);
    }
  }

  // Fetch tab data (+ folders) on tab switch / initial
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    let didFinish = false;

    setError(null);

    const SHOW_LOADING_DELAY = 300;

    const isInitialPredictorFetch =
      predictors.length === 0 && activeTab === "predictors";
    const isInitialDatasetFetch =
      datasets.length === 0 && activeTab === "datasets";
    const isInitialFolderFetch =
      folders.length === 0 && activeTab === "folders";

    const isInitialFetch =
      isInitialPredictorFetch || isInitialDatasetFetch || isInitialFolderFetch;

    let loadingTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchActive() {
      if (!isInitialFetch) {
        setIsLoading(false);
        return;
      }

      loadingTimer = setTimeout(() => {
        if (!didFinish && mounted) setIsLoading(true);
      }, SHOW_LOADING_DELAY);

      try {
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

        // always fetch folders so sidebar + folders tab stay fresh
        promises.push(
          (async () => {
            await fetchFolders();
          })()
        );

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
        didFinish = true;
        if (loadingTimer) clearTimeout(loadingTimer);
        if (mounted) setIsLoading(false);
      }
    }

    const t = window.setTimeout(() => fetchActive(), 250);

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(t);
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [user, activeTab, predictors.length, datasets.length, folders.length]);

  // track "loaded once" per tab, to avoid spinner flashes
  useEffect(() => {
    const hasData =
      (activeTab === "predictors" && predictors.length > 0) ||
      (activeTab === "datasets" && datasets.length > 0) ||
      (activeTab === "folders" && folders.length > 0);

    const tabWasLoaded = loadedTabs.has(activeTab);

    if (hasData && !tabWasLoaded) {
      setLoadedTabs((prev) => new Set(prev).add(activeTab));
      setIsLoading(false);
    } else if (hasData && tabWasLoaded) {
      setIsLoading(false);
    }
  }, [
    activeTab,
    predictors.length,
    datasets.length,
    folders.length,
    loadedTabs,
  ]);

  const filteredPredictors = useMemo(() => {
    const q = predictorQuery.trim().toLowerCase();
    let list = predictors.filter((it) =>
      q ? it.title.toLowerCase().includes(q) : true
    );
    if (predictorOwnership === "owner") list = list.filter((it) => it.owner);
    if (predictorOwnership === "viewer") list = list.filter((it) => !it.owner);
    return list;
  }, [predictors, predictorQuery, predictorOwnership]);

  const filteredDatasets = useMemo(() => {
    const q = datasetQuery.trim().toLowerCase();
    let list = datasets.filter((it) => {
      const title = it?.title ?? "";
      return q ? title.toLowerCase().includes(q) : true;
    });
    if (datasetOwnership === "owner") list = list.filter((it) => it.owner);
    if (datasetOwnership === "viewer") list = list.filter((it) => !it.owner);
    return list;
  }, [datasets, datasetQuery, datasetOwnership]);

  const filteredFolders = useMemo(() => {
    const currentUserId = (user as any)?.id ?? (user as any)?.pk ?? undefined;

    let list = folders;

    // ownership filter
    list = list.filter((folder) => {
      const isOwner = currentUserId
        ? folder.owner.id === currentUserId
        : false;
      if (folderOwnership === "owner") return isOwner;
      if (folderOwnership === "viewer") return !isOwner;
      return true;
    });

    // search folders and their contents
    if (folderQuery.trim()) {
      const q = folderQuery.trim().toLowerCase();
      list = list.filter((folder) => {
        const folderMatch =
          folder.name.toLowerCase().includes(q) ||
          (folder.description &&
            folder.description.toLowerCase().includes(q));

        const contentMatch = folder.items?.some(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            (item.notes && item.notes.toLowerCase().includes(q))
        );

        return folderMatch || contentMatch;
      });
    }

    // type filter
    list = filterFoldersByType(list, folderTypeFilter);

    // sort
    list = sortFolders(list, folderSortOption);

    return list;
  }, [
    folders,
    folderQuery,
    folderOwnership,
    folderTypeFilter,
    folderSortOption,
    user,
  ]);

  function toggleSelect(id: string) {
    if (activeTab === "predictors") {
      setSelectedPredictorId((curr) => (curr === id ? null : id));
      setSelectedDatasetId(null);
    } else {
      setSelectedDatasetId((curr) => (curr === id ? null : id));
      setSelectedPredictorId(null);
    }
  }

  function clearSelection() {
    setSelectedPredictorId(null);
    setSelectedDatasetId(null);
  }

  function createPredictor() {
    navigate("/predictors/new");
  }

  function addDataset() {
    navigate("/datasets/new");
  }

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

      // refresh after creation so sidebar, etc. are current
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

      // if you were looking at this folder, clear that view
      setCurrentFolderView((curr) =>
        curr === folderId ? null : curr
      );

      // also prune it from "recent folders"
      try {
        const stored = localStorage.getItem("kiro_recent_folders");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter(
              (f: any) => f.folder_id !== folderId
            );
            localStorage.setItem(
              "kiro_recent_folders",
              JSON.stringify(updated)
            );
          }
        }
      } catch (_) {
        /* ignore localStorage errors */
      }
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
    setLoadingFolders((prev) => new Set(prev).add(folderId));

    try {
      await removeItemFromFolder(folderId, itemType, itemId);

      // clear folderId on that item in the flat lists
      if (itemType === "predictor") {
        setPredictors((prev) =>
          prev.map((p) =>
            p.id === itemId ? { ...p, folderId: undefined } : p
          )
        );
      } else {
        setDatasets((prev) =>
          prev.map((d) =>
            d.id === itemId ? { ...d, folderId: undefined } : d
          )
        );
      }

      // update exact folder's contents inline
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

  function editItem(id: string) {
    if (activeTab === "predictors") {
      navigate(`/predictors/${id}/edit`);
    } else {
      navigate(`/datasets/${id}/edit`);
    }
  }

  function viewItem(id: string) {
    if (activeTab === "predictors") {
      navigate(`/predictors/${id}`, { state: { from: "dashboard" } });
    } else {
      navigate(`/datasets/${id}/view`);
    }
  }

  async function downloadItem(id: string) {
    try {
      const datasetId = parseInt(id);
      const { blob, filename } = await downloadDatasetFile(datasetId);

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

  async function confirmDelete() {
    if (!pendingDelete || isDeleting) return;

    setIsDeleting(true);

    try {
      if (activeTab === "predictors") {
        const predictorId = pendingDelete.id;
        await deletePredictor(predictorId);

        setPredictors((arr) =>
          arr.filter((x) => x.id !== pendingDelete.id)
        );

        if (selectedPredictorId === predictorId) {
          setSelectedPredictorId(null);
        }
      } else {
        const datasetId = parseInt(pendingDelete.id);
        await deleteDataset(datasetId);

        setDatasets((arr) =>
          arr.filter((x) => x.id !== pendingDelete.id)
        );
        if (selectedDatasetId === pendingDelete.id) {
          setSelectedDatasetId(null);
        }
      }

      setPendingDelete(null);
    } catch (error: any) {
      const errorMessage =
        error?.details?.error ||
        error?.message ||
        "Failed to delete dataset";
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
    activeTab === "predictors"
      ? selectedPredictorId
      : selectedDatasetId;

  return (
    <DragDropProvider>
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
          <div className="mx-auto mt-4 max-w-2xl space-y-2">
            <h2 className="text-2xl tracking-tight md:text-2xl">
              Find your datasets and predictors below.
            </h2>
          </div>
        </div>

        {/* sticky toolbar under navbar, aligned to max-w-6xl like Browse */}
        <div
          className="sticky top-14 md:top-16 z-40 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-6xl px-4 py-3">
            <Toolbar
              activeTab={activeTab}
              onTabChange={async (t) => {
                setActiveTab(t);
                clearSelection();
                if (t === "folders") {
                  await fetchFolders();
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
                activeTab === "folders"
                  ? setFolderTypeFilter
                  : undefined
              }
              folderSortOption={
                activeTab === "folders" ? folderSortOption : undefined
              }
              onFolderSortChange={
                activeTab === "folders"
                  ? setFolderSortOption
                  : undefined
              }
            />
          </div>
          <div className="border-t border-black/10" />
        </div>

        {/* Main Content Area */}
        {activeTab === "folders" ? (
          /* FOLDERS TAB LAYOUT (no sidebar) */
          <div
            className="mx-auto max-w-6xl px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {isLoading && folders.length === 0 ? (
              /* folders loading skeleton */
              <div className="space-y-6">
                <div className="rounded-md border border-black/10 bg-white p-4">
                  <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="flex gap-2 overflow-x-auto">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="min-w-[8rem] rounded-lg border border-black/10 p-3"
                      >
                        <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-gray-200" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-black/10 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3 h-5 w-3/4 animate-pulse rounded bg-gray-200" />
                      <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                      <div className="h-16 animate-pulse rounded bg-gray-200" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* folders real content */
              <div className="space-y-6">
                <div>
                  <RecentFolders
                    onFolderSelect={handleRecentFolderSelect}
                    currentFolderId={currentFolderView || undefined}
                  />
                </div>

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
                            ? "ring-2 ring-blue-500 rounded-xl"
                            : ""
                        }
                      >
                        <FolderCard
                          folder={folder}
                          expanded={expandedFolders.has(folder.folder_id)}
                          onToggleExpand={handleToggleFolderExpansion}
                          onEdit={(folderId) => {
                            console.log(
                              "Folder edit initiated for:",
                              folderId
                            );
                          }}
                          onDelete={handleFolderDelete}
                          onShare={(folderId) => {
                            console.log(
                              "Folder sharing initiated for:",
                              folderId
                            );
                          }}
                          onItemSelect={(itemId, itemType) => {
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
                              ...(selectedDatasetId
                                ? [selectedDatasetId]
                                : []),
                            ])
                          }
                          currentUserId={currentUserId}
                          canEdit={true}
                          // DroppableFolder in FolderCard expects isLoading: (id) => boolean
                          isLoading={loadingFolders.has(
                            folder.folder_id
                          )}
                        />
                      </div>
                    );
                  })}
                </div>

                {filteredFolders.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <div className="text-gray-500 text-lg">
                      No folders found
                    </div>
                    <div className="text-gray-400 text-sm mt-2">
                      Create a folder to organize your predictors and datasets
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* PREDICTORS / DATASETS TAB LAYOUT (sidebar + main grid) */
          <div className="mx-auto max-w-6xl px-4 flex gap-6">
            {/* left sidebar is always shown here, like pinned panel on Browse */}
            <FolderSidebar
              onItemMoved={async (_itemId, _folderId) => {
                try {
                  await fetchFolders();
                } catch (error) {
                  console.error(
                    "Failed to refresh folder data:",
                    error
                  );
                }
              }}
            />

            <div className="flex-1 transition-all duration-300">
              {isLoading && list.length === 0 ? (
                /* predictors/datasets loading skeleton in-place */
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-t-2 border-b-2 border-gray-700" />
                    <div className="text-sm text-gray-700">
                      Loading {activeTab}...
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-black/10 p-4"
                      >
                        <div className="mb-3 h-5 w-3/4 animate-pulse rounded bg-gray-200" />
                        <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                        <div className="h-20 animate-pulse rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* real predictors/datasets content */
                <DroppableFolder
                  folder={null}
                  onDrop={handleDrop}
                  isLoading={isItemLoading}
                  className="min-h-[200px] p-4 rounded-xl transition-all duration-200"
                >
                  <div
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {list
                      .filter((item) => !item.folderId)
                      .map((it) =>
                        activeTab === "predictors" ? (
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
                        ) : (
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
                            onDownload={downloadItem}
                            onDrop={handleDrop}
                            isLoading={isItemLoading(it.id)}
                          />
                        )
                      )}

                    {list.filter((item) => !item.folderId).length === 0 &&
                      !isLoading && (
                        <div className="col-span-full flex items-center justify-center py-12 text-center">
                          <div className="max-w-sm">
                            <div className="text-gray-400 text-lg mb-2">
                              🗀
                            </div>
                            <p className="text-gray-500 text-sm">
                              No {activeTab} in your main collection
                            </p>
                            <p className="text-gray-400 text-xs mt-1">
                              Drag items from folders here to move them
                              back to your main collection
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                </DroppableFolder>
              )}
            </div>
          </div>
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
      </section>
    </DragDropProvider>
  );
}
