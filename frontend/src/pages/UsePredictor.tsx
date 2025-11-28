/**
 * Use Predictor Page
 * 
 * Single-page workflow for running predictions on datasets using trained models.
 * Provides a guided three-step process: select predictor, select dataset, run prediction.
 * 
 * Workflow:
 * 1. Select a trained predictor from dropdown (auto-loads metadata)
 * 2. Select a dataset from dropdown (auto-loads preview and validates features)
 * 3. Review validation status and run prediction if features match
 * 4. Save prediction results with a custom name
 * 
 * Features:
 * - Automatic feature validation (checks for missing/extra features)
 * - Truncated feature display (shows first 10 with "..." for long lists)
 * - Dataset preview with first 10 rows
 * - Labeled dataset detection (checks for time/censored columns)
 * - Yellow warning banner for labeled datasets
 * - Full-screen loading modal during prediction
 * - Enhanced button hover effects (scale, shadow)
 * - Performance optimizations (memoized dropdowns, callbacks)
 * 
 * Validation Logic:
 * - Checks that selected dataset has EXACT features required by predictor
 * - Allows predictions only when features match perfectly  * - Detects and ignores time/censored columns for labeled datasets
 * - Displays truncated list of missing/extra features for better UX
 * 
 * State Management:
 * - predictors: List of all trained predictors
 * - datasets: List of all available datasets
 * - selectedPredictor: Currently selected predictor (with metadata)
 * - selectedDataset: Currently selected dataset
 * - datasetPreview: Preview data for selected dataset (columns + 10 rows)
 * - featureStatus: Validation result (ok/not ok, message, missing, extra)
 * - loading: Whether prediction is currently running
 * - results: Prediction results from ML API
 * - isLabeledDataset: Whether dataset has time/censored columns
 * - survivalCurvesData: Transformed curves for visualization
 * - showSaveModal: Whether save modal is visible
 * 
 * Performance Optimizations:
 * - Memoized dropdown options to prevent re-renders
 * - useCallback for change handlers
 * - Debounced feature validation
 * 
 * API Integration:
 * - Fetches predictors and datasets on mount
 * - Fetches dataset preview when dataset selected
 * - Runs prediction via /api/predictors/:id/ml/predict/
 * - Passes labeled=true parameter for labeled datasets
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "../components/use_predictor/card";
import { Button } from "../components/use_predictor/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/use_predictor/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "../components/use_predictor/table";
import { api } from "../lib/apiClient";
import { useAuth } from "../auth/AuthContext";
import { mapApiPredictorToUi } from "../lib/predictors";
import { type PredictorItem } from "../components/PredictorCard";
import { type DatasetItem } from "../components/DatasetCard";
import { mapApiDatasetToUi } from "../lib/datasets";
import type { SurvivalCurvesData, SurvivalCurve } from "../lib/predictors";
import PredictionSaveModal from "../components/PredictionSaveModal";

/**
 * Local type definitions for Use Predictor page
 */

/** Dataset preview structure returned from backend */
interface DatasetPreview {
  /** Column names in the dataset */
  columns: string[];
  /** First 10 rows of data (2D array) */
  preview_data: any[][];
}

/** Feature validation result */
interface ValidationStatus {
  /** Whether features match requirements */
  ok: boolean;
  /** Human-readable validation message */
  message: string;
  /** List of missing required features (if any) */
  missing?: string[];
  /** List of extra features not used in training (if any) */
  extra?: string[];
}

/** Prediction result from ML API */
interface PredictionResult {
  /** Whether prediction succeeded or failed */
  status: "success" | "error";
  /** Status message */
  message: string;
  /** Full prediction data from ML API (if successful) */
  data?: any;
}

/**
 * Truncates a list of features for display
 * 
 * Shows up to maxDisplay features followed by "..." if list is longer.
 * Used to prevent overwhelming the user with long feature lists.
 * 
 * @param features - Array of feature names
 * @param maxDisplay - Maximum number of features to show (default: 10)
 * @returns Comma-separated string of features, truncated if necessary
 * 
 * @example
 * truncateFeatures(['a', 'b', 'c'], 10) // Returns: "a, b, c"
 * truncateFeatures(['a', 'b', ..., 'z'], 10) // Returns: "a, b, c, d, e, f, g, h, i, j..."
 */
const truncateFeatures = (features: string[], maxDisplay: number = 10): string => {
  if (features.length <= maxDisplay) {
    return features.join(', ');
  }
  return features.slice(0, maxDisplay).join(', ') + '...';
};

