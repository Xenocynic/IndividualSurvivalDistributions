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
 * 
 * Flow:
 * 1. Fill out form → Click "Train & Save"
 * 2. Creates predictor in database
 * 3. Shows training modal
 * 4. Trains ML model
 * 5. Navigates to predictor detail page
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { FolderSelector } from "../components/folder";
import { listMyDatasets } from "../lib/datasets";
import { toDatasetItem } from "../lib/mappers";
import { createPredictor, listMyPredictors, getPredictor, updatePredictor, grantPredictorViewer, trainPredictor } from "../lib/predictors";
import { UserSearchInput, type UserSuggestion } from "../components/UserSearchInput";
import { resolveUsernameToId } from "../lib/users";

type PermRow = {
  id: number;
  username: string;
  role: "owner" | "viewer";
  userId?: number;
};

type TrainingStep = 'idle' | 'creating' | 'training' | 'complete' | 'error';

export default function PredictorCreate() {
  const navigate = useNavigate();

  // form state
  const [name, setName] = useState("");
  const { id: draftId } = useParams();
  const isDraftMode = Boolean(draftId);
  const [notes, setNotes] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // dataset selection
  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState<
    { id: string; title: string; notes?: string; owner: boolean; isPublic?: boolean }[]
  >([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

  // permissions rows
  const [rows, setRows] = useState<PermRow[]>([
    { id: 1, username: "", role: "owner" },
  ]);

  // training state
  const [trainingStep, setTrainingStep] = useState<TrainingStep>('idle');
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [createdPredictorId, setCreatedPredictorId] = useState<number | null>(null);

  // meta state
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);

  // name availability
  const [checking, setChecking] = useState(false);
  const [nameTaken, setNameTaken] = useState<boolean | null>(null);

  // detection for the leave prompt
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!draftId) return;

    async function loadDraft() {
      const p = await getPredictor(draftId);
      if (!p) return;

      setName(p.name);
      setNotes(p.description);
      setSelectedDatasetId(String(p.dataset_id));
      setSelectedFolderId(p.folder_id ? String(p.folder_id) : null);
      setIsPublic(!p.is_private);

      setRows(
        p.permissions.map((perm) => ({
          id: perm.user.id,
          username: perm.user.username,
          role: perm.role,
          userId: perm.user.id
        }))
      );
    }

    loadDraft();
  }, [draftId]);

  useEffect(() => {
    dirtyRef.current =
      !!name.trim() ||
      !!notes.trim() ||
      !!selectedDatasetId ||
      isPublic ||
      !!selectedFolderId ||
      rows.some((r) => r.username.trim());
  }, [name, notes, selectedDatasetId, isPublic, selectedFolderId, rows]);

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

  const canSave = !!name.trim() && !nameTaken && !!selectedDatasetId && trainingStep === 'idle';


  // Try to train the dataset first 
  async function onTrainAndSave() {
    if (!canSave) return;

    setTrainingStep('training');
    setTrainingError(null);

    try {
      const datasetId = Number(selectedDatasetId)
      // Step 1: Train first (no predictor yet)
      const trainingResult = await trainPredictor(datasetId, {
        parameters: {
          n_epochs: 100,
          dropout: 0.2,
          neurons: [64, 64],
          n_exp: 10
        },
      });

      // Validate training result
      if (!trainingResult || !trainingResult.model_id) {
        throw new Error('Training did not return a valid model_id');
      }

      // Step 2: Create predictor with ML metadata
      setTrainingStep('creating');

      let finalPredictor;

      if (isDraftMode) {
        // Update existing draft and convert to final
        finalPredictor = await updatePredictor(Number(draftId), {
          name: name.trim(),
          description: notes.trim(),
          dataset_id: datasetId,
          folder_id: selectedFolderId || undefined,
          is_private: !isPublic,
          ml_training_status: "trained",
          ml_model_metrics: trainingResult.metrics || {},
          ml_selected_features: trainingResult.selected_features,
          model_id: trainingResult.model_id,
          ml_trained_at: trainingResult.trained_at
        });
      } else {
        // Create fresh predictor
        finalPredictor = await createPredictor({
          name: name.trim(),
          description: notes.trim(),
          dataset_id: datasetId,
          folder_id: selectedFolderId || undefined,
          is_private: !isPublic,
          ml_training_status: "trained",
          ml_model_metrics: trainingResult.metrics || {},
          ml_selected_features: trainingResult.selected_features,
          model_id: trainingResult.model_id,
          ml_trained_at: trainingResult.trained_at
        });
      }

      setCreatedPredictorId(finalPredictor.predictor_id);

      // Step 3: Grant permissions
      for (const row of rows) {
        const username = row.username.trim();
        if (!username) continue;
        let userId = row.userId;
        if (!userId) {
          userId = await resolveUsernameToId(username);
        }
        if (!userId) continue;

        try {
          await grantPredictorViewer(finalPredictor.predictor_id, userId, row.role);
        } catch (e) {
          console.error("Grant failed", e);
        }
      }

      // Step 4: Complete!
      setTrainingStep('complete');

      setTimeout(() => {
        navigate(`/predictors/${finalPredictor.predictor_id}`);
      }, 2000);

    } catch (error: any) {
      // Update ML training status for error scenario
      setTrainingStep('error');
      setTrainingError(error.message || 'Failed to train and create predictor!');
      console.error('Training error:', error);

      // Optionally, you could create a predictor in "failed" state if needed
      // await createPredictor({ name, ... , ml_training_status: 'failed' });
    }
  }


  async function saveDraft() {
    try {
      let draft;

      if (isDraftMode) {
        // Update existing draft
        draft = await updatePredictor(Number(draftId), {
          name: name.trim(),
          description: notes.trim(),
          dataset_id: selectedDatasetId ? Number(selectedDatasetId) : null,
          folder_id: selectedFolderId || undefined,
          is_private: true,
          ml_training_status: "not_trained",
          ml_trained_at: null,
          ml_model_metrics: {},
          ml_selected_features: null,
          model_id: null,
        });
      } else {
        // Create new draft
        draft = await createPredictor({
          name: name.trim(),
          description: notes.trim(),
          dataset_id: selectedDatasetId ? Number(selectedDatasetId) : null,
          folder_id: selectedFolderId || undefined,
          is_private: true,
          ml_training_status: "not_trained",
          ml_trained_at: null,
          ml_model_metrics: {},
          ml_selected_features: null,
          model_id: null,
        });
      }

      navigate("/dashboard", { state: { tab: "predictors" } })
    } catch (e) {
      alert("Failed to save draft");
    }
  }


  function onBack() {
    if (trainingStep !== 'idle') {
      // Don't allow navigation during training
      return;
    }
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
  function handleUserSelect(id: number, user: UserSuggestion) {
    updateRow(id, { username: user.username, userId: user.id });
  }

  const isProcessing = trainingStep !== 'idle';

  return (
    <div className="min-h-[60vh] bg-white">
      {/* Sticky sub-header */}
      <div className="sticky top-[var(--app-nav-h,3.5rem)] z-40 w-full border-b bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-2.5">
          <button
            onClick={onBack}
            disabled={isProcessing}
            className="rounded-md bg-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <div className="text-sm font-semibold tracking-wide">Create New Predictor</div>
          <button
            onClick={onTrainAndSave}
            disabled={!canSave}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {trainingStep === 'creating' ? 'Creating…' :
              trainingStep === 'training' ? 'Training…' :
                'Train & Save'}
          </button>
        </div>
        <div className="h-1 w-full bg-neutral-600" />
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl space-y-8 p-4">
        {/* Name */}
        <section className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isProcessing}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
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
            disabled={isProcessing}
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
            placeholder="Optional description (maps to backend 'description')."
          />
        </section>

        {/* Folder Selection */}
        <section className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Organization</label>
          <FolderSelector
            selectedFolderId={selectedFolderId}
            onFolderSelect={setSelectedFolderId}
            disabled={isProcessing}
            placeholder="Select a folder (optional)"
          />
          <div className="rounded-md bg-gray-100 p-2 text-xs text-gray-700">
            Organize your predictor by adding it to a folder. You can create a new folder or select an existing one.
          </div>
        </section>

        {/* Dataset picker */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Choose a dataset
            </label>
            <div className="w-64">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search datasets…"
                onClear={() => setQuery("")}
                disabled={isProcessing}
              />
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
                        disabled={isProcessing}
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:cursor-not-allowed ${selected ? "bg-neutral-100" : ""
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
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={isProcessing}
              className="h-4 w-4 accent-neutral-900 disabled:opacity-50"
            />
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
                      className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
                      title="Remove"
                      onClick={() => removeRow(r.id)}
                      disabled={isProcessing}
                    >
                      ✕
                    </button>
                    <UserSearchInput
                      value={r.username}
                      onValueChange={(val) => updateRow(r.id, { username: val, userId: undefined })}
                      onSelect={(user) => handleUserSelect(r.id, user)}
                      placeholder="Search username"
                      disabled={isProcessing}
                    />
                  </div>
                  <div>
                    <select
                      value={r.role}
                      onChange={(e) => updateRow(r.id, { role: e.target.value as PermRow["role"] })}
                      disabled={isProcessing}
                      className="w-40 rounded-md border px-2 py-1 text-sm disabled:bg-gray-100"
                    >
                      <option value="owner">Owner</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t bg-neutral-100 px-3 py-2">
              <button
                onClick={addRow}
                disabled={isProcessing}
                className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
              >
                + Add
              </button>
              <div className="text-[11px] text-neutral-600">
                Owners can edit & retrain. Viewers can use the predictor only.
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Training Modal */}
      {isProcessing && (
        <TrainingModal
          step={trainingStep}
          error={trainingError}
          onRetry={() => {
            setTrainingStep('idle');
            setTrainingError(null);
          }}
          onViewPredictor={() => {
            if (createdPredictorId) {
              navigate(`/predictors/${createdPredictorId}`);
            }
          }}
        />
      )}

      {showLeavePrompt && (
        <ConfirmLeave
          onCancel={() => setShowLeavePrompt(false)}
          onContinue={() => navigate("/dashboard", { state: { tab: "predictors" } })}
          onSaveDraft={saveDraft}
        />
      )}
    </div>
  );
}

