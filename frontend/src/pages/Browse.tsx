import { useEffect, useMemo, useState } from "react";
import SearchBar from "../components/SearchBar";
import CardShell from "../components/CardShell";
import PublicFilter, { type Visibility } from "../components/PublicFilter";
import UsernameTag from "../components/UsernameTag";
import DragDropProvider from "../components/DragDropProvider";
import {
  FolderCard,
  FolderSortMenu,
  FolderTypeFilter,
  RecentFolders,
  type FolderSortOption,
  type FolderType,
} from "../components/folder";
import { addFolderToRecent } from "../components/folder/navigation/RecentFolders";
import {
  listPublicPredictors,
  listPinnedPredictors,
  pinPredictor,
  unpinPredictor,
} from "../lib/predictors";
import {
  listPublicFolders,
  getPublicFolderContents,
  mapApiFolderToUi,
  type Folder,
} from "../lib/folders";
import {
  listPublicDatasets,
  listPinnedDatasets,
  pinDataset,
  unpinDataset,
  downloadDatasetFile,
} from "../lib/datasets";
import { toPredictorItem, toDatasetItem } from "../lib/mappers";
import { useAuth } from "../auth/AuthContext";
import { sortFolders, DEFAULT_FOLDER_SORT } from "../lib/folderUtils";
import { useNavigate, useSearchParams } from "react-router-dom";

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
} from "../types/flitering";
import type { PredictorItem } from "../components/PredictorCard";
import type { DatasetItem } from "../components/DatasetCard";

type Tab = "predictors" | "datasets" | "folders";

/**
 * Browse-specific extensions to the base card item types
 * used on the Dashboard.
 */
type BrowseBase = {
  ownerName?: string | null | undefined;
  // raw timestamp for chronological filtering
  updatedAtRaw?: string | null | undefined;
  // these are mainly used for datasets but kept shared for simplicity
  hasFile?: boolean;
  originalFilename?: string | null | undefined;
};

type BrowsePredictor = PredictorItem & BrowseBase;
type BrowseDataset = DatasetItem & BrowseBase;
type BrowseItem = BrowsePredictor | BrowseDataset;

// local types for advanced filters
type KeywordTarget = "title" | "notes" | "both";
type TimeWindow = "any" | "7d" | "30d" | "365d";

const DEFAULT_PREDICTOR_SORT = {
  field: "updatedAt" as const,
  direction: "desc" as const,
};

const DEFAULT_DATASET_SORT = {
  field: "updatedAt" as const,
  direction: "desc" as const,
};

// helper: updatedWithin matcher (uses raw ISO timestamp where possible)
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

