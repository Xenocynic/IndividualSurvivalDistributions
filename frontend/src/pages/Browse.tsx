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
  type FolderType
} from "../components/folder";
import { addFolderToRecent } from "../components/folder/navigation/RecentFolders";
import { listPublicPredictors, listPinnedPredictors, pinPredictor, unpinPredictor } from "../lib/predictors";
import { listPublicFolders, getPublicFolderContents, mapApiFolderToUi, type Folder } from "../lib/folders";
import { listPublicDatasets, listPinnedDatasets, pinDataset, unpinDataset, downloadDatasetFile } from "../lib/datasets";
import { toPredictorItem, toDatasetItem } from "../lib/mappers";
import { useAuth } from "../auth/AuthContext";
import {
  sortFolders,
  filterFoldersByType,
  DEFAULT_FOLDER_SORT,
} from "../lib/folderUtils";
import { useNavigate, useSearchParams } from "react-router-dom";

type Tab = "predictors" | "datasets" | "folders";

/**
 * Item is the local UI shape used by Browse cards.
 * We derive it from API objects via the mapper layer, then normalize
 * here into the fields Browse needs (title / owner / visibility / notes/etc.).
 */
type Item = {
  id: string;
  title: string;
  updatedAt: string;
  isPublic: boolean;
  ownerName: string;
  notes?: string;
  hasFile?: boolean;
  originalFilename?: string;
};

