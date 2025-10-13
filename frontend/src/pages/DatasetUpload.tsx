import { useState } from "react";
import { createDataset, grantDatasetViewer } from "../lib/datasets";

export default function DatasetCreate() {
  const [name, setName] = useState("");
  const [notes] = useState(""); // UI-only for now - implement this on the backend please.
  const [file, setFile] = useState<File | null>(null);
  const [validated, setValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDatasetId, setNewDatasetId] = useState<number | null>(null);

  async function validateFile() {
    // TODO replace with real validator from Alex's branch; for now just check CSV extension
    setValidated(!!file && file.name.toLowerCase().endsWith(".csv"));
  }

  async function onSave() {
    setSaving(true);
    try {
      const ds = await createDataset(name);
      setNewDatasetId(ds.dataset_id);
      // NOTE: file upload here, also take it from Alex's branch.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-center">Create New Dataset</h1>

      <section className="space-y-2">
        <label className="block text-xs font-medium">Name</label>
        <input className="w-full rounded-md border px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} />
        <p className="text-xs text-gray-500">This maps to <code>dataset_name</code>.</p>
      </section>

      <section className="space-y-2">
        <label className="block text-xs font-medium">Notes (not saved yet)</label>
        <textarea className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Not persisted (backend TBD)" />
      </section>

      <section className="space-y-2">
        <label className="block text-xs font-medium">Delimited Dataset (UI only)</label>
        <input type="file" accept=".csv" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
        <div className="flex gap-2">
          <button onClick={validateFile} className="btn-gray">Validate</button>
          <span className={`text-xs ${validated ? "text-green-600" : "text-gray-500"}`}>
            {validated ? "Looks good" : "Awaiting validation"}
          </span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Visibility (placeholders)</h2>
        <div className="text-xs text-gray-600">Admin access & Make Public are UI-only right now.</div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Share with users (viewers)</h3>
        <div className="text-xs text-gray-600">Add users as <b>viewers</b>. Owners = creator only.</div>
        {/* simple viewer adder once dataset exists */}
        {newDatasetId ? (
          <ShareViewer datasetId={newDatasetId} />
        ) : (
          <div className="text-xs text-gray-500">Save dataset first to grant access.</div>
        )}
      </section>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={!name || !validated || saving} className="btn-gray">
          {saving ? "Saving…" : "Save Dataset"}
        </button>
        <button className="rounded-md border px-4 py-2 text-sm">Save draft</button>
      </div>
    </div>
  );
}

function ShareViewer({ datasetId }: { datasetId: number }) {
  const [userId, setUserId] = useState<number | "">("");
  async function add() {
    if (typeof userId === "number") await grantDatasetViewer(datasetId, userId);
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
