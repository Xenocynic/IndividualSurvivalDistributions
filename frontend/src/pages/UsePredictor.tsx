import { useState, useEffect } from "react";
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

// Types for our local state
interface DatasetPreview {
  columns: string[];
  preview_data: any[][];
}

interface ValidationStatus {
  ok: boolean;
  message: string;
  missing?: string[];
  extra?: string[];
}

interface PredictionResult {
  status: "success" | "error";
  message: string;
  data?: any; // The full response from the ML API
}

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
      return;
    }

    // Get required features from predictor
    const requiredFeatures = selectedPredictor.ml_selected_features || [];
    const availableFeatures = datasetPreview.columns;

    // If trained on "all", we need to know what "all" was. 
    // The backend `ml_predict_unlabeled_data` handles this logic too, 
    // but for UI feedback we need it here.
    // If `requiredFeatures` is a string "all", we can't validate easily on frontend without more info.
    // But usually after training it should be a list.
    
    // Let's assume it's a list of strings.
    if (Array.isArray(requiredFeatures) && requiredFeatures.length > 0) {
        const missing = requiredFeatures.filter((f: string) => !availableFeatures.includes(f));
        const extra = availableFeatures.filter((f: string) => !requiredFeatures.includes(f) && f !== 'time' && f !== 'event'); // Ignore standard cols

        if (missing.length === 0) {
            setFeatureStatus({
                ok: true,
                message: `All ${requiredFeatures.length} required features present.`,
                extra
            });
        } else {
            setFeatureStatus({
                ok: false,
                message: `Missing ${missing.length} features.`,
                missing,
                extra
            });
        }
    } else {
        // Fallback if we can't validate (e.g. "all" or missing metadata)
        // We'll let the backend handle the strict validation
        setFeatureStatus({
            ok: true,
            message: "Ready to predict. (Feature validation will happen on server)"
        });
    }

  }, [selectedPredictor, selectedDataset, datasetPreview]);

  const runPrediction = async () => {
    if (!selectedPredictor || !selectedDataset) return;

    setLoading(true);
    setResults(null);
    try {
      const response = await api.post(
        `/api/predictors/${selectedPredictor.id}/ml/predict/`,
        { dataset_id: selectedDataset.id }
      );
      setResults({
        status: "success",
        message: "Prediction completed successfully.",
        data: response,
      });
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
          onValueChange={(val) => {
            const p = predictors.find((x) => x.id === val);
            setSelectedPredictor(p || null);
            setSelectedDataset(null);
            setFeatureStatus(null);
            setResults(null);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a trained predictor..." />
          </SelectTrigger>
          <SelectContent className="z-[9999]" position="popper">
            {predictors.length === 0 ? (
                <SelectItem value="none" disabled>No trained predictors available</SelectItem>
            ) : (
                predictors.map((p) => (
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
        <h2 className="text-xl font-bold mb-4">Select Unlabeled Dataset</h2>
        <Select
          disabled={!selectedPredictor}
          onValueChange={(val) => {
            const ds = datasets.find((x) => x.id === val);
            setSelectedDataset(ds || null);
            setResults(null);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a dataset..." />
          </SelectTrigger>
          <SelectContent>
            {datasets.map((d) => (
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
                        <strong>Missing:</strong> {featureStatus.missing.join(", ")}
                    </div>
                )}
                 {featureStatus.extra && featureStatus.extra.length > 0 && (
                    <div className="mt-1 text-yellow-700 text-sm">
                        <strong>Ignored Extra:</strong> {featureStatus.extra.join(", ")}
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
          className="px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
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

      {/* Results */}
      {results && (
        <Card className={`p-6 border-t-4 ${results.status === 'success' ? 'border-blue-500 bg-blue-50' : 'border-red-500 bg-red-50'}`}>
          <h3 className="text-xl font-bold mb-2">
            {results.status === 'success' ? "Prediction Results" : "Error"}
          </h3>
          <p className="mb-4">{results.message}</p>
          
          {results.status === 'success' && results.data && (
            <div className="bg-white p-4 rounded border overflow-auto max-h-96">
                <pre className="text-xs">{JSON.stringify(results.data, null, 2)}</pre>
                
                {/* 
                    TODO: Render a nice table or visualization here.
                    The ML API returns a JSON with predictions. 
                    We should parse it and show a table or download button.
                */}
                <div className="mt-4">
                    <Button variant="outline" onClick={() => {
                        // Create a blob and download
                        const blob = new Blob([JSON.stringify(results.data, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `prediction_results_${selectedPredictor?.id}_${selectedDataset?.id}.json`;
                        a.click();
                    }}>
                        Download JSON
                    </Button>
                </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
