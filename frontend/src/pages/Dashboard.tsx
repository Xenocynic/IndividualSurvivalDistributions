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
import { useNavigate } from "react-router-dom";
import Toolbar from "../components/Toolbar";
import PredictorCard, { type PredictorItem } from "../components/PredictorCard";
import DatasetCard, { type DatasetItem } from "../components/DatasetCard";
import { DeletePredictor } from "../components/DeletePredictor";
import type { Ownership } from "../components/FilterMenu";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/apiClient";
import { downloadDatasetFile, deleteDataset } from "../lib/datasets";


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
  const navigate = useNavigate();
  
  // tabs + data
  const [activeTab, setActiveTab] = useState<Tab>("predictors");
  const [predictors, setPredictors] = useState<PredictorItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);


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
  const [isDeleting, setIsDeleting] = useState(false);

  // Mapper function from Dataset to UI 
  function mapApiDatasetToUi(item: any, currentUserId?: number): DatasetItem {
    // Format the uploaded date for display
    const formatDate = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
      } catch {
        return dateStr;
      }
    };

    // Convert file size from bytes to MB
    const fileSizeMB = item.file_size ? Math.round(item.file_size / (1024 * 1024) * 10) / 10 : undefined;

    return {
      id: String(item.dataset_id ?? item.id ?? item.pk ?? ""),
      title: item.dataset_name ?? item.name ?? item.title ?? "Untitled dataset",
      // If API returns owner as an id, compare with current user id to produce boolean
      owner:
        typeof item.owner === "number" && currentUserId !== undefined
          ? item.owner === currentUserId
          : Boolean(item.owner),
      ownerId: item.owner ?? null,
      ownerName: item.owner_name ?? item.ownerName ?? null,
      updatedAt: item.uploaded_at ? formatDate(item.uploaded_at) : (item.updated_at ?? item.updatedAt ?? item.modified ?? undefined),
      notes: item.notes ?? item.description ?? "",
      sizeMB: fileSizeMB,
      hasFile: item.has_file ?? Boolean(item.file_path),
      originalFilename: item.original_filename ?? item.originalFilename,
      __raw: item,
    };
  }

  function mapApiPredictorToUi(item: any, currentUserId?: number): PredictorItem {
  return {
    id: String(item.predictor_id ?? item.id ?? item.pk ?? ""),
    title: item.name ?? item.title ?? "Untitled predictor",
    status: item.status ?? (item.is_private ? "DRAFT" : "PUBLISHED"), // optional logic
    updatedAt: item.updated_at ?? item.modified ?? item.last_edited ?? undefined,
    owner:
      typeof item.owner === "number" && currentUserId !== undefined
        ? item.owner === currentUserId
        : Boolean(item.owner),
    notes: item.description ?? item.notes ?? "",
  };
    }


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
          const currentUserId = (user as any)?.id ?? (user as any)?.pk ?? undefined;
          const mapped = Array.isArray(data)
            ? data.map((it) => mapApiPredictorToUi(it, currentUserId))
            : [];
          setPredictors(mapped);
          console.log("mapped predictors:", JSON.parse(JSON.stringify(mapped)));
        } else {
          const data = await api.get<DatasetItem[]>(`/api/datasets/`)
          if (!mounted) return;
          const currentUserId = (user as any)?.id ?? (user as any)?.pk ?? undefined;
          const mapped = Array.isArray(data)
            ? data.map((it) => mapApiDatasetToUi(it, currentUserId))
            : [];

          setDatasets(mapped);
          // debug snapshot:
          console.log("mapped datasets:", JSON.parse(JSON.stringify(mapped)));
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
    let list = datasets.filter((it) => {
    const title = it?.title ?? "";
    return q ? title.toLowerCase().includes(q) : true;
    });
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

  // navigate to edit page
  function editItem(id: string) {
    if (activeTab === "predictors") {
      // TODO: Add predictor edit page when available
      alert(`(demo) Edit predictor ${id}`);
    } else {
      // Navigate to dataset edit page
      navigate(`/datasets/${id}/edit`);
    }
  }

  // navigate to view page
  function viewItem(id: string) {
    if (activeTab === "predictors") {
      // TODO: Add predictor view page when available
      alert(`(demo) View predictor ${id}`);
    } else {
      // Navigate to dataset view page
      navigate(`/datasets/${id}/view`);
    }
  }

  // download dataset file
  async function downloadItem(id: string) {
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
  
  // delete dataset / predictor prompt and deletion
  async function confirmDelete() {
    if (!pendingDelete || isDeleting) return;
    
    setIsDeleting(true);
    
    try {
      if (activeTab === "predictors") {
        // TODO: Add predictor delete API call when available
        alert("Predictor deletion not yet implemented");
        setPredictors((arr) => arr.filter((x) => x.id !== pendingDelete.id));
        if (selectedPredictorId === pendingDelete.id) setSelectedPredictorId(null);
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
      const errorMessage = error?.details?.error || error?.message || 'Failed to delete dataset';
      alert(`Delete failed: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
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
                item={{ ...it, owner: Boolean(it.owner) }}
                selected={selectedId === it.id}
                onToggleSelect={toggleSelect}
                onEdit={editItem}
                onDelete={(id) =>
                  setPendingDelete(datasets.find((x) => x.id === id) ?? null)
                }
                onView={viewItem}
                onDownload={downloadItem}
              />
            ))}
      </div>

      <DeletePredictor
        open={!!pendingDelete}
        name={pendingDelete?.title ?? ""}
        onCancel={() => !isDeleting && setPendingDelete(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </section>
  );
}
