/**
 * Select Features Page for Retraining Predictor
 * 
 * Allows users to select features and configure settings for creating a new
 * predictor based on an existing one with custom feature selection.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPredictor, trainPredictor, createPredictor } from "../lib/predictors";
import { getDatasetStats } from "../lib/datasets";

interface PredictorData {
  predictor_id: number;
  name: string;
  dataset: {
    dataset_id: number;
    dataset_name: string;
  };
  regularization: "l1" | "l2";
  objective_function: "log-likelihood" | "l2 marginal loss" | "log-likelihood & L2ML";
  marginal_loss_type: "weighted" | "unweighted";
  c_param_search_scope: "basic" | "fine" | "extremely fine";
  cox_feature_selection: boolean;
  mrmr_feature_selection: boolean;
  mtlr_predictor: "stable" | "testing1";
  tune_parameters: boolean;
  use_smoothed_log_likelihood: boolean;
  use_predefined_folds: boolean;
  num_time_points: number | null;
  run_cross_validation: boolean;
  standardize_features: boolean;
  features: string[];
}

type TrainingStep = "idle" | "training" | "creating" | "complete" | "error";

export default function SelectFeaturesPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  // Loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Predictor data
  const [predictor, setPredictor] = useState<PredictorData | null>(null);
  
  // Feature selection
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  
  // Advanced settings - Model Selection
  const [selectedModel, setSelectedModel] = useState<string>("MTLR");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // General/Experiment Settings
  const [postProcess, setPostProcess] = useState<"CSD" | "CSD-iPOT">("CSD");
  const [nExp, setNExp] = useState<number>(10);
  const [seed, setSeed] = useState<number>(0);
  const [timeBins, setTimeBins] = useState<number | null>(null);
  
  // Conformalization Settings
  const [decensorMethod, setDecensorMethod] = useState<"uncensored" | "margin" | "PO" | "sampling">("sampling");
  const [monoMethod, setMonoMethod] = useState<"ceil" | "floor" | "bootstrap">("bootstrap");
  const [interpolate, setInterpolate] = useState<"Linear" | "Pchip">("Pchip");
  const [nQuantiles, setNQuantiles] = useState<number>(9);
  const [useTrain, setUseTrain] = useState<boolean>(true);
  const [nSample, setNSample] = useState<number>(1000);
  
  // Neural Network Architecture
  const [neurons, setNeurons] = useState<number[]>([64,64]);
  const [norm, setNorm] = useState<boolean>(true);
  const [dropout, setDropout] = useState<number>(0.4);
  const [activation, setActivation] = useState<string>("ReLU");
  
  // Training Hyperparameters
  const [nEpochs, setNEpochs] = useState<number>(10000);
  const [earlyStop, setEarlyStop] = useState<boolean>(true);
  const [batchSize, setBatchSize] = useState<number>(256);
  const [lr, setLr] = useState<number>(0.001);
  const [weightDecay, setWeightDecay] = useState<number>(0.1);
  const [lam, setLam] = useState<number>(0);
  
  // New predictor fields
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  
  // Helper function to check if model uses neural network
  const isNeuralNetworkModel = () => {
    return ['MTLR', 'CoxPH', 'DeepHit', 'CoxTime', 'CQRNN', 'LogNormalNN'].includes(selectedModel);
  };
  
  // Training state
  const [trainingStep, setTrainingStep] = useState<TrainingStep>("idle");
  const [trainingError, setTrainingError] = useState<string | null>(null);
  
  // Load predictor and features on mount
  useEffect(() => {
    async function loadData() {
      if (!id) return;
      
      try {
        setLoading(true);
        const predictorData = await getPredictor(Number(id)) as any;
        setPredictor(predictorData);
        
        // Note: New parameters use defaults; no need to initialize from old predictor data
        
        // Load dataset features
        const stats = await getDatasetStats(predictorData.dataset.dataset_id);
        const features = stats.feature_correlations?.map(fc => fc.feature) ?? [];
        
        // Filter out "time" and "censored"
        const filteredFeatures = features.filter(f => f !== "time" && f !== "censored");
        setAvailableFeatures(filteredFeatures);
        
        // Select all features by default
        setSelectedFeatures(new Set(filteredFeatures));
        
        // Suggested name
        setName(`${predictorData.name}_F${filteredFeatures.length}`);
        
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to load predictor data:", err);
        setError(err.message || "Failed to load predictor data");
        setLoading(false);
      }
    }
    
    loadData();
  }, [id]);
  
  // Feature filtering and pagination
  const filteredFeatures = useMemo(() => {
    if (!searchQuery) return availableFeatures;
    return availableFeatures.filter(f =>
      f.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, availableFeatures]);
  
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredFeatures.length / pageSize)),
    [filteredFeatures.length, pageSize]
  );
  
  const currentFeatures = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredFeatures.slice(start, start + pageSize);
  }, [filteredFeatures, page, pageSize]);
  
  // Handlers
  const handleToggleFeature = (feature: string) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(feature)) newSelected.delete(feature);
    else newSelected.add(feature);
    setSelectedFeatures(newSelected);
    
    // Update suggested name
    if (predictor) {
      setName(`${predictor.name}_F${newSelected.size}`);
    }
  };
  
  const handleSelectAll = () => {
    setSelectedFeatures(new Set(availableFeatures));
    if (predictor) {
      setName(`${predictor.name}_F${availableFeatures.length}`);
    }
  };
  
  const handleDeselectAll = () => {
    setSelectedFeatures(new Set());
    if (predictor) {
      setName(`${predictor.name}_F0`);
    }
  };
  
  // Retrain handler
  const handleRetrain = async () => {
    if (!predictor || selectedFeatures.size === 0) return;
    
    setTrainingStep("training");
    setTrainingError(null);
    
    try {
      // Train the model with new parameters
      const trainingResult = await trainPredictor(predictor.dataset.dataset_id, {
        parameters: {
          // Model & Experiment
          model: selectedModel,
          post_process: postProcess,
          n_exp: nExp,
          seed,
          ...(['MTLR', 'CoxPH', 'CQRNN', 'LogNormalNN'].includes(selectedModel) && timeBins !== null && { time_bins: timeBins }),
          
          // Conformalization
          error_f: "Quantile",
          decensor_method: decensorMethod,
          mono_method: monoMethod,
          interpolate,
          n_quantiles: nQuantiles,
          use_train: useTrain,
          n_sample: decensorMethod === "sampling" ? nSample : undefined,
          
          // Neural Network Architecture (only if applicable)
            ...(isNeuralNetworkModel() && {
              neurons,
              norm,
              dropout,
              activation,
              n_epochs: nEpochs,
              early_stop: earlyStop,
              batch_size: batchSize,
              lr,
              weight_decay: weightDecay,
          }),
          ...(selectedModel === "LogNormalNN" && { lam }),

          // Feature selection
          selected_features: Array.from(selectedFeatures),
        },
      });
      
      if (!trainingResult || !trainingResult.model_id) {
        throw new Error("Training did not return a valid model_id");
      }
      
      // Create new predictor
      setTrainingStep("creating");
      
      let parsedFeatures = trainingResult.selected_features;
      if (typeof parsedFeatures === "string") {
        try {
          parsedFeatures = JSON.parse(parsedFeatures);
        } catch (e) {
          console.warn("Could not parse selected_features as JSON");
        }
      }
      
      const created = await createPredictor({
        name: name.trim(),
        description: notes.trim(),
        dataset_id: predictor.dataset.dataset_id,
        is_private: true,
        model_id: trainingResult.model_id,
        ml_trained_at: trainingResult.trained_at || new Date().toISOString(),
        ml_training_status: "trained",
        ml_model_metrics: trainingResult.metrics || {},
        ml_selected_features: parsedFeatures || null,
        
        // Store all the new parameters with predictor
        model: selectedModel,
        post_process: postProcess,
        n_exp: nExp,
        seed,
        time_bins: ['MTLR', 'CoxPH', 'CQRNN', 'LogNormalNN'].includes(selectedModel) && timeBins !== null ? timeBins : undefined,
        error_f: "Quantile",
        decensor_method: decensorMethod,
        mono_method: monoMethod,
        interpolate,
        n_quantiles: nQuantiles,
        use_train: useTrain,
        n_sample: decensorMethod === "sampling" ? nSample : undefined,
        neurons: isNeuralNetworkModel() ? neurons : undefined,
        norm: isNeuralNetworkModel() ? norm : undefined,
        dropout: isNeuralNetworkModel() ? dropout : undefined,
        activation: isNeuralNetworkModel() ? activation : undefined,
        n_epochs: isNeuralNetworkModel() ? nEpochs : undefined,
        early_stop: isNeuralNetworkModel() ? earlyStop : undefined,
        batch_size: isNeuralNetworkModel() ? batchSize : undefined,
        lr: isNeuralNetworkModel() ? lr : undefined,
        weight_decay: isNeuralNetworkModel() ? weightDecay : undefined,
        lam: selectedModel === "LogNormalNN" ? lam : undefined,
      });
      
      setTrainingStep("complete");
      
      setTimeout(() => {
        navigate(`/predictors/${created.predictor_id}`);
      }, 2000);
    } catch (err: any) {
      setTrainingStep("error");
      console.error("Retrain failed:", err);
      setTrainingError(err.message || "Failed to retrain predictor");
    }
  };
  
  const canRetrain = name.trim() && selectedFeatures.size > 0 && trainingStep === "idle";
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900 mx-auto" />
          <p className="mt-4 text-neutral-600">Loading predictor data...</p>
        </div>
      </div>
    );
  }
  
  if (error || !predictor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">Error</h2>
          <p className="mt-2 text-red-700">{error || "Predictor not found"}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-100 pb-12">
      {/* Header */}
      <div className="sticky top-[var(--app-nav-h,4rem)] z-40 border-b bg-neutral-700 text-white">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(`/predictors/${predictor.predictor_id}`)}
            disabled={trainingStep !== "idle"}
            className="rounded-md border border-white/10 bg-neutral-600 px-3 py-1.5 text-sm transition hover:bg-neutral-500 disabled:opacity-50"
          >
            Back
          </button>
          <div className="text-lg font-semibold">Re-train Predictor</div>
          <div className="w-20"></div>
        </div>
      </div>
      
      {/* Body */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
          {/* Info */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm text-neutral-700">
              Select features to re-train your predictor with. A new predictor will be created based on <strong>{predictor.name}</strong>.
            </p>
          </div>
          
          {/* Feature Selection */}
          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-1">
              Select Features
            </h2>
            <p className="text-sm text-neutral-600 mb-3">
              {selectedFeatures.size} / {availableFeatures.length} features selected
            </p>
            
            <div className="rounded-md border">
              <div className="flex items-center gap-2 border-b bg-neutral-50 p-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search features..."
                  className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                />
                <button onClick={handleSelectAll} className="text-sm text-neutral-800 hover:underline">
                  Select All
                </button>
                <button onClick={handleDeselectAll} className="text-sm text-neutral-800 hover:underline">
                  Deselect All
                </button>
              </div>
              
              <div className="max-h-72 overflow-y-auto">
                {currentFeatures.map((feature) => (
                  <label
                    key={feature}
                    className="flex cursor-pointer items-center gap-3 border-t border-neutral-100 p-3 hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFeatures.has(feature)}
                      onChange={() => handleToggleFeature(feature)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-mono">{feature}</span>
                  </label>
                ))}
                {currentFeatures.length === 0 && (
                  <p className="p-4 text-center text-sm text-neutral-500">No features found</p>
                )}
              </div>
              
              <div className="flex items-center justify-between border-t p-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded border px-2 py-1"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </section>
          
          {/* Advanced Settings */}
          <section className="rounded-lg border bg-neutral-50 p-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="text-sm font-semibold uppercase text-neutral-900">
                Advanced Settings
              </h2>
              <span className={`transform transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-6">
                {/* Model Selection */}
                <div className="pb-4 border-b border-neutral-300">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Model Type</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="block w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="MTLR">MTLR</option>
                    <option value="DeepHit" disabled>DeepHit (Coming Soon)</option>
                    <option value="CoxPH" disabled>CoxPH (Coming Soon)</option>
                    <option value="AFT" disabled>AFT (Coming Soon)</option>
                    <option value="GB" disabled>GB (Coming Soon)</option>
                    <option value="CoxTime" disabled>CoxTime (Coming Soon)</option>
                    <option value="CQRNN" disabled>CQRNN (Coming Soon)</option>
                    <option value="LogNormalNN" disabled>LogNormalNN (Coming Soon)</option>
                    <option value="KM" disabled>KM (Coming Soon)</option>
                  </select>
                  <p className="mt-1 text-xs text-neutral-500">Select the survival model to use</p>
                </div>

                {/* General Settings */}
                <div className="pb-4 border-b border-neutral-300">
                  <h4 className="text-sm font-semibold text-neutral-800 mb-3">General Settings</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Post Process</label>
                      <select
                        value={postProcess}
                        onChange={(e) => setPostProcess(e.target.value as "CSD" | "CSD-iPOT")}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="CSD">CSD</option>
                        <option value="CSD-iPOT">CSD-iPOT</option>
                      </select>
                      <p className="mt-1 text-xs text-neutral-500">Post-processing method for predictions</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Number of Experiments</label>
                      <input
                        type="number"
                        value={nExp}
                        onChange={(e) => setNExp(Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Number of experimental runs</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Random Seed</label>
                      <input
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Seed for reproducibility</p>
                    </div>
                    {['MTLR', 'CoxPH', 'CQRNN', 'LogNormalNN'].includes(selectedModel) && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-700">Time Bins</label>
                        <input
                          type="number"
                          value={timeBins || ''}
                          onChange={(e) => setTimeBins(e.target.value ? Number(e.target.value) : null)}
                          placeholder="Optional"
                          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-neutral-500">Number of time bins for survival analysis</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Conformalization Settings */}
                <div className="pb-4 border-b border-neutral-300">
                  <h4 className="text-sm font-semibold text-neutral-800 mb-3">Conformalization Settings</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Error Function</label>
                      <input
                        type="text"
                        value="Quantile"
                        disabled
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm bg-neutral-100"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Error function for conformal prediction</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Decensor Method</label>
                      <select
                        value={decensorMethod}
                        onChange={(e) => setDecensorMethod(e.target.value as any)}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="uncensored">Uncensored</option>
                        <option value="margin">Margin</option>
                        <option value="PO">PO</option>
                        <option value="sampling">Sampling</option>
                      </select>
                      <p className="mt-1 text-xs text-neutral-500">Method for handling censored data</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Monotonization Method</label>
                      <select
                        value={monoMethod}
                        onChange={(e) => setMonoMethod(e.target.value as any)}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="ceil">Ceil</option>
                        <option value="floor">Floor</option>
                        <option value="bootstrap">Bootstrap</option>
                      </select>
                      <p className="mt-1 text-xs text-neutral-500">Method for ensuring monotonicity</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Interpolation</label>
                      <select
                        value={interpolate}
                        onChange={(e) => setInterpolate(e.target.value as any)}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="Linear">Linear</option>
                        <option value="Pchip">Pchip</option>
                      </select>
                      <p className="mt-1 text-xs text-neutral-500">Interpolation method for predictions</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Number of Quantiles</label>
                      <input
                        type="number"
                        value={nQuantiles}
                        onChange={(e) => setNQuantiles(Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Common values: 4, 9, 19, 39, 49, 99</p>
                    </div>
                    {decensorMethod === "sampling" && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-700">Sample Size</label>
                        <input
                          type="number"
                          value={nSample}
                          onChange={(e) => setNSample(Number(e.target.value))}
                          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-neutral-500">Number of samples when using sampling method</p>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={useTrain}
                          onChange={(e) => setUseTrain(e.target.checked)}
                          className="h-4 w-4"
                          id="use-train"
                        />
                        <label htmlFor="use-train" className="ml-2 text-sm">Use Training Data</label>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500 ml-6">Include training data in conformal prediction</p>
                    </div>
                  </div>
                </div>

                {/* Neural Network Architecture */}
                <div className="pb-4 border-b border-neutral-300">
                  <h4 className="text-sm font-semibold text-neutral-800 mb-3">
                    Neural Network Architecture
                    {!isNeuralNetworkModel() && <span className="ml-2 text-xs text-neutral-500 font-normal">(Only for neural network models)</span>}
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Hidden Layers (comma-separated)</label>
                      <input
                        type="text"
                        value={neurons.join(',')}
                        onChange={(e) => {
                          const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(n => !isNaN(n));
                          setNeurons(values.length > 0 ? values : [64, 64]);
                        }}
                        disabled={!isNeuralNetworkModel()}
                        placeholder="e.g., 64,64"
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Layer sizes separated by commas</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Activation Function</label>
                      <select
                        value={activation}
                        onChange={(e) => setActivation(e.target.value)}
                        disabled={!isNeuralNetworkModel()}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
                      >
                        <option value="ReLU">ReLU</option>
                        <option value="LeakyReLU">LeakyReLU</option>
                        <option value="PReLU">PReLU</option>
                        <option value="Tanh">Tanh</option>
                        <option value="Sigmoid">Sigmoid</option>
                        <option value="ELU">ELU</option>
                        <option value="SELU">SELU</option>
                      </select>
                      <p className="mt-1 text-xs text-neutral-500">Non-linearity between layers</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Dropout Rate</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={dropout}
                        onChange={(e) => setDropout(Number(e.target.value))}
                        disabled={!isNeuralNetworkModel()}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Probability of dropping neurons (0-1)</p>
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={norm}
                          onChange={(e) => setNorm(e.target.checked)}
                          disabled={!isNeuralNetworkModel()}
                          className="h-4 w-4 disabled:opacity-50"
                          id="batch-norm"
                        />
                        <label htmlFor="batch-norm" className="ml-2 text-sm">Use Batch Normalization</label>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500 ml-6">Normalize activations for stability</p>
                    </div>
                  </div>
                </div>

                {/* Training Hyperparameters */}
                <div>
                  <h4 className="text-sm font-semibold text-neutral-800 mb-3">
                    Training Hyperparameters
                    {!isNeuralNetworkModel() && <span className="ml-2 text-xs text-neutral-500 font-normal">(Only for neural network models)</span>}
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Number of Epochs</label>
                      <input
                        type="number"
                        value={nEpochs}
                        onChange={(e) => setNEpochs(Number(e.target.value))}
                        disabled={!isNeuralNetworkModel()}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Maximum training iterations</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Batch Size</label>
                      <input
                        type="number"
                        value={batchSize}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                        disabled={!isNeuralNetworkModel()}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Samples per gradient update</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Learning Rate</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={lr}
                        onChange={(e) => setLr(Number(e.target.value))}
                        disabled={!isNeuralNetworkModel()}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
                      />
                      <p className="mt-1 text-xs text-neutral-500">Step size for gradient descent</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Weight Decay</label>
                      <input
                        type="number"
                        step="0.01"
                        value={weightDecay}
                        onChange={(e) => setWeightDecay(Number(e.target.value))}
                        disabled={!isNeuralNetworkModel()}
                        className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
                      />
                      <p className="mt-1 text-xs text-neutral-500">L2 regularization strength</p>
                    </div>
                    {selectedModel === "LogNormalNN" && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-700">Lambda (λ)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={lam}
                          onChange={(e) => setLam(Number(e.target.value))}
                          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-neutral-500">Regularization weight for d-calibration</p>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={earlyStop}
                          onChange={(e) => setEarlyStop(e.target.checked)}
                          disabled={!isNeuralNetworkModel()}
                          className="h-4 w-4 disabled:opacity-50"
                          id="early-stop"
                        />
                        <label htmlFor="early-stop" className="ml-2 text-sm">Enable Early Stopping</label>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500 ml-6">Stop training if validation performance plateaus</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
          
          {/* Notes */}
          <section>
            <label className="block text-sm font-semibold text-neutral-900 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this predictor..."
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </section>
          
          {/* Predictor Name */}
          <section>
            <label className="block text-sm font-semibold text-neutral-900 mb-1">
              Predictor Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter predictor name"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Suggested: {predictor.name}_F{selectedFeatures.size}
            </p>
          </section>
          
          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleRetrain}
              disabled={!canRetrain}
              className="rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {trainingStep === "training" ? "Training..." : trainingStep === "creating" ? "Creating..." : "Re-train Predictor"}
            </button>
          </div>
        </div>
      </div>
      
      {/* Training Modal */}
      {trainingStep !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            {trainingStep === "training" && (
              <div className="text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                <h3 className="mt-4 text-lg font-semibold">Re-training Model...</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  This may take several minutes. Please don't close this page.
                </p>
              </div>
            )}
            
            {trainingStep === "creating" && (
              <div className="text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
                <h3 className="mt-4 text-lg font-semibold">Creating Predictor...</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Setting up your new predictor in the database.
                </p>
              </div>
            )}
            
            {trainingStep === "complete" && (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
                  ✓
                </div>
                <h3 className="mt-4 text-lg font-semibold">Training Complete!</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Redirecting to predictor page...
                </p>
              </div>
            )}
            
            {trainingStep === "error" && (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
                  ✕
                </div>
                <h3 className="mt-4 text-lg font-semibold">Training Failed</h3>
                <p className="mt-2 text-sm text-red-600">{trainingError}</p>
                <button
                  onClick={() => {
                    setTrainingStep("idle");
                    setTrainingError(null);
                  }}
                  className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-800"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
