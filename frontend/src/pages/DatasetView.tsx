/**
 * View Dataset (Read-only)
 * Consistent grey palette + sharp edges + sticky header offset by global navbar height.
 */

import { useEffect, useState , useCallback, useMemo} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDataset, getDatasetStats, downloadDatasetFile, isUserOwner, type Dataset, type DatasetStats } from "../lib/datasets";
import LinkedPredictorsList from "../components/LinkedPredictorsList";
import {
  formatInteger,
  formatWithUnit,
  InfoItem,
  FeatureCorrelationTable,
  EventHistogramChart
} from "./PredictorDetailPage";

const MAX_HISTOGRAM_BARS = 40;
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

  // Dataset statistics
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Fetch dataset details
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

  // Fetch dataset stats
  useEffect(() => {
    if (!datasetId) return;
    setIsLoadingStats(true);
    getDatasetStats(datasetId)
      .then((data) => setStats(data))
      .catch((error) => {
        console.error("Failed to load dataset statistics", error);
        setStatsError("Failed to load dataset metrics.");
      })
      .finally(() => setIsLoadingStats(false));
  }, [datasetId]);

  const handleRefreshStats = useCallback(async () => {
    if (!datasetId) return;
    setIsRefreshing(true);
    setStatsError(null);
    try {
      const fresh = await getDatasetStats(datasetId, { refresh: true });
      setStats(fresh);
    } catch (error) {
      console.error("Failed to refresh dataset statistics", error);
      setStatsError("Failed to refresh dataset metrics. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
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

  // Derived values for rendering
  const generalStats = stats?.general_stats;
  const timeUnitLabel = generalStats?.time_unit || dataset?.time_unit;
  const hasTimeStats =
    generalStats &&
    [generalStats.time_min, generalStats.time_max, generalStats.time_mean, generalStats.time_median].some(
      (v) => v !== null && v !== undefined
    );
  const histogramBins = useMemo(
    () => stats?.event_time_histogram?.slice(0, MAX_HISTOGRAM_BARS) ?? [],
    [stats]
  );

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
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

        {/* Dataset Metrics Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 flex items-center justify-between">
            Dataset Metrics
            {datasetId && (
              <button
                onClick={handleRefreshStats}
                disabled={isRefreshing}
                className="rounded-md border bg-white px-3 py-1 text-xs text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? "Refreshing…" : "Refresh metrics"}
              </button>
            )}
          </h2>

          {isLoadingStats ? (
            <p className="text-sm text-neutral-500">Loading dataset statistics…</p>
          ) : statsError ? (
            <p className="text-sm text-red-600">{statsError}</p>
          ) : stats ? (
            <div className="rounded-md border bg-neutral-50 p-3 space-y-3">
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <InfoItem label="# Samples" value={formatInteger(generalStats?.num_samples)} />
                <InfoItem label="# Censored" value={formatInteger(generalStats?.num_censored)} />
                <InfoItem label="# Events" value={formatInteger(generalStats?.num_events)} />
                <InfoItem label="# Features" value={formatInteger(generalStats?.num_features)} />
                <InfoItem label="# Numeric Features" value={formatInteger(generalStats?.num_numeric_features)} />
                <InfoItem label="Time Unit" value={timeUnitLabel} />
              </dl>
              {hasTimeStats && (
                <dl className="grid grid-cols-2 gap-3">
                  <InfoItem label="Time Min" value={formatWithUnit(generalStats?.time_min, timeUnitLabel)} />
                  <InfoItem label="Time Max" value={formatWithUnit(generalStats?.time_max, timeUnitLabel)} />
                  <InfoItem label="Time Mean" value={formatWithUnit(generalStats?.time_mean, timeUnitLabel)} />
                  <InfoItem label="Time Median" value={formatWithUnit(generalStats?.time_median, timeUnitLabel)} />
                </dl>
              )}
              <div className="mt-3">
                <FeatureCorrelationTable rows={stats.feature_correlations ?? []} />
                <EventHistogramChart bins={histogramBins} timeUnit={timeUnitLabel} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Statistics are not available for this dataset yet. Click “Refresh metrics” to generate them.
            </p>
          )}
        </section>

        {/* Notes */}
        {dataset.notes && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-800">Notes</h2>
            <div className="rounded-md border bg-neutral-50 p-4 text-sm text-neutral-800 whitespace-pre-wrap">
              {dataset.notes}
            </div>
          </section>
        )}

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
