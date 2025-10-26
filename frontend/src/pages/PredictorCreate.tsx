/**
 * Create New Predictor
 *
 * UX goals (mirrors Upload Dataset):
 * - Sticky grey header with Back / title / Save
 *   - "Back" warns if there are unsaved changes
 * - Name + Notes fields
 * - Dataset picker (owner or viewer datasets) with SearchBar
 *   - Scrollable embedded pane; clicking a dataset selects it
 * - Visibility: public / private toggle (matches datasets)
 * - Manage permissions table:
 *   - Add usernames and choose role (Owner / Viewer)
 *   - For now, this is UI-only; we wanna wire
 *     - Owner
 *     - Viewer
 *
 * Save:
 * - Calls createPredictor()
 * - (Later) iterate manage-permissions rows
 * - Navigates back to Dashboard -> Predictors tab with a PredictorItem preview
 */

/**
 * Create New Predictor — unified grey UI, sharp edges, sticky header offset.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
// TODO[backend]: listMyDatasets() should return datasets the current user can see (owner or viewer)
import { listMyDatasets } from "../lib/datasets";
// TODO[backend]: mappers should expose fields we show 
import { toDatasetItem } from "../lib/mappers";
// TODO[backend]: createPredictor() should accept fields listed below
// TODO[backend]: listMyPredictors() is used for client-side "name exists" check - maybe make a dedicated exists endpoint?
import { createPredictor, listMyPredictors, grantPredictorViewer, resolveUsernameToId } from "../lib/predictors";
import { type PredictorItem } from "../components/PredictorCard";
// import { api } from "../lib/apiClient";

type PermRow = { 
  id: number;              // local row id
  username: string;        // text the user typed (later - lookup user id)
  role: "owner" | "viewer"; // UI role
};

export default function PredictorCreate() {
  const navigate = useNavigate();

    // form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isPublic, setIsPublic] = useState(false); // TODO[backend]: wire into predictor creation

  // dataset selection
  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState<
    { id: string; title: string; notes?: string; owner: boolean; isPublic?: boolean }[]
  >([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

  // permissions rows (UI-only for now)
  const [rows, setRows] = useState<PermRow[]>([
    { id: 1, username: "", role: "owner" }, // example empty line to start
  ]);

  // meta state
  const [saving, setSaving] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);

  // name availability (mirrors DatasetUpload)
  const [checking, setChecking] = useState(false);
  const [nameTaken, setNameTaken] = useState<boolean | null>(null);

  // detection for the leave prompt
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current =
      !!name.trim() ||
      !!notes.trim() ||
      !!selectedDatasetId ||
      isPublic ||
      rows.some((r) => r.username.trim());
  }, [name, notes, selectedDatasetId, isPublic, rows]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const trimmed = name.trim();
      if (!trimmed) {
        setNameTaken(null);
        return;
      }
      setChecking(true);
      try {
        const mine = await listMyPredictors();
        const exists = mine.some((p: any) => ((p.name ?? p.predictor_name ?? "") + "").toLowerCase() === trimmed.toLowerCase());
        if (!cancelled) setNameTaken(exists);
      } catch {
        if (!cancelled) setNameTaken(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    const t = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [name]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = await listMyDatasets();
        if (cancelled) return;
        const ui = api.map((d) => {
          const m = toDatasetItem(d);
          return { id: m.id, title: m.title, notes: m.notes, owner: m.owner };
        });
        setDatasets(ui);
      } catch {
        setDatasets([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((d) => (q ? d.title.toLowerCase().includes(q) : true));
  }, [datasets, query]);

  const canSave = !!name.trim() && !nameTaken && !!selectedDatasetId && !saving;

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const created = await createPredictor({
        name: name.trim(),
        description: notes.trim(),
        dataset_id: Number(selectedDatasetId),
        is_private: !isPublic,
      });

      for (const row of rows) {
        const username = row.username.trim();
        if (!username) continue;
        const userId = await resolveUsernameToId(username);
        if (!userId) continue;
        try {
          await grantPredictorViewer(created.predictor_id, userId, row.role);
        } catch (e) {
          console.error("Grant failed", e);
        }
      }

      const justCreated: PredictorItem = {
        id: String(created.predictor_id),
        title: created.name ?? name.trim(),
        notes: created.description ?? notes.trim(),
        owner: true,
        isPublic: !created.is_private,
        status: undefined,
        updatedAt: undefined,
      };

      navigate("/dashboard", {
        state: { tab: "predictors", justCreatedId: created.predictor_id, justCreated },
      });
    } catch {
      alert("Failed to create predictor. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function onBack() {
    if (dirtyRef.current) setShowLeavePrompt(true);
    else navigate("/dashboard", { state: { tab: "predictors" } });
  }

  function addRow() {
    setRows((r) => [...r, { id: (r.at(-1)?.id ?? 0) + 1, username: "", role: "viewer" }]);
  }
  function removeRow(id: number) {
    setRows((r) => r.filter((x) => x.id !== id));
  }
  function updateRow(id: number, patch: Partial<PermRow>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  return (
    <div className="min-h-[60vh] bg-white">
      {/* Sticky sub-header under global nav */}
      <div className="sticky top-[var(--app-nav-h,3.5rem)] z-40 w-full border-b bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-2.5">
          <button onClick={onBack} className="rounded-md bg-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-500">
            Back
          </button>
          <div className="text-sm font-semibold tracking-wide">Create New Predictor</div>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="h-1 w-full bg-neutral-600" />
      </div>

      {/* Body — single centered column */}
      <div className="mx-auto max-w-3xl space-y-8 p-4">
        {/* Name */}
        <section className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            placeholder="A concise predictor name"
          />
          <div className="min-h-[1.25rem] text-xs">
            {name ? (
              checking ? (
                <span className="text-neutral-500">Checking availability…</span>
              ) : nameTaken === true ? (
                <span className="text-red-600">This name is already taken.</span>
              ) : nameTaken === false ? (
                <span className="text-green-600">Name is available. Proceed!</span>
              ) : (
                <span className="text-neutral-500">Could not verify name; you can still proceed.</span>
              )
            ) : (
              <span className="text-neutral-500">
                This maps to <code>name</code>.
              </span>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            placeholder="Optional description (maps to backend 'description')."
          />
        </section>

        {/* Dataset picker */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Choose a dataset
            </label>
            <div className="w-64">
              <SearchBar value={query} onChange={setQuery} placeholder="Search datasets…" onClear={() => setQuery("")} />
            </div>
          </div>

          <div className="max-h-60 overflow-auto rounded-md border bg-white">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-neutral-500">No datasets match your search.</div>
            ) : (
              <ul className="divide-y">
                {filtered.map((ds) => {
                  const selected = selectedDatasetId === ds.id;
                  return (
                    <li key={ds.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedDatasetId(ds.id)}
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                          selected ? "bg-neutral-100" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{ds.title}</div>
                          <div className="text-[11px] text-neutral-600">{ds.owner ? "Owner" : "Viewer"}</div>
                        </div>
                        {ds.notes && <div className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{ds.notes}</div>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="text-xs text-neutral-500">You must select one dataset to train/use this predictor.</div>
        </section>

        {/* Visibility */}
        <section className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Visibility</div>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 accent-neutral-900" />
            <span className="text-sm">Make Predictor Public</span>
          </label>
          <div className="rounded-md border bg-neutral-50 p-2 text-xs text-neutral-700">
            By enabling this, all users will be able to discover and use this predictor. Disable to keep it private to you
            (and the users you share with).
          </div>
        </section>

        {/* Manage permissions */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Customize visibility and permissions</h3>
          <div className="rounded-md border">
            <div className="grid grid-cols-2 border-b bg-neutral-100 px-3 py-2 text-xs font-semibold">
              <div>Users</div>
              <div>Permissions</div>
            </div>

            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="grid grid-cols-2 items-center gap-2 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                      title="Remove"
                      onClick={() => removeRow(r.id)}
                    >
                      ✕
                    </button>
                    <input
                      value={r.username}
                      onChange={(e) => updateRow(r.id, { username: e.target.value })}
                      placeholder="Username"
                      className="w-full rounded-md border px-2 py-1 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    />
                  </div>
                  <div>
                    <select
                      value={r.role}
                      onChange={(e) => updateRow(r.id, { role: e.target.value as PermRow["role"] })}
                      className="w-40 rounded-md border px-2 py-1 text-sm"
                    >
                      <option value="owner">Owner</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t bg-neutral-100 px-3 py-2">
              <button onClick={addRow} className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50">
                + Add
              </button>
              <div className="text-[11px] text-neutral-600">
                Owners can edit & retrain. Viewers can use the predictor only.
              </div>
            </div>
          </div>
        </section>
      </div>

      {showLeavePrompt && (
        <ConfirmLeave onCancel={() => setShowLeavePrompt(false)} onContinue={() => navigate("/dashboard", { state: { tab: "predictors" } })} />
      )}
    </div>
  );
}

function ConfirmLeave({ onCancel, onContinue }: { onCancel: () => void; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-lg">
        <h3 className="text-base font-semibold">Leave without saving?</h3>
        <p className="mt-1 text-sm text-neutral-600">Your data will not be saved if you return to the Dashboard.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50">
            Cancel
          </button>
          <button onClick={onContinue} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