/**
 * UsePredictor Page Component
 * 
 * Main component for the Use Predictor page.
 * Implements a three-step workflow for running predictions.
 * 
 * @returns JSX element containing the prediction workflow interface
 */
export default function UsePredictor() {
  const { user } = useAuth();
  const currentUserId = (user as any)?.id ?? (user as any)?.pk;

  // Data state
  const [predictors, setPredictors] = useState<PredictorItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);

  // Selection state
  const [selectedPredictor, setSelectedPredictor] = useState<PredictorItem | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [datasetPreview, setDatasetPreview] = useState<DatasetPreview | null>(null);

  // Status state
  const [featureStatus, setFeatureStatus] = useState<ValidationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [results, setResults] = useState<PredictionResult | null>(null);
  const [isLabeledDataset, setIsLabeledDataset] = useState(false);
  const [survivalCurvesData, setSurvivalCurvesData] = useState<SurvivalCurvesData | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);


  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [predData, dsData] = await Promise.all([
          api.get<any[]>("/api/predictors/"),
          api.get<any[]>("/api/datasets/"),
        ]);

        const mappedPreds = Array.isArray(predData)
          ? predData.map((p) => mapApiPredictorToUi(p, currentUserId))
          : [];
        const mappedDatasets = Array.isArray(dsData)
          ? dsData.map((d) => mapApiDatasetToUi(d, currentUserId))
          : [];

        // Filter only trained predictors
        const trainedPreds = mappedPreds.filter(p => p.ml_training_status === "Trained" || p.ml_training_status === "trained");
        
        setPredictors(trainedPreds);
        setDatasets(mappedDatasets);
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    }
    fetchData();
  }, [currentUserId]);

  // Fetch dataset preview when dataset is selected
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetPreview(null);
      return;
    }

    async function fetchPreview() {
      setPreviewLoading(true);
      try {
        const data = await api.get<DatasetPreview>(
          `/api/datasets/${selectedDataset?.id}/preview/`
        );
        setDatasetPreview(data);
      } catch (err) {
        console.error("Failed to fetch dataset preview", err);
        setDatasetPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }

    fetchPreview();
  }, [selectedDataset]);

  // Validate features when both are selected and preview is ready
  useEffect(() => {
    if (!selectedPredictor || !selectedDataset || !datasetPreview) {
      setFeatureStatus(null);
      setIsLabeledDataset(false);
      return;
    }

    // Check if dataset is labeled (has time and censored columns which are case-insensitive)
    const hasTimeColumn = datasetPreview.columns.some(col =>
      /time/i.test(col)
    );
    const hasCensoredColumn = datasetPreview.columns.some(col =>
      /censored/i.test(col)
    );

    // If dataset is labeled, pass parameter (labeled=True) to backend to generate full predictions when predicting
    const isLabeled = hasTimeColumn && hasCensoredColumn;
    setIsLabeledDataset(isLabeled);

    // Get required features from predictor
    const requiredFeatures = selectedPredictor.ml_selected_features || [];
    
    // Filter out time and censored columns from available features
    const availableFeatures = datasetPreview.columns.filter((col: string) =>
      !/time|censored/i.test(col)
    );

  
    // Feature validation logic
    if (Array.isArray(requiredFeatures) && requiredFeatures.length > 0) {
        const missing = requiredFeatures.filter((f: string) => !availableFeatures.includes(f));
        const extra = availableFeatures.filter((f: string) => !requiredFeatures.includes(f));

        if (missing.length === 0 && extra.length === 0) {
            // Perfect match - all required features present, no extra features
            setFeatureStatus({
                ok: true,
                message: `All ${requiredFeatures.length} required features are present.`,
            });
        } else if (missing.length === 0 && extra.length > 0) {
            // All required features present but has extra features
            setFeatureStatus({
                ok: false,
                message: `Dataset has ${extra.length} extra feature(s) not used in training: ${truncateFeatures(extra)}`,
                extra
            });
        } else {
            // Missing required features
            setFeatureStatus({
                ok: false,
                message: `Missing ${missing.length} required feature(s):`,
                missing,
                extra
            });
        }
    } else {
        // Fallback if we can't validate 
        setFeatureStatus({
            ok: false,
            message: "Feature validation failed."
        });
    }

  }, [selectedPredictor, selectedDataset, datasetPreview]);

  // Memoize dropdown options to prevent re-renders
  const predictorOptions = useMemo(() => predictors, [predictors]);
  const datasetOptions = useMemo(() => datasets, [datasets]);
  
  // Memoize change handlers
  const handlePredictorChange = useCallback((val: string) => {
    const pred = predictors.find((x) => x.id === val);
    setSelectedPredictor(pred || null);
    setSelectedDataset(null);
    setDatasetPreview(null);
    setFeatureStatus(null);
    setResults(null);
  }, [predictors]);
  
  const handleDatasetChange = useCallback((val: string) => {
    const ds = datasets.find((x) => x.id === val);
    setSelectedDataset(ds || null);
    setResults(null);
  }, [datasets]);

  const runPrediction = async () => {
    if (!selectedPredictor || !selectedDataset) return;

    setLoading(true);
    setResults(null);
    setSurvivalCurvesData(null);
    
    try {
      // Build request payload
      const payload: any = { dataset_id: selectedDataset.id };
      
      // Add labeled parameter if dataset is labeled
      if (isLabeledDataset) {
        payload.labeled = true;
      }
      
      const response: any = await api.post(
        `/api/predictors/${selectedPredictor.id}/ml/predict/`,
        payload
      );
      
      console.log('Prediction response:', response);
      
      // Transform survival curves data if present
      // Response structure: { predictions: { survival_curves: [[...], [...]], time_points: [...] } }
      if (response.predictions?.survival_curves && response.predictions?.time_points) {
        const curves: Record<string, SurvivalCurve> = {};
        const survivalCurves = response.predictions.survival_curves;
        const timePoints = response.predictions.time_points;
        
        console.log('Transforming survival curves...');
        console.log('Number of curves:', survivalCurves.length);
        console.log('Number of time points:', timePoints.length);
        
        // Each survival_curves[i] is an array of probabilities for individual i
        survivalCurves.forEach((probabilities: number[], index: number) => {
          curves[String(index)] = {
            times: timePoints,
            // Convert to percentage and clamp to max 100% (some values are slightly > 1.0)
            survival_probabilities: probabilities.map((p: number) => Math.min(100, p * 100))
          };
        });
        
        const transformedData = {
          quantile_levels: timePoints, // Use time_points as quantile_levels
          survival_probabilities: [], // Not used by component
          curves
        };
        
        console.log('Transformed survival curves data:', transformedData);
        console.log('Sample curve 0:', curves['0']);
        setSurvivalCurvesData(transformedData);
      } else {
        console.warn('No survival curves data in response');
        console.log('Response structure:', Object.keys(response));
        if (response.predictions) {
          console.log('Predictions keys:', Object.keys(response.predictions));
        }
      }
      
      setResults({
        status: "success",
        message: "Prediction completed successfully.",
        data: response,
      });
      
      // Show save modal after successful prediction
      setShowSaveModal(true);
    } catch (err: any) {
      console.error("Prediction failed", err);
      setResults({
        status: "error",
        message: err.message || "Prediction failed. Please check the logs.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Use Predictor</h1>
      
      {/* Predictor Selector */}
      <Card className="p-6 overflow-visible relative z-auto">
        <h2 className="text-xl font-bold mb-4">Select Predictor</h2>
        <Select
          onValueChange={handlePredictorChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a trained predictor..." />
          </SelectTrigger>
          <SelectContent className="z-[9999]" position="popper">
            {predictors.length === 0 ? (
                <SelectItem value="none" disabled>No trained predictors available</SelectItem>
            ) : (
                predictorOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                    {p.title} {p.ml_training_status === "Trained" ? "✅" : ""}
                </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>

        {selectedPredictor && (
          <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Predictor Info</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span className="font-medium text-gray-700">Status:</span> {selectedPredictor.status}
                </div>
                <div>
                    <span className="font-medium text-gray-700">Last Updated:</span> {selectedPredictor.updatedAt}
                </div>
                <div className="col-span-2">
                    <span className="font-medium text-gray-700">Description:</span> 
                    <p className="mt-1 text-gray-600">{selectedPredictor.notes || "No description provided."}</p>
                </div>
            </div>

            {selectedPredictor.model_metadata && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Model Configuration</h4>
                <p><strong>Model type:</strong> {selectedPredictor.model_metadata.model_type}</p>
                <p><strong>Trained on:</strong> {selectedPredictor.dataset?.original_filename}</p>
                <p><strong>Required features:</strong> {selectedPredictor.model_metadata.n_features}</p>
                <p><strong>Trained at:</strong> {selectedPredictor.ml_trained_at}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Dataset Selector */}
      <Card className={`p-6 transition-opacity ${!selectedPredictor ? "opacity-50 pointer-events-none" : ""}`}>
        <h2 className="text-xl font-bold mb-4">Select Dataset</h2>
        <Select
          disabled={!selectedPredictor}
          onValueChange={handleDatasetChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a dataset..." />
          </SelectTrigger>
          <SelectContent>
            {datasetOptions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedDataset && (
          <div className="mt-4">
            {previewLoading ? (
                <div className="text-center py-4 text-gray-500">Loading preview...</div>
            ) : datasetPreview ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Dataset Preview (First 10 rows)</h3>
                    <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            {datasetPreview.columns.map((col) => (
                                <TableHead key={col} className="font-bold whitespace-nowrap">{col}</TableHead>
                            ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {datasetPreview.preview_data.map((row, i) => (
                            <TableRow key={i}>
                                {row.map((cell, j) => (
                                <TableCell key={j} className="whitespace-nowrap">
                                    {cell !== null ? String(cell) : <span className="text-gray-400 italic">null</span>}
                                </TableCell>
                                ))}
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Showing {datasetPreview.preview_data.length} rows and {datasetPreview.columns.length} columns.</p>
                    
                    {/* Informational message for labeled datasets */}
                    {isLabeledDataset && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-400 rounded-lg">
                        <p className="text-sm text-yellow-900">
                          <span className="font-semibold">⚠️ Note:</span> This dataset contains <code className="bg-yellow-100 px-1 rounded">time</code> and <code className="bg-yellow-100 px-1 rounded">censored</code> columns which will be ignored for prediction purposes.
                        </p>
                      </div>
                    )}
                </div>
            ) : (
                <div className="text-red-500 mt-2">Failed to load preview.</div>
            )}
          </div>
        )}
      </Card>

      {/* Feature Validation */}
      {featureStatus && (
        <Card className={`p-4 border-l-4 ${featureStatus.ok ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"}`}>
          <div className="flex items-start gap-3">
            <div className={`text-2xl ${featureStatus.ok ? "text-green-500" : "text-red-500"}`}>
                {featureStatus.ok ? "✓" : "⛔"}
            </div>
            <div>
                <h3 className={`font-bold ${featureStatus.ok ? "text-green-800" : "text-red-800"}`}>
                    {featureStatus.ok ? "Feature Check Passed" : "Feature Mismatch"}
                </h3>
                <p className={`${featureStatus.ok ? "text-green-700" : "text-red-700"}`}>
                    {featureStatus.message}
                </p>
                
                {featureStatus.missing && featureStatus.missing.length > 0 && (
                    <div className="mt-2 text-red-700 text-sm">
                        <strong>Missing:</strong> {truncateFeatures(featureStatus.missing)}
                    </div>
                )}
                 {featureStatus.extra && featureStatus.extra.length > 0 && (
                    <div className="mt-1 text-yellow-700 text-sm">
                        <strong>Ignored Extra:</strong> {truncateFeatures(featureStatus.extra)}
                    </div>
                )}
            </div>
          </div>
        </Card>
      )}

      {/* Run Prediction */}
      <div className="flex justify-center pt-4">
        <Button
          disabled={!featureStatus || !featureStatus.ok || loading}
          onClick={runPrediction}
          className="px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200"
          size="lg"
        >
          {loading ? (
             <>
               <span className="animate-spin mr-2">⏳</span> Running Prediction...
             </>
          ) : (
            "Run Prediction"
          )}
        </Button>
      </div>

      {/* Full-Screen Loading Modal */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-md">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Predicting...</h3>
            <p className="text-gray-600 text-center">
              Running prediction on your dataset. This may take a few moments.
            </p>
          </div>
        </div>
      )}

     
      
      {/* Save Modal */}
      {showSaveModal && selectedPredictor && selectedDataset && results?.data && (
        <PredictionSaveModal
          predictionData={results.data}
          survivalCurvesData={survivalCurvesData}
          predictorId={parseInt(selectedPredictor.id)}
          predictorName={selectedPredictor.title}
          datasetId={parseInt(selectedDataset.id)}
          timeUnit={selectedPredictor.dataset?.time_unit || null}
          isLabeled={isLabeledDataset}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
