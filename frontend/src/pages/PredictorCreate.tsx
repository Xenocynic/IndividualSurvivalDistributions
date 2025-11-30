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
import { useNavigate, useLocation } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { FolderSelector } from "../components/folder";
import { listMyDatasets, getDatasetStats } from "../lib/datasets";
import { toDatasetItem } from "../lib/mappers";
import {
  createPredictor,
  listMyPredictors,
  grantPredictorViewer,
  trainPredictorAsync,
} from "../lib/predictors";
import {
  UserSearchInput,
  type UserSuggestion,
} from "../components/UserSearchInput";
import { resolveUsernameToId } from "../lib/users";
import TrainingModal from "../components/TrainingModal";
import { AlertTriangle, AlertCircle, ChevronDown, X } from "lucide-react";

type PermRow = {
  id: number;
  username: string;
  role: "owner" | "viewer";
  userId?: number;
};

type TrainingStep = "idle" | "creating" | "training" | "complete" | "error";

export default function PredictorCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromUsePredictor  =
    location.state?.from === "use-predictor";

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
  const [createdPredictorId, setCreatedPredictorId] =
    useState<number | null>(null);
  const [showTrainingModal, setShowTrainingModal] = useState(false);

  // advanced settings state
  const [numTimePoints, setNumTimePoints] = useState<string | number>("");
  const [regularization, setRegularization] = useState<"l1" | "l2">("l2");
  const [objectiveFunction, setObjectiveFunction] = useState<
    "log-likelihood" | "l2 marginal loss" | "log-likelihood & L2ML"
  >("log-likelihood");
  const [marginalLossType, setMarginalLossType] = useState<
    "weighted" | "unweighted"
  >("weighted");
  const [cParamSearchScope, setCParamSearchScope] = useState<
    "basic" | "fine" | "extremely fine"
  >("basic");
  const [coxFeatureSelection, setCoxFeatureSelection] = useState(false);
  const [mrmrFeatureSelection, setMrmrFeatureSelection] = useState(false);
  const [mtlrPredictor, setMtlrPredictor] =
    useState<"stable" | "testing1">("stable");
  const [tuneParameters, setTuneParameters] = useState(false);
  const [useSmoothedLogLikelihood, setUseSmoothedLogLikelihood] =
    useState(false);
  const [usePredefinedFolds, setUsePredefinedFolds] = useState(false);
  const [runCrossValidation, setRunCrossValidation] = useState(true);
  const [standardizeFeatures, setStandardizeFeatures] = useState(true);

  // feature selection state
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set()
  );
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresError, setFeaturesError] = useState<string | null>(null);

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

  // Fetch features when dataset is selected
  useEffect(() => {
    if (!selectedDatasetId) {
      setAvailableFeatures([]);
      setSelectedFeatures(new Set());
      setFeaturesError(null);
      return;
    }

    let cancelled = false;
    setFeaturesLoading(true);
    setFeaturesError(null);

    (async () => {
      try {
        const stats = await getDatasetStats(Number(selectedDatasetId));
        if (cancelled) return;

        // Extract feature names from feature_correlations
        const features =
          stats.feature_correlations?.map((fc) => fc.feature) ?? [];
        setAvailableFeatures(features);
        // Select all features by default
        setSelectedFeatures(new Set(features));
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load dataset features:", err);
        setFeaturesError(
          "Failed to load features. You can still proceed with training."
        );
        setAvailableFeatures([]);
        setSelectedFeatures(new Set());
      } finally {
        if (!cancelled) setFeaturesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDatasetId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((d) => (q ? d.title.toLowerCase().includes(q) : true));
  }, [datasets, query]);

  const canSave =
    !!name.trim() && !nameTaken && !!selectedDatasetId && trainingStep === "idle";

  // Create predictor and start async training
  async function onTrainAndSave() {
    if (!canSave) return;

    setTrainingStep("creating");
    setTrainingError(null);

    try {
      const datasetId = Number(selectedDatasetId);

      // Step 1: Create predictor first (without model_id, in 'not_trained' state)
      const created = await createPredictor({
        name: name.trim(),
        description: notes.trim(),
        dataset_id: datasetId,
        folder_id: selectedFolderId || undefined,
        is_private: !isPublic,
        ml_training_status: "not_trained",
        // Advanced settings
        num_time_points:
          numTimePoints !== "" &&
          !isNaN(Number(numTimePoints)) &&
          Number(numTimePoints) > 0
            ? Number(numTimePoints)
            : undefined,
        regularization,
        objective_function: objectiveFunction,
        marginal_loss_type: marginalLossType,
        c_param_search_scope: cParamSearchScope,
        cox_feature_selection: coxFeatureSelection,
        mrmr_feature_selection: mrmrFeatureSelection,
        mtlr_predictor: mtlrPredictor,
        tune_parameters: tuneParameters,
        use_smoothed_log_likelihood: useSmoothedLogLikelihood,
        use_predefined_folds: usePredefinedFolds,
        run_cross_validation: runCrossValidation,
        standardize_features: standardizeFeatures,
      });

      setCreatedPredictorId(created.predictor_id);

      // Step 2: Grant permissions
      for (const row of rows) {
        const username = row.username.trim();
        if (!username) continue;
        let userId = row.userId;
        if (!userId) {
          const resolvedId = await resolveUsernameToId(username);
          if (!resolvedId) continue;
          userId = resolvedId;
        }
        await grantPredictorViewer(created.predictor_id, userId, row.role);
      }

      // Step 3: Start async training
      setTrainingStep("training");
      setShowTrainingModal(true);

      await trainPredictorAsync(datasetId, created.predictor_id, {
        parameters: {
          n_epochs: 100,
          dropout: 0.2,
          neurons: [64, 64],
          n_exp: 10,
          // Advanced settings
          num_time_points:
            numTimePoints !== "" &&
            !isNaN(Number(numTimePoints)) &&
            Number(numTimePoints) > 0
              ? Number(numTimePoints)
              : undefined,
          regularization,
          objective_function: objectiveFunction,
          marginal_loss_type: marginalLossType,
          c_param_search_scope: cParamSearchScope,
          cox_feature_selection: coxFeatureSelection,
          mrmr_feature_selection: mrmrFeatureSelection,
          mtlr_predictor: mtlrPredictor,
          tune_parameters: tuneParameters,
          use_smoothed_log_likelihood: useSmoothedLogLikelihood,
          use_predefined_folds: usePredefinedFolds,
          run_cross_validation: runCrossValidation,
          standardize_features: standardizeFeatures,
          // Feature selection
          selected_features:
            selectedFeatures.size > 0
              ? Array.from(selectedFeatures)
              : undefined,
        },
      });
    } catch (error: any) {
      setTrainingStep("error");
      setTrainingError(
        error.message || "Failed to create predictor and start training!"
      );
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
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
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

      {/* Notification Banner - Only shown when redirected from use-predictor */}
      {cameFromUsePredictor  && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-700" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-neutral-900">
                  No trained predictors available
                </h3>
                <p className="mt-1 text-sm text-neutral-700">
                  You must create and train a predictor before you can make
                  predictions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
            </header>
          </section>

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
              ownedOnly={true}
            />
            <div className="rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
              Organize your predictor by adding it to a folder. You can create a
              new folder or select an existing one.
            </div>
          </section>

          {/* Dataset picker */}
          <section className="space-y-4 rounded-lg border border-black/10 bg-neutral-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="block pl-1 text-sm font-semibold uppercase text-neutral-900">
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

          {/* Feature Selection (Collapsible) - only show when dataset is selected */}
          {selectedDatasetId && (
            <FeatureSelectionSection
              disabled={isProcessing}
              availableFeatures={availableFeatures}
              selectedFeatures={selectedFeatures}
              setSelectedFeatures={setSelectedFeatures}
              isLoading={featuresLoading}
              error={featuresError}
            />
          )}

          {/* Advanced Settings (Collapsible) */}
          <AdvancedSettingsSection
            disabled={isProcessing}
            numTimePoints={numTimePoints}
            setNumTimePoints={setNumTimePoints}
            regularization={regularization}
            setRegularization={setRegularization}
            objectiveFunction={objectiveFunction}
            setObjectiveFunction={setObjectiveFunction}
            marginalLossType={marginalLossType}
            setMarginalLossType={setMarginalLossType}
            cParamSearchScope={cParamSearchScope}
            setCParamSearchScope={setCParamSearchScope}
            coxFeatureSelection={coxFeatureSelection}
            setCoxFeatureSelection={setCoxFeatureSelection}
            mrmrFeatureSelection={mrmrFeatureSelection}
            setMrmrFeatureSelection={setMrmrFeatureSelection}
            mtlrPredictor={mtlrPredictor}
            setMtlrPredictor={setMtlrPredictor}
            tuneParameters={tuneParameters}
            setTuneParameters={setTuneParameters}
            useSmoothedLogLikelihood={useSmoothedLogLikelihood}
            setUseSmoothedLogLikelihood={setUseSmoothedLogLikelihood}
            usePredefinedFolds={usePredefinedFolds}
            setUsePredefinedFolds={setUsePredefinedFolds}
            runCrossValidation={runCrossValidation}
            setRunCrossValidation={setRunCrossValidation}
            standardizeFeatures={standardizeFeatures}
            setStandardizeFeatures={setStandardizeFeatures}
          />

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
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
                          title="Remove"
                          onClick={() => removeRow(r.id)}
                          disabled={isProcessing}
                          aria-label="Remove user"
                        >
                          <X className="h-3.5 w-3.5" />
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

      {/* Creating Predictor Modal */}
      {trainingStep === "creating" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
              <h3 className="text-lg font-semibold">Creating predictor…</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Setting up your predictor in the database.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Training Modal with close button */}
      {showTrainingModal && createdPredictorId && (
        <TrainingModal
          predictorId={createdPredictorId}
          onClose={() => {
            setShowTrainingModal(false);
            navigate("/dashboard", { state: { tab: "predictors" } });
          }}
          autoNavigateOnComplete={false}
        />
      )}

      {/* Error Modal */}
      {trainingStep === "error" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-800">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">
                Training failed
              </h3>
              <p className="mt-2 text-sm text-neutral-700">{trainingError}</p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => {
                    setTrainingStep("idle");
                    setTrainingError(null);
                  }}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
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

interface AdvancedSettingsProps {
  disabled: boolean;
  numTimePoints: string | number;
  setNumTimePoints: (v: string | number) => void;
  regularization: "l1" | "l2";
  setRegularization: (v: "l1" | "l2") => void;
  objectiveFunction:
    | "log-likelihood"
    | "l2 marginal loss"
    | "log-likelihood & L2ML";
  setObjectiveFunction: (
    v: "log-likelihood" | "l2 marginal loss" | "log-likelihood & L2ML"
  ) => void;
  marginalLossType: "weighted" | "unweighted";
  setMarginalLossType: (v: "weighted" | "unweighted") => void;
  cParamSearchScope: "basic" | "fine" | "extremely fine";
  setCParamSearchScope: (v: "basic" | "fine" | "extremely fine") => void;
  coxFeatureSelection: boolean;
  setCoxFeatureSelection: (v: boolean) => void;
  mrmrFeatureSelection: boolean;
  setMrmrFeatureSelection: (v: boolean) => void;
  mtlrPredictor: "stable" | "testing1";
  setMtlrPredictor: (v: "stable" | "testing1") => void;
  tuneParameters: boolean;
  setTuneParameters: (v: boolean) => void;
  useSmoothedLogLikelihood: boolean;
  setUseSmoothedLogLikelihood: (v: boolean) => void;
  usePredefinedFolds: boolean;
  setUsePredefinedFolds: (v: boolean) => void;
  runCrossValidation: boolean;
  setRunCrossValidation: (v: boolean) => void;
  standardizeFeatures: boolean;
  setStandardizeFeatures: (v: boolean) => void;
}

function AdvancedSettingsSection({
  disabled,
  numTimePoints,
  setNumTimePoints,
  regularization,
  setRegularization,
  objectiveFunction,
  setObjectiveFunction,
  marginalLossType,
  setMarginalLossType,
  cParamSearchScope,
  setCParamSearchScope,
  coxFeatureSelection,
  setCoxFeatureSelection,
  mrmrFeatureSelection,
  setMrmrFeatureSelection,
  mtlrPredictor,
  setMtlrPredictor,
  tuneParameters,
  setTuneParameters,
  useSmoothedLogLikelihood,
  setUseSmoothedLogLikelihood,
  usePredefinedFolds,
  setUsePredefinedFolds,
  runCrossValidation,
  setRunCrossValidation,
  standardizeFeatures,
  setStandardizeFeatures,
}: AdvancedSettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className="space-y-4 rounded-lg border border-black/10 bg-neutral-50 p-4">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        disabled={disabled}
        className="flex w-full items-center justify-between text-left disabled:opacity-60"
      >
        <h2 className="block text-sm font-semibold uppercase text-neutral-900">
          Advanced Settings
        </h2>
        <ChevronDown
          className={`h-4 w-4 text-neutral-600 transition-transform ${
            showAdvanced ? "rotate-180" : ""
          }`}
        />
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-1 gap-6 pt-2 sm:grid-cols-2">
          <div>
            <label
              htmlFor="num_time_points"
              className="block text-sm font-medium text-neutral-700"
            >
              Number of Time Points
            </label>
            <input
              type="number"
              id="num_time_points"
              value={numTimePoints}
              onChange={(e) => setNumTimePoints(e.target.value)}
              disabled={disabled}
              placeholder="Optional"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Leave blank to use default (sqrt of sample size).
            </p>
          </div>

          <div>
            <label
              htmlFor="regularization"
              className="block text-sm font-medium text-neutral-700"
            >
              Regularization
            </label>
            <select
              id="regularization"
              value={regularization}
              onChange={(e) =>
                setRegularization(e.target.value as "l1" | "l2")
              }
              disabled={disabled}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
            >
              <option value="l1">L1</option>
              <option value="l2">L2</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="objective_function"
              className="block text-sm font-medium text-neutral-700"
            >
              Objective Function
            </label>
            <select
              id="objective_function"
              value={objectiveFunction}
              onChange={(e) =>
                setObjectiveFunction(
                  e.target.value as
                    | "log-likelihood"
                    | "l2 marginal loss"
                    | "log-likelihood & L2ML"
                )
              }
              disabled={disabled}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
            >
              <option value="log-likelihood">Log-likelihood</option>
              <option value="l2 marginal loss">L2 marginal loss</option>
              <option value="log-likelihood & L2ML">
                Log-likelihood &amp; L2ML
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="marginal_loss_type"
              className="block text-sm font-medium text-neutral-700"
            >
              Marginal Loss Type
            </label>
            <select
              id="marginal_loss_type"
              value={marginalLossType}
              onChange={(e) =>
                setMarginalLossType(
                  e.target.value as "weighted" | "unweighted"
                )
              }
              disabled={disabled}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
            >
              <option value="weighted">Weighted</option>
              <option value="unweighted">Unweighted</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="c_param_search_scope"
              className="block text-sm font-medium text-neutral-700"
            >
              C-parameter search scope
            </label>
            <select
              id="c_param_search_scope"
              value={cParamSearchScope}
              onChange={(e) =>
                setCParamSearchScope(
                  e.target.value as "basic" | "fine" | "extremely fine"
                )
              }
              disabled={disabled}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
            >
              <option value="basic">Basic</option>
              <option value="fine">Fine</option>
              <option value="extremely fine">Extremely fine</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="mtlr_predictor"
              className="block text-sm font-medium text-neutral-700"
            >
              MTLR predictor
            </label>
            <select
              id="mtlr_predictor"
              value={mtlrPredictor}
              onChange={(e) =>
                setMtlrPredictor(e.target.value as "stable" | "testing1")
              }
              disabled={disabled}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-gray-100"
            >
              <option value="stable">Stable</option>
              <option value="testing1">Testing1</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
            {[
              {
                state: coxFeatureSelection,
                setState: setCoxFeatureSelection,
                label: "Use Cox feature selection",
                id: "cox_feature_selection_create",
              },
              {
                state: mrmrFeatureSelection,
                setState: setMrmrFeatureSelection,
                label: "Use MRMR feature selection",
                id: "mrmr_feature_selection_create",
              },
              {
                state: tuneParameters,
                setState: setTuneParameters,
                label: "Tune parameters",
                id: "tune_parameters_create",
              },
              {
                state: useSmoothedLogLikelihood,
                setState: setUseSmoothedLogLikelihood,
                label: "Use smoothed log-likelihood",
                id: "use_smoothed_log_likelihood_create",
              },
              {
                state: usePredefinedFolds,
                setState: setUsePredefinedFolds,
                label: "Use predefined folds",
                id: "use_predefined_folds_create",
              },
              {
                state: runCrossValidation,
                setState: setRunCrossValidation,
                label: "Run cross-validation",
                id: "run_cross_validation_create",
              },
              {
                state: standardizeFeatures,
                setState: setStandardizeFeatures,
                label: "Standardize features",
                id: "standardize_features_create",
              },
            ].map((cb) => (
              <div className="flex items-center" key={cb.id}>
                <input
                  type="checkbox"
                  id={cb.id}
                  checked={cb.state}
                  onChange={(e) => cb.setState(e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 disabled:opacity-50"
                />
                <label
                  htmlFor={cb.id}
                  className="ml-2 block text-sm text-neutral-900"
                >
                  {cb.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

interface FeatureSelectionProps {
  disabled: boolean;
  availableFeatures: string[];
  selectedFeatures: Set<string>;
  setSelectedFeatures: (features: Set<string>) => void;
  isLoading: boolean;
  error: string | null;
}

function FeatureSelectionSection({
  disabled,
  availableFeatures,
  selectedFeatures,
  setSelectedFeatures,
  isLoading,
  error,
}: FeatureSelectionProps) {
  const [showFeatures, setShowFeatures] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Filter features based on search
  const filteredFeatures = useMemo(() => {
    if (!searchQuery) return availableFeatures;
    return availableFeatures.filter((f) =>
      f.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, availableFeatures]);

  // Pagination
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredFeatures.length / pageSize)),
    [filteredFeatures.length, pageSize]
  );

  const currentFeatures = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredFeatures.slice(start, start + pageSize);
  }, [filteredFeatures, page, pageSize]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize]);

  // Ensure page is valid
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // Handlers
  const handleToggleFeature = (feature: string) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(feature)) newSelected.delete(feature);
    else newSelected.add(feature);
    setSelectedFeatures(newSelected);
  };

  const handleSelectAll = () => setSelectedFeatures(new Set(availableFeatures));
  const handleDeselectAll = () => setSelectedFeatures(new Set());

  return (
    <section className="space-y-4 rounded-lg border border-black/10 bg-neutral-50 p-4">
      <button
        type="button"
        onClick={() => setShowFeatures(!showFeatures)}
        disabled={disabled}
        className="flex w-full items-center justify-between text-left disabled:opacity-60"
      >
        <div>
          <h2 className="block text-sm font-semibold uppercase text-neutral-900">
            Feature Selection
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            {selectedFeatures.size} / {availableFeatures.length} features
            selected
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-neutral-600 transition-transform ${
            showFeatures ? "rotate-180" : ""
          }`}
        />
      </button>

      {showFeatures && (
        <div className="pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
              <span className="ml-2 text-sm text-neutral-500">
                Loading features…
              </span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" />
              <span>{error}</span>
            </div>
          ) : availableFeatures.length === 0 ? (
            <div className="rounded-md bg-neutral-100 p-3 text-center text-sm text-neutral-500">
              No features available for this dataset.
            </div>
          ) : (
            <div className="rounded-md border border-neutral-300 bg-white">
              {/* Search and actions bar */}
              <div className="flex items-center gap-2 border-b bg-neutral-50 p-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={disabled}
                  className="flex-1 rounded-md border border-neutral-300 p-2 text-sm disabled:bg-gray-100"
                  placeholder="Search for features..."
                />
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={disabled}
                  className="text-sm text-neutral-800 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  disabled={disabled}
                  className="text-sm text-neutral-800 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Deselect all
                </button>
              </div>

              {/* Feature list */}
              <div className="max-h-72 overflow-y-auto">
                {currentFeatures.map((feature) => (
                  <label
                    key={feature}
                    className="flex cursor-pointer items-center gap-3 border-t p-3 hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFeatures.has(feature)}
                      onChange={() => handleToggleFeature(feature)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 disabled:opacity-50"
                    />
                    <span className="text-sm font-mono">{feature}</span>
                  </label>
                ))}
                {currentFeatures.length === 0 && (
                  <p className="p-4 text-center text-sm text-neutral-500">
                    No features found.
                  </p>
                )}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t bg-neutral-50 p-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>Entries per page:</span>
                  <select
                    className="rounded-md border border-neutral-300 p-1 text-sm disabled:bg-gray-100"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    disabled={disabled}
                  >
                    {[5, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  {page > 1 && (
                    <button
                      type="button"
                      className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50 disabled:opacity-50"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={disabled}
                    >
                      Prev
                    </button>
                  )}
                  <span className="px-2 text-sm text-neutral-600">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <button
                      type="button"
                      className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50 disabled:opacity-50"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={disabled}
                    >
                      Next
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
