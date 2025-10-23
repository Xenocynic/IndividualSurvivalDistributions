import { act, useEffect, useMemo, useState } from "react";
import SearchBar from "../components/SearchBar";
import CardShell from "../components/CardShell";
import PublicFilter, { type Visibility } from "../components/PublicFilter";
import UsernameTag from "../components/UsernameTag";
import { listPublicPredictors, listPinnedPredictors, pinPredictor, unpinPredictor, } from "../lib/predictors";
import { listPublicDatasets } from "../lib/datasets";
import { toPredictorItem, toDatasetItem } from "../lib/mappers";
import { useAuth } from "../auth/AuthContext";
import { downloadDatasetFile } from "../lib/datasets";

type Tab = "predictors" | "datasets";

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
  const [activeTab, setActiveTab] = useState<Tab>("predictors");
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [pinnedOpen, setPinnedOpen] = useState(true);

  // API-loaded data (mapped through the mappers)
  const [predictors, setPredictors] = useState<Item[]>([]);
  const [datasets, setDatasets] = useState<Item[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pinned IDs separated per tab (pinning is ONLY on Browse)
  const [pinnedPredictorIds, setPinnedPredictorIds] = useState<Set<string>>(new Set());
  const [pinnedDatasetIds, setPinnedDatasetIds] = useState<Set<string>>(new Set());

  // Fetch pinned predictors from your backend API
  async function fetchPinnedPredictors() {
    if (!user) {
      console.log("No user yet; not fetching pins");
      return;
    }
    console.log("Fetching pinned predictors...");
    try {
      const pinned = await listPinnedPredictors(); // call your API
      console.log("Pinned response:", pinned);
      const pinnedSet = new Set(pinned.map((p) => String(p.predictor.predictor_id)));
      setPinnedPredictorIds(pinnedSet);
      console.log("Pinned predictor IDs set:", pinnedSet);
    } catch (err) {
      console.error("Failed to fetch pinned predictors:", err);
    }
  }

  // Load pinned predictors from backend on mount
  // Call on mount or whenever the active tab is "predictors"
  useEffect(() => {
    if (activeTab === "predictors") fetchPinnedPredictors();
  }, [user, activeTab]);

  // Fetch & map once on mount or when tab changes
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    let didFinish = false;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;

    const SHOW_LOADING_DELAY = 300;

    // Track whether we've already fetched data for this tab
    const isInitialPredictorFetch = predictors.length === 0 && activeTab === "predictors";
    const isInitialDatasetFetch = datasets.length === 0 && activeTab === "datasets";
    const isInitialFetch = isInitialPredictorFetch || isInitialDatasetFetch;

    setError(null);

    async function fetchData() {
      // Only trigger loader delay if it's the first fetch of the data
      if (isInitialFetch) {
        loadingTimer = setTimeout(() => {
          if (!didFinish && mounted) setIsLoading(true);
        }, SHOW_LOADING_DELAY);
      } else {
        // No loader when switching tabs or refetching
        setIsLoading(false);
      }

      try {
        if (activeTab === "predictors") {
          // Always use public endpoint on Browse page - only show public predictors
          const apiPreds = await listPublicPredictors();

          if (!mounted) return;

          // Map API → UI (predictors)
          const uiPreds = apiPreds.map((p) => {
            const ui = toPredictorItem(p);
            const item: Item = {
              id: ui.id,
              title: ui.title,
              updatedAt: ui.updatedAt ?? "",
              isPublic: !!ui.isPublic,
              ownerName: (p as any).owner_name || "Owner",
              notes: ui.notes,
            };
            return item;
          });

          setPredictors(uiPreds);

        } else {
          // Always use public endpoint on Browse page - only show public datasets
          const apiDsets = await listPublicDatasets();

          if (!mounted) return;

          // Map API → UI (datasets)
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
        }
      } catch (err: any) {
        if (err?.status === 0) {
          setError("Network error");
        } else {
          setError(err?.details?.message ?? err?.statusText ?? "Failed to load");
        }
        console.error("Fetch error", err);
      } finally {
        didFinish = true;
        if (loadingTimer) clearTimeout(loadingTimer);
        if (mounted) setIsLoading(false);
      }
    }

    // Debounce fetch start by 250 ms
    const t = window.setTimeout(() => fetchData(), 250);

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(t);
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [user, activeTab]);

  const list = activeTab === "predictors" ? predictors : datasets;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = list.filter((it) => (q ? it.title.toLowerCase().includes(q) : true));
    if (visibility === "public") arr = arr.filter((it) => it.isPublic);
    if (visibility === "private") arr = arr.filter((it) => !it.isPublic);
    return arr;
  }, [list, query, visibility, activeTab]);

  const pinnedSet = activeTab === "predictors" ? pinnedPredictorIds : pinnedDatasetIds;
  const pinned = list.filter((it) => pinnedSet.has(it.id));

  // Pin / unpin (Browse + supabase interaction)
  // Toggle pin
  async function togglePin(id: string) {
    if (!user) return;

    if (activeTab === "predictors") {
      const isPinned = pinnedPredictorIds.has(id);

      // Optimistic update
      setPinnedPredictorIds((prev) => {
        const next = new Set(prev);
        if (isPinned) next.delete(id);
        else next.add(id);
        return next;
      });

      try {
        if (isPinned) {
          await unpinPredictor(id);
        } else {
          await pinPredictor(id);
        }
      } catch (err) {
        console.error("Failed to toggle pin:", err);
        // Rollback
        setPinnedPredictorIds((prev) => {
          const next = new Set(prev);
          if (isPinned) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    } else if (activeTab === "datasets") {
      // Local pin/unpin for datasets
      setPinnedDatasetIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }


  // download dataset file
  async function downloadDataset(id: string) {
    try {
      const datasetId = parseInt(id);
      const { blob, filename } = await downloadDatasetFile(datasetId);

      // Create download link and trigger download
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

  return (
    <section className="flex gap-4">
      {/* Left: Pinned panel */}
      <aside className="w-64 shrink-0">
        <div className="rounded-md border border-black/10 bg-black">
          <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
            <div className="text-xs font-semibold text-white">
              Pinned {activeTab === "predictors" ? "Predictors" : "Datasets"}
            </div>
            <button
              onClick={() => setPinnedOpen((v) => !v)}
              className="rounded border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100"
              aria-expanded={pinnedOpen}
            >
              {pinnedOpen ? "▾" : "▸"}
            </button>
          </div>
          {pinnedOpen && (
            <div className="space-y-2 p-2">
              {pinned.length === 0 ? (
                <div className="rounded-md bg-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                  Nothing pinned yet
                </div>
              ) : (
                pinned.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-black/10 bg-gray-200 px-3 py-2 text-xs"
                  >
                    <span className="truncate">{p.title}</span>
                    <button
                      className="ml-2 rounded px-2 py-0.5 text-xs hover:bg-gray-300"
                      title="Unpin"
                      onClick={() => togglePin(p.id)}
                    >
                      📌
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Right: content */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Mini grey navbar */}
        <div className="rounded-md border border-black/10 bg-gray-400 px-3 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {/* Left cluster: tab switch + search */}
            <div className="flex w-full items-center gap-2">
              <div className="inline-flex h-9 overflow-hidden rounded-md border border-black/10 bg-white">
                <button
                  className={`px-3 text-sm ${activeTab === "predictors" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  onClick={() => setActiveTab("predictors")}
                >
                  Predictors
                </button>
                <button
                  className={`px-3 text-sm ${activeTab === "datasets" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  onClick={() => setActiveTab("datasets")}
                >
                  Datasets
                </button>
              </div>

              <div className="flex-1 md:max-w-md">
                <SearchBar value={query} onChange={setQuery} placeholder="Search" onClear={() => setQuery("")} />
              </div>
            </div>

            {/* Right cluster: filter */}
            <div className="shrink-0">
              <PublicFilter value={visibility} onChange={setVisibility} />
            </div>
          </div>

          {/* Center title line */}
          <div className="mt-2 text-center font-semibold">
            Browse {activeTab === "predictors" ? "Predictors" : "Datasets"}
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading ? (
          <div className="py-6">
            {/* Simple spinner + hint */}
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-700" />
              <div className="text-sm text-gray-700">Loading {activeTab}...</div>
            </div>

            {/* Optional skeleton grid — placeholders matching your card layout */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-20 bg-gray-200 rounded" />
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

        {/* Grid of cards */}
        {!isLoading && (
          <>
            {filtered.length === 0 && !error ? (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">
                  No public {activeTab} available
                </div>
                <div className="text-gray-400 text-sm mt-2">
                  Public {activeTab} will appear here when available
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((it) => {
                  const isPinned = pinnedSet.has(it.id);
                  return (
                    <CardShell
                      key={it.id}
                      actionVisibility="hover"
                      title={
                        <div>
                          <div className="-mb-1">
                            <UsernameTag name={it.ownerName} />
                          </div>
                          <div className="mt-1 text-sm font-medium">{it.title}</div>
                        </div>
                      }
                      description={<span>{it.notes}</span>}
                      footerLeft={<span className="text-gray-500">{it.updatedAt}</span>}
                      footerRight={
                        <div className="flex items-center gap-2">
                          {activeTab === "datasets" && it.hasFile && it.originalFilename && (
                            <span className="text-[11px] text-gray-500" title={`File: ${it.originalFilename}`}>📄</span>
                          )}
                          {it.isPublic ? (
                            <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] text-green-700">Public</span>
                          ) : (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">Private</span>
                          )}
                        </div>
                      }
                    >
                      {/* Hover actions (top-right) */}
                      <button
                        className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeTab === "datasets") {
                            window.open(`/datasets/${it.id}/view`, '_blank');
                          } else {
                            window.open(`/predictors/${it.id}/view`, '_blank');
                          }
                        }}
                      >
                        View
                      </button>
                      {activeTab === "datasets" && it.hasFile && (
                        <button
                          className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100"
                          title="Download file"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadDataset(it.id);
                          }}
                        >
                          📥
                        </button>
                      )}
                      <button
                        className={`rounded-md border border-black/10 px-2 py-1 text-xs ${isPinned ? "bg-yellow-100 hover:bg-yellow-200" : "bg-white hover:bg-gray-100"
                          }`}
                        title={isPinned ? "Unpin" : "Pin"}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(it.id);
                        }}
                      >
                        📌
                      </button>
                    </CardShell>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}