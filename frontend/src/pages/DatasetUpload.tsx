/**
 * Upload Dataset
 *
 * UX notes:
 * - Sticky grey header with Back / title / Save
 * - "Back" warns if there are unsaved changes
 * - Name field checks availability (client-side for now via listMyDatasets)
 * - Notes is UI-only (persist when backend adds a field)
 * - File format help is collapsible
 * - File upload is a simple input (drop / click); replace with real uploader later
 * - Time unit buttons (Year / Month / Day / Hour)
 * - Public/Private toggle with a help blurb
 * - Save - creates dataset object, then returns to Dashboard on the Datasets tab
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDataset,
  listMyDatasets,
  type CreateDatasetRequest,
} from "../lib/datasets";
import { FolderSelector } from "../components/folder";

type PermRow = {
  id: number; // local row id
  username: string; // text the user typed (later - lookup user id)
  role: "owner" | "viewer"; // UI role
};

type TimeUnit = "year" | "month" | "day" | "hour";

export default function DatasetUpload() {
  const navigate = useNavigate();

  // form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showFormatHelp, setShowFormatHelp] = useState(true);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("month");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // permissions rows (UI-only for now)
  const [rows, setRows] = useState<PermRow[]>([
    { id: 1, username: "", role: "owner" }, // example empty line to start
  ]);

  // meta state
  const [checking, setChecking] = useState(false);
  const [nameTaken, setNameTaken] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);

  // local detection to decide whether to warn
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current =
      !!name.trim() ||
      !!notes.trim() ||
      !!file ||
      isPublic ||
      timeUnit !== "month" ||
      !!selectedFolderId ||
      rows.some((r) => r.username.trim());
  }, [name, notes, file, isPublic, timeUnit, selectedFolderId, rows]);

  // check name availability (client-side)
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
        const mine = await listMyDatasets(); // API wrapper
        // NOTE: case-insensitive compare
        const exists = mine.some(
          (d) => d.dataset_name.toLowerCase() === trimmed.toLowerCase()
        );
        if (!cancelled) setNameTaken(exists);
      } catch {
        // If this fails, don't block user; just show "unknown"
        if (!cancelled) setNameTaken(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    // Small debounce
    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name]);

  // “valid” when the required bits are present
  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (nameTaken) return false;
    if (!file) return false;
    return true;
  }, [name, nameTaken, file]);

  // Save - create dataset object with file upload
  const onSave = async () => {
    if (!canSave || saving || !file) return;
    setSaving(true);
    try {
      const request: CreateDatasetRequest = {
        dataset_name: name.trim(),
        file: file,
        notes: notes.trim() || undefined,
        time_unit: timeUnit,
        is_public: isPublic,
        folder_id: selectedFolderId || undefined,
      };

      const created = await createDataset(request);

      // Route to dashboard with the Datasets tab selected
      navigate("/dashboard", {
        state: {
          tab: "datasets",
          justCreatedId: created.dataset_id,
          folderAssigned: selectedFolderId ? true : false,
          folderName: selectedFolderId ? "folder" : undefined,
        },
      });
    } catch (err: any) {
      // Handle different types of errors
      let errorMessage = "Failed to save dataset. Please try again.";

      if (err?.details) {
        // Handle validation errors from the backend
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
    if (dirtyRef.current) {
      setShowLeavePrompt(true);
    } else {
      navigate("/dashboard", { state: { tab: "datasets" } });
    }
  };

  // manage-permissions table handlers
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

  // simple drop handler (visual only)
  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div className="min-h-[60vh] bg-white">
      {/* Sticky sub-header under global nav (match PredictorCreate) */}
      <div className="sticky top-[var(--app-nav-h,3.5rem)] z-40 w-full border-b bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-2.5">
          <button
            onClick={onBack}
            className="rounded-md bg-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-500"
          >
            Back
          </button>
          <div className="text-sm font-semibold tracking-wide">Upload Dataset</div>
          <button
            onClick={onSave}
            disabled={!canSave || saving}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="h-1 w-full bg-neutral-600" />
      </div>

      {/* Body — single centered column (match PredictorCreate) */}
      <div className="mx-auto max-w-3xl space-y-8 p-4">
        {/* Name */}
        <section className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
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
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            placeholder="A concise dataset name"
          />
          <div className="flex justify-between items-start min-h-[1.25rem] text-xs">
            <div>
              {name ? (
                checking ? (
                  <span className="text-neutral-500">Checking availability…</span>
                ) : nameTaken === true ? (
                  <span className="text-red-600">This name is already taken.</span>
                ) : nameTaken === false ? (
                  <span className="text-green-600">Name is available. Proceed!</span>
                ) : (
                  <span className="text-neutral-500">
                    Could not verify name; you can still proceed.
                  </span>
                )
              ) : (
                <span className="text-neutral-500">
                  This maps to <code>dataset_name</code>.
                </span>
              )}
            </div>
            <span
              className={`text-xs ${
                name.length > 45
                  ? "text-red-600"
                  : name.length > 40
                  ? "text-orange-600"
                  : "text-neutral-400"
              }`}
            >
              {name.length}/50
            </span>
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
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
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            placeholder="Optional description (maps to backend 'notes')."
          />
          <div className="flex justify-end">
            <span
              className={`text-xs ${
                notes.length > 180
                  ? "text-red-600"
                  : notes.length > 160
                  ? "text-orange-600"
                  : "text-neutral-400"
              }`}
            >
              {notes.length}/200
            </span>
          </div>
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
            Organize your dataset by adding it to a folder. You can create a new
            folder or select an existing one.
          </div>
        </section>

        {/* Delimited Dataset / File format + uploader */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Delimited Dataset
            </div>
            <button
              onClick={() => setShowFormatHelp((v) => !v)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
            >
              {showFormatHelp ? "Hide" : "Show"}
            </button>
          </div>

          {showFormatHelp && (
            <div className="rounded-md border bg-neutral-50 p-3 text-xs text-neutral-700">
              <div className="font-medium">File Format</div>
              <p className="mt-1 leading-relaxed">
                Put formatting guide here (placeholder for now).
              </p>
            </div>
          )}

          {/* Upload box */}
          <label
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="grid cursor-pointer place-items-center rounded-md border-2 border-dashed border-neutral-300 bg-white py-10 text-center hover:bg-neutral-50"
          >
            <input
              type="file"
              accept=".csv,.tsv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div>
              <div className="text-3xl">☁️</div>
              <div className="mt-1 text-sm">
                {file ? <strong>{file.name}</strong> : "Click to choose a file or drag it here"}
              </div>
              <div className="text-xs text-neutral-500">CSV recommended</div>
            </div>
          </label>
        </section>

        {/* Time Unit */}
        <section className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Time Unit</div>
          <div className="inline-flex overflow-hidden rounded-md border bg-white">
            {(["year", "month", "day", "hour"] as TimeUnit[]).map((unit) => (
              <button
                key={unit}
                onClick={() => setTimeUnit(unit)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  timeUnit === unit ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
          <div className="rounded-md bg-gray-100 p-2 text-xs text-gray-700">
            Specify the time scale used by this dataset (e.g., survival
            durations recorded in months).
          </div>
        </section>

        {/* Visibility */}
        <section className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Visibility</div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 accent-neutral-900"
            />
            <span className="text-sm">Make Dataset Public</span>
          </label>
          <div className="rounded-md border bg-neutral-50 p-2 text-xs text-neutral-700">
            If enabled, other users can discover and view this dataset. (Viewers
            can use datasets, but only the owner can modify or delete.)
          </div>
        </section>

        {/* Manage permissions */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">
            Customize visibility and permissions
          </h3>
          <div className="rounded-md border">
            <div className="grid grid-cols-2 border-b bg-neutral-100 px-3 py-2 text-xs font-semibold">
              <div>Users</div>
              <div>Permissions</div>
            </div>

            {/* rows */}
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
                      onChange={(e) =>
                        updateRow(r.id, {
                          role: e.target.value as PermRow["role"],
                        })
                      }
                      className="w-40 rounded-md border px-2 py-1 text-sm"
                    >
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* add row */}
            <div className="flex items-center justify-between border-t bg-neutral-100 px-3 py-2">
              <button
                onClick={addRow}
                className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
              >
                + Add
              </button>
              <div className="text-[11px] text-neutral-600">
                Viewers can use the dataset for predictor training.
                {/* TODO[backend]: implement user search, then POST role grants after create. */}
              </div>
            </div>
          </div>
        </section>

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
    </div>
  );
}

/** "are you sure?" modal — match PredictorCreate modal style */
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
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

