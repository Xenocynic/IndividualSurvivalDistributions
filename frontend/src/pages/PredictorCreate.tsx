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

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { FolderSelector } from "../components/folder";
// TODO[backend]: listMyDatasets() should return datasets the current user can see (owner or viewer)
import { listMyDatasets } from "../lib/datasets";
// TODO[backend]: mappers should expose fields we show 
import { toDatasetItem } from "../lib/mappers";
// TODO[backend]: createPredictor() should accept fields listed below
// TODO[backend]: listMyPredictors() is used for client-side "name exists" check - maybe make a dedicated exists endpoint?
import { createPredictor, listMyPredictors, grantPredictorViewer, resolveUsernameToId } from "../lib/predictors";
import { type PredictorItem } from "../components/PredictorCard";
import { api } from "../lib/apiClient";

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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

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
      !!selectedFolderId ||
      rows.some((r) => r.username.trim());
  }, [name, notes, selectedDatasetId, isPublic, selectedFolderId, rows]);

  // check name availability (client-side) — see DatasetUpload for the same pattern
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
        // TODO[backend]: Prefer a dedicated endpoint
        // For now we fall back to listing mine and comparing client-side
        const mine = await listMyPredictors();
        // NOTE: case-insensitive compare!!!
        const exists = mine.some((p: any) => {
          const candidate =
            (p.name ?? p.predictor_name ?? "").toString().toLowerCase();
          return candidate === trimmed.toLowerCase();
        });
        if (!cancelled) setNameTaken(exists);
      } catch {
        // If this fails, don't block user; just show "unknown" or something
        if (!cancelled) setNameTaken(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    // Small debounce to avoid spamming the API...? maybe unnecessary
    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name]);

  // load datasets you can see (owner or viewer), then map via the mapper layer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // TODO[backend]: Ensure the endpoiunt in question returns the user's visible datasets.
        const api = await listMyDatasets();
        if (cancelled) return;
        const ui = api.map((d) => {
          const mapped = toDatasetItem(d);
          return {
            id: mapped.id,
            title: mapped.title,
            notes: mapped.notes,
            owner: mapped.owner,
            // TODO[backend]: expose dataset privacy in mapper:
            // isPublic: mapped.isPublic,
          };
        });
        setDatasets(ui);
      } catch {
        setDatasets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // filter by search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((d) => (q ? d.title.toLowerCase().includes(q) : true));
  }, [datasets, query]);

  // simple canSave rule
  const canSave = !!name.trim() && !nameTaken && !!selectedDatasetId && !saving;

  // Save predictor and return to dashboard (Predictors tab) with a PredictorItem
  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      // 1. Create predictor via your existing API
      const created = await createPredictor({
        name: name.trim(),
        description: notes.trim(),
        dataset_id: Number(selectedDatasetId),
        folder_id: selectedFolderId || undefined,
        is_private: !isPublic,
      });

      for (const row of rows) {
        const username = row.username.trim();
        if (!username) continue;

        // Resolve user_id
        const userId = await resolveUsernameToId(username);
        if (!userId) {
          console.warn(`User not found: ${username}`);
          continue;
        }

        try {
          const resp = await grantPredictorViewer(created.predictor_id, userId, row.role);
          console.log("Granted permission:", username, row.role, resp);
        } catch (err) {
          console.error("Failed to grant permission:", username, err);
        }
      }

      const justCreated: PredictorItem = {
        id: String(created.predictor_id),
        title: created.name ?? name.trim(),
        notes: created.description ?? notes.trim(),
        owner: true,
        isPublic: !created.is_private,              // TODO[backend]: replace 
        status: undefined,     // TODO[backend]: replace
        updatedAt: undefined,  // TODO[backend]: rplace
        // add createdAt i guess
      };

      // route back to dashboard with Predictors tab selected
      navigate("/dashboard", {
        state: {
          tab: "predictors",
          justCreatedId: created.predictor_id,
          justCreated,
          folderAssigned: selectedFolderId ? true : false,
          folderName: selectedFolderId ? "folder" : undefined // We could get the actual folder name if needed
        },
      });
    } catch (err) {
      // TODO[backend]: surface server errors 
      alert("Failed to create predictor. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function onBack() {
    if (dirtyRef.current) {
      setShowLeavePrompt(true);
    } else {
      navigate("/dashboard", { state: { tab: "predictors" } });
    }
  }

  // manage-permissions table handlers
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
    <div className="min-h-[60vh]">
      {/* Sticky header */}
      <div className="sticky top-14 md:top-16 z-40 border-b border-black/10 bg-gray-400">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
          <button
            onClick={onBack}
            className="rounded border border-black/10 bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Back
          </button>
          <div className="font-semibold">Create New Predictor</div>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Body — single centered column */}
      <div className="mx-auto max-w-3xl p-4 space-y-8">
        {/* Name */}
        <section className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
            placeholder="A concise predictor name"
          />
          <div className="min-h-[1.25rem] text-xs">
            {name
              ? checking
                ? <span className="text-gray-500">Checking availability…</span>
                : nameTaken === true
                  ? <span className="text-red-600">This name is already taken.</span>
                  : nameTaken === false
                    ? <span className="text-green-600">Name is available. Proceed!</span>
                    : <span className="text-gray-500">Could not verify name; you can still proceed.</span>
              : <span className="text-gray-500">This maps to <code>name</code>.</span>}
          </div>
          {/* TODO[backend]: if you implement /exists, replace client-side check with server response here. */}
        </section>

        {/* Notes */}
        <section className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
            placeholder="Optional description (maps to backend 'description')."
          />
        </section>

        {/* Folder Selection */}
        <section className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Organization</label>
          <FolderSelector
            selectedFolderId={selectedFolderId}
            onFolderSelect={setSelectedFolderId}
            disabled={saving}
            placeholder="Select a folder (optional)"
          />
          <div className="rounded-md bg-gray-100 p-2 text-xs text-gray-700">
            Organize your predictor by adding it to a folder. You can create a new folder or select an existing one.
          </div>
        </section>

        {/* Dataset picker */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-700">
              Choose a dataset
            </label>
            <div className="w-64">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search datasets…"
                onClear={() => setQuery("")}
              />
            </div>
          </div>

          {/* Embedded, scrollable selector (this is cute fr) */}
          <div className="max-h-60 overflow-auto rounded-md border border-black/10 bg-white">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No datasets match your search.</div>
            ) : (
              <ul className="divide-y divide-black/5">
                {filtered.map((ds) => {
                  const selected = selectedDatasetId === ds.id;
                  return (
                    <li key={ds.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedDatasetId(ds.id)}
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selected ? "bg-gray-100" : ""
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{ds.title}</div>
                          <div className="text-[11px] text-gray-600">
                            {/* TODO[backend]: show dataset privacy when mapper exposes it */}
                            {ds.isPublic ? "Public" : "Private"} {ds.owner ? "• Owner" : "• Viewer"}
                          </div>
                        </div>
                        {ds.notes && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">{ds.notes}</div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="text-xs text-gray-500">
            You must select one dataset to train/use this predictor.
          </div>
        </section>

        {/* Visibility */}
        <section className="space-y-2">
          <div className="text-xs font-semibold text-gray-700">Visibility</div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 accent-black"
            />
            <span className="text-sm">Make Predictor Public</span>
          </label>
          <div className="rounded-md bg-gray-100 p-2 text-xs text-gray-700">
            By enabling this, all users will be able to discover and use this predictor.
            Do not enable if you want it to remain private to you (and users you share with).
          </div>
          {/* TODO[backend]: persist "is_public" when saving; reflect it on list & detail endpoints */}
        </section>

        {/* Manage permissions */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Customize visibility and permissions</h3>
          <div className="rounded-md border border-black/10">
            <div className="grid grid-cols-2 border-b border-black/10 bg-gray-50 px-3 py-2 text-xs font-semibold">
              <div>Users</div>
              <div>Permissions</div>
            </div>

            {/* rows */}
            <div className="divide-y divide-black/5">
              {rows.map((r) => (
                <div key={r.id} className="grid grid-cols-2 items-center gap-2 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded border border-black/10 px-2 py-1 text-xs hover:bg-gray-50"
                      title="Remove"
                      onClick={() => removeRow(r.id)}
                    >
                      ✕
                    </button>
                    <input
                      value={r.username}
                      onChange={(e) => updateRow(r.id, { username: e.target.value })}
                      placeholder="Username"
                      className="w-full rounded-md border border-black/10 px-2 py-1 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                  <div>
                    <select
                      value={r.role}
                      onChange={(e) => updateRow(r.id, { role: e.target.value as PermRow["role"] })}
                      className="w-40 rounded-md border border-black/10 px-2 py-1 text-sm"
                    >
                      <option value="owner">Owner</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* add row */}
            <div className="flex items-center justify-between border-t border-black/10 bg-gray-50 px-3 py-2">
              <button
                onClick={addRow}
                className="rounded border border-black/10 px-2 py-1 text-xs hover:bg-gray-50"
              >
                + Add
              </button>
              <div className="text-[11px] text-gray-600">
                Owners can edit predictor details & retrain. Viewers can use the predictor only.
                {/* TODO[backend]: implement user search, then POST role grants after create. */}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Leave prompt */}
      {showLeavePrompt && (
        <ConfirmLeave
          onCancel={() => setShowLeavePrompt(false)}
          onContinue={() => navigate("/dashboard", { state: { tab: "predictors" } })}
        />
      )}
    </div>
  );
}

/** "are you sure?" modal (shared shape with DatasetUpload) */
function ConfirmLeave({
  onCancel,
  onContinue,
}: {
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
        <h3 className="text-base font-semibold">Leave without saving?</h3>
        <p className="mt-1 text-sm text-gray-600">
          Your data will not be saved if you return to the Dashboard.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}