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
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { FolderSelector } from "../components/folder";
import { listMyDatasets } from "../lib/datasets";
import { toDatasetItem } from "../lib/mappers";
import {
  createPredictor,
  listMyPredictors,
  grantPredictorViewer,
  trainPredictor,
} from "../lib/predictors";
import {
  UserSearchInput,
  type UserSuggestion,
} from "../components/UserSearchInput";
import { resolveUsernameToId } from "../lib/users";

type PermRow = {
  id: number;
  username: string;
  role: "owner" | "viewer";
  userId?: number;
};

type TrainingStep = "idle" | "creating" | "training" | "complete" | "error";

export default function PredictorCreate() {
  const navigate = useNavigate();

  // form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // dataset selection
  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState<
    {
      id: string;
      title: string;
      notes?: string;
      owner: boolean;
      isPublic?: boolean;
    }[]
  >([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  );

  // permissions rows
  const [rows, setRows] = useState<PermRow[]>([
    { id: 1, username: "", role: "owner" },
  ]);

  // training state
  const [trainingStep, setTrainingStep] = useState<TrainingStep>("idle");
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [createdPredictorId, setCreatedPredictorId] = useState<number | null>(
    null
  );

  // meta state
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);

  // name availability
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
        const exists = mine.some(
          (p: any) =>
            ((p.name ?? p.predictor_name ?? "") + "").toLowerCase() ===
            trimmed.toLowerCase()
        );
        if (!cancelled) setNameTaken(exists);
      } catch {
        if (!cancelled) setNameTaken(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
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
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((d) =>
      q ? d.title.toLowerCase().includes(q) : true
    );
  }, [datasets, query]);

  const canSave =
    !!name.trim() && !nameTaken && !!selectedDatasetId && trainingStep === "idle";

  // Try to train the dataset first
  async function onTrainAndSave() {
    if (!canSave) return;

    setTrainingStep("training");
    setTrainingError(null);

    try {
      const datasetId = Number(selectedDatasetId);
      // Step 1: Train first (no predictor yet)
      const trainingResult = await trainPredictor(datasetId, {
        parameters: {
          n_epochs: 100,
          dropout: 0.2,
          neurons: [64, 64],
          n_exp: 10,
        },
      });

      // Validate training result
      if (!trainingResult || !trainingResult.model_id) {
        throw new Error("Training did not return a valid model_id");
      }

      // Step 2: Create predictor with ML metadata
      setTrainingStep("creating");

      const created = await createPredictor({
        name: name.trim(),
        description: notes.trim(),
        dataset_id: Number(selectedDatasetId),
        folder_id: selectedFolderId || undefined,
        is_private: !isPublic,
        model_id: trainingResult.model_id,
        ml_trained_at: trainingResult.trained_at,
        ml_training_status: "trained",
        ml_model_metrics: trainingResult.metrics || {},
        ml_selected_features: trainingResult.selected_features,
      });

      setCreatedPredictorId(created.predictor_id);

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
          await grantPredictorViewer(created.predictor_id, userId, row.role);
        } catch (e) {
          console.error("Grant failed", e);
        }
      }

      // Step 4: Complete!
      setTrainingStep("complete");

      setTimeout(() => {
        navigate(`/predictors/${created.predictor_id}`);
      }, 2000);
    } catch (error: any) {
      setTrainingStep("error");
      setTrainingError(error.message || "Failed to train and create predictor!");
      console.error("Training error:", error);
    }
  }

  function onBack() {
    if (trainingStep !== "idle") {
      // Don't allow navigation during training
      return;
    }
    if (dirtyRef.current) setShowLeavePrompt(true);
    else navigate("/dashboard", { state: { tab: "predictors" } });
  }

  function addRow() {
    setRows((r) => [
      ...r,
      { id: (r.at(-1)?.id ?? 0) + 1, username: "", role: "viewer" },
    ]);
  }
  function removeRow(id: number) {
    setRows((r) => r.filter((x) => x.id !== id));
  }
  function updateRow(id: number, patch: Partial<PermRow>) {
    setRows((r) => (r.map((x) => (x.id === id ? { ...x, ...patch } : x))));
  }
  function handleUserSelect(id: number, user: UserSuggestion) {
    updateRow(id, { username: user.username, userId: user.id });
  }

  const isProcessing = trainingStep !== "idle";

  return (
    <div className="min-h-[60vh] bg-neutral-100">
      {/* Sticky sub-header */}
      <div className="sticky top-[var(--app-nav-h,4rem)] z-40 w-full border-b bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            disabled={isProcessing}
            className="inline-flex items-center rounded-md border border-white/10 bg-neutral-600 px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-neutral-500 active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back
          </button>
          <div className="text-lg font-semibold tracking-wide">
            Create New Predictor
          </div>
          <button
            onClick={onTrainAndSave}
            disabled={!canSave}
            className="inline-flex items-center rounded-md border border-black/10 bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {trainingStep === "creating"
              ? "Creating…"
              : trainingStep === "training"
              ? "Training…"
              : "Train & Save"}
          </button>
        </div>
        <div className="h-1 w-full bg-neutral-600" />
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-8 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          {/* Page heading */}
          <section className="space-y-4 rounded-lg border border-black/10 bg-neutral-200 p-4">
          <header className="space-y-1">
            <p className="text-sm text-neutral-600">
              Name your predictor, choose a dataset, then configure who can
              see and use it.
            </p>
          </header></section>

          {/* Name */}
          <section className="space-y-2">
            <label className="block text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isProcessing}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
              placeholder="A concise predictor name"
            />
            <div className="flex min-h-[1.25rem] items-start justify-between text-xs">
              <div>
                {name ? (
                  checking ? (
                    <span className="text-neutral-500">
                      Checking availability…
                    </span>
                  ) : nameTaken === true ? (
                    <span className="text-red-600">
                      This name is already taken.
                    </span>
                  ) : nameTaken === false ? (
                    <span className="text-green-600">
                      Name is available. Proceed!
                    </span>
                  ) : (
                    <span className="text-neutral-500">
                      Could not verify name; you can still proceed.
                    </span>
                  )
                ) : (
                  <span className="text-neutral-500">
                    This maps to <code>name</code>.
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <label className="block text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isProcessing}
              rows={4}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
              placeholder="Optional description (maps to backend 'description')."
            />
          </section>

          {/* Folder Selection */}
          <section className="space-y-4 rounded-lg border border-black/10 bg-neutral-50 p-4">
            <h2 className="block uppercase text-sm font-semibold text-neutral-900">
              Organization
            </h2>
            <FolderSelector
              selectedFolderId={selectedFolderId}
              onFolderSelect={setSelectedFolderId}
              disabled={isProcessing}
              placeholder="Select a folder (optional)"
            />
            <div className="rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
              Organize your predictor by adding it to a folder. You can create
              a new folder or select an existing one.
            </div>
          </section>

          {/* Dataset picker */}
          <section className="space-y-4 rounded-lg border border-black/10 bg-neutral-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="pl-1 block uppercase text-sm font-semibold text-neutral-900">
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

            <div className="max-h-60 overflow-auto rounded-md border border-black/10 bg-white">
              {filtered.length === 0 ? (
                <div className="p-3 text-sm text-neutral-500">
                  No datasets match your search.
                </div>
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
                          className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-neutral-200 disabled:cursor-not-allowed ${
                            selected ? "bg-neutral-200" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{ds.title}</div>
                            <div className="text-[11px] text-neutral-600">
                              {ds.owner ? "Owner" : "Viewer"}
                            </div>
                          </div>
                          {ds.notes && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-neutral-600">
                              {ds.notes}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="text-xs text-neutral-500">
              You must select one dataset to train/use this predictor.
            </div>
          </section>

          {/* Visibility + Permissions grouped */}
          <section className="space-y-4 rounded-lg border border-black/10 bg-neutral-50/80 p-4">
            <h2 className="block uppercase text-sm font-semibold text-neutral-900">
              Visibility &amp; sharing
            </h2>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={isProcessing}
                  className="h-4 w-4 accent-neutral-900 disabled:opacity-50"
                />
                <span className="text-xs font-medium text-neutral-800">
                  Make Predictor Public
                </span>
              </label>
              <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-200 p-2 text-xs text-neutral-700">
                By enabling this, all users will be able to discover and use
                this predictor. Disable to keep it private to you (and the
                users you share with).
              </div>
            </div>

            {/* Manage permissions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-600">
                Customize visibility and permissions
              </h3>
              <div className="rounded-md border border-neutral-200 bg-white">
                <div className="grid grid-cols-2 border-b bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-800">
                  <div>Users</div>
                  <div>Permissions</div>
                </div>

                <div className="divide-y">
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="grid grid-cols-2 items-center gap-2 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs transition hover:bg-neutral-50 disabled:opacity-50"
                          title="Remove"
                          onClick={() => removeRow(r.id)}
                          disabled={isProcessing}
                        >
                          ✕
                        </button>
                        <UserSearchInput
                          value={r.username}
                          onValueChange={(val) =>
                            updateRow(r.id, {
                              username: val,
                              userId: undefined,
                            })
                          }
                          onSelect={(user) => handleUserSelect(r.id, user)}
                          placeholder="Search username"
                          disabled={isProcessing}
                        />
                      </div>
                      <div>
                        <select
                          value={r.role}
                          onChange={(e) =>
                            updateRow(r.id, {
                              role: e.target.value as PermRow["role"],
                            })
                          }
                          disabled={isProcessing}
                          className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:bg-gray-100"
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
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium transition hover:bg-neutral-50 disabled:opacity-50"
                  >
                    + Add
                  </button>
                  <div className="text-[11px] text-neutral-600">
                    Owners can edit &amp; retrain. Viewers can only use the
                    predictor.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Training Modal */}
      {isProcessing && (
        <TrainingModal
          step={trainingStep}
          error={trainingError}
          onRetry={() => {
            setTrainingStep("idle");
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
          onContinue={() =>
            navigate("/dashboard", { state: { tab: "predictors" } })
          }
        />
      )}
    </div>
  );
}

function TrainingModal({
  step,
  error,
  onRetry,
  onViewPredictor,
}: {
  step: TrainingStep;
  error: string | null;
  onRetry: () => void;
  onViewPredictor: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {step === "creating" && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
            <h3 className="text-lg font-semibold">Creating Predictor...</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Setting up your predictor in the database.
            </p>
          </div>
        )}

        {step === "training" && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <h3 className="text-lg font-semibold">Training ML Model...</h3>
            <p className="mt-2 text-sm text-neutral-600">
              This may take several minutes depending on dataset size. Please
              don't close this page.
            </p>
            <div className="mt-4 rounded-md bg-blue-50 p-3 text-xs text-blue-800">
              🛠 Training in progress... The model is learning from your
              dataset.
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
              ✓
            </div>
            <h3 className="text-lg font-semibold">Training Complete!</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Your predictor has been created and trained successfully.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Redirecting to predictor details...
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
              ✕
            </div>
            <h3 className="text-lg font-semibold">Training Failed</h3>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={onRetry}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:translate-y-[0.5px]"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmLeave({
  onCancel,
  onContinue,
}: {
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-lg">
        <h3 className="text-base font-semibold">Leave without saving?</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Your data will not be saved if you return to the Dashboard.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 active:translate-y-[0.5px]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
