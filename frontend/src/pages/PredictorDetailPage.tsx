import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { api } from "../lib/apiClient";
import { getDatasetStats } from "../lib/datasets";
import type { DatasetStats } from "../lib/datasets";

// --- Type Definitions ---
interface PredictorDetail {
  predictor_id: number;
  name: string;
  description: string;
  dataset: {
    dataset_id: number;
    dataset_name: string;
  };
  owner: {
    id: number;
    username: string;
  };
  is_private: boolean;
  time_unit: 'hour' | 'day' | 'month' | 'year';
  num_time_points: number | null;
  regularization: 'l1' | 'l2';
  objective_function: 'log-likelihood' | 'l2 marginal loss' | 'log-likelihood & L2ML';
  marginal_loss_type: 'weighted' | 'unweighted';
  c_param_search_scope: 'basic' | 'fine' | 'extremely fine';
  cox_feature_selection: boolean;
  mrmr_feature_selection: boolean;
  mtlr_predictor: 'stable' | 'testing1';
  tune_parameters: boolean;
  use_smoothed_log_likelihood: boolean;
  use_predefined_folds: boolean;
  allow_admin_access: boolean;
  created_at: string;
  updated_at: string;
  features: string[];
  run_cross_validation: boolean;
  standardize_features: boolean;
  model_id: string;
}

type Tab = "meta" | "dataset" | "retrain" | "cross-validation";

const NAVBAR_HEIGHT = 64;   // px
const HEADER_HEIGHT = 60;   // px (approx: header row + 1px progress bar + padding)
const MAX_HISTOGRAM_BARS = 20;

type DatasetSubTab = "correlations" | "eventHistogram" | "survivalHistogram";

