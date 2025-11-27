import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

// --- CONTENT COMPONENT (Logic & Hooks) ---
function BrowseContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentUserId = (user as any)?.id ?? (user as any)?.pk ?? undefined;
  const navigate = useNavigate();

  // tab navigation handling
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: Tab = (() => {
    const q = searchParams.get("tab");
    return q === "datasets" || q === "folders" ? (q as Tab) : "predictors";
  })();

  const selectTab = useCallback((t: Tab) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      sp.set("tab", t);
      return sp;
    }, { replace: true });
    setSelectedPredictorId(null);
    setSelectedDatasetId(null);
  }, [setSearchParams]);

  // Separate search states for each tab
  const [predictorQuery, setPredictorQuery] = useState("");
  const [datasetQuery, setDatasetQuery] = useState("");
  const [folderQuery, setFolderQuery] = useState("");

  // Separate visibility filters for each tab
  const [predictorVisibility, setPredictorVisibility] = useState<Visibility>("all");
  const [datasetVisibility, setDatasetVisibility] = useState<Visibility>("all");
  const [folderVisibility, setFolderVisibility] = useState<Visibility>("all");
  const [pinnedOpen, setPinnedOpen] = useState(true);

  // Folder expansion state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Folder-specific filters
  const [folderSortOption, setFolderSortOption] = useState<FolderSortOption>(DEFAULT_FOLDER_SORT);
  const [folderTypeFilter, setFolderTypeFilter] = useState<FolderType>("all");

  const [selectedPredictorId, setSelectedPredictorId] = useState<string | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

  // Local state for folder pins (feature not fully on backend yet?)
  const [pinnedFolderIds, setPinnedFolderIds] = useState<Set<string>>(new Set());

  // --- TANSTACK QUERY: FETCH MAIN LISTS ---

  // Fetch Public Predictors
  const { 
    data: predictors = [], 
    isLoading: isPredictorsLoading,
    error: predictorsError
  } = useQuery({
    queryKey: ['public-predictors'],
    queryFn: () => listPublicPredictors(),
    select: (data) => data.map((p: any) => {
      const ui = toPredictorItem(p);
      const rawDate = p.updated_at
      const item: Item = {
        id: ui.id,
        title: ui.title,
        updatedAt: rawDate ? new Date(rawDate).toLocaleDateString("en-US", {
          month: 'short',
          day: 'numeric',
          year: 'numeric'   
        }) : "No date",
        isPublic: !!ui.isPublic,
        ownerName: p.owner?.username || "Unknown Owner",
        notes: ui.notes,
      };
      return item;
    }),
    enabled: activeTab === 'predictors',
    staleTime: 1000 * 60 * 5,
  });

  // Fetch Public Datasets
  const { 
    data: datasets = [], 
    isLoading: isDatasetsLoading,
    error: datasetsError
  } = useQuery({
    queryKey: ['public-datasets'],
    queryFn: () => listPublicDatasets(),
    select: (data) => data.map((d) => {
      const ui = toDatasetItem(d, currentUserId);
      const rawDate = d.uploaded_at;
      const item: Item = {
        id: ui.id,
        title: ui.title,
        updatedAt: rawDate ? new Date(rawDate).toLocaleDateString("en-US", {
          month: 'short',
          day: 'numeric',
          year: 'numeric'   
        }) : "No date",
        isPublic: !!(d as any).is_public,
        ownerName: ui.ownerName || (d as any).owner_name || "Owner",
        notes: ui.notes,
        hasFile: ui.hasFile,
        originalFilename: ui.originalFilename,
      };
      return item;
    }),
    enabled: activeTab === 'datasets',
    staleTime: 1000 * 60 * 5,
  });

  // Fetch Public Folders
  const { 
    data: folders = [], 
    isLoading: isFoldersLoading,
    error: foldersError
  } = useQuery({
    queryKey: ['public-folders'],
    queryFn: async () => {
       const apiFolders = await listPublicFolders();
       return apiFolders
         .map(mapApiFolderToUi)
         .filter(folder => !folder.is_private && folder.public_item_count > 0);
    },
    enabled: activeTab === 'folders',
    staleTime: 1000 * 60 * 5,
  });

  // --- TANSTACK QUERY: FETCH PINNED ITEMS ---

  // Fetch Pinned Predictor IDs
  const { data: pinnedPredictorIds = new Set<string>() } = useQuery({
    queryKey: ['pinned-predictors'],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const pinned = await listPinnedPredictors();
      return new Set(pinned.map((p) => String(p.predictor.predictor_id)));
    },
    enabled: !!user && activeTab === 'predictors',
  });

  // Fetch Pinned Dataset IDs
  const { data: pinnedDatasetIds = new Set<string>() } = useQuery({
    queryKey: ['pinned-datasets'],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const pinned = await listPinnedDatasets();
      return new Set(pinned.map((d) => String(d.dataset_id)));
    },
    enabled: !!user && activeTab === 'datasets',
  });

  // --- MUTATIONS FOR PINNING ---

  const pinPredictorMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string, isPinned: boolean }) => {
      return isPinned ? unpinPredictor(id) : pinPredictor(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-predictors'] });
    },
    onError: (err) => console.error("Failed to toggle pin", err)
  });

  const pinDatasetMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string, isPinned: boolean }) => {
      return isPinned ? unpinDataset(id) : pinDataset(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-datasets'] });
    },
    onError: (err) => console.error("Failed to toggle pin", err)
  });

  // --- FILTERING ---

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

  // Global loading/error
  const isLoading = 
    (activeTab === 'predictors' && isPredictorsLoading) ||
    (activeTab === 'datasets' && isDatasetsLoading) ||
    (activeTab === 'folders' && isFoldersLoading);
    
  const errorObj = 
    (activeTab === 'predictors' ? predictorsError : null) || 
    (activeTab === 'datasets' ? datasetsError : null) || 
    (activeTab === 'folders' ? foldersError : null);
    
  const errorMessage = errorObj ? (errorObj as any).message || "Failed to load data" : null;

  // --- ACTIONS ---

  const toggleSelect = useCallback((id: string) => {
    if (activeTab === "predictors") {
      setSelectedPredictorId((curr) => (curr === id ? null : id));
      setSelectedDatasetId(null);
    } else {
      setSelectedDatasetId((curr) => (curr === id ? null : id));
      setSelectedPredictorId(null);
    }
  }, [activeTab]);

  const togglePin = useCallback((id: string) => {
    if (!user) return;
    if (activeTab === "predictors") {
      pinPredictorMutation.mutate({ id, isPinned: pinnedPredictorIds.has(id) });
    } else if (activeTab === "datasets") {
      pinDatasetMutation.mutate({ id, isPinned: pinnedDatasetIds.has(id) });
    }
  }, [user, activeTab, pinnedPredictorIds, pinnedDatasetIds, pinPredictorMutation, pinDatasetMutation]);

  // Local state pin for folders
  const toggleFolderPin = useCallback((folderId: string) => {
    setPinnedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const downloadDataset = useCallback(async (id: string) => {
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
  }, []);

  // Folder expansion - updates Query Cache manually for efficiency
  const handleToggleFolderExpand = useCallback(async (folderId: string) => {
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
          // Manually update the query cache so the UI reflects the loaded items
          queryClient.setQueryData(['public-folders'], (old: Folder[] | undefined) => {
            if (!old) return old;
            return old.map(f => f.folder_id === folderId ? { ...f, items: contents } : f);
          });
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
  }, [expandedFolders, folders, queryClient]);

  const handleRecentFolderSelect = useCallback((folderId: string) => {
    setExpandedFolders(prev => new Set(prev).add(folderId));
    setTimeout(() => {
      const element = document.getElementById(`browse-folder-${folderId}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const handleItemView = useCallback((itemId: string, itemType: 'predictor' | 'dataset') => {
    if (itemType === 'predictor') {
      window.open(`/predictors/${itemId}/view`, '_blank');
    } else {
      window.open(`/datasets/${itemId}/view`, '_blank');
    }
  }, []);

  const tabLabel = activeTab === "predictors" ? "Predictors" : activeTab === "datasets" ? "Datasets" : "Folders";

  // Determine pinned items list for Sidebar
  const pinnedSet =
    activeTab === "predictors" ? pinnedPredictorIds :
    activeTab === "datasets" ? pinnedDatasetIds : pinnedFolderIds;
  const pinned = activeTab === "folders" ? [] : list.filter((it) => pinnedSet.has(it.id));

  return (
    <>
      {/* Sticky sub-header under global nav */}
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
                    const isPinned = pinnedSet.has(p.id);
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
          {errorMessage && !isLoading ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
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
                  {filtered.length === 0 && !errorMessage ? (
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
                            footerLeft={<span className="text-neutral-500">Updated {it.updatedAt}</span>}
                            footerRight={
                              <div className="flex items-center gap-2">
                                {activeTab === "datasets" && it.hasFile && it.originalFilename && (
                                  <span className="text-[11px] text-neutral-600" title={`File: ${it.originalFilename}`}>▦</span>
                                )}
                                {it.isPublic ? (
                                  <span className="rounded bg-green-500/35 px-2 py-0.5 text-[11px] text-neutral-800">Public</span>
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
    </>
  );
}

// --- Main Wrapper (Context Provider) ---
export default function Browse() {
  return (
    <DragDropProvider>
      <BrowseContent />
    </DragDropProvider>
  );
}