function TrainingModal({
  step,
  error,
  onRetry,
  onViewPredictor
}: {
  step: TrainingStep;
  error: string | null;
  onRetry: () => void;
  onViewPredictor: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {step === 'creating' && (
          <>
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900"></div>
              <h3 className="text-lg font-semibold">Creating Predictor...</h3>
              <p className="mt-2 text-sm text-neutral-600">Setting up your predictor in the database.</p>
            </div>
          </>
        )}

        {step === 'training' && (
          <>
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
              <h3 className="text-lg font-semibold">Training ML Model...</h3>
              <p className="mt-2 text-sm text-neutral-600">
                This may take several minutes depending on dataset size. Please don't close this page.
              </p>
              <div className="mt-4 rounded-md bg-blue-50 p-3 text-xs text-blue-800">
                🔄 Training in progress... The model is learning from your dataset.
              </div>
            </div>
          </>
        )}

        {step === 'complete' && (
          <>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
                ✓
              </div>
              <h3 className="text-lg font-semibold">Training Complete!</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Your predictor has been created and trained successfully.
              </p>
              <p className="mt-1 text-xs text-neutral-500">Redirecting to predictor details...</p>
            </div>
          </>
        )}

        {step === 'error' && (
          <>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
                ✕
              </div>
              <h3 className="text-lg font-semibold">Training Failed</h3>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <div className="mt-4 flex gap-2 justify-center">
                <button
                  onClick={onRetry}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConfirmLeave({ onCancel, onContinue, onSaveDraft }: { onCancel: () => void; onContinue: () => void; onSaveDraft: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-lg">
        <h3 className="text-base font-semibold">Leave without saving?</h3>
        <p className="mt-1 text-sm text-neutral-600">Your data will not be saved if you continue to dashboard.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50">
            Cancel
          </button>
          <button onClick={onContinue} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50">
            Continue
          </button>
          <button onClick={onSaveDraft} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}