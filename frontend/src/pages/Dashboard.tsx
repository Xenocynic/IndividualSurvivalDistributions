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
 * - Local state holds the mock data and UI state (activeTab, query, ownership, selection, etc.).
 * - useMemo filters each list by query + ownership.
 * - Clicking the page background clears any selection.
 * - A small modal handles delete confirmation.
 *
 * TO DO:
 * - Replace mock data with API data when backend is ready.
 * - Navigate to actual create / edit / view routes instead of alert() stubs.
 */

import { useMemo, useState, useEffect } from "react";
import Toolbar from "../components/Toolbar";
import PredictorCard, { type PredictorItem } from "../components/PredictorCard";
import DatasetCard, { type DatasetItem } from "../components/DatasetCard";
import { DeletePredictor } from "../components/DeletePredictor";
import type { Ownership } from "../components/FilterMenu";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/apiClient";

type Tab = "predictors" | "datasets";


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
  
  // tabs + data
  const [activeTab, setActiveTab] = useState<Tab>("predictors");
  const [predictors, setPredictors] = useState<PredictorItem[]>([]);
  const [datasets, setDatasets] = useState<PredictorItem[]>([]);


  // error and loading
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // selection is per-tab
  const [selectedPredictorId, setSelectedPredictorId] = useState<string | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

  // shared search across tabs
  const [query, setQuery] = useState("");

  // ownership filter
  const [ownership, setOwnership] = useState<Ownership>("all");

  // delete modal
  const [pendingDelete, setPendingDelete] = useState<PredictorItem | null>(null);


  useEffect(() => {
    let mounted = true;
    // AbortController for cleanup if component unmounts or user changes rapidly

    const controller = new AbortController();
    setError(null);

    async function fetchActive() {
      setIsLoading(true);

      try{
        if (activeTab === "predictors") {
          const data = await api.get<PredictorItem[]>(`/api/predictors/`);
          if (!mounted) return;
          setPredictors(Array.isArray(data) ? data: []);
        } else {
          const data = await api.get<DatasetItem[]>(`/api/datasets/`);
          if (!mounted) return;
          setDatasets(Array.isArray(data) ? data : []);
        }
        

      } catch (err: any) {
        if (err?.status === 0) {
          setError("Network error");
        } else {
          setError(err?.details?.message ?? err?.statusText ?? "Failed to load");
        }
        console.error("Fetch err", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    // debounce by 250 ms
    const t = window.setTimeout(() => fetchActive(), 250);

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(t);
    };



  }, [user, activeTab])



  // filter functionality for predictors and datasets - just looks at ownership
  const filteredPredictors = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = predictors.filter((it) => (q ? it.title.toLowerCase().includes(q) : true));
    if (ownership === "owner") list = list.filter((it) => it.owner);
    if (ownership === "viewer") list = list.filter((it) => !it.owner);
    return list;
  }, [predictors, query, ownership]);

  const filteredDatasets = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = datasets.filter((it) => (q ? it.title.toLowerCase().includes(q) : true));
    if (ownership === "owner") list = list.filter((it) => it.owner);
    if (ownership === "viewer") list = list.filter((it) => !it.owner);
    return list;
  }, [datasets, query, ownership]);

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

  // create Predictor - make a new card, add actual line taking you to Create page once created
  async function createPredictor() {
    const n: PredictorItem = {
      id: Math.random().toString(36).slice(2),
      title: `New Predictor ${predictors.length + 1}`,
      status: "DRAFT",
      updatedAt: "just now",
      owner: true,
      notes: "New predictor draft.",
    };
    setPredictors([n, ...predictors]);
    setActiveTab("predictors");
    setSelectedPredictorId(n.id);
  }

  // create Dataset: mirror predictor behavior; similarly, take to Upload Dataset page
  function addDataset() {
    const n: PredictorItem = {
      id: Math.random().toString(36).slice(2),
      title: `New Dataset ${datasets.length + 1}`,
      updatedAt: "just now",
      owner: true,
      notes: "New dataset draft.",
    };
    setDatasets([n, ...datasets]);
    setActiveTab("datasets");         
    setSelectedDatasetId(n.id);       
    setSelectedPredictorId(null);
  }
  // should ideally add a new bubble onscreen, like a black / grey pocket
  // can see collapsed view of cards inside - just the names. Open it, it expands and takes as many lines as it needs
  function createFolder() {
    alert("(demo) Folder creation UI");
  }

  // replace with Edit Predictor / Dataset view when created
  function editItem(id: string) {
    alert(`(demo) Edit ${id}`);
  }

  // replace with Edit Predictor / Dataset view but with the buttons greyed out - can only view, not edit
  function viewItem(id: string) {
    alert(`(demo) View ${id}`); 
  }
  
  // delete dataset / predictor prompt and deletion
  function confirmDelete() {
    if (!pendingDelete) return;
    if (activeTab === "predictors") {
      setPredictors((arr) => arr.filter((x) => x.id !== pendingDelete.id));
      if (selectedPredictorId === pendingDelete.id) setSelectedPredictorId(null);
    } else {
      setDatasets((arr) => arr.filter((x) => x.id !== pendingDelete.id));
      if (selectedDatasetId === pendingDelete.id) setSelectedDatasetId(null);
    }
    setPendingDelete(null);
  }

  const list = activeTab === "predictors" ? filteredPredictors : filteredDatasets;
  const selectedId = activeTab === "predictors" ? selectedPredictorId : selectedDatasetId;

  return (
    
    // clicking the background clears selection
    <section className="space-y-6" onClick={clearSelection} role="presentation">
      {/* welcome header */}
      <div className="py-6 text-center" onClick={(e) => e.stopPropagation()}>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Welcome,{" "}
          {user
            ? user.first_name?.trim()
              ? user.first_name
              : user.username
            : "User"}!
        </h1>
        {/* REPLACE WITH ACTUAL TEXT EVENTUALLY */}
        <div className="mx-auto mt-4 max-w-2xl space-y-2">
          <h2 className="text-2xl tracking-tight md:text-2xl">
          Find your datasets and predictors below.
        </h2>
        </div>
      </div>
      {/* show error banner above toolbar */}
      {error && (
          <div className="mx-auto max-w-4xl px-4 py-2">
            <div className="rounded-md bg-red-50 border border-red-200 p-3 flex items-center justify-between">
              <div className="text-sm text-red-800">
                <strong className="mr-1">Error:</strong>
                {error}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-sm px-3 py-1 bg-white border rounded-md hover:bg-gray-50"
                  onClick={() => {
                    // simple retry — reload the page or better: call your fetch routine
                    // quick option: force a full reload
                    window.location.reload();
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
      )}
      {/* sticky toolbar under navbar - stays on top when you scroll */}
      <div
        className="sticky top-14 md:top-16 z-40 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-3">
          <Toolbar
            activeTab={activeTab}
            onTabChange={(t) => {
              setActiveTab(t);
              clearSelection();
            }}
            query={query}
            onQueryChange={setQuery}
            onCreatePredictor={createPredictor}
            onCreateDataset={addDataset} 
            onCreateFolder={createFolder}
            ownership={ownership}
            onOwnershipChange={setOwnership}
          />
        </div>
        <div className="border-t border-black/10" />
      </div>
      {/* loading indicator or skeleton */}
      {isLoading ? (
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* simple spinner + hint */}
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-700" />
            <div className="text-sm text-gray-700">Loading {activeTab}...</div>
          </div>

          {/* optional skeleton grid — placeholders matching your card layout */}
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
      {/* Grid - basically how stuff is displayed onscreen */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        onClick={(e) => e.stopPropagation()}
      >
        {activeTab === "predictors"
          ? list.map((it) => (
              <PredictorCard
                key={it.id}
                item={it}
                selected={selectedId === it.id}
                onToggleSelect={toggleSelect}
                onEdit={editItem}
                onDelete={(id) =>
                  setPendingDelete(predictors.find((x) => x.id === id) ?? null)
                }
                onView={viewItem}
              />
            ))
          : list.map((it) => (
              <DatasetCard
                key={it.id}
                item={it}
                selected={selectedId === it.id}
                onToggleSelect={toggleSelect}
                onEdit={editItem}
                onDelete={(id) =>
                  setPendingDelete(datasets.find((x) => x.id === id) ?? null)
                }
                onView={viewItem}
              />
            ))}
      </div>

      <DeletePredictor
        open={!!pendingDelete}
        name={pendingDelete?.title ?? ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
