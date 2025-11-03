/**
 * Edit Dataset
 *
 * UX notes:
 * - Similar to DatasetUpload but for editing existing datasets
 * - File cannot be changed (show current file info)
 * - Name field checks availability (excluding current dataset)
 * - Pre-populate all fields with current values
 * - Save updates the dataset metadata
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getDataset,
  updateDataset,
  listMyDatasets,
  type Dataset,
} from "../lib/datasets";
import LinkedPredictorsList from "../components/LinkedPredictorsList";

type TimeUnit = "year" | "month" | "day" | "hour";

export default function DatasetEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const datasetId = id ? parseInt(id) : null;

  // form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("month");
  const [isPublic, setIsPublic] = useState(false);

  // dataset info
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [originalName, setOriginalName] = useState("");

  // meta state
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [nameTaken, setNameTaken] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // local detection to decide whether to warn
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    if (!dataset) {
      setIsDirty(false);
      return;
    }
    const hasChanges =
      name.trim() !== dataset.dataset_name ||
      notes.trim() !== (dataset.notes || "") ||
      timeUnit !== dataset.time_unit ||
      isPublic !== dataset.is_public;
    setIsDirty(hasChanges);
  }, [name, notes, timeUnit, isPublic, dataset]);

  // Load dataset data
  useEffect(() => {
    if (!datasetId) {
      setError("Invalid dataset ID");
      setLoading(false);
      return;
    }

    async function loadDataset() {
      try {
        const data = await getDataset(datasetId!);
        setDataset(data);
        setName(data.dataset_name);
        setOriginalName(data.dataset_name);
        setNotes(data.notes || "");
        setTimeUnit(data.time_unit);
        setIsPublic(data.is_public);
      } catch (err: any) {
        if (err?.status === 404) {
          setError("Dataset not found");
        } else if (err?.status === 403) {
          setError("You don't have permission to edit this dataset");
        } else {
          setError("Failed to load dataset");
        }
      } finally {
        setLoading(false);
      }
    }

    loadDataset();
  }, [datasetId]);

  // check name availability (client-side, excluding current dataset)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const trimmed = name.trim();
      if (!trimmed || trimmed === originalName) {
        setNameTaken(null);
        return;
      }
      setChecking(true);
      try {
        const mine = await listMyDatasets();
        // Check if name exists (excluding current dataset)
        const exists = mine.some(
          (d) =>
            d.dataset_name.toLowerCase() === trimmed.toLowerCase() &&
            d.dataset_id !== datasetId
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
  }, [name, originalName, datasetId]);

  // "valid" when the required bits are present and changed
  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (nameTaken) return false;
    if (!isDirty) return false; // No changes made
    return true;
  }, [name, nameTaken, isDirty]);

  // Save - update dataset
  const onSave = async () => {
    if (!canSave || saving || !datasetId) return;
    setSaving(true);
    try {
      const updateData = {
        dataset_name: name.trim(),
        notes: notes.trim() || undefined,
        time_unit: timeUnit,
        is_public: isPublic,
      };

      await updateDataset(datasetId, updateData);

      // Route back to dashboard
      navigate("/dashboard", { state: { tab: "datasets" } });
    } catch (err: any) {
      let errorMessage = "Failed to update dataset. Please try again.";

      if (err?.details) {
        if (typeof err.details === "object") {
          const errors = Object.entries(err.details)
            .map(
              ([field, messages]) =>
                `${field}: ${
                  Array.isArray(messages) ? messages.join(", ") : messages
                }`
            )
            .join("\n");
          errorMessage = `Validation errors:\n${errors}`;
        } else if (typeof err.details === "string") {
          errorMessage = err.details;
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }

      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (isDirty) {
      setShowLeavePrompt(true);
    } else {
      navigate("/dashboard", { state: { tab: "datasets" } });
    }
  };

  if (loading) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-700 mx-auto'></div>
          <div className='mt-2 text-sm text-gray-600'>Loading dataset...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center'>
        <div className='text-center'>
          <div className='text-red-600 text-lg font-semibold'>{error}</div>
          <button
            onClick={() =>
              navigate("/dashboard", { state: { tab: "datasets" } })
            }
            className='mt-4 rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800'
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-[60vh]'>
      {/* Sticky header */}
      <div className='sticky top-14 md:top-16 z-40 border-b border-black/10 bg-gray-400'>
        <div className='mx-auto flex max-w-4xl items-center justify-between px-3 py-3'>
          <button
            onClick={onBack}
            className='rounded border border-black/10 bg-white px-3 py-1.5 text-sm hover:bg-gray-100'
          >
            Back
          </button>
          <div className='font-semibold'>Edit Dataset</div>
          <button
            onClick={onSave}
            disabled={!canSave || saving}
            className='rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50'
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className='mx-auto max-w-4xl space-y-8 p-4'>
        {/* Name */}
        <section className='space-y-2'>
          <label className='block text-xs font-medium text-gray-700'>
            Name
          </label>
          <input
            value={name}
            onChange={(e) => {
              if (e.target.value.length <= 50) {
                setName(e.target.value);
              }
            }}
            maxLength={50}
            className='w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10'
            placeholder='A concise dataset name'
          />
          <div className='flex justify-between items-start min-h-[1.25rem] text-xs'>
            <div>
              {name && name.trim() !== originalName ? (
                checking ? (
                  <span className='text-gray-500'>Checking availability…</span>
                ) : nameTaken === true ? (
                  <span className='text-red-600'>
                    This name is already taken.
                  </span>
                ) : nameTaken === false ? (
                  <span className='text-green-600'>
                    Name is available. Proceed!
                  </span>
                ) : (
                  <span className='text-gray-500'>
                    Could not verify name; you can still proceed.
                  </span>
                )
              ) : (
                <span className='text-gray-500'>
                  This maps to <code>dataset_name</code>.
                </span>
              )}
            </div>
            <span
              className={`text-xs ${
                name.length > 40
                  ? "text-orange-600"
                  : name.length > 45
                  ? "text-red-600"
                  : "text-gray-400"
              }`}
            >
              {name.length}/50
            </span>
          </div>
        </section>

        {/* Notes */}
        <section className='space-y-2'>
          <label className='block text-xs font-medium text-gray-700'>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => {
              if (e.target.value.length <= 200) {
                setNotes(e.target.value);
              }
            }}
            maxLength={200}
            rows={4}
            className='w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10'
            placeholder='Optional notes for collaborators about this dataset (max 2 sentences).'
          />
          <div className='flex justify-end'>
            <span
              className={`text-xs ${
                notes.length > 160
                  ? "text-orange-600"
                  : notes.length > 180
                  ? "text-red-600"
                  : "text-gray-400"
              }`}
            >
              {notes.length}/200
            </span>
          </div>
        </section>

        {/* Current File Info */}
        <section className='space-y-3'>
          <div className='text-xs font-semibold text-gray-700'>
            Current File
          </div>
          <div className='rounded-md border border-black/10 bg-gray-50 p-3'>
            {dataset?.has_file ? (
              <div className='space-y-2'>
                <div className='flex items-center gap-2'>
                  <span className='text-2xl'>📄</span>
                  <div>
                    <div className='text-sm font-medium'>
                      {dataset.file_display_name || dataset.original_filename}
                    </div>
                    <div className='text-xs text-gray-500'>
                      {dataset.file_size_display} • Uploaded{" "}
                      {new Date(dataset.uploaded_at).toLocaleDateString()}
                    </div>

                    <div className='mt-2 flex gap-4 border-t border-black/5 pt-2'>
                      <div>
                        <div className='text-xs text-gray-500'>Features</div>
                        <div className='text-sm font-medium text-gray-800'>
                          {dataset.num_features ?? 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs text-gray-500'>Labels (Samples)</div>
                        <div className='text-sm font-medium text-gray-800'>
                          {dataset.num_labels ?? 'N/A'}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
                <div className='text-xs text-gray-600'>
                  Note: Files cannot be changed after upload. To use a different
                  file, create a new dataset.
                </div>
              </div>
            ) : (
              <div className='text-sm text-gray-600'>
                No file associated with this dataset.
              </div>
            )}
          </div>
        </section>

        {/* Time Unit */}
        <section className='space-y-2'>
          <div className='text-xs font-semibold text-gray-700'>Time Unit</div>
          <div className='inline-flex overflow-hidden rounded-md border border-black/10 bg-white'>
            {(["year", "month", "day", "hour"] as TimeUnit[]).map((unit) => (
              <button
                key={unit}
                onClick={() => setTimeUnit(unit)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  timeUnit === unit
                    ? "bg-black text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
          <div className='rounded-md bg-gray-100 p-2 text-xs text-gray-700'>
            Specify the time scale used by this dataset (e.g., survival
            durations recorded in months).
          </div>
        </section>

        {/* Visibility */}
        <section className='space-y-2'>
          <div className='text-xs font-semibold text-gray-700'>Visibility</div>
          <label className='flex items-center gap-3'>
            <input
              type='checkbox'
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className='h-4 w-4 accent-black'
            />
            <span className='text-sm'>Make Dataset Public</span>
          </label>
          <div className='rounded-md bg-gray-100 p-2 text-xs text-gray-700'>
            If enabled, other users can discover and view this dataset. (Viewers
            can use datasets, but only the owner can modify or delete.)
          </div>
        </section>

        {/* Connected Predictors */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-700">
            Predictors Using This Dataset
          </h2>
          <div className="rounded-md border border-black/10 bg-gray-50 p-3">
            {datasetId ? (
              <LinkedPredictorsList datasetId={datasetId} />
            ) : (
              <p className="text-sm text-gray-500">Could not load predictors.</p>
            )}
          </div>
        </section>
      </div>

      {/* Leave prompt */}
      {showLeavePrompt && (
        <ConfirmLeave
          onCancel={() => setShowLeavePrompt(false)}
          onContinue={() =>
            navigate("/dashboard", { state: { tab: "datasets" } })
          }
        />
      )}
    </div>
  );
}

/** "are you sure?" modal */
function ConfirmLeave({
  onCancel,
  onContinue,
}: {
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className='fixed inset-0 z-50 grid place-items-center bg-black/40 p-4'>
      <div className='w-full max-w-sm rounded-lg bg-white p-4 shadow-lg'>
        <h3 className='text-base font-semibold'>Leave without saving?</h3>
        <p className='mt-1 text-sm text-gray-600'>
          Your changes will not be saved if you return to the Dashboard.
        </p>
        <div className='mt-4 flex justify-end gap-2'>
          <button
            onClick={onCancel}
            className='rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50'
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className='rounded-md bg-black px-3 py-1.5 text-sm text-white'
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