export default function PredictorDetailPage() {
  const { predictorId } = useParams<{ predictorId: string }>();
  const navigate = useNavigate();

  // State for data, loading, and errors
  const [predictor, setPredictor] = useState<PredictorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("meta");

  // navigation handling - we want it to go the respective page the card was accessed from when 'back' is pressed
  const location = useLocation();
  const backTo = location.state?.from === "browse" ? "/browse" : "/dashboard";

  // Fetch predictor data when the component mounts
  useEffect(() => {
    if (!predictorId) {
      setError("No predictor ID provided.");
      setIsLoading(false);
      return;
    }

    async function fetchPredictorDetails() {
      setIsLoading(true);
      setError(null);
      try {
                const data = await api.get<PredictorDetail>(
          `/api/predictors/${predictorId}/`
        );
        setPredictor(data);
      } catch (err) {
        setError(
          "Failed to load predictor details. It may not exist or you may not have permission."
        );
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPredictorDetails();
  }, [predictorId]);

  // --- Render States ---
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900" />
        <p className="ml-3 text-gray-600">Loading Predictor...</p>
      </div>
    );
  }

  if (error || !predictor) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-red-600">{error || "Predictor not found."}</p>
        <button
          onClick={() => navigate(backTo)}
          className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
        >
          Back
        </button>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "meta":
        return <MetaTab predictor={predictor} />;
      case "dataset":
        return <DatasetTab predictor={predictor} />;
      case "retrain":
        return <RetrainTab predictor={predictor} />;
      case "cross-validation":
        return <CrossValidationTab />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div
        className="sticky z-30 w-full bg-neutral-700 text-white"
        style={{ top: NAVBAR_HEIGHT }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(backTo)}
            className="rounded-md bg-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-500"
            aria-label="Back"
          >
            Back
          </button>

          <h1 className="text-lg font-semibold tracking-wide text-center">{predictor.name}</h1>

          {/* status badge placeholder */}
          <div className="hidden rounded-full bg-neutral-600 px-3 py-1 text-xs sm:block">
            Status: <span className="font-medium">Trained</span>
          </div>
        </div>
        <div className="h-[4px] w-full bg-neutral-600" />
      </div>

      <div
        className="sticky z-20 w-full border-b bg-neutral-100"
        style={{ top: NAVBAR_HEIGHT + HEADER_HEIGHT }}
      >
        <div className="mx-auto max-w-6xl">
          <nav className="flex justify-center gap-2 px-2 py-2">
            {(["meta", "dataset", "retrain", "cross-validation"] as Tab[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-3 py-2 text-sm font-medium capitalize transition ${
                    isActive
                      ? "bg-neutral-800 text-white"
                      : "border bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {tab === "retrain" ? "Predictor Settings / Retrain" : tab.replace("-", " ")}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8">{renderTabContent()}</div>
      </div>
    </div>
  );
}

// --- Shared tiny components (read-only info pockets) ---
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-md border border-neutral-200 bg-neutral-50 p-4 ${className}`}>{children}</div>
);

const InfoItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</dt>
    <dd className="text-sm text-neutral-900">{value}</dd>
  </div>
);

// --- Tabs ---
function MetaTab({ predictor }: { predictor: PredictorDetail }) {
  return (
    <div className="space-y-6">
      <Card>
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <InfoItem label="Predictor Name" value={predictor.name} />
          <InfoItem label="Owner" value={predictor.owner.username} />
          <InfoItem label="Created" value={new Date(predictor.created_at).toLocaleDateString()} />
          <InfoItem label="Last Updated" value={new Date(predictor.updated_at).toLocaleDateString()} />
          <InfoItem label="Visibility" value={!predictor.is_private ? "Public" : "Private"} />
        </dl>
      </Card>

      <Card>
        <dl className="grid grid-cols-1 gap-4">
          <div className="sm:col-span-2">
            <InfoItem label="Description" value={predictor.description || "No description provided."} />
          </div>
        </dl>
      </Card>
    </div>
  );
}

function DatasetTab({ predictor }: { predictor: PredictorDetail }) {
  const [activeView, setActiveView] = useState<DatasetSubTab>("correlations");
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const datasetId = predictor.dataset?.dataset_id;

  const handleRefreshStats = useCallback(async () => {
    if (!datasetId) return;
    setIsRefreshing(true);
    setStatsError(null);
    try {
      const fresh = await getDatasetStats(datasetId, { refresh: true });
      setStats(fresh);
    } catch (error) {
      console.error("Failed to refresh dataset statistics", error);
      const apiDetails = (error as { details?: unknown })?.details as Record<string, unknown> | undefined;
      const errorMessage =
        (apiDetails && typeof apiDetails.error === "string" && apiDetails.error) ||
        (apiDetails && typeof apiDetails.message === "string" && apiDetails.message) ||
        "Failed to refresh dataset metrics. Please try again.";
      setStatsError(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  }, [datasetId]);

  useEffect(() => {
    let cancelled = false;
    if (!datasetId) {
      setStats(null);
      setIsInitialLoading(false);
      return;
    }
    setIsInitialLoading(true);
    setStatsError(null);
    getDatasetStats(datasetId)
      .then((data) => {
        if (!cancelled) {
          setStats(data);
        }
      })
      .catch((error) => {
        console.error("Failed to load dataset statistics", error);
        if (!cancelled) {
          const apiDetails = (error as { details?: unknown })?.details as Record<string, unknown> | undefined;
          const errorMessage =
            (apiDetails && typeof apiDetails.error === "string" && apiDetails.error) ||
            (apiDetails && typeof apiDetails.message === "string" && apiDetails.message) ||
            "Failed to load dataset metrics.";
          setStatsError(errorMessage);
          setStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInitialLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const generalStats = stats?.general_stats;
  const timeUnitLabel = generalStats?.time_unit || predictor.time_unit;
  const hasTimeStats =
    generalStats &&
    [generalStats.time_min, generalStats.time_max, generalStats.time_mean, generalStats.time_median].some(
      (value) => value !== null && value !== undefined
    );

  const histogramBins = useMemo(
    () => stats?.event_time_histogram?.slice(0, MAX_HISTOGRAM_BARS) ?? [],
    [stats]
  );

  const tabButtonClass = useCallback(
    (tab: DatasetSubTab) =>
      `rounded-md px-3 py-1.5 text-sm transition ${
        activeView === tab ? "bg-neutral-800 text-white" : "border bg-white text-neutral-700 hover:bg-neutral-50"
      }`,
    [activeView]
  );

  const content = useMemo(() => {
    if (isInitialLoading) {
      return (
        <div className="flex h-56 flex-col items-center justify-center text-sm text-neutral-500">
          <p>Loading dataset statistics…</p>
        </div>
      );
    }

    if (!stats) {
      return (
        <div className="flex h-56 flex-col items-center justify-center text-sm text-neutral-500">
          <p>Statistics are not available for this dataset yet.</p>
          {datasetId && (
            <button
              onClick={handleRefreshStats}
              disabled={isRefreshing}
              className="mt-4 rounded-md border bg-white px-3 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing…" : "Generate statistics"}
            </button>
          )}
        </div>
      );
    }

    switch (activeView) {
      case "correlations":
        return <FeatureCorrelationTable rows={stats.feature_correlations ?? []} />;
      case "eventHistogram":
        return <EventHistogramChart bins={histogramBins} timeUnit={timeUnitLabel} />;
      case "survivalHistogram":
        return (
          <div className="flex h-56 flex-col items-center justify-center text-sm text-neutral-500">
            <p>Predicted survival histogram will be available once modelling outputs are produced.</p>
          </div>
        );
      default:
        return null;
    }
  }, [activeView, datasetId, handleRefreshStats, histogramBins, isInitialLoading, isRefreshing, stats, timeUnitLabel]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <dl className="space-y-4">
            <InfoItem
              label="Dataset"
              value={
                <Link
                  to={`/datasets/${predictor.dataset.dataset_id}/view`}
                  className="font-mono text-blue-600 hover:underline"
                >
                  {predictor.dataset.dataset_name}
                </Link>
              }
            />
            <InfoItem label="Dataset ID" value={predictor.dataset.dataset_id} />
            <InfoItem label="MTLR Training File" value={<span className="text-neutral-500">TODO</span>} />
            <InfoItem label="MTLR Feature List File" value={<span className="text-neutral-500">TODO</span>} />
          </dl>
        </Card>

        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-neutral-700">General Statistics</h4>
              {stats?.computed_at && (
                <p className="text-xs text-neutral-500">Updated {formatDateTime(stats.computed_at)}</p>
              )}
            </div>
            {datasetId && (
              <button
                onClick={handleRefreshStats}
                disabled={isRefreshing}
                className="rounded-md border bg-white px-3 py-1 text-xs text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? "Refreshing…" : "Refresh metrics"}
              </button>
            )}
          </div>
          {statsError && <p className="mt-2 text-xs text-red-600">{statsError}</p>}
          <div className="mt-3 space-y-4 rounded-md bg-neutral-100 p-3">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="# Samples" value={formatInteger(generalStats?.num_samples)} />
              <InfoItem label="# Censored" value={formatInteger(generalStats?.num_censored)} />
              <InfoItem label="# Events" value={formatInteger(generalStats?.num_events)} />
              <InfoItem label="# Features" value={formatInteger(generalStats?.num_features)} />
              <InfoItem label="# Numeric Features" value={formatInteger(generalStats?.num_numeric_features)} />
              <InfoItem label="Time Unit" value={timeUnitLabel} />
            </dl>
            {hasTimeStats && (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoItem label="Time Min" value={formatWithUnit(generalStats?.time_min, timeUnitLabel)} />
                <InfoItem label="Time Max" value={formatWithUnit(generalStats?.time_max, timeUnitLabel)} />
                <InfoItem label="Time Mean" value={formatWithUnit(generalStats?.time_mean, timeUnitLabel)} />
                <InfoItem label="Time Median" value={formatWithUnit(generalStats?.time_median, timeUnitLabel)} />
              </dl>
            )}
          </div>
        </Card>
      </div>

      <div className="rounded-md border bg-neutral-100 p-2">
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setActiveView("correlations")} className={tabButtonClass("correlations")}>
            Feature Correlations
          </button>
          <button
            type="button"
            onClick={() => setActiveView("eventHistogram")}
            className={tabButtonClass("eventHistogram")}
          >
            Event Time Histogram
          </button>
          <button
            type="button"
            onClick={() => setActiveView("survivalHistogram")}
            className={tabButtonClass("survivalHistogram")}
            title="Coming soon"
          >
            Predicted Survival Histogram
          </button>
        </div>
      </div>

      <Card>{content}</Card>
    </div>
  );
}

type FeatureCorrelationRow = DatasetStats["feature_correlations"][number];
type HistogramBin = DatasetStats["event_time_histogram"][number];

function FeatureCorrelationTable({ rows }: { rows: FeatureCorrelationRow[] }) {
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const term = search.trim().toLowerCase();
    return rows.filter((row) =>
      row.feature.toLowerCase().includes(term)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const paginatedRows = useMemo(
    () => filteredRows.slice(startIndex, startIndex + rowsPerPage),
    [filteredRows, rowsPerPage, startIndex]
  );

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!rows.length) {
    return (
      <div className="flex h-56 flex-col items-center justify-center text-sm text-neutral-500">
        <p>Not enough numeric features to compute correlations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">
          Censored subjects are ignored for these calculations.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            Rows per page
            <select
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
              className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
            >
              {[25, 50, 100, 250].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search features"
            className="w-48 rounded border border-neutral-300 px-3 py-1 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Rank</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Feature</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Non-nil (%)</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Type</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Correlation</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">|Correlation|</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Details</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Cox score</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Cox score log</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {paginatedRows.map((row, index) => {
              const correlationValue = row.correlation_with_time;
              const correlationClass =
                correlationValue === null || correlationValue === undefined
                  ? "text-neutral-500"
                  : correlationValue >= 0
                    ? "text-emerald-600"
                    : "text-rose-600";

              return (
                <tr key={row.feature}>
                  <td className="px-3 py-2 text-neutral-500">{startIndex + index + 1}</td>
                  <td className="px-3 py-2 font-mono text-sm text-neutral-800">{row.feature}</td>
                  <td className="px-3 py-2 text-right text-neutral-600">{formatPercentage(row.non_null_percent)}</td>
                  <td className="px-3 py-2 text-left capitalize text-neutral-600">
                    {row.feature_type ?? "—"}
                  </td>
                  <td className={`px-3 py-2 text-right ${correlationClass}`}>
                    {formatCorrelation(correlationValue)}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-600">
                    {formatCorrelation(row.abs_correlation)}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-600">
                    {formatDetails(row.mean, row.std_dev)}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-600">
                    {formatScientific(row.cox_score)}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-600">
                    {formatFloat(row.cox_score_log, 6)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {paginatedRows.length} of {filteredRows.length} features
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function EventHistogramChart({ bins, timeUnit }: { bins: HistogramBin[]; timeUnit?: string | null }) {
  if (!bins.length) {
    return (
      <div className="flex h-56 flex-col items-center justify-center text-sm text-neutral-500">
        <p>Not enough time observations to plot a histogram.</p>
      </div>
    );
  }

  const normalizedBins = bins.map((bin) => {
    const events = typeof bin.events === "number" ? bin.events : bin.count ?? 0;
    const censored =
      typeof bin.censored === "number"
        ? bin.censored
        : Math.max((bin.count ?? 0) - events, 0);
    const total = typeof bin.count === "number" ? bin.count : events + censored;
    return {
      ...bin,
      events,
      censored,
      total,
    };
  });

  const maxCount = Math.max(
    ...normalizedBins.map((bin) => Math.max(bin.events, bin.censored, bin.total)),
    1
  );

  const chartHeight = 260;
  const barWidth = 22;
  const gap = 28;
  const svgWidth = normalizedBins.length * (barWidth * 2 + gap) + gap;

  const yTicks = [0.25, 0.5, 0.75, 1].map((fraction) => Math.round(maxCount * fraction));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg
          width="100%"
          height={chartHeight + 60}
          viewBox={`0 0 ${Math.max(svgWidth, 700)} ${chartHeight + 60}`}
          className="rounded border border-neutral-200 bg-white"
        >
          {yTicks.map((tick) => {
            const y = chartHeight - (tick / maxCount) * chartHeight;
            return (
              <g key={tick}>
                <line
                  x1={0}
                  x2={svgWidth}
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeDasharray="4 6"
                />
                <text
                  x={5}
                  y={y - 4}
                  className="text-[10px] fill-neutral-400"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {normalizedBins.map((bin, index) => {
            const baseX = gap + index * (barWidth * 2 + gap);
            const eventsHeight = (bin.events / maxCount) * chartHeight;
            const censoredHeight = (bin.censored / maxCount) * chartHeight;
            return (
              <g key={`${bin.bin_start}-${bin.bin_end}-${index}`}>
                <rect
                  x={baseX}
                  y={chartHeight - eventsHeight}
                  width={barWidth}
                  height={eventsHeight}
                  fill="#1d4ed8"
                  rx={2}
                />
                <rect
                  x={baseX + barWidth + 4}
                  y={chartHeight - censoredHeight}
                  width={barWidth}
                  height={censoredHeight}
                  fill="#e11d48"
                  rx={2}
                />
                <text
                  x={baseX + barWidth}
                  y={chartHeight + 16}
                  textAnchor="middle"
                  className="text-[10px] fill-neutral-500"
                >
                  {formatHistogramLabel(bin.bin_start)}
                </text>
                <text
                  x={baseX + barWidth}
                  y={chartHeight + 30}
                  textAnchor="middle"
                  className="text-[10px] fill-neutral-400"
                >
                  {formatHistogramLabel(bin.bin_end)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-xs text-neutral-500">
        Counts represent samples per time bucket{timeUnit ? ` (${timeUnit})` : ""}.
      </p>
      <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
          Uncensored
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
          Censored
        </span>
      </div>
    </div>
  );
}

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return Math.round(value).toLocaleString();
}

function formatFloat(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return Number(value.toFixed(digits)).toLocaleString();
}

function formatPercentage(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${Number(value.toFixed(digits)).toLocaleString()}%`;
}

function formatDetails(mean: number | null | undefined, stdDev: number | null | undefined): string {
  const meanFormatted = formatFloat(mean, 3);
  const stdFormatted = formatFloat(stdDev, 5);

  if (meanFormatted === "—" && stdFormatted === "—") {
    return "—";
  }

  if (stdFormatted === "—") {
    return `${meanFormatted}`;
  }

  return `${meanFormatted}, σ = ${stdFormatted}`;
}

function formatScientific(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toExponential(5);
}

function formatWithUnit(value: number | null | undefined, unit?: string | null): string {
  const formatted = formatFloat(value);
  if (formatted === "—") {
    return formatted;
  }
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

function formatCorrelation(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  const rounded = Number(value.toFixed(3));
  return (Math.abs(rounded) < 0.0005 ? 0 : rounded).toFixed(3);
}

function formatHistogramLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  const digits = Math.abs(value) >= 100 ? 0 : 1;
  return Number(value.toFixed(digits)).toLocaleString();
}

function RetrainTab({ predictor }: { predictor: PredictorDetail }) {
  // --- State for Features ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(predictor.features)
  );

  // --- State for Advanced Settings ---
  const [showAdvanced, setShowAdvanced] = useState(false); // Collapsible section state
  const [numTimePoints, setNumTimePoints] = useState(predictor.num_time_points ?? "");
  const [regularization, setRegularization] = useState(predictor.regularization);
  const [objectiveFunction, setObjectiveFunction] = useState(predictor.objective_function);
  const [marginalLossType, setMarginalLossType] = useState(predictor.marginal_loss_type);
  const [cParamSearchScope, setCParamSearchScope] = useState(predictor.c_param_search_scope);
  const [coxFeatureSelection, setCoxFeatureSelection] = useState(predictor.cox_feature_selection);
  const [mrmrFeatureSelection, setMrmrFeatureSelection] = useState(predictor.mrmr_feature_selection);
  const [mtlrPredictor, setMtlrPredictor] = useState(predictor.mtlr_predictor);
  const [tuneParameters, setTuneParameters] = useState(predictor.tune_parameters);
  const [useSmoothedLogLikelihood, setUseSmoothedLogLikelihood] = useState(predictor.use_smoothed_log_likelihood);
  const [usePredefinedFolds, setUsePredefinedFolds] = useState(predictor.use_predefined_folds);
  const [runCrossValidation, setRunCrossValidation] = useState(true);
  const [standardizeFeatures, setStandardizeFeatures] = useState(true);

  // --- Retraining Status ---
  const [isRetraining, setIsRetraining] = useState(false);

  // --- Feature Filtering Logic ---
  const filteredFeatures = useMemo(() => {
    if (!searchQuery) return predictor.features;
    return predictor.features.filter((f) =>
      f.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, predictor.features]);

  // --- Pagination stuff ---
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredFeatures.length / pageSize));
    if (page > totalPages) setPage(1);
  }, [filteredFeatures.length, pageSize]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredFeatures.length / pageSize)),
    [filteredFeatures.length, pageSize]
  );

  const currentFeatures = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredFeatures.slice(start, start + pageSize);
  }, [filteredFeatures, page, pageSize]);

  // --- Feature Selection Handlers ---
  const handleToggleFeature = (feature: string) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(feature)) newSelected.delete(feature);
    else newSelected.add(feature);
    setSelectedFeatures(newSelected);
  };
  const handleSelectAll = () => setSelectedFeatures(new Set(predictor.features));
  const handleDeselectAll = () => setSelectedFeatures(new Set());

  // --- Retrain Handler ---
  const handleRetrain = async () => {
    setIsRetraining(true);
    const retrainingConfig = {
      selected_features: Array.from(selectedFeatures),
      parameters: {
        num_time_points: numTimePoints === '' ? null : Number(numTimePoints), // Send null if empty for now
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
      },
      model_id: predictor.model_id
    };
    try {
      console.log("Sending retraining config:", retrainingConfig);
      const response = await fetch("http://localhost:5000/retrain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(retrainingConfig),
      });

      // Check if the response was successful
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Retraining response:", data);
      alert(`Retraining job started! New model ID: ${data.model_id}`);

    } catch (err: any) {
      console.error("Retrain failed:", err);
      alert(`Retraining failed: ${err.message}`);
    } finally {
      setIsRetraining(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* “Options” & “Results” */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-neutral-700">Options</h3>
          <p className="mt-2 text-xs text-neutral-500">
            Auto-filled from current predictor settings. Adjust in “Advanced Settings”.
          </p>

        {/* darker bubble for readability */}
          <div className="mt-3 space-y-1 rounded-md bg-neutral-100 p-3 text-sm text-neutral-800">
            <div>
              Regularization: <span className="font-mono">{regularization.toUpperCase()}</span>
            </div>
            <div>
              Objective: <span className="font-mono">{objectiveFunction}</span>
            </div>
            <div>
              Time Points: <span className="font-mono">{numTimePoints || "default (√N)"}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-neutral-700">Results</h3>
          <p className="mt-2 text-xs text-neutral-500">TODO (training output summary)</p>
        </Card>
      </div>

      {/* Buttons row */}
      <div className="flex flex-wrap justify-center gap-2">
        <button className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-neutral-50">View Sparsity Values</button>
        <button
          onClick={handleRetrain}
          disabled={isRetraining || selectedFeatures.size === 0}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isRetraining ? "Retraining..." : "Re-train With Selected Options"}
        </button>
      </div>

      {/* Feature table */}
      <Card>
        <h3 className="text-base font-semibold">Select features to re-train your predictor with:</h3>
        <p className="mt-1 text-sm text-neutral-600">
          ({selectedFeatures.size} / {predictor.features.length} selected)
        </p>

        <div className="mt-4 rounded-md border">
          <div className="flex items-center gap-2 border-b bg-neutral-50 p-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="flex-1 rounded-md border border-neutral-300 p-2 text-sm"
              placeholder="Search for features..."
            />
            <button onClick={handleSelectAll} className="text-sm text-blue-700 hover:underline">
              Select All
            </button>
            <button onClick={handleDeselectAll} className="text-sm text-blue-700 hover:underline">
              Deselect All
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto bg-white">
            {currentFeatures.map((feature) => (
              <label key={feature} className="flex cursor-pointer items-center gap-3 border-t p-3 hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={selectedFeatures.has(feature)}
                  onChange={() => handleToggleFeature(feature)}
                  className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
                />
                <span className="text-sm font-mono">{feature}</span>
              </label>
            ))}
            {currentFeatures.length === 0 && (
              <p className="p-4 text-center text-sm text-neutral-500">No features found.</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t p-2">
            <div className="flex items-center gap-2 text-sm">
              <span>Entries per page:</span>
              <select
                className="rounded-md border border-neutral-300 p-1 text-sm"
                value={pageSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPageSize(v);
                  setPage(1);
                }}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onJump={(n) => setPage(n)}
            />
          </div>
        </div>
      </Card>

      {/* --- Advanced Settings Section (Collapsible) --- */}
      <section>
        <div className="rounded-md border">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between bg-neutral-100 p-3 text-left text-base font-semibold"
          >
            Advanced Settings
            <span className={`transform transition-transform ${showAdvanced ? "rotate-180" : ""}`}>▼</span>
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="num_time_points" className="block text-sm font-medium text-neutral-700">
                  Number of Time Points
                </label>
                <input
                  type="number"
                  id="num_time_points"
                  value={numTimePoints}
                  onChange={(e) => setNumTimePoints(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm sm:text-sm"
                />
                <p className="mt-1 text-xs text-neutral-500">Leave blank to use default (sqrt of sample size).</p>
              </div>
              {/* Select Dropdown */}
              <div>
                <label htmlFor="regularization" className="block text-sm font-medium text-neutral-700">
                  Regularization
                </label>
                <select
                  id="regularization"
                  value={regularization}
                  onChange={(e) => setRegularization(e.target.value as "l1" | "l2")}
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm sm:text-sm"
                >
                  <option value="l1">L1</option>
                  <option value="l2">L2</option>
                </select>
              </div>

              <div>
                <label htmlFor="objective_function" className="block text-sm font-medium text-neutral-700">
                  Objective Function
                </label>
                <select
                  id="objective_function"
                  value={objectiveFunction}
                  onChange={(e) =>
                    setObjectiveFunction(e.target.value as PredictorDetail["objective_function"])
                  }
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm sm:text-sm"
                >
                  <option value="log-likelihood">Log-Likelihood</option>
                  <option value="l2 marginal loss">L2 Marginal Loss</option>
                  <option value="log-likelihood & L2ML">Log-Likelihood & L2ML</option>
                </select>
              </div>

              <div>
                <label htmlFor="marginal_loss_type" className="block text-sm font-medium text-neutral-700">
                  Marginal Loss Type
                </label>
                <select
                  id="marginal_loss_type"
                  value={marginalLossType}
                  onChange={(e) => setMarginalLossType(e.target.value as "weighted" | "unweighted")}
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm sm:text-sm"
                >
                  <option value="weighted">Weighted</option>
                  <option value="unweighted">Unweighted</option>
                </select>
              </div>

              <div>
                <label htmlFor="c_param_search_scope" className="block text-sm font-medium text-neutral-700">
                  C-Param Search Scope
                </label>
                <select
                  id="c_param_search_scope"
                  value={cParamSearchScope}
                  onChange={(e) => setCParamSearchScope(e.target.value as "basic" | "fine" | "extremely fine")}
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm sm:text-sm"
                >
                  <option value="basic">Basic</option>
                  <option value="fine">Fine</option>
                  <option value="extremely fine">Extremely Fine</option>
                </select>
              </div>

              <div>
                <label htmlFor="mtlr_predictor" className="block text-sm font-medium text-neutral-700">
                  MTLR Predictor
                </label>
                <select
                  id="mtlr_predictor"
                  value={mtlrPredictor}
                  onChange={(e) => setMtlrPredictor(e.target.value as "stable" | "testing1")}
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm sm:text-sm"
                >
                  <option value="stable">Stable</option>
                  <option value="testing1">Testing1</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
                {[
                  { state: coxFeatureSelection, setState: setCoxFeatureSelection, label: "Use Cox Feature Selection", id: "cox_feature_selection" },
                  { state: mrmrFeatureSelection, setState: setMrmrFeatureSelection, label: "Use MRMR Feature Selection", id: "mrmr_feature_selection" },
                  { state: tuneParameters, setState: setTuneParameters, label: "Tune Parameters", id: "tune_parameters" },
                  { state: useSmoothedLogLikelihood, setState: setUseSmoothedLogLikelihood, label: "Use Smoothed Log-Likelihood", id: "use_smoothed_log_likelihood" },
                  { state: usePredefinedFolds, setState: setUsePredefinedFolds, label: "Use Predefined Folds", id: "use_predefined_folds" },
                  { state: runCrossValidation, setState: setRunCrossValidation, label: "Run Cross Validation", id: "run_cross_validation" },
                  { state: standardizeFeatures, setState: setStandardizeFeatures, label: "Standardize Features", id: "standardize_features" },
                ].map((cb) => (
                  <div className="flex items-center" key={cb.id}>
                    <input
                      type="checkbox"
                      id={cb.id}
                      checked={cb.state}
                      onChange={(e) => cb.setState(e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
                    />
                    <label htmlFor={cb.id} className="ml-2 block text-sm text-neutral-900">
                      {cb.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* right aligned action */}
      <div className="flex justify-end">
        <button
          onClick={handleRetrain}
          disabled={isRetraining || selectedFeatures.size === 0}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isRetraining ? "Retraining..." : "Start Retraining Job"}
        </button>
      </div>
    </div>
  );
}

function CrossValidationTab() {
  return (
    <div className="space-y-6">
      {/* centered actions row */}
      <div className="flex flex-wrap justify-center gap-2">
        <button className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-white">
          5-Fold Cross-Validation Statistics
        </button>
        <button className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">
          Download Predictions (CSV)
        </button>
        <button className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Individual Predictions</button>
        <button className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">D-Calibration Histogram</button>
        <button className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Kaplan Meier Visualization</button>
        <button className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Show Feature Weights</button>
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">5-Fold Cross-Validation Statistics*</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700">Measure</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700">PSSP Predictor (median)</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700">PSSP Predictor (mean)</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700">K-M Predictor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                "Concordance Index",
                "Hinged L1 Loss",
                "Uncensored L1 Loss",
                "Marginal L1 Loss",
                "Hinged L1 Log-Loss",
                "Uncensored L1 Log-Loss",
                "Marginal L2 Loss",
                "Log-Likelihood Loss",
                "D-calibration χ² statistic",
                "D-calibration p-value",
              ].map((row) => (
                <tr key={row} className="odd:bg-white even:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-800">{row}</td>
                  <td className="px-3 py-2 text-neutral-500">TODO</td>
                  <td className="px-3 py-2 text-neutral-500">TODO</td>
                  <td className="px-3 py-2 text-neutral-500">TODO</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">* mean ± standard deviation.</p>
      </Card>

      <Card>
        <h4 className="text-sm font-semibold text-neutral-700">Examine Classification Accuracy</h4>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Statistics accuracy, specificity, sensitivity (t-calibration) for classifier with cutoff:
          </label>
          <input type="number" className="w-24 rounded-md border border-neutral-300 p-1 text-sm" defaultValue={18.4} />
          <span className="text-sm text-neutral-700">days</span>
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">Submit</button>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h5 className="text-sm font-semibold text-neutral-700">Generated Classifier Performance and Histogram</h5>
            <div className="flex items-center gap-2">
              <button className="rounded-md border bg-white px-2 py-1 text-xs hover:bg-neutral-50" aria-label="Show">
                Show
              </button>
              <button className="rounded-md border bg-white px-2 py-1 text-xs hover:bg-neutral-50" aria-label="Print">
                🖨️
              </button>
              <button className="rounded-md border bg-white px-2 py-1 text-xs hover:bg-neutral-50" aria-label="Download">
                ⤓
              </button>
            </div>
          </div>
          <div className="h-56 w-full rounded border-2 border-neutral-300" />
        </div>
      </Card>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
  onJump,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onJump: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {page > 1 && (
        <button className="rounded-md border px-2 py-1 text-sm hover:bg-neutral-50" onClick={onPrev}>
          PREV
        </button>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          className={`rounded-md border px-2 py-1 text-sm ${n === page ? "bg-neutral-200" : "hover:bg-neutral-50"}`}
          onClick={() => onJump(n)}
        >
          {n}
        </button>
      ))}
      {page < totalPages && (
        <button className="rounded-md border px-2 py-1 text-sm hover:bg-neutral-50" onClick={onNext}>
          NEXT
        </button>
      )}
    </div>
  );
}
