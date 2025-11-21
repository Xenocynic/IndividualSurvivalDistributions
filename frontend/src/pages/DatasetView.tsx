/**
 * View Dataset (Read-only)
 * Consistent grey palette + sharp edges + sticky header offset by global navbar height.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDataset, downloadDatasetFile, isUserOwner, type Dataset } from "../lib/datasets";
import LinkedPredictorsList from "../components/LinkedPredictorsList";
import { useAuth } from "../auth/AuthContext";

export default function DatasetView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const datasetId = id ? parseInt(id) : null;
  const { user } = useAuth(); 
  const currentUserId = (user as any)?.id ?? (user as any)?.pk;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // super cool function to handle going back to pages + maintaining a history of them
  // will update the PredictorDetailPage handling of this because I think maintaining a history
  // is good for routing
  const handleBack = () => {
    // if there's a prior location, use it
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    // fallback: Dashboard, Datasets tab - not sure why this tab-specific routing fails ngl
      navigate("/dashboard?tab=datasets", { replace: true });
  };

  useEffect(() => {
    if (!datasetId) {
      setError("Invalid dataset ID");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await getDataset(datasetId!);
        setDataset(data);
      } catch (err: any) {
        if (err?.status === 404) setError("Dataset not found");
        else if (err?.status === 403) setError("You don't have permission to view this dataset");
        else setError("Failed to load dataset");
      } finally {
        setLoading(false);
      }
    })();
  }, [datasetId]);

  const handleDownload = async () => {
    // if admin access blocked, show alert and return
    if (!dataset || !datasetId) return;

    const isOwner = isUserOwner(dataset.owner, currentUserId);
    const isAllowedAccess = dataset.allow_admin_access ?? false;

    if (!isOwner && !isAllowedAccess) {
      alert("Download blocked: External access to this dataset has been disabled.");
      return;
    }

    console.log("🔒 Security Check:", {
      datasetOwner: dataset.owner,     // e.g., 5
      myUserId: currentUserId,         // e.g., 99
      isOwnerResult: isOwner,          // Should be false
      allowAdmin: isAllowedAccess,     // Should be false
      RESULT: (isOwner || isAllowedAccess) ? "✅ PASSED (Request sending...)" : "❌ BLOCKED"
    });

    if (!datasetId || downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadDatasetFile(datasetId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Download failed: ${e?.message ?? "Unknown error"}`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-neutral-800" />
          <div className="mt-2 text-sm text-neutral-600">Loading dataset…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center">
          <div className="text-neutral-900 text-base font-semibold">{error}</div>
          <button
            onClick={() => navigate("/dashboard", { state: { tab: "datasets" } })}
            className="mt-4 rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!dataset) return null;

  return (
    <div className="min-h-[60vh] bg-white">
      {/* Sticky sub-header under the global nav */}
      <div className="sticky top-[var(--app-nav-h,3.5rem)] z-40 w-full border-b bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-2.5">
          <button
            onClick={handleBack}
            className="rounded-md bg-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-500"
          >
            Back
          </button>
          <div className="text-sm font-semibold tracking-wide">View Dataset</div>
          <div className="w-[76px]" />
        </div>
        <div className="h-1 w-full bg-neutral-600" />
      </div>

      {/* Body */}
      <div className="mx-auto max-w-4xl space-y-8 p-4">
        {/* Title */}
        <section className="text-center">
          <h1 className="text-xl font-semibold text-neutral-900">{dataset.dataset_name}</h1>
          <div className="mt-1 text-xs text-neutral-600">
            Owned by {dataset.owner_name} • Uploaded {new Date(dataset.uploaded_at).toLocaleDateString()}
          </div>
        </section>

        {/* Info Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Dataset Info */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-800">Dataset Information</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                  Time Unit
                </label>
                <div className="rounded-md border bg-neutral-50 px-3 py-2 text-sm capitalize">{dataset.time_unit}</div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                  Visibility
                </label>
                <div className="rounded-md border bg-neutral-50 px-3 py-2 text-sm">
                  {dataset.is_public ? (
                    <span className="inline-flex items-center gap-1">● Public</span>
                  ) : (
                    <span className="inline-flex items-center gap-1">● Private</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* File Info */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-800">File Information</h2>

            {dataset.has_file ? (
              <div className="space-y-3">
                <div className="rounded-md border bg-neutral-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📄</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {dataset.file_display_name || dataset.original_filename}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">{dataset.file_size_display}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex gap-4 border-t pt-2">
                  <div>
                    <div className="text-xs text-neutral-500">Features</div>
                    <div className="text-sm font-medium text-neutral-800">
                      {dataset.num_features ?? 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">Labels (Samples)</div>
                    <div className="text-sm font-medium text-neutral-800">
                      {dataset.num_labels ?? 'N/A'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {downloading ? "Downloading…" : "Download File"}
                </button>
              </div>
            ) : (
              <div className="rounded-md border bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                No file associated with this dataset.
              </div>
            )}
          </section>
        </div>

        {/* Notes */}
        {dataset.notes && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-800">Notes</h2>
            <div className="rounded-md border bg-neutral-50 p-4 text-sm text-neutral-800 whitespace-pre-wrap">
              {dataset.notes}
            </div>
          </section>
        )}

        {/* Processing blurb */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-800">Data Processing</h2>
          <div className="rounded-md border bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <div className="text-xl">✅</div>
              <div className="flex-1">
                <div className="mb-1 text-sm font-medium text-green-900">Automatic Feature Imputation</div>
                <p className="text-sm text-green-900/80">
                  Missing numeric values were replaced with column means; categorical with most frequent values.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Connected Predictors */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800">
            Predictors Using This Dataset
          </h2>
          {datasetId && <LinkedPredictorsList datasetId={datasetId} />}
        </section>
      </div>
    </div>
  );
}
