import { useMemo, useState } from "react";
import { createPredictor, grantPredictorViewer } from "../lib/predictors";
import { listMyDatasets } from "../lib/datasets";
import SearchBar from "../components/SearchBar";

export default function PredictorCreate() {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState<{ dataset_id:number; dataset_name:string }[]>([]);
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [predictorId, setPredictorId] = useState<number | null>(null);

  // load datasets once (omit error handling for brevity)
  useState(() => { listMyDatasets().then(setDatasets); });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter(d => (q ? d.dataset_name.toLowerCase().includes(q) : true));
  }, [datasets, query]);

  async function onSave() {
    if (!datasetId) return;
    setSaving(true);
    try {
      const p = await createPredictor({ name, description: desc, dataset: datasetId });
      setPredictorId(p.predictor_id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-center">Create New Predictor</h1>

      <section className="space-y-2">
        <label className="block text-xs font-medium">Name</label>
        <input className="w-full rounded-md border px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} />
      </section>

      <section className="space-y-2">
        <label className="block text-xs font-medium">Notes</label>
        <textarea className="w-full rounded-md border px-3 py-2 text-sm" value={desc} onChange={e=>setDesc(e.target.value)} />
      </section>

      <section className="space-y-2">
        <label className="block text-xs font-medium">Choose a dataset</label>
        <SearchBar value={query} onChange={setQuery} placeholder="Search datasets…" onClear={()=>setQuery("")}/>
        <div className="max-h-52 overflow-auto rounded-md border">
          {filtered.map(ds => (
            <button
              key={ds.dataset_id}
              onClick={()=>setDatasetId(ds.dataset_id)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${datasetId===ds.dataset_id ? "bg-gray-100" : ""}`}
            >
              {ds.dataset_name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Visibility & permissions</h3>
        <div className="text-xs text-gray-600">Owners (you) can retrain; added users are viewers only.</div>
        {predictorId ? (
          <ShareViewer predictorId={predictorId}/>
        ) : (
          <div className="text-xs text-gray-500">Save predictor first to grant access.</div>
        )}
      </section>

      {/* Time unit (placeholder) */}
      <section className="space-y-1">
        <label className="block text-xs font-medium">Time unit (placeholder)</label>
        <div className="text-xs text-gray-500">Not stored yet (needs backend field).</div>
        <div className="flex gap-2">
          <button className="btn-gray" disabled>Year</button>
          <button className="btn-gray" disabled>Month</button>
          <button className="btn-gray" disabled>Day</button>
          <button className="btn-gray" disabled>Hour</button>
        </div>
      </section>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={!name || !datasetId || saving} className="btn-gray">
          {saving ? "Saving…" : "Save Predictor"}
        </button>
        <button className="rounded-md border px-4 py-2 text-sm">Save draft</button>
      </div>
    </div>
  );
}

function ShareViewer({ predictorId }: { predictorId: number }) {
  const [userId, setUserId] = useState<number | "">("");
  async function add() {
    if (typeof userId === "number") await grantPredictorViewer(predictorId, userId);
    setUserId("");
  }
  return (
    <div className="flex items-center gap-2">
      <input type="number" className="w-40 rounded-md border px-2 py-1 text-sm" placeholder="User ID"
             value={userId} onChange={(e)=>setUserId(e.target.value ? Number(e.target.value) : "")} />
      <button onClick={add} className="btn-gray">Add Viewer</button>
    </div>
  );
}