export default function Browse() {
  const { user } = useAuth();

  // tab navigation handling (same thing as Dashboard mostly)
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: Tab = (() => {
    const q = searchParams.get("tab");
    return q === "datasets" || q === "folders" ? (q as Tab) : "predictors";
  })();

  const selectTab = (t: Tab) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set("tab", t);
        return sp;
      },
      { replace: true }
    );
    setSelectedPredictorId(null);
    setSelectedDatasetId(null);
  };

  // Separate search states for each tab
  const [predictorQuery, setPredictorQuery] = useState("");
  const [datasetQuery, setDatasetQuery] = useState("");
  const [folderQuery, setFolderQuery] = useState("");

  // Separate visibility filters for each tab
  const [predictorVisibility, setPredictorVisibility] =
    useState<Visibility>("all");
  const [datasetVisibility, setDatasetVisibility] =
    useState<Visibility>("all");
  const [folderVisibility, setFolderVisibility] = useState<Visibility>("all");
  const [pinnedOpen, setPinnedOpen] = useState(true);

  // --- Advanced filter state (Browse only) ---

  // where to search (title / notes / both)
  const [predictorKeywordTarget, setPredictorKeywordTarget] =
    useState<KeywordTarget>("both");
  const [datasetKeywordTarget, setDatasetKeywordTarget] =
    useState<KeywordTarget>("both");

  // updated within time windows
  const [predictorUpdatedWithin, setPredictorUpdatedWithin] =
    useState<TimeWindow>("any");
  const [datasetUpdatedWithin, setDatasetUpdatedWithin] =
    useState<TimeWindow>("any");

  // owner username search (shared between predictors/datasets)
  const [ownerNameQuery, setOwnerNameQuery] = useState("");

  // datasets: only show those with a downloadable file
  const [datasetHasFileOnly, setDatasetHasFileOnly] = useState(false);

  // API-loaded data (mapped through the mappers)
  const [predictors, setPredictors] = useState<BrowsePredictor[]>([]);
  const [datasets, setDatasets] = useState<BrowseDataset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pinned IDs separated per tab (pinning is ONLY on Browse)
  const [pinnedPredictorIds, setPinnedPredictorIds] = useState<Set<string>>(
    new Set()
  );
  const [pinnedDatasetIds, setPinnedDatasetIds] = useState<Set<string>>(
    new Set()
  );
  const [pinnedFolderIds, setPinnedFolderIds] = useState<Set<string>>(
    new Set()
  );

  // Folder expansion state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Folder-specific filters (search uses main query state)
  const [folderSortOption, setFolderSortOption] =
    useState<FolderSortOption>(DEFAULT_FOLDER_SORT);
  const [folderTypeFilter, setFolderTypeFilter] = useState<FolderType>("all");

  const navigate = useNavigate();

  const [selectedPredictorId, setSelectedPredictorId] = useState<string | null>(
    null
  );
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  );

  function toggleSelect(id: string) {
    if (activeTab === "predictors") {
      setSelectedPredictorId((curr) => (curr === id ? null : id));
      setSelectedDatasetId(null);
    } else {
      setSelectedDatasetId((curr) => (curr === id ? null : id));
      setSelectedPredictorId(null);
    }
  }

  // Fetch pinned predictors from your backend API
  async function fetchPinnedPredictors() {
    if (!user) return;

    try {
      const pinned = await listPinnedPredictors();
      const pinnedSet = new Set(
        pinned.map((p) => String(p.predictor.predictor_id))
      );
      setPinnedPredictorIds(pinnedSet);
    } catch (err) {
      console.error("Failed to fetch pinned predictors:", err);
    }
  }

  // Fetch pinned datasets
  async function fetchPinnedDatasets() {
    if (!user) return;

    try {
      const pinned = await listPinnedDatasets();
      const pinnedSet = new Set(pinned.map((d) => String(d.dataset_id)));
      setPinnedDatasetIds(pinnedSet);
    } catch (err) {
      console.error("Failed to fetch pinned datasets:", err);
    }
  }

  // Load pinned items from backend on mount / tab change
  useEffect(() => {
    if (activeTab === "predictors") fetchPinnedPredictors();
    else if (activeTab === "datasets") fetchPinnedDatasets();
  }, [user, activeTab]);

  // Fetch & map once on mount or when tab changes
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    let didFinish = false;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;

    const SHOW_LOADING_DELAY = 300;

    // Track whether we've already fetched data for this tab
    const isInitialPredictorFetch =
      predictors.length === 0 && activeTab === "predictors";
    const isInitialDatasetFetch =
      datasets.length === 0 && activeTab === "datasets";
    const isInitialFetch = isInitialPredictorFetch || isInitialDatasetFetch;

    setError(null);

    async function fetchData() {
      if (isInitialFetch) {
        loadingTimer = setTimeout(() => {
          if (!didFinish && mounted) setIsLoading(true);
        }, SHOW_LOADING_DELAY);
      } else {
        setIsLoading(false);
      }

      try {
        if (activeTab === "predictors") {
          const apiPreds = await listPublicPredictors();
          if (!mounted) return;

          const uiPreds: BrowsePredictor[] = apiPreds.map((p: any) => {
            const ui = toPredictorItem(p);
            // extend the Dashboard-style UI item with browse-specific fields
            const item: BrowsePredictor = {
              ...ui,
              ownerName: p.owner?.username || "Unknown Owner",
              updatedAtRaw: (p as any).updated_at ?? null,
            };
            return item;
          });

          setPredictors(uiPreds);
        } else if (activeTab === "datasets") {
          const apiDsets = await listPublicDatasets();
          if (!mounted) return;
          const currentUserId =
            (user as any)?.id ?? (user as any)?.pk ?? undefined;

          const uiDsets: BrowseDataset[] = apiDsets.map((d: any) => {
            const ui = toDatasetItem(d, currentUserId);
            const item: BrowseDataset = {
              ...ui,
              // prefer mapper's ownerName, fall back to API field
              ownerName: ui.ownerName || d.owner_name || "Owner",
              updatedAtRaw: d.updated_at ?? null,
            };
            return item;
          });

          setDatasets(uiDsets);
        }
      } catch (err: any) {
        if (err?.status === 0) setError("Network error");
        else
          setError(
            err?.details?.message ?? err?.statusText ?? "Failed to load"
          );
        console.error("Fetch error", err);
      } finally {
        didFinish = true;
        if (loadingTimer) clearTimeout(loadingTimer);
        if (mounted) setIsLoading(false);
      }
    }

    const t = window.setTimeout(() => fetchData(), 250);

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(t);
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [user, activeTab, predictors.length, datasets.length]);

  // Separate effect to fetch folders (always loaded)
  useEffect(() => {
    let mounted = true;

    async function fetchFolders() {
      try {
        const apiFolders = await listPublicFolders();
        if (!mounted) return;
        const uiFolders = apiFolders
          .map(mapApiFolderToUi)
          .filter(
            (folder) =>
              !folder.is_private && folder.public_item_count > 0
          );
        setFolders(uiFolders);
      } catch (err) {
        console.error("Failed to fetch folders:", err);
      }
    }

    fetchFolders();

    return () => {
      mounted = false;
    };
  }, [user]);

  // base list for pinned panel (only predictors/datasets)
  const list: BrowseItem[] =
    activeTab === "predictors"
      ? predictors
      : activeTab === "datasets"
      ? datasets
      : [];

  // filtered items for predictors / datasets
  const filteredPredictors = useMemo<BrowsePredictor[]>(() => {
    if (activeTab !== "predictors") return [];

    const keywords = predictorQuery.trim()
      ? predictorQuery.trim().split(/\s+/)
      : [];

    const filter: PredictorFilterState = {
      keywords,
      keywordTarget: predictorKeywordTarget,
      ownership: "all",
      visibility: predictorVisibility,
    };

    // base keyword + visibility filtering
    let base = filterPredictors(
      predictors,
      filter
    ) as BrowsePredictor[];

    // owner-name filter
    if (ownerNameQuery.trim()) {
      const needle = ownerNameQuery.trim().toLowerCase();
      base = base.filter((item) =>
        (item.ownerName ?? "").toLowerCase().includes(needle)
      );
    }

    // time window filter (use raw timestamp if available)
    if (predictorUpdatedWithin !== "any") {
      base = base.filter((item) =>
        matchesUpdatedWithin(
          item.updatedAtRaw ?? item.updatedAt,
          predictorUpdatedWithin
        )
      );
    }

    return sortPredictors(
      base,
      DEFAULT_PREDICTOR_SORT
    ) as BrowsePredictor[];
  }, [
    activeTab,
    predictors,
    predictorQuery,
    predictorVisibility,
    predictorKeywordTarget,
    predictorUpdatedWithin,
    ownerNameQuery,
  ]);

  const filteredDatasets = useMemo<BrowseDataset[]>(() => {
    if (activeTab !== "datasets") return [];

    const keywords = datasetQuery.trim()
      ? datasetQuery.trim().split(/\s+/)
      : [];

    const filter: DatasetFilterState = {
      keywords,
      keywordTarget: datasetKeywordTarget,
      ownership: "all",
      visibility: datasetVisibility,
    };

    // base keyword + visibility filtering
    let base = filterDatasets(
      datasets,
      filter
    ) as BrowseDataset[];

    // owner-name filter
    if (ownerNameQuery.trim()) {
      const needle = ownerNameQuery.trim().toLowerCase();
      base = base.filter((item) =>
        (item.ownerName ?? "").toLowerCase().includes(needle)
      );
    }

    // time window filter (use raw timestamp if available)
    if (datasetUpdatedWithin !== "any") {
      base = base.filter((item) =>
        matchesUpdatedWithin(
          item.updatedAtRaw ?? item.updatedAt,
          datasetUpdatedWithin
        )
      );
    }

    // has-file-only filter
    if (datasetHasFileOnly) {
      base = base.filter((item) => !!item.hasFile);
    }

    return sortDatasets(base, DEFAULT_DATASET_SORT) as BrowseDataset[];
  }, [
    activeTab,
    datasets,
    datasetQuery,
    datasetVisibility,
    datasetKeywordTarget,
    datasetUpdatedWithin,
    ownerNameQuery,
    datasetHasFileOnly,
  ]);

  const filtered: BrowseItem[] =
    activeTab === "predictors"
      ? filteredPredictors
      : activeTab === "datasets"
      ? filteredDatasets
      : [];

  // Filter folders based on search, visibility, type, and sorting
  const filteredFolders = useMemo(() => {
    const keywords = folderQuery.trim()
      ? folderQuery.trim().split(/\s+/)
      : [];

    const filter: FolderFilterState = {
      keywords,
      keywordTarget: "both",
      // Browse doesn't care about owner/viewer split; we show all public folders
      ownership: "all",
      visibility: folderVisibility,
      folderType: folderTypeFilter,
    };

    const base = filterFolders(folders, filter);
    return sortFolders(base, folderSortOption);
  }, [
    folders,
    folderQuery,
    folderVisibility,
    folderTypeFilter,
    folderSortOption,
  ]);

  const pinnedSet =
    activeTab === "predictors"
      ? pinnedPredictorIds
      : activeTab === "datasets"
      ? pinnedDatasetIds
      : pinnedFolderIds;

  const pinned =
    activeTab === "folders"
      ? []
      : list.filter((it) => pinnedSet.has(it.id));

  // Toggle pin (predictors & datasets)
  async function togglePin(id: string) {
    if (!user) return;

    if (activeTab === "predictors") {
      const isPinned = pinnedPredictorIds.has(id);
      setPinnedPredictorIds((prev) => {
        const next = new Set(prev);
        if (isPinned) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        if (isPinned) await unpinPredictor(id);
        else await pinPredictor(id);
      } catch (err) {
        console.error("Failed to toggle pin:", err);
        // rollback
        setPinnedPredictorIds((prev) => {
          const next = new Set(prev);
          if (isPinned) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    } else if (activeTab === "datasets") {
      const isPinned = pinnedDatasetIds.has(id);
      setPinnedDatasetIds((prev) => {
        const next = new Set(prev);
        if (isPinned) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        if (isPinned) await unpinDataset(id);
        else await pinDataset(id);
      } catch (err) {
        console.error("Failed to toggle dataset pin:", err);
        setPinnedDatasetIds((prev) => {
          const next = new Set(prev);
          if (isPinned) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    }
  }

  // Separate function for folder pinning
  function toggleFolderPin(folderId: string) {
    setPinnedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  // download dataset file
  async function downloadDataset(id: string) {
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

  // Folder expansion handlers
  async function handleToggleFolderExpand(folderId: string) {
    const isExpanded = expandedFolders.has(folderId);

    if (isExpanded) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    } else {
      const folder = folders.find((f) => f.folder_id === folderId);
      if (folder && (!folder.items || folder.items.length === 0)) {
        try {
          const contents = await getPublicFolderContents(folderId);
          setFolders((prev) =>
            prev.map((f) =>
              f.folder_id === folderId ? { ...f, items: contents } : f
            )
          );
        } catch (error) {
          console.error("Failed to load folder contents:", error);
        }
      }

      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(folderId);
        return next;
      });

      if (folder) addFolderToRecent(folder);
    }
  }

  // Recent folder selection handler
  function handleRecentFolderSelect(folderId: string) {
    setExpandedFolders((prev) => new Set(prev).add(folderId));
    setTimeout(() => {
      const element = document.getElementById(
        `browse-folder-${folderId}`
      );
      if (element)
        element.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  function handleItemView(
    itemId: string,
    itemType: "predictor" | "dataset"
  ) {
    if (itemType === "predictor") {
      window.open(`/predictors/${itemId}/view`, "_blank");
    } else {
      window.open(`/datasets/${itemId}/view`, "_blank");
    }
  }

  const tabLabel =
    activeTab === "predictors"
      ? "Predictors"
      : activeTab === "datasets"
      ? "Datasets"
      : "Folders";

  const itemCountLabel =
    activeTab === "folders"
      ? `${filteredFolders.length} public folders`
      : `${filtered.length} public ${activeTab}`;

  return (
    <DragDropProvider>
      {/* Sticky sub-header under global nav (leave this exactly as-is) */}
      <div className="sticky top-[var(--app-nav-h,3.5rem)] z-30 w-full border-b bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-3 py-2.5">
          <div className="text-sm font-semibold tracking-wide">
            Browse {tabLabel}
          </div>
        </div>
        <div className="h-1 w-full bg-neutral-600" />
      </div>

      {/* Controls bar (now sticky + translucent) */}
      <div className="sticky top-[calc(var(--app-nav-h,3rem)+3rem)] z-20 w-full border-b bg-neutral-100/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-100/75">
        <div className="mx-auto max-w-6xl px-3 py-2">
          <div className="flex items-center justify-between text-[12px] text-neutral-500 mb-1">
            <span className="hidden sm:inline">{itemCountLabel}</span>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {/* Left cluster: tab switch + search */}
            <div className="flex w-full items-center gap-2">
              <div className="inline-flex h-9 overflow-hidden rounded-md border bg-white shadow-sm">
                <button
                  className={`px-3 text-xs font-medium ${
                    activeTab === "predictors"
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                  onClick={() => selectTab("predictors")}
                >
                  Predictors
                </button>
                <button
                  className={`px-3 text-xs font-medium ${
                    activeTab === "datasets"
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                  onClick={() => selectTab("datasets")}
                >
                  Datasets
                </button>
                <button
                  className={`px-3 text-xs font-medium ${
                    activeTab === "folders"
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                  onClick={() => selectTab("folders")}
                >
                  Folders
                </button>
              </div>

              <div className="flex-1 md:max-w-md">
                <SearchBar
                  value={
                    activeTab === "predictors"
                      ? predictorQuery
                      : activeTab === "datasets"
                      ? datasetQuery
                      : folderQuery
                  }
                  onChange={
                    activeTab === "predictors"
                      ? setPredictorQuery
                      : activeTab === "datasets"
                      ? setDatasetQuery
                      : setFolderQuery
                  }
                  placeholder={
                    activeTab === "folders"
                      ? "Search folders…"
                      : activeTab === "predictors"
                      ? "Search predictors…"
                      : "Search datasets…"
                  }
                  onClear={() => {
                    if (activeTab === "predictors") setPredictorQuery("");
                    else if (activeTab === "datasets") setDatasetQuery("");
                    else setFolderQuery("");
                  }}
                />
              </div>
            </div>

            {/* Right cluster: filters (single unified menu per tab) */}
            <div className="flex items-center gap-2 shrink-0">
              {activeTab === "folders" ? (
                <FolderAdvancedFilterMenu
                  visibility={folderVisibility}
                  onVisibilityChange={setFolderVisibility}
                  folderType={folderTypeFilter}
                  onFolderTypeChange={setFolderTypeFilter}
                  sortOption={folderSortOption}
                  onSortOptionChange={setFolderSortOption}
                />
              ) : (
                <AdvancedFilterMenu
                  visibility={
                    activeTab === "predictors"
                      ? predictorVisibility
                      : datasetVisibility
                  }
                  onVisibilityChange={
                    activeTab === "predictors"
                      ? setPredictorVisibility
                      : setDatasetVisibility
                  }
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
                  ownerNameQuery={ownerNameQuery}
                  onOwnerNameQueryChange={setOwnerNameQuery}
                  hasFileOnly={
                    activeTab === "datasets" ? datasetHasFileOnly : undefined
                  }
                  onHasFileOnlyChange={
                    activeTab === "datasets"
                      ? setDatasetHasFileOnly
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content row: pinned left, grid right */}
      <section className="mx-auto flex max-w-6xl gap-4 px-3 py-4 bg-neutral-50">
        {/* Left: Pinned panel */}
        <aside className="w-64 shrink-0">
          <div className="rounded-md border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b bg-neutral-50 px-3 py-2">
              <div className="text-xs font-semibold text-neutral-800">
                Pinned {tabLabel}
              </div>
              <button
                onClick={() => setPinnedOpen((v) => !v)}
                className="rounded-md border px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                aria-expanded={pinnedOpen}
              >
                {pinnedOpen ? "▾" : "▸"}
              </button>
            </div>
            {pinnedOpen && (
              <div className="space-y-2 p-2">
                {pinned.length === 0 ? (
                  <div className="rounded-md bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-600">
                    Nothing pinned yet
                  </div>
                ) : (
                  pinned.map((p) => {
                    const isPinned =
                      (activeTab === "predictors" &&
                        pinnedPredictorIds.has(p.id)) ||
                      (activeTab === "datasets" &&
                        pinnedDatasetIds.has(p.id)) ||
                      (activeTab === "folders" &&
                        pinnedFolderIds.has(p.id));
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-xs"
                      >
                        <span className="truncate text-neutral-800">
                          {p.title}
                        </span>
                        <button
                          className={`ml-2 rounded-md border px-2 py-0.5 text-xs ${
                            isPinned
                              ? "bg-amber-50 border-amber-300 text-amber-800"
                              : "hover:bg-neutral-50"
                          }`}
                          title={isPinned ? "Unpin" : "Pin"}
                          onClick={() =>
                            activeTab === "folders"
                              ? toggleFolderPin(p.id)
                              : togglePin(p.id)
                          }
                        >
                          {isPinned ? "★" : "☆"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Right: content */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Loading indicator */}
          {isLoading ? (
            <div className="py-6">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-neutral-700" />
                <div className="text-sm text-neutral-700">
                  Loading {tabLabel}…
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-md border bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3 h-5 w-3/4 animate-pulse rounded bg-neutral-100" />
                    <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
                    <div className="h-20 animate-pulse rounded bg-neutral-100" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Error display */}
          {error && !isLoading ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {/* Main Content Area */}
          {!isLoading && (
            <>
              {activeTab === "folders" ? (
                /* Folders Tab Content */
                <div className="space-y-6 -mt-2">
                  {/* Recent Folders Quick Access */}
                  <div className="mt-0">
                    <RecentFolders
                      onFolderSelect={handleRecentFolderSelect}
                    />
                  </div>

                  {/* Folders Content */}
                  {filteredFolders.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="text-lg text-neutral-500">
                        No public folders available
                      </div>
                      <div className="mt-2 text-sm text-neutral-400">
                        Public folders will appear here when available
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                      {filteredFolders.map((folder) => {
                        const isPinned = pinnedFolderIds.has(
                          folder.folder_id
                        );
                        return (
                          <div
                            key={folder.folder_id}
                            id={`browse-folder-${folder.folder_id}`}
                            className="relative"
                          >
                            <FolderCard
                              folder={folder}
                              expanded={expandedFolders.has(
                                folder.folder_id
                              )}
                              onToggleExpand={handleToggleFolderExpand}
                              onItemView={handleItemView}
                              canEdit={false}
                            />
                            {/* Pin button overlay */}
                            <button
                              className={`absolute right-2 top-2 rounded-md border px-2 py-1 text-xs shadow-sm ${
                                isPinned
                                  ? "bg-neutral-100"
                                  : "bg-white hover:bg-neutral-50"
                              }`}
                              title={isPinned ? "Unpin" : "Pin"}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderPin(folder.folder_id);
                              }}
                            >
                              {isPinned ? "★" : "☆"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Predictors and Datasets Tab Content */
                <>
                  {filtered.length === 0 && !error ? (
                    <div className="py-12 text-center">
                      <div className="text-lg text-neutral-500">
                        No public {activeTab} available
                      </div>
                      <div className="mt-2 text-sm text-neutral-400">
                        Public {activeTab} will appear here when available
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filtered.map((it) => {
                        const isPinned = pinnedSet.has(it.id);
                        const asDataset = it as BrowseDataset;
                        const visibilityLabel = it.isPublic
                          ? "Public"
                          : "Private";
                        return (
                          <CardShell
                            key={it.id}
                            actionVisibility="selected"
                            selected={
                              activeTab === "predictors"
                                ? selectedPredictorId === it.id
                                : selectedDatasetId === it.id
                            }
                            onSelect={() => toggleSelect(it.id)}
                            title={
                              <div className="space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="truncate text-sm font-semibold text-neutral-900">
                                    {it.title}
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-md border px-2 py-[2px] text-[10px] font-medium ${
                                      it.isPublic
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-neutral-200 bg-neutral-50 text-neutral-700"
                                    }`}
                                  >
                                    {visibilityLabel}
                                  </span>
                                </div>
                                <div className="text-[11px] text-neutral-500">
                                  <UsernameTag
                                    name={it.ownerName || "Owner"}
                                  />
                                </div>
                              </div>
                            }
                            description={
                              <p className="mt-1 text-xs text-neutral-600 line-clamp-2">
                                {it.notes || "No description provided."}
                              </p>
                            }
                            footerLeft={
                              <span className="text-[11px] text-neutral-500">
                                {it.updatedAt}
                              </span>
                            }
                            footerRight={
                              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                                {activeTab === "datasets" &&
                                  asDataset.hasFile &&
                                  asDataset.originalFilename && (
                                    <span
                                      className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-[1px]"
                                      title={`File: ${asDataset.originalFilename}`}
                                    >
                                      ▦{" "}
                                      <span className="ml-1 truncate max-w-[6rem]">
                                        {asDataset.originalFilename}
                                      </span>
                                    </span>
                                  )}
                              </div>
                            }
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                className="rounded-md border px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeTab === "datasets") {
                                    navigate(`/datasets/${it.id}/view`);
                                  } else {
                                    navigate(`/predictors/${it.id}`, {
                                      state: { from: "browse" },
                                    });
                                  }
                                }}
                              >
                                View
                              </button>
                              {activeTab === "datasets" &&
                                asDataset.hasFile && (
                                  <button
                                    className="rounded-md border px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                                    title="Download file"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadDataset(it.id);
                                    }}
                                  >
                                    ⇩ Download
                                  </button>
                                )}
                              <button
                                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                                  isPinned
                                    ? "border-amber-300 bg-amber-50 text-amber-800"
                                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                                }`}
                                title={isPinned ? "Unpin" : "Pin"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePin(it.id);
                                }}
                              >
                                {isPinned ? "★ Pinned" : "☆ Pin"}
                              </button>
                            </div>
                          </CardShell>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </DragDropProvider>
  );
}

/**
 * Advanced filter menu for predictors/datasets.
 * Consolidates:
 * - Visibility (public/private/all)
 * - Search in (title/notes/both)
 * - Updated within (time window)
 * - Owner username
 * - Has file (datasets only)
 */
type AdvancedFilterMenuProps = {
  visibility: Visibility;
  onVisibilityChange: (value: Visibility) => void;

  keywordTarget: KeywordTarget;
  onKeywordTargetChange: (value: KeywordTarget) => void;

  updatedWithin: TimeWindow;
  onUpdatedWithinChange: (value: TimeWindow) => void;

  ownerNameQuery: string;
  onOwnerNameQueryChange: (value: string) => void;

  hasFileOnly?: boolean;
  onHasFileOnlyChange?: (value: boolean) => void;
};

function AdvancedFilterMenu({
  visibility,
  onVisibilityChange,
  keywordTarget,
  onKeywordTargetChange,
  updatedWithin,
  onUpdatedWithinChange,
  ownerNameQuery,
  onOwnerNameQueryChange,
  hasFileOnly,
  onHasFileOnlyChange,
}: AdvancedFilterMenuProps) {
  return (
    <details className="group relative">
      <summary className="inline-flex h-8 cursor-pointer select-none items-center gap-1 rounded-md border bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
        Filters
        <span className="text-[10px] text-neutral-500 group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 mt-1 w-72 rounded-md border bg-white p-3 text-xs shadow-lg z-20">
        {/* Visibility */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">
            Visibility
          </div>
          <PublicFilter value={visibility} onChange={onVisibilityChange} />
        </div>

        {/* Search in */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">
            Search in
          </div>
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

        {/* Owner username */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">
            Owner username
          </div>
          <input
            type="text"
            value={ownerNameQuery}
            onChange={(e) => onOwnerNameQueryChange(e.target.value)}
            placeholder="survival_predictor100"
            className="w-full rounded-md border px-2 py-1 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        {/* Has file (datasets only) */}
        {typeof hasFileOnly === "boolean" && onHasFileOnlyChange && (
          <label className="flex items-center gap-2 text-xs text-neutral-700">
            <input
              type="checkbox"
              checked={hasFileOnly}
              onChange={(e) => onHasFileOnlyChange(e.target.checked)}
              className="h-3 w-3 rounded border-neutral-400 text-neutral-900"
            />
            <span>Downloadable dataset</span>
          </label>
        )}
      </div>
    </details>
  );
}

/**
 * Folder-specific filter menu.
 * Consolidates:
 * - Visibility (public/private/all)
 * - Folder type
 * - Sort option
 */
type FolderAdvancedFilterMenuProps = {
  visibility: Visibility;
  onVisibilityChange: (value: Visibility) => void;

  folderType: FolderType;
  onFolderTypeChange: (value: FolderType) => void;

  sortOption: FolderSortOption;
  onSortOptionChange: (value: FolderSortOption) => void;
};

function FolderAdvancedFilterMenu({
  visibility,
  onVisibilityChange,
  folderType,
  onFolderTypeChange,
  sortOption,
  onSortOptionChange,
}: FolderAdvancedFilterMenuProps) {
  return (
    <details className="group relative">
      <summary className="inline-flex h-8 cursor-pointer select-none items-center gap-1 rounded-md border bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
        Filters
        <span className="text-[10px] text-neutral-500 group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 mt-1 w-72 rounded-md border bg-white p-3 text-xs shadow-lg z-20">
        {/* Visibility */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">
            Visibility
          </div>
          <PublicFilter value={visibility} onChange={onVisibilityChange} />
        </div>

        {/* Folder type */}
        <div className="mb-3">
          <div className="mb-1 font-semibold text-neutral-700">
            Folder type
          </div>
          <FolderTypeFilter value={folderType} onChange={onFolderTypeChange} />
        </div>

        {/* Sort */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-neutral-700">Sort by</span>
          </div>
          <FolderSortMenu value={sortOption} onChange={onSortOptionChange} />
        </div>
      </div>
    </details>
  );
}
