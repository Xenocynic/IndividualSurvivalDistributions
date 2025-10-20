import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/apiClient"; // Assuming your API client is configured

// --- Type Definitions ---
// This interface matches the enhanced PredictorSerializer response from your backend
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
  time_unit: string;
  num_time_points: number | null;
  regularization: "l1" | "l2";
  objective_function: string;
  marginal_loss_type: string;
  c_param_search_scope: string;
  cox_feature_selection: boolean;
  mrmr_feature_selection: boolean; // Assuming this will be added to the model
  mtlr_predictor: string;          // Assuming this will be added to the model
  created_at: string;
  updated_at: string;
  features: string[];
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
  // State for feature selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(predictor.features)
  );
  
  // State for editable model parameters
  const [numTimePoints, setNumTimePoints] = useState(predictor.num_time_points || '');
  const [regularization, setRegularization] = useState(predictor.regularization);
  const [coxFeatureSelection, setCoxFeatureSelection] = useState(predictor.cox_feature_selection);
  // ... add state for other editable parameters ...

  const [isRetraining, setIsRetraining] = useState(false);

  const filteredFeatures = useMemo(() => {
    if (!searchQuery) return predictor.features;
    return predictor.features.filter((f) =>
      f.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, predictor.features]);

  const handleToggleFeature = (feature: string) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(feature)) newSelected.delete(feature);
    else newSelected.add(feature);
    setSelectedFeatures(newSelected);
  };

  const handleSelectAll = () => setSelectedFeatures(new Set(predictor.features));
  const handleDeselectAll = () => setSelectedFeatures(new Set());

  const handleRetrain = async () => {
    setIsRetraining(true);
    const retrainingConfig = {
      features: Array.from(selectedFeatures),
      parameters: {
        num_time_points: numTimePoints,
        regularization,
        cox_feature_selection: coxFeatureSelection,
        // ... include other parameters
      },
    };
    console.log("TODO: Start retraining with config:", retrainingConfig);
    // TODO: Replace with actual API call to the backend retraining endpoint
    await new Promise((res) => setTimeout(res, 2000));
    setIsRetraining(false);
    alert("Retraining job started!");
  };

  return (
    <div className="space-y-8">
      {/* Model Parameters Section */}
      <section>
        <h3 className="text-lg font-semibold">Model Parameters</h3>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
                <label htmlFor="num_time_points" className="block text-sm font-medium text-gray-700">Number of Time Points</label>
                <input type="number" id="num_time_points" value={numTimePoints} onChange={e => setNumTimePoints(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
            </div>
            <div>
                <label htmlFor="regularization" className="block text-sm font-medium text-gray-700">Regularization</label>
                <select id="regularization" value={regularization} onChange={e => setRegularization(e.target.value as 'l1' | 'l2')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                    <option value="l1">L1</option>
                    <option value="l2">L2</option>
                </select>
            </div>
            {/* Read-only fields for now */}
            <InfoItem label="Objective Function" value={predictor.objective_function} />
            <InfoItem label="Marginal Loss Type" value={predictor.marginal_loss_type} />
            <InfoItem label="C-Param Search Scope" value={predictor.c_param_search_scope} />
             {/* Checkbox for boolean fields */}
            <div className="flex items-center">
                 <input type="checkbox" id="cox_feature_selection" checked={coxFeatureSelection} onChange={e => setCoxFeatureSelection(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black" />
                 <label htmlFor="cox_feature_selection" className="ml-2 block text-sm text-gray-900">Use Cox Feature Selection</label>
            </div>
        </div>
      </section>

      {/* Feature Selection Section */}
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
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:underline"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="text-sm text-blue-600 hover:underline"
            >
              Deselect All
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredFeatures.map((feature) => (
              <label
                key={feature}
                className="flex cursor-pointer items-center gap-3 border-t p-3 hover:bg-gray-50"
              >
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
              <p className="p-4 text-center text-sm text-gray-500">
                No features found.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Action Button */}
      <div className="flex justify-end border-t pt-6">
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
    <div>
      <h3 className="text-base font-semibold">Cross-Validation Results</h3>
      <p className="mt-2 text-sm text-gray-500">
        Results and visualizations from cross-validation runs will be displayed
        here.
      </p>
    </div>
  );
}