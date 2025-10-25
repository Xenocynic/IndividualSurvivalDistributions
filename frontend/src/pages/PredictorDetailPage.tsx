import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export default function PredictorDetailPage() {
  const { predictorId } = useParams<{ predictorId: string }>();
  const navigate = useNavigate();

  // State for data, loading, and errors
  const [predictor, setPredictor] = useState<PredictorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("meta");

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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
        <p className="ml-3 text-gray-600">Loading Predictor...</p>
      </div>
    );
  }

  if (error || !predictor) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-red-600">{error || "Predictor not found."}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
        >
          Back to Dashboard
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
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-gray-50 px-4 py-2">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm text-gray-700 hover:text-black"
        >
          &larr; Back to Dashboard
        </button>
        <h1 className="text-base font-semibold">{predictor.name}</h1>
        <div className="w-40"></div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="border-b">
            <nav className="-mb-px flex space-x-6">
              {(
                ["meta", "dataset", "retrain", "cross-validation"] as Tab[]
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium capitalize ${
                    activeTab === tab
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  {tab === "retrain"
                    ? "Settings / Retrain"
                    : tab.replace("-", " ")}
                </button>
              ))}
            </nav>
          </div>
          <div className="py-8">{renderTabContent()}</div>
        </div>
      </div>
    </div>
  );
}

// --- Tab Components ---
const InfoItem = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div>
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="mt-1 text-sm text-gray-900">{value}</dd>
  </div>
);

function MetaTab({ predictor }: { predictor: PredictorDetail }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
      <InfoItem label="Predictor Name" value={predictor.name} />
      <InfoItem label="Owner" value={predictor.owner.username} />
      <InfoItem
        label="Created"
        value={new Date(predictor.created_at).toLocaleDateString()}
      />
      <InfoItem
        label="Last Updated"
        value={new Date(predictor.updated_at).toLocaleDateString()}
      />
      <InfoItem
        label="Visibility"
        value={!predictor.is_private ? "Public" : "Private"}
      />
      <div className="sm:col-span-2">
        <InfoItem
          label="Description"
          value={predictor.description || "No description provided."}
        />
      </div>
    </dl>
  );
}

function DatasetTab({ predictor }: { predictor: PredictorDetail }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
      <InfoItem
        label="Dataset Name"
        value={
          <span className="font-mono">{predictor.dataset.dataset_name}</span>
        }
      />
      <InfoItem label="Dataset ID" value={predictor.dataset.dataset_id} />
    </dl>
  );
}

