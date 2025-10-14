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

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Toolbar from "../components/Toolbar";
import PredictorCard, { type PredictorItem } from "../components/PredictorCard";
import DatasetCard, { type DatasetItem } from "../components/DatasetCard";
import { DeletePredictor } from "../components/DeletePredictor";
import type { Ownership } from "../components/FilterMenu";
import { useAuth } from "../auth/AuthContext";
import { listMyPredictors } from "../lib/predictors";
import { listMyDatasets } from "../lib/datasets";
import { toPredictorItem, toDatasetItem } from "../lib/mappers";

type Tab = "predictors" | "datasets";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // tabs + data
  const [activeTab, setActiveTab] = useState<Tab>("predictors");

  // API-backed lists, mapped to the card UI types
  const [predictors, setPredictors] = useState<PredictorItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);

  // selection is per-tab
  const [selectedPredictorId, setSelectedPredictorId] = useState<string | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

  // shared search across tabs
  const [query, setQuery] = useState("");

  // ownership filter
  const [ownership, setOwnership] = useState<Ownership>("all");

  // delete modal
  const [pendingDelete, setPendingDelete] = useState<PredictorItem | null>(null);

  // Load data on mount and map via the mappers
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [apiPreds, apiDsets] = await Promise.all([
          listMyPredictors(),
          listMyDatasets(),
        ]);
        if (!mounted) return;
        setPredictors(apiPreds.map(toPredictorItem));
        setDatasets(apiDsets.map(toDatasetItem));
      } catch {
        setPredictors([]);
        setDatasets([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

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

  // create Predictor - navigate to the Create Predictor page
  function createPredictor() {
    navigate("/predictors/new");
  }

  // create Dataset - navigate to the Upload/Create Dataset page
  function addDataset() {
    navigate("/datasets/new");
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
