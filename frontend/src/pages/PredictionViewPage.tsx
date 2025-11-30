/**
 * PredictionViewPage
 *
 * Read-only view for an already-saved prediction.
 * Opened from My Predictions "View" button.
 * Shows:
 * - Title (prediction name) in the header
 * - Predictor + dataset info
 * - Visualizations (Individual / D-calibration / Kaplan–Meier) reusing
 *   the same components as the save page, but with no save UI.
 */

import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import IndividualSurvivalCurves from "../components/IndividualSurvivalCurves";
import DCalibrationHistogram from "../components/DCalibrationHistogram";
import KaplanMeierVisualization from "../components/KaplanMeierVisualization";
import type { SurvivalCurvesData, SurvivalCurve } from "../lib/predictors";
import type { Prediction } from "../lib/predictions";
import { AlertTriangle } from "lucide-react";

type Tab = "individual" | "dcalibration" | "kaplan-meier";

interface PredictionViewLocationState {
  prediction?: Prediction;
}

export default function PredictionViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { prediction } = (location.state || {}) as PredictionViewLocationState;

  // If user hit this route directly without going through My Predictions
  if (!prediction) {
    return (
      <div className="min-h-[60vh] bg-neutral-100">
        <div className="sticky top-[var(--app-nav-h,4rem)] z-40 w-full border-b bg-neutral-700 text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-7 py-3">
            <button
              onClick={() => navigate("/my-predictions")}
              className="inline-flex items-center rounded-md border border-white/10 bg-neutral-600 px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-neutral-500 active:translate-y-[0.5px]"
            >
              Back
            </button>
            <div className="text-lg font-semibold tracking-wide">
              Prediction details
            </div>
            <div className="w-[96px]" />
          </div>
          <div className="h-1 w-full bg-neutral-600" />
        </div>

        <div className="mx-auto max-w-5xl px-7 py-6">
          <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-neutral-700" />
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  No prediction selected
                </h2>
                <p className="mt-1 text-sm text-neutral-700">
                  This page is meant to be opened from the{" "}
                  <span className="font-semibold">My Predictions</span> page.
                  Please go back and choose a prediction to view.
                  {params?.predictionId && (
                    <>
                      {" "}
                      (URL id: <code>{params.predictionId}</code>)
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<Tab>("individual");

  const survivalCurvesData = useMemo(
    () => getSurvivalCurvesData(prediction),
    [prediction],
  );

  const isLabeled = prediction.is_labeled;
  const predictorName = prediction.predictor.name;
  const predictorId = prediction.predictor.predictor_id;
  const datasetName = prediction.dataset.dataset_name;

  const tabButtonClass = (tab: Tab) =>
    `rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
      activeTab === tab
        ? "bg-neutral-900 text-white shadow-sm"
        : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
    }`;

  return (
    <div className="min-h-[60vh] bg-neutral-100">
      {/* Sticky sub-header */}
      <div className="sticky top-[var(--app-nav-h,4rem)] z-40 w-full border-b bg-neutral-700 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-7 py-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center rounded-md border border-white/10 bg-neutral-600 px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-neutral-500 active:translate-y-[0.5px]"
          >
            Back
          </button>
          <div className="flex flex-col items-center text-center">
            <div className="text-lg font-semibold tracking-wide">
              {prediction.name}
            </div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-200">
              {predictorName} &middot; {datasetName}
            </div>
          </div>
          <div className="w-[96px]" />
        </div>
        <div className="h-1 w-full bg-neutral-600" />
      </div>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-7 py-6">
        <div className="space-y-6 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          {/* Meta summary (no save warning) */}
          <section className="space-y-1 rounded-lg border border-black/10 bg-neutral-50 p-4">
            <p className="text-sm text-neutral-800">
              <span className="font-semibold">Predictor:</span> {predictorName}
            </p>
            <p className="text-sm text-neutral-800">
              <span className="font-semibold">Dataset:</span> {datasetName}
            </p>
            <p className="text-xs text-neutral-600">
              This view shows the saved prediction results, including individual
              survival curves{isLabeled ? ", D-calibration, and Kaplan–Meier" : ""}.
            </p>
          </section>

          {/* Labeled datasets: tabs + three sections */}
          {isLabeled && survivalCurvesData && (
            <section className="space-y-6">
              {/* Tabs */}
              <div className="flex flex-wrap items-center justify-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("individual")}
                  className={tabButtonClass("individual")}
                >
                  Individual predictions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("dcalibration")}
                  className={tabButtonClass("dcalibration")}
                >
                  D-calibration histogram
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("kaplan-meier")}
                  className={tabButtonClass("kaplan-meier")}
                >
                  Kaplan–Meier visualization
                </button>
              </div>

              <div className="rounded-lg border border-black/10 bg-neutral-50 p-4">
                {activeTab === "individual" && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                      Individual survival curves
                    </h3>
                    <div className="max-w-full overflow-x-auto">
                      <div className="origin-top-left transform scale-[0.95]">
                        <IndividualSurvivalCurves
                          data={survivalCurvesData}
                          timeUnit={null}
                          predictorId={predictorId}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "dcalibration" && (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        D-calibration histogram
                      </h3>
                    </div>
                    <div className="max-w-full overflow-x-auto">
                      <div className="origin-top-left transform scale-[0.95]">
                        <DCalibrationHistogram
                          predictorId={predictorId}
                          predictorName={predictorName}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "kaplan-meier" && (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        Kaplan–Meier visualization
                      </h3>
                    </div>
                    <div className="max-w-full overflow-x-auto">
                      <div className="origin-top-left transform scale-[0.95]">
                        <KaplanMeierVisualization
                          predictorId={predictorId}
                          predictorName={predictorName}
                          timeUnit={null}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Unlabeled: only individual curves */}
          {!isLabeled && survivalCurvesData && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">
                Prediction preview
              </h3>
              <div className="rounded-lg border border-black/10 bg-neutral-50 p-4">
                <div className="max-w-full overflow-x-auto">
                  <div className="origin-top-left transform scale-[0.95]">
                    <IndividualSurvivalCurves
                      data={survivalCurvesData}
                      timeUnit={null}
                      predictorId={predictorId}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {!survivalCurvesData && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This prediction does not contain survival curves data that can be
              visualized in this view.
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Rebuild SurvivalCurvesData from a saved Prediction object,
 * same transformation as the old MyPredictions modal.
 */
function getSurvivalCurvesData(
  prediction: Prediction,
): SurvivalCurvesData | null {
  const predData = (prediction as any).prediction_data;
  if (
    !predData?.predictions?.survival_curves ||
    !predData?.predictions?.time_points
  ) {
    return null;
  }

  const curves: Record<string, SurvivalCurve> = {};
  const survivalCurves = predData.predictions.survival_curves;
  const timePoints = predData.predictions.time_points;

  survivalCurves.forEach((probabilities: number[], index: number) => {
    curves[String(index)] = {
      times: timePoints,
      survival_probabilities: probabilities.map((p: number) =>
        Math.min(100, p * 100),
      ),
    };
  });

  return {
    quantile_levels: timePoints,
    survival_probabilities: [],
    curves,
  };
}
