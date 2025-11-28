/**
 * Prediction Save Modal Component
 * 
 * A modal dialog for saving prediction results to the database.
 * Displays prediction visualizations and allows users to name and save their predictions.
 * 
 * Features:
 * - Tabbed interface for labeled predictions (Individual, D-Calibration, Kaplan-Meier)
 * - Simplified view for unlabeled predictions (Individual curves only)
 * - Automatic extraction of C-index and IBS metrics for labeled datasets
 * - Redirects to My Predictions page after successful save
 */

/**
 * PredictionSaveModal Component
 * 
 * Modal dialog for saving prediction results to the database.
 * Displays prediction results in a tabbed interface and allows users to name and save the prediction.
 * 
 * Features:
 * - Name input for the prediction
 * - Preview of survival curves
 * - Tabbed interface for labeled datasets (Individual Predictions, D-Calibration, Kaplan-Meier)
  * - Automatic extraction of C-index and IBS metrics from prediction data
 * - Error handling and loading states
 * - Navigation to My Predictions page after successful save
 * 
 * @example
 * ```tsx
 * <PredictionSaveModal
 *   predictionData={mlApiResponse}
 *   survivalCurvesData={transformedCurves}
 *   predictorId={5}
 *   predictorName="Cancer Risk Model"
 *   datasetId={12}
 *   timeUnit="months"
 *   isLabeled={true}
 *   onClose={() => setShowModal(false)}
 * />
 * ```
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/use_predictor/button";
import { createPrediction } from "../lib/predictions";
import IndividualSurvivalCurves from "../components/IndividualSurvivalCurves";
import DCalibrationHistogram from "../components/DCalibrationHistogram";
import KaplanMeierVisualization from "../components/KaplanMeierVisualization";
import type { SurvivalCurvesData } from "../lib/predictors";

/**
 * Props for the PredictionSaveModal component
 */
interface PredictionSaveModalProps {
  /** Full prediction response from the ML API */
  predictionData: any;
  
  /** Transformed survival curves data for visualization */
  survivalCurvesData: SurvivalCurvesData | null;
  
  /** ID of the predictor used for this prediction */
  predictorId: number;
  
  /** Name of the predictor used for this prediction */
  predictorName: string;
  
  /** ID of the dataset the prediction was run on */
  datasetId: number;
  
  /** Time unit for the predictor (e.g., "days", "months") */
  timeUnit: string | null;
  
  /** Whether this prediction was made on a labeled dataset (has time/censored columns) */
  isLabeled: boolean;
  
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * Available tab options for labeled predictions
 */
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