export default function Browse() {
  const { user } = useAuth();

  // tab navigation ahndling (same thing as Dashboard mostly)
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: Tab = (() => {
    const q = searchParams.get("tab");
    return q === "datasets" || q === "folders" ? (q as Tab) : "predictors";
  })();

  const selectTab = (t: Tab) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      sp.set("tab", t);
      return sp;
    }, { replace: true });
    setSelectedPredictorId(null);
    setSelectedDatasetId(null);
  };

  // Track loaded tabs to prevent re-fetching
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());

  // Separate search states for each tab
  const [predictorQuery, setPredictorQuery] = useState("");
  const [datasetQuery, setDatasetQuery] = useState("");
  const [folderQuery, setFolderQuery] = useState("");

  // Separate visibility filters for each tab
  const [predictorVisibility, setPredictorVisibility] = useState<Visibility>("all");
  const [datasetVisibility, setDatasetVisibility] = useState<Visibility>("all");
  const [folderVisibility, setFolderVisibility] = useState<Visibility>("all");
  const [pinnedOpen, setPinnedOpen] = useState(true);

  // API-loaded data (mapped through the mappers)
  const [predictors, setPredictors] = useState<Item[]>([]);
  const [datasets, setDatasets] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pinned IDs separated per tab (pinning is ONLY on Browse)
  const [pinnedPredictorIds, setPinnedPredictorIds] = useState<Set<string>>(new Set());
  const [pinnedDatasetIds, setPinnedDatasetIds] = useState<Set<string>>(new Set());
  const [pinnedFolderIds, setPinnedFolderIds] = useState<Set<string>>(new Set());

  // Folder expansion state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Folder-specific filters (search uses main query state)
  const [folderSortOption, setFolderSortOption] = useState<FolderSortOption>(DEFAULT_FOLDER_SORT);
  const [folderTypeFilter, setFolderTypeFilter] = useState<FolderType>("all");

  const navigate = useNavigate();

  const [selectedPredictorId, setSelectedPredictorId] = useState<string | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
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
    if (!user) {
      return;
    }
    try {
      const pinned = await listPinnedPredictors(); // call your API
      const pinnedSet = new Set(pinned.map((p) => String(p.predictor.predictor_id)));
      setPinnedPredictorIds(pinnedSet);
    } catch (err) {
      console.error("Failed to fetch pinned predictors:", err);
    }
  }

  // ----------------------------
  // Fetch pinned datasets
  // ----------------------------
  async function fetchPinnedDatasets() {
    if (!user) {
      return;
    }
    try {
      const pinned = await listPinnedDatasets();
      const pinnedSet = new Set(pinned.map((d) => String(d.dataset_id)));
      setPinnedDatasetIds(pinnedSet);
    } catch (err) {
      console.error("Failed to fetch pinned datasets:", err);
    }
  }

  // Load pinned predictors from backend on mount
  // Call on mount or whenever the active tab is "predictors"
  useEffect(() => {
    if (activeTab === "predictors") fetchPinnedPredictors();
    else if (activeTab === "datasets") fetchPinnedDatasets();
  }, [user, activeTab]);

  // ----------------------------
  // Fetch data for active tab
  // ----------------------------

  // Fetch & map once on mount or when tab changes
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    let didFinish = false;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;

    // Check if already loaded to avoid repeated fetching
    // Skip if activeTab is "folders" as that is handled by a separate effect
    if (loadedTabs.has(activeTab) || activeTab === "folders") {
        setIsLoading(false);
        return;
    }

    const SHOW_LOADING_DELAY = 300;

    // Track whether we've already fetched data for this tab
    const isInitialPredictorFetch = predictors.length === 0 && activeTab === "predictors";
    const isInitialDatasetFetch = datasets.length === 0 && activeTab === "datasets";
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
          const uiPreds = apiPreds.map((p: any) => {
            const ui = toPredictorItem(p);
            const item: Item = {
              id: ui.id,
              title: ui.title,
              updatedAt: ui.updatedAt ?? "",
              isPublic: !!ui.isPublic,
              ownerName: p.owner?.username || "Unknown Owner",
              notes: ui.notes,
            };
            return item;
          });
          setPredictors(uiPreds);
          // Mark as loaded
          setLoadedTabs(prev => new Set(prev).add("predictors"));
        } else if (activeTab === "datasets") {
          const apiDsets = await listPublicDatasets();
          if (!mounted) return;
          const currentUserId = (user as any)?.id ?? (user as any)?.pk ?? undefined;
          const uiDsets = apiDsets.map((d) => {
            const ui = toDatasetItem(d, currentUserId);
            const item: Item = {
              id: ui.id,
              title: ui.title,
              updatedAt: ui.updatedAt ?? "",
              isPublic: !!(d as any).is_public,
              ownerName: ui.ownerName || (d as any).owner_name || "Owner",
              notes: ui.notes,
              hasFile: ui.hasFile,
              originalFilename: ui.originalFilename,
            };
            return item;
          });
          setDatasets(uiDsets);
          // Mark as loaded
          setLoadedTabs(prev => new Set(prev).add("datasets"));
        }
      } catch (err: any) {
        if (err?.status === 0) setError("Network error");
        else setError(err?.details?.message ?? err?.statusText ?? "Failed to load");
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
  }, [user, activeTab, loadedTabs]); // Added loadedTabs dependency

  // Separate effect to fetch folders (always loaded)
  useEffect(() => {
    let mounted = true;

    async function fetchFolders() {
      // if folders are already loaded, skip
      if (folders.length > 0) return;

      try {
        const apiFolders = await listPublicFolders();
        if (!mounted) return;
        const uiFolders = apiFolders
          .map(mapApiFolderToUi)
          .filter(folder => !folder.is_private && folder.public_item_count > 0);
        setFolders(uiFolders);
      } catch (err) {
        console.error('Failed to fetch folders:', err);
      }
    }

    fetchFolders();

    return () => {
      mounted = false;
    };
  }, [user]);

  const list = activeTab === "predictors" ? predictors : activeTab === "datasets" ? datasets : [];

  const filtered = useMemo(() => {
    if (activeTab === "folders") return [];

    const currentQuery = activeTab === "predictors" ? predictorQuery : datasetQuery;
    const currentVisibility = activeTab === "predictors" ? predictorVisibility : datasetVisibility;

    const q = currentQuery.trim().toLowerCase();
    let arr = list.filter((it) => (q ? it.title.toLowerCase().includes(q) : true));
    if (currentVisibility === "public") arr = arr.filter((it) => it.isPublic);
    if (currentVisibility === "private") arr = arr.filter((it) => !it.isPublic);
    return arr;
  }, [list, predictorQuery, datasetQuery, predictorVisibility, datasetVisibility, activeTab]);

  // Filter folders based on search, visibility, type, and sorting
  const filteredFolders = useMemo(() => {
    let folderArr = folders;

    // Apply search query
    if (folderQuery.trim()) {
      const q = folderQuery.trim().toLowerCase();
      folderArr = folderArr.filter((folder) => {
        const folderMatch = folder.name.toLowerCase().includes(q) ||
          (folder.description && folder.description.toLowerCase().includes(q));
        const contentMatch = folder.items?.some(item =>
          item.title.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q))
        );
        return folderMatch || contentMatch;
      });
    }

    // Apply visibility filter
    if (folderVisibility === "public") folderArr = folderArr.filter((folder) => !folder.is_private);
    if (folderVisibility === "private") folderArr = folderArr.filter((folder) => folder.is_private);

    // Apply type filter
    folderArr = filterFoldersByType(folderArr, folderTypeFilter);

    // Apply sorting
    folderArr = sortFolders(folderArr, folderSortOption);

    return folderArr;
  }, [folders, folderQuery, folderVisibility, folderTypeFilter, folderSortOption]);

  const pinnedSet =
    activeTab === "predictors" ? pinnedPredictorIds :
    activeTab === "datasets" ? pinnedDatasetIds : pinnedFolderIds;
  const pinned = activeTab === "folders" ? [] : list.filter((it) => pinnedSet.has(it.id));

  // ----------------------------
  // Toggle pin (predictors & datasets)
  // ----------------------------

  async function togglePin(id: string) {
    if (!user) return;

    if (activeTab === "predictors") {
      const isPinned = pinnedPredictorIds.has(id);
      setPinnedPredictorIds((prev) => {
        const next = new Set(prev);
        if (isPinned) next.delete(id); else next.add(id);
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
          if (isPinned) next.add(id); else next.delete(id);
          return next;
        });
      }
    } else if (activeTab === "datasets") {
      const isPinned = pinnedDatasetIds.has(id);
      setPinnedDatasetIds((prev) => {
        const next = new Set(prev);
        if (isPinned) next.delete(id); else next.add(id);
        return next;
      });
      try {
        if (isPinned) await unpinDataset(id);
        else await pinDataset(id);
      } catch (err) {
        console.error("Failed to toggle dataset pin:", err);
        setPinnedDatasetIds((prev) => {
          const next = new Set(prev);
          if (isPinned) next.add(id); else next.delete(id);
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
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Download failed: ${error.message || 'Unknown error'}`);
    }
  }

  // Folder expansion handlers
  async function handleToggleFolderExpand(folderId: string) {
    const isExpanded = expandedFolders.has(folderId);

    if (isExpanded) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    } else {
      const folder = folders.find(f => f.folder_id === folderId);
      if (folder && (!folder.items || folder.items.length === 0)) {
        try {
          const contents = await getPublicFolderContents(folderId);
          setFolders(prev => prev.map(f =>
            f.folder_id === folderId
              ? { ...f, items: contents }
              : f
          ));
        } catch (error) {
          console.error('Failed to load folder contents:', error);
        }
      }

      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(folderId);
        return next;
      });

      if (folder) addFolderToRecent(folder);
    }
  }

  // Recent folder selection handler
  function handleRecentFolderSelect(folderId: string) {
    setExpandedFolders(prev => new Set(prev).add(folderId));
    setTimeout(() => {
      const element = document.getElementById(`browse-folder-${folderId}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function handleItemView(itemId: string, itemType: 'predictor' | 'dataset') {
    if (itemType === 'predictor') {
      window.open(`/predictors/${itemId}/view`, '_blank');
    } else {
      window.open(`/datasets/${itemId}/view`, '_blank');
    }
  }

  const tabLabel = activeTab === "predictors" ? "Predictors" : activeTab === "datasets" ? "Datasets" : "Folders";

  return (
    <DragDropProvider>
      {/* Sticky sub-header under global nav (unified with create/upload pages) */}
      <div className="sticky top-[var(--app-nav-h,3.5rem)] z-30 w-full border-b bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-3 py-2.5">
          <div className="text-sm font-semibold tracking-wide">Browse {tabLabel}</div>
        </div>
        <div className="h-1 w-full bg-neutral-600" />
      </div>

      {/* Controls bar */}
      <div className="w-full border-b bg-neutral-100">
        <div className="mx-auto max-w-6xl px-3 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {/* Left cluster: tab switch + search */}
            <div className="flex w-full items-center gap-2">
              <div className="inline-flex h-9 overflow-hidden rounded-md border bg-white">
                <button
                  className={`px-3 text-sm ${activeTab === "predictors" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
                  onClick={() => selectTab("predictors")}
                >
                  Predictors
                </button>
                <button
                  className={`px-3 text-sm ${activeTab === "datasets" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
                  onClick={() => selectTab("datasets")}
                >
                  Datasets
                </button>
                <button
                  className={`px-3 text-sm ${activeTab === "folders" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
                  onClick={() => selectTab("folders")}
                >
                  Folders
                </button>
              </div>

              <div className="flex-1 md:max-w-md">
                <SearchBar
                  value={activeTab === "predictors" ? predictorQuery : activeTab === "datasets" ? datasetQuery : folderQuery}
                  onChange={activeTab === "predictors" ? setPredictorQuery : activeTab === "datasets" ? setDatasetQuery : setFolderQuery}
                  placeholder={activeTab === "folders" ? "Search folders…" : activeTab === "predictors" ? "Search predictors…" : "Search datasets…"}
                  onClear={() => {
                    if (activeTab === "predictors") setPredictorQuery("");
                    else if (activeTab === "datasets") setDatasetQuery("");
                    else setFolderQuery("");
                  }}
                />
              </div>
            </div>

            {/* Right cluster: filters */}
            <div className="flex items-center gap-2 shrink-0">
              {activeTab === "folders" ? (
                <>
                  <PublicFilter value={folderVisibility} onChange={setFolderVisibility} />
                  <FolderTypeFilter value={folderTypeFilter} onChange={setFolderTypeFilter} />
                  <FolderSortMenu value={folderSortOption} onChange={setFolderSortOption} />
                </>
              ) : (
                <PublicFilter
                  value={activeTab === "predictors" ? predictorVisibility : datasetVisibility}
                  onChange={activeTab === "predictors" ? setPredictorVisibility : setDatasetVisibility}
                />
              )}
            </div>
          </div>
          {/* (Removed center title line; title is now in the sticky header) */}
        </div>
      </div>

      {/* Content row: pinned left, grid right */}
      <section className="mx-auto max-w-6xl px-3 py-4 flex gap-4">
        {/* Left: Pinned panel */}
        <aside className="w-64 shrink-0">
          <div className="rounded-md border bg-neutral-50">
            <div className="flex items-center justify-between border-b bg-neutral-100 px-3 py-2">
              <div className="text-xs font-semibold text-neutral-800">
                Pinned {tabLabel}
              </div>
              <button
                onClick={() => setPinnedOpen((v) => !v)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                aria-expanded={pinnedOpen}
              >
                {pinnedOpen ? "▾" : "▸"}
              </button>
            </div>
            {pinnedOpen && (
              <div className="space-y-2 p-2">
                {pinned.length === 0 ? (
                  <div className="rounded-md bg-neutral-100 px-3 py-2 text-left text-xs text-neutral-600">
                    Nothing pinned yet
                  </div>
                ) : (
                  pinned.map((p) => {
                    const isPinned =
                      (activeTab === "predictors" && pinnedPredictorIds.has(p.id)) ||
                      (activeTab === "datasets" && pinnedDatasetIds.has(p.id)) ||
                      (activeTab === "folders" && pinnedFolderIds.has(p.id));
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-xs"
                      >
                        <span className="truncate">{p.title}</span>
                        <button
                          className="ml-2 rounded-md px-2 py-0.5 text-xs hover:bg-neutral-50"
                          title={isPinned ? "Unpin" : "Pin"}
                          onClick={() => (activeTab === "folders" ? toggleFolderPin(p.id) : togglePin(p.id))}
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
                <div className="text-sm text-neutral-700">Loading {tabLabel}…</div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-md border p-4">
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
                    <RecentFolders onFolderSelect={handleRecentFolderSelect} />
                  </div>

                  {/* Folders Content */}
                  {filteredFolders.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="text-lg text-neutral-500">No public folders available</div>
                      <div className="mt-2 text-sm text-neutral-400">Public folders will appear here when available</div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                      {filteredFolders.map((folder) => {
                        const isPinned = pinnedFolderIds.has(folder.folder_id);
                        return (
                          <div key={folder.folder_id} id={`browse-folder-${folder.folder_id}`} className="relative">
                            <FolderCard
                              folder={folder}
                              expanded={expandedFolders.has(folder.folder_id)}
                              onToggleExpand={handleToggleFolderExpand}
                              onItemView={handleItemView}
                              canEdit={false}
                            />
                            {/* Pin button overlay */}
                            <button
                              className={`absolute right-2 top-2 rounded-md border px-2 py-1 text-xs ${
                                isPinned ? "bg-neutral-100" : "bg-white hover:bg-neutral-50"
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
                      <div className="text-lg text-neutral-500">No public {activeTab} available</div>
                      <div className="mt-2 text-sm text-neutral-400">Public {activeTab} will appear here when available</div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filtered.map((it) => {
                        const isPinned = pinnedSet.has(it.id);
                        return (
                          <CardShell
                            key={it.id}
                            actionVisibility="selected"
                            selected={activeTab === "predictors" ? selectedPredictorId === it.id : selectedDatasetId === it.id}
                            onSelect={() => toggleSelect(it.id)}
                            title={
                              <div>
                                <div className="-mb-1">
                                  <UsernameTag name={it.ownerName} />
                                </div>
                                <div className="mt-1 text-sm font-medium">{it.title}</div>
                              </div>
                            }
                            description={<span>{it.notes}</span>}
                            footerLeft={<span className="text-neutral-500">{it.updatedAt}</span>}
                            footerRight={
                              <div className="flex items-center gap-2">
                                {activeTab === "datasets" && it.hasFile && it.originalFilename && (
                                  <span className="text-[11px] text-neutral-600" title={`File: ${it.originalFilename}`}>▦</span>
                                )}
                                {it.isPublic ? (
                                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">Public</span>
                                ) : (
                                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">Private</span>
                                )}
                              </div>
                            }
                          >
                            {/* Hover actions (top-right) */}
                            <button
                              className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeTab === "datasets") {
                                  navigate(`/datasets/${it.id}/view`);
                                } else {
                                  navigate(`/predictors/${it.id}`, { state: { from: "browse" } });
                                }
                              }}
                            >
                              View
                            </button>
                            {activeTab === "datasets" && it.hasFile && (
                              <button
                                className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                                title="Download file"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadDataset(it.id);
                                }}
                              >
                                ⇩
                              </button>
                            )}
                            <button
                              className={`rounded-md border px-2 py-1 text-xs ${isPinned ? "bg-neutral-100" : "bg-white hover:bg-neutral-50"}`}
                              title={isPinned ? "Unpin" : "Pin"}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(it.id);
                              }}
                            >
                              {isPinned ? "★" : "☆"}
                            </button>
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