import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/use_predictor/card";
import { Button } from "../components/use_predictor/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "../components/use_predictor/table";
import { listMyPredictions, deletePrediction, type Prediction } from "../lib/predictions";
import IndividualSurvivalCurves from "../components/IndividualSurvivalCurves";
import DCalibrationHistogram from "../components/DCalibrationHistogram";
import KaplanMeierVisualization from "../components/KaplanMeierVisualization";
import type { SurvivalCurvesData, SurvivalCurve } from "../lib/predictors";
import { useMemo } from "react";

export default function MyPredictions() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingPrediction, setViewingPrediction] = useState<Prediction | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"individual" | "dcalibration" | "kaplan-meier">("individual");
  
  // Filter state
  const [labeledFilter, setLabeledFilter] = useState<"all" | "labeled" | "unlabeled">("all");
  const [sortBy, setSortBy] = useState<"name" | "created" | "model">("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Load predictions
  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const data = await listMyPredictions(searchQuery || undefined);
      setPredictions(data);
    } catch (error) {
      console.error("Failed to load predictions", error);
    } finally {
      setLoading(false);
    }
  };

  // Search handler with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPredictions();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDelete = async (id: number) => {
    try {
      await deletePrediction(id);
      setPredictions(predictions.filter((p) => p.prediction_id !== id));
      setDeletingId(null);
    } catch (error) {
      console.error("Failed to delete prediction", error);
      alert("Failed to delete prediction");
    }
  };

  const handleView = (prediction: Prediction) => {
    setViewingPrediction(prediction);
  };

  // Transform prediction data for visualization
  const getSurvivalCurvesData = (prediction: Prediction): SurvivalCurvesData | null => {
    const predData = prediction.prediction_data;
    if (!predData?.predictions?.survival_curves || !predData?.predictions?.time_points) {
      return null;
    }

    const curves: Record<string, SurvivalCurve> = {};
    const survivalCurves = predData.predictions.survival_curves;
    const timePoints = predData.predictions.time_points;

    survivalCurves.forEach((probabilities: number[], index: number) => {
      curves[String(index)] = {
        times: timePoints,
        survival_probabilities: probabilities.map((p: number) => Math.min(100, p * 100)),
      };
    });

    return {
      quantile_levels: timePoints,
      survival_probabilities: [],
      curves,
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Filter and sort predictions
  const filteredAndSortedPredictions = useMemo(() => {
    let filtered = [...predictions];

    // Apply labeled filter
    if (labeledFilter === "labeled") {
      filtered = filtered.filter(p => p.is_labeled);
    } else if (labeledFilter === "unlabeled") {
      filtered = filtered.filter(p => !p.is_labeled);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "created") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "model") {
        comparison = a.predictor.name.localeCompare(b.predictor.name);
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [predictions, labeledFilter, sortBy, sortOrder]);

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Predictions</h1>
          <p className="text-gray-600 mt-1">
            View and manage survival predictions you've run across datasets.
          </p>
        </div>
        <Button
          onClick={() => navigate("/use-predictor")}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          + New Prediction
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name, dataset, model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Labeled Filter */}
          <select
            value={labeledFilter}
            onChange={(e) => setLabeledFilter(e.target.value as "all" | "labeled" | "unlabeled")}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Predictions</option>
            <option value="labeled">Labeled Only</option>
            <option value="unlabeled">Unlabeled Only</option>
          </select>
          
          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "created" | "model")}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="created">Sort by Created</option>
            <option value="name">Sort by Name</option>
            <option value="model">Sort by Model</option>
          </select>
          
          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </Card>

      {/* Predictions Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            Loading predictions...
          </div>
        ) : filteredAndSortedPredictions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg mb-2">No predictions found</p>
            <p className="text-sm">
              {searchQuery
                ? "Try a different search term"
                : "Run your first prediction to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-center">Labeled</TableHead>
                  <TableHead className="text-center">C-index</TableHead>
                  <TableHead className="text-center">IBS</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPredictions.map((prediction) => (
                  <TableRow key={prediction.prediction_id}>
                    <TableCell className="font-medium">{prediction.name}</TableCell>
                    <TableCell>{prediction.predictor.name}</TableCell>
                    <TableCell>{prediction.dataset.dataset_name}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(prediction.created_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        prediction.is_labeled 
                          ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {prediction.is_labeled ? "True" : "False"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {prediction.c_index !== null
                        ? prediction.c_index.toFixed(3)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {prediction.ibs_score !== null
                        ? prediction.ibs_score.toFixed(3)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(prediction)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingId(prediction.prediction_id)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* View Modal */}
      {viewingPrediction && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setViewingPrediction(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {viewingPrediction.name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {viewingPrediction.predictor.name} • {viewingPrediction.dataset.dataset_name}
                </p>
              </div>
              <button
                onClick={() => setViewingPrediction(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Tabs for labeled predictions */}
            {viewingPrediction.is_labeled && (
              <div className="flex gap-2 border-b px-6 pt-4">
                <button
                  onClick={() => setActiveTab("individual")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                    activeTab === "individual"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Individual Predictions
                </button>
                <button
                  onClick={() => setActiveTab("dcalibration")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                    activeTab === "dcalibration"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  D-Calibration Histogram
                </button>
                <button
                  onClick={() => setActiveTab("kaplan-meier")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                    activeTab === "kaplan-meier"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Kaplan Meier Visualization
                </button>
              </div>
            )}

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "individual" && (() => {
                const survivalData = getSurvivalCurvesData(viewingPrediction);
                return survivalData ? (
                  <IndividualSurvivalCurves
                    data={survivalData}
                    timeUnit={null}
                    predictorId={viewingPrediction.predictor.predictor_id}
                  />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p>No survival curves data available for this prediction.</p>
                  </div>
                );
              })()}
              
              {activeTab === "dcalibration" && viewingPrediction.is_labeled && (
                <DCalibrationHistogram 
                  predictorId={viewingPrediction.predictor.predictor_id}
                  predictorName={viewingPrediction.predictor.name}
                />
              )}
              
              {activeTab === "kaplan-meier" && viewingPrediction.is_labeled && (
                <KaplanMeierVisualization
                  predictorId={viewingPrediction.predictor.predictor_id}
                  predictorName={viewingPrediction.predictor.name}
                  timeUnit={null}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t flex justify-end">
              <Button variant="outline" onClick={() => setViewingPrediction(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Prediction?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this prediction? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(deletingId)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
