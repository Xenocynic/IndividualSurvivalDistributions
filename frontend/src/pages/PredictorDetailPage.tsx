import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link, } from "react-router-dom";
import { api } from "../lib/apiClient";

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
}

type Tab = "meta" | "dataset" | "retrain" | "cross-validation";

const NAVBAR_HEIGHT = 64;   // px
const HEADER_HEIGHT = 60;   // px (approx: header row + 1px progress bar + padding)

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
  return (
    <div className="space-y-6">
      {/* top read-only pockets */}
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
          <h4 className="mb-3 text-sm font-semibold text-neutral-700">General Statistics</h4>
          {/* darker inner bubble for legibility */}
          <div className="rounded-md bg-neutral-100 p-3">
            <dl className="grid grid-cols-2 gap-4">
              <InfoItem label="# Samples" value={<span className="text-neutral-500">TODO</span>} />
              <InfoItem label="# Censored" value={<span className="text-neutral-500">TODO</span>} />
              <InfoItem label="# Features" value={<span className="text-neutral-500">TODO</span>} />
              <InfoItem label="Time Unit" value={predictor.time_unit} />
            </dl>
          </div>
        </Card>
      </div>

      {/* centered secondary tab strip */}
      <div className="rounded-md border bg-neutral-100 p-2">
        <div className="flex flex-wrap justify-center gap-2">
          <button className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-white">Feature Correlations</button>
          <button className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Event Time Histogram</button>
          <button className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">
            Predicted Survival Histogram
          </button>
        </div>
      </div>

      {/* chart area */}
      <Card className="relative">
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <button className="rounded-md border bg-white px-2 py-1 text-xs hover:bg-neutral-50" aria-label="Print">
            🖨️
          </button>
          <button className="rounded-md border bg-white px-2 py-1 text-xs hover:bg-neutral-50" aria-label="Download">
            ⤓
          </button>
        </div>
        <div className="mx-auto mt-6 h-64 w-full max-w-3xl rounded border-2 border-neutral-300" />
        <div className="mt-4 ml-auto w-56 rounded-md border bg-white p-3 text-xs">
          <div className="font-semibold text-neutral-700">Legend</div>
          <div className="mt-1 text-neutral-500">TODO</div>
        </div>
      </Card>
    </div>
  );
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
      features: Array.from(selectedFeatures),
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
    };
    console.log("TODO: Start retraining with config:", retrainingConfig);
    // TODO: Replace with actual API call to the backend retraining endpoint
    // Example: await api.post(`/api/predictors/${predictor.predictor_id}/retrain/`, retrainingConfig);
    await new Promise((res) => setTimeout(res, 2000)); // Simulate API delay
    setIsRetraining(false);
    alert("Retraining job started! (See console for config)");
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
                  onChange={(e) => setObjectiveFunction(e.target.value)}
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm sm:text-sm"
                >
                  <option value="log-likelihood">Log-Likelihood</option>
                  <option value="L2 marginal loss">L2 Marginal Loss</option>
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