function RetrainTab({ predictor }: { predictor: PredictorDetail }) {
  // --- State for Features ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(predictor.features)
  );

  // --- State for Advanced Settings ---
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numTimePoints, setNumTimePoints] = useState(predictor.num_time_points ?? '');
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

  const [choiceOpen, setChoiceOpen] = useState(false);
  const navigate = useNavigate();

  type RetrainResp = {
    new_predictor_id?: number;
    overwrote?: number | null;
    seed?: {
      from_predictor_id: number;
      dataset_id?: number | null;
      settings?: any;
    };
  };

  // --- Retraining Logic --- 
  const submitRetrain = async (mode: "overwrite" | "new") => {    
    setIsRetraining(true);
    try {
      const body = {
        mode,
        features: Array.from(selectedFeatures),
        parameters: {
          num_time_points: numTimePoints === '' ? null : Number(numTimePoints),
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

      const res = await api.post<RetrainResp>(
        `/api/predictors/${predictor.predictor_id}/retrain/`,
        body
      );

      if (mode === "overwrite") {
        if (!res.new_predictor_id) throw new Error("Missing new_predictor_id");
        navigate(`/predictors/${res.new_predictor_id}`);
      } else {
        // Pass the seed via navigation state; do NOT create anything yet.
        navigate("/predictors/new", { state: { seed: res.seed } });
      }
    } catch {
      alert("Retrain failed. Please try again.");
    } finally {
      setIsRetraining(false);
      setChoiceOpen(false);
    }
  };

  // --- Feature Filtering Logic ---
  const filteredFeatures = useMemo(() => {
    if (!searchQuery) return predictor.features;
    return predictor.features.filter((f) =>
      f.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, predictor.features]);

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
  // direct call to the rtrain logic block
  const handleRetrain = () => {
    setChoiceOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* --- Feature Selection Section --- */}
      <section>
        <h3 className="text-lg font-semibold">Select Features for Retraining</h3>
        <p className="mt-1 text-sm text-gray-600">
          ({selectedFeatures.size} / {predictor.features.length} selected)
        </p>
        <div className="mt-4 rounded-md border">
          <div className="flex items-center gap-2 border-b p-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 p-2 text-sm"
              placeholder="Search for features..."
            />
            <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:underline">Select All</button>
            <button onClick={handleDeselectAll} className="text-sm text-blue-600 hover:underline">Deselect All</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {/* Feature List Rendering */}
            {filteredFeatures.map((feature) => (
              <label key={feature} className="flex cursor-pointer items-center gap-3 border-t p-3 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedFeatures.has(feature)}
                  onChange={() => handleToggleFeature(feature)}
                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span className="text-sm font-mono">{feature}</span>
              </label>
            ))}
            {filteredFeatures.length === 0 && (
              <p className="p-4 text-center text-sm text-gray-500">No features found.</p>
            )}
          </div>
        </div>
      </section>

      {/* --- Advanced Settings Section (Collapsible) --- */}
      <section>
        <div className="rounded-md border">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between bg-gray-50 p-3 text-left text-base font-semibold"
            >
              Advanced Settings
              <span className={`transform transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>
            {showAdvanced && (
                <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2">
                    {/* --- Parameter Inputs --- */}
                      <div>
                        <label htmlFor="num_time_points" className="block text-sm font-medium text-gray-700">
                          Number of Time Points
                        </label>
                        <input
                          type="number"
                          id="num_time_points"
                          value={numTimePoints}
                          onChange={e => setNumTimePoints(e.target.value)}
                          placeholder="Optional"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Leave blank to use default (sqrt of sample size).
                        </p>
                      </div>
                    {/* Select Dropdown */}
                    <div>
                        <label htmlFor="regularization" className="block text-sm font-medium text-gray-700">Regularization</label>
                        <select id="regularization" value={regularization} onChange={e => setRegularization(e.target.value as 'l1' | 'l2')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                            <option value="l1">L1</option>
                            <option value="l2">L2</option>
                        </select>
                    </div>
                    {/* Select Dropdown */}
                     <div>
                        <label htmlFor="objective_function" className="block text-sm font-medium text-gray-700">Objective Function</label>
                        <select id="objective_function" value={objectiveFunction} onChange={e => setObjectiveFunction(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                            <option value="log-likelihood">Log-Likelihood</option>
                            <option value="L2 marginal loss">L2 Marginal Loss</option>
                            <option value="log-likelihood & L2ML">Log-Likelihood & L2ML</option>
                        </select>
                    </div>
                     {/* Select Dropdown */}
                    <div>
                        <label htmlFor="marginal_loss_type" className="block text-sm font-medium text-gray-700">Marginal Loss Type</label>
                        <select id="marginal_loss_type" value={marginalLossType} onChange={e => setMarginalLossType(e.target.value as 'weighted' | 'unweighted')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                            <option value="weighted">Weighted</option>
                            <option value="unweighted">Unweighted</option>
                        </select>
                    </div>
                    {/* Select Dropdown */}
                    <div>
                        <label htmlFor="c_param_search_scope" className="block text-sm font-medium text-gray-700">C-Param Search Scope</label>
                        <select id="c_param_search_scope" value={cParamSearchScope} onChange={e => setCParamSearchScope(e.target.value as 'basic' | 'fine' | 'extremely fine')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                            <option value="basic">Basic</option>
                            <option value="fine">Fine</option>
                            <option value="extremely fine">Extremely Fine</option>
                        </select>
                    </div>
                     {/* Select Dropdown */}
                    <div>
                        <label htmlFor="mtlr_predictor" className="block text-sm font-medium text-gray-700">MTLR Predictor</label>
                        <select id="mtlr_predictor" value={mtlrPredictor} onChange={e => setMtlrPredictor(e.target.value as 'stable' | 'testing1')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                            <option value="stable">Stable</option>
                            <option value="testing1">Testing1</option>
                        </select>
                    </div>

                    {/* Checkboxes for Boolean Fields */}
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { state: coxFeatureSelection, setState: setCoxFeatureSelection, label: "Use Cox Feature Selection", id: "cox_feature_selection" },
                            { state: mrmrFeatureSelection, setState: setMrmrFeatureSelection, label: "Use MRMR Feature Selection", id: "mrmr_feature_selection" },
                            { state: tuneParameters, setState: setTuneParameters, label: "Tune Parameters", id: "tune_parameters" },
                            { state: useSmoothedLogLikelihood, setState: setUseSmoothedLogLikelihood, label: "Use Smoothed Log-Likelihood", id: "use_smoothed_log_likelihood" },
                            { state: usePredefinedFolds, setState: setUsePredefinedFolds, label: "Use Predefined Folds", id: "use_predefined_folds" },
                            { state: runCrossValidation, setState: setRunCrossValidation, label: "Run Cross Validation", id: "run_cross_validation" },
                            { state: standardizeFeatures, setState: setStandardizeFeatures, label: "Standardize Features", id: "standardize_features" },
                        ].map(cb => (
                            <div className="flex items-center" key={cb.id}>
                                <input type="checkbox" id={cb.id} checked={cb.state} onChange={e => cb.setState(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black" />
                                <label htmlFor={cb.id} className="ml-2 block text-sm text-gray-900">{cb.label}</label>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </section>

      {/* --- Action Button --- */}
      <div className="flex justify-end border-t pt-6">
        <button
          onClick={handleRetrain}
          disabled={isRetraining || selectedFeatures.size === 0}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isRetraining ? "Retraining..." : "Start Retraining Job"}
        </button>
      </div>

      {choiceOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold">After retraining, what would you like to do?</h3>
            <p className="mt-1 text-sm text-gray-600">You can overwrite the existing predictor or create a new one.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setChoiceOpen(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => submitRetrain("new")} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">Create New</button>
              <button onClick={() => submitRetrain("overwrite")} className="rounded-md bg-black px-3 py-1.5 text-sm text-white">Overwrite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CrossValidationTab() {
  return (
    <div>
      <h3 className="text-base font-semibold">Cross-Validation Results</h3>
      <p className="mt-2 text-sm text-gray-500">
        Results and visualizations from cross-validation runs will be displayed
        here.
      </p>
    </div>
  );
}