import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/use_predictor/button";
import { createPrediction } from "../lib/predictions";
import IndividualSurvivalCurves from "../components/IndividualSurvivalCurves";
import DCalibrationHistogram from "../components/DCalibrationHistogram";
import KaplanMeierVisualization from "../components/KaplanMeierVisualization";
import type { SurvivalCurvesData } from "../lib/predictors";

interface PredictionSaveModalProps {
  predictionData: any;
  survivalCurvesData: SurvivalCurvesData | null;
  predictorId: number;
  predictorName: string;
  datasetId: number;
  timeUnit: string | null;
  isLabeled: boolean;
  onClose: () => void;
}

type Tab = "individual" | "dcalibration" | "kaplan-meier";

export default function PredictionSaveModal({
  predictionData,
  survivalCurvesData,
  predictorId,
  predictorName,
  datasetId,
  timeUnit,
  isLabeled,
  onClose,
}: PredictionSaveModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("individual");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a name for this prediction");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Extract statistics from prediction data if available
      const metrics = predictionData?.metrics;
      const cIndex = metrics?.concordance_index || predictionData?.predictions?.statistics?.c_index || null;
      const ibsScore = metrics?.integrated_brier_score || predictionData?.predictions?.statistics?.ibs || null;

      await createPrediction({
        name: name.trim(),
        predictor_id: predictorId,
        dataset_id: datasetId,
        prediction_data: predictionData,
        is_labeled: isLabeled,
        c_index: cIndex,
        ibs_score: ibsScore,
      });

      // Navigate to My Predictions page
      navigate("/my-predictions");
    } catch (err: any) {
      console.error("Failed to save prediction", err);
      setError(err.message || "Failed to save prediction");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Save Prediction</h2>
          <p className="text-sm text-gray-600 mt-1">
            Give your prediction a name and save it for later viewing
          </p>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prediction Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AML Survival - Test Cohort"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </div>

          {/* Tabs for labeled predictions */}
          {isLabeled && predictionData?.full_predictions && (
            <div className="flex gap-2 border-b">
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

          {/* Tab Content */}
          <div>
            {activeTab === "individual" && survivalCurvesData && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Individual Survival Curves
                </h3>
                <IndividualSurvivalCurves
                  data={survivalCurvesData}
                  timeUnit={timeUnit}
                  predictorId={predictorId}
                />
              </div>
            )}

            {activeTab === "dcalibration" && isLabeled && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  D-Calibration Histogram
                </h3>
                <DCalibrationHistogram 
                  predictorId={predictorId}
                  predictorName={predictorName}
                />
              </div>
            )}

            {activeTab === "kaplan-meier" && isLabeled && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Kaplan-Meier Visualization
                </h3>
                <KaplanMeierVisualization
                  predictorId={predictorId}
                  predictorName={predictorName}
                  timeUnit={timeUnit}
                />
              </div>
            )}

            {/* Show survival curves even for unlabeled if no tabs */}
            {!isLabeled && survivalCurvesData && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Prediction Preview
                </h3>
                <IndividualSurvivalCurves
                  data={survivalCurvesData}
                  timeUnit={timeUnit}
                  predictorId={predictorId}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? "Saving..." : "Save Prediction"}
          </Button>
        </div>
      </div>
    </div>
  );
}
