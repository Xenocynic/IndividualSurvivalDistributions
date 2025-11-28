import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { FolderSelector } from "../components/folder";
import { listMyDatasets } from "../lib/datasets";
import { toDatasetItem } from "../lib/mappers";
import {
    getPredictor,
    updatePredictor,
    grantPredictorViewer,
    trainPredictor,
    createPredictor,
    listMyPredictors
} from "../lib/predictors";
import type { Predictor } from "../lib/predictors";
import { UserSearchInput, type UserSuggestion } from "../components/UserSearchInput";
import { resolveUsernameToId } from "../lib/users";

type PermRow = {
    id: number;
    username: string;
    role: "owner" | "viewer";
    userId?: number;
};

type TrainingStep = "idle" | "creating" | "training" | "complete" | "error";

export default function PredictorDraftEdit() {
    const navigate = useNavigate();
    const { id } = useParams();
    const draftId = Number(id);

    // core state
    const [loading, setLoading] = useState(true);
    const [predictor, setPredictor] = useState<Predictor | null>(null);

    // form fields
    const [name, setName] = useState("");
    const [notes, setNotes] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    // dataset selection
    const [query, setQuery] = useState("");
    const [datasets, setDatasets] = useState<any[]>([]);
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

    // permissions
    const [rows, setRows] = useState<PermRow[]>([]);

    // training modal
    const [trainingStep, setTrainingStep] = useState<TrainingStep>("idle");
    const [trainingError, setTrainingError] = useState<string | null>(null);
    const [createdPredictorId, setCreatedPredictorId] = useState<number | null>(null);

    // leave-prompt
    const [showLeavePrompt, setShowLeavePrompt] = useState(false);
    const dirtyRef = useRef(false);

    // name availability
    const [checking, setChecking] = useState(false);
    const [nameTaken, setNameTaken] = useState<boolean | null>(null);

    // ---------------------------------------------
    // Load the Draft Predictor
    // ---------------------------------------------
    useEffect(() => {
        async function load() {
            const p = await getPredictor(draftId);
            if (!p) return;

            setPredictor(p);

            setName(p.name);
            setNotes(p.description);
            setIsPublic(!p.is_private);
            setSelectedDatasetId(p.dataset_id ? String(p.dataset_id) : null);
            setSelectedFolderId(p.folder_id ? String(p.folder_id) : null);

            const perms = Array.isArray(p.permissions) ? p.permissions : [];
            setRows(
                perms.map((perm) => ({
                    id: perm.user.id,
                    username: perm.user.username,
                    role: perm.role,
                    userId: perm.user.id,
                }))
            );

            setLoading(false);
        }
        load();
    }, [draftId]);

    // ---------------------------------------------
    // Load datasets
    // ---------------------------------------------
    useEffect(() => {
        (async () => {
            const api = await listMyDatasets();
            const ui = api.map((d) => {
                const m = toDatasetItem(d);
                return { id: String(m.id), title: m.title, notes: m.notes, owner: m.owner };
            });
            setDatasets(ui);
        })();
    }, []);

    useEffect(() => {
        if (predictor?.dataset_id) {
            setSelectedDatasetId(String(predictor.dataset_id));
        }
    }, [datasets, predictor]);

    useEffect(() => {
        dirtyRef.current =
            !!name.trim() ||
            !!notes.trim() ||
            !!selectedDatasetId ||
            !!selectedFolderId ||
            rows.some((r) => r.username.trim());
    }, [name, notes, selectedDatasetId, selectedFolderId, rows]);

    // ---------------------------------------------
    // Name Availability Check (same as PredictorCreate)
    // ---------------------------------------------
    useEffect(() => {
        let cancelled = false;

        async function checkName() {
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
                        ((p.name ?? p.predictor_name ?? "") + "").toLowerCase() === trimmed.toLowerCase() &&
                        p.predictor_id !== draftId // allow own draft
                );
                if (!cancelled) setNameTaken(exists);
            } catch {
                if (!cancelled) setNameTaken(null);
            } finally {
                if (!cancelled) setChecking(false);
            }
        }

        const t = setTimeout(checkName, 300);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [name, draftId]);

    // dataset filtering
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return datasets.filter((d) => (q ? d.title.toLowerCase().includes(q) : true));
    }, [datasets, query]);

    // allow save?
    const canSave =
        !!name.trim() && !nameTaken && !!selectedDatasetId && trainingStep === "idle";

    const isProcessing = trainingStep !== "idle";

    // ---------------------------------------------
    // Save as Draft
    // ---------------------------------------------
    async function saveDraft() {

        if (!selectedDatasetId) {
            alert("Please select a dataset before saving the draft.");
            return;
        }

        try {
            const draft = await updatePredictor(draftId, {
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

            for (const row of rows) {
                const username = row.username.trim();
                if (!username) continue;

                let userId = row.userId;
                if (!userId) userId = await resolveUsernameToId(username);
                if (!userId) continue;

                try {
                    await grantPredictorViewer(draft.predictor_id, userId, row.role);
                } catch (e) {
                    console.error("Grant failed", e);
                }
            }

            navigate("/dashboard", { state: { tab: "predictors" } });
        } catch (e) {
            alert("Failed to save draft");
        }
    }

    // ---------------------------------------------
    // Train & Save (similar to create flow)
    // ---------------------------------------------
    async function onTrainAndSave() {
        if (!canSave) return;

        setTrainingStep("training");
        setTrainingError(null);

        try {
            const datasetId = Number(selectedDatasetId);

            // Step 1 — train model
            const trainingResult = await trainPredictor(datasetId, {
                parameters: {
                    n_epochs: 100,
                    dropout: 0.2,
                    neurons: [64, 64],
                    n_exp: 10,
                },
            });

            if (!trainingResult || !trainingResult.model_id) {
                throw new Error("Training did not return a valid model_id");
            }

            setTrainingStep("creating");

            // Step 2 — update the draft into a fully trained predictor
            const finalPredictor = await updatePredictor(draftId, {
                name: name.trim(),
                description: notes.trim(),
                dataset_id: datasetId,
                folder_id: selectedFolderId || undefined,
                is_private: !isPublic,
                ml_training_status: "trained",
                ml_model_metrics: trainingResult.metrics || {},
                ml_selected_features: trainingResult.selected_features,
                model_id: trainingResult.model_id,
                ml_trained_at: trainingResult.trained_at,
            });

            setCreatedPredictorId(finalPredictor.predictor_id);

            // Step 3 — permissions
            for (const row of rows) {
                const username = row.username.trim();
                if (!username) continue;

                let userId = row.userId;
                if (!userId) userId = await resolveUsernameToId(username);
                if (!userId) continue;

                try {
                    await grantPredictorViewer(finalPredictor.predictor_id, userId, row.role);
                } catch { }
            }

            // Step 4 — success
            setTrainingStep("complete");

            setTimeout(() => {
                navigate(`/predictors/${finalPredictor.predictor_id}`);
            }, 2000);
        } catch (err: any) {
            setTrainingStep("error");
            setTrainingError(err.message || "Failed to train predictor");
        }
    }

    function onBack() {
        if (isProcessing) return;
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

    if (loading) return <div className="p-6">Loading draft…</div>;

    return (
        <div className="min-h-[60vh] bg-white">
            {/* Sticky sub-header */}
            <div className="sticky top-[var(--app-nav-h,3.5rem)] z-40 w-full border-b bg-neutral-700 text-white">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-2.5">
                    <button
                        onClick={onBack}
                        disabled={isProcessing}
                        className="rounded-md bg-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-500 disabled:opacity-50"
                    >
                        Back
                    </button>
                    <div className="text-sm font-semibold tracking-wide">Edit Draft Predictor</div>
                    <button
                        onClick={onTrainAndSave}
                        disabled={!canSave}
                        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
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
            <div className="mx-auto max-w-3xl space-y-8 p-4">

                {/* Name */}
                <section className="space-y-2">
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500">
                        Name
                    </label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isProcessing}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="A concise predictor name"
                    />
                    <div className="min-h-[1.25rem] text-xs">
                        {name ? (
                            checking ? (
                                <span className="text-neutral-500">Checking availability…</span>
                            ) : nameTaken === true ? (
                                <span className="text-red-600">This name is already taken.</span>
                            ) : nameTaken === false ? (
                                <span className="text-green-600">Name is available.</span>
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
                </section>

                {/* Notes */}
                <section className="space-y-2">
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500">
                        Notes
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isProcessing}
                        rows={4}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="Optional description"
                    />
                </section>

                {/* Folder Selection */}
                <section className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700">
                        Organization
                    </label>
                    <FolderSelector
                        selectedFolderId={selectedFolderId}
                        onFolderSelect={setSelectedFolderId}
                        disabled={isProcessing}
                        placeholder="Select a folder (optional)"
                    />
                </section>

                {/* Dataset Picker */}
                <section className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-semibold uppercase text-neutral-500">
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
                                                className={`block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 ${selected ? "bg-neutral-100" : ""
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="font-medium">{ds.title}</div>
                                                    <div className="text-[11px] text-neutral-600">
                                                        {ds.owner ? "Owner" : "Viewer"}
                                                    </div>
                                                </div>
                                                {ds.notes && (
                                                    <div className="mt-0.5 text-xs text-neutral-600">
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
                </section>

                {/* Visibility */}
                <section className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase text-neutral-500">
                        Visibility
                    </div>
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            disabled={isProcessing}
                            className="h-4 w-4 accent-neutral-900"
                        />
                        <span className="text-sm">Make Predictor Public</span>
                    </label>
                </section>

                {/* Permissions */}
                <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-800">
                        Customize visibility and permissions
                    </h3>
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
                                            disabled={isProcessing}
                                        />
                                    </div>

                                    <select
                                        value={r.role}
                                        onChange={(e) =>
                                            updateRow(r.id, {
                                                role: e.target.value as PermRow["role"],
                                            })
                                        }
                                        disabled={isProcessing}
                                        className="w-40 rounded-md border px-2 py-1 text-sm"
                                    >
                                        <option value="owner">Owner</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between border-t bg-neutral-100 px-3 py-2">
                            <button
                                onClick={addRow}
                                disabled={isProcessing}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
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
                    onSaveDraft={saveDraft}
                />
            )}
        </div>
    );
}

/* -----------------------------------------
   Training Modal (similar to Create)
----------------------------------------- */
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
            <div className="w-full max-w-md rounded-lg bg-white p-6">
                {step === "creating" && (
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900"></div>
                        <h3 className="text-lg font-semibold">Creating Predictor...</h3>
                    </div>
                )}

                {step === "training" && (
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                        <h3 className="text-lg font-semibold">Training ML Model...</h3>
                        <p className="mt-2 text-sm text-neutral-600">
                            This may take a few minutes. Don’t close this page.
                        </p>
                    </div>
                )}

                {step === "complete" && (
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
                            ✓
                        </div>
                        <h3 className="text-lg font-semibold">Training Complete!</h3>
                    </div>
                )}

                {step === "error" && (
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl">
                            ✕
                        </div>
                        <h3 className="text-lg font-semibold">Training Failed</h3>
                        <p className="mt-2 text-sm text-red-600">{error}</p>

                        <button
                            onClick={onRetry}
                            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* -----------------------------------------
   Leave Prompt
----------------------------------------- */
function ConfirmLeave({
    onCancel,
    onContinue,
    onSaveDraft,
}: {
    onCancel: () => void;
    onContinue: () => void;
    onSaveDraft: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-md bg-white p-4">
                <h3 className="text-base font-semibold">Leave without saving?</h3>
                <p className="mt-1 text-sm text-neutral-600">
                    Your changes will be lost.
                </p>

                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="rounded-md border px-3 py-1.5 text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onContinue}
                        className="rounded-md border px-3 py-1.5 text-sm"
                    >
                        Continue
                    </button>
                    <button
                        onClick={onSaveDraft}
                        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
                    >
                        Save as Draft
                    </button>
                </div>
            </div>
        </div>
    );
}
