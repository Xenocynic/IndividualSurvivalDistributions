import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import { getTrainingStatus } from "../lib/predictors";

interface TrainingProgress {
  current_experiment?: number;
  total_experiments?: number;
  message?: string;
  estimated_progress?: number;
  elapsed_seconds?: number;
  eta_seconds?: number;
}

interface TrainingModalProps {
  predictorId: number;
  onClose?: () => void;
  autoNavigateOnComplete?: boolean;
}

export default function TrainingModal({
  predictorId,
  onClose,
  autoNavigateOnComplete = false,
}: TrainingModalProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [status, setStatus] = useState<"training" | "complete" | "failed">(
    "training"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: number;

    const pollTrainingStatus = async () => {
      try {
        const statusData = await getTrainingStatus(predictorId);

        if (statusData.progress) {
          setProgress(statusData.progress);
        }

        if (statusData.status === "trained") {
          clearInterval(pollInterval);
          setStatus("complete");
          setProgress({
            ...statusData.progress,
            estimated_progress: 100,
            message: "Training completed successfully.",
          });

          if (autoNavigateOnComplete) {
            setTimeout(() => {
              navigate(`/predictors/${predictorId}`);
            }, 2000);
          }
        } else if (statusData.status === "failed") {
          clearInterval(pollInterval);
          setStatus("failed");
          setError(statusData.error || "Training failed.");
        }
      } catch (err) {
        // Keep polling; transient errors are possible
        // eslint-disable-next-line no-console
        console.error("Error polling training status:", err);
      }
    };

    // Start polling immediately
    pollTrainingStatus();
    pollInterval = window.setInterval(pollTrainingStatus, 1000);

    return () => clearInterval(pollInterval);
  }, [predictorId, autoNavigateOnComplete, navigate]);

  const formatTime = (seconds?: number) => {
    if (seconds === undefined || seconds === null || seconds < 0) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-xl border border-black/10 bg-white p-6 shadow-2xl">
        {/* Close button (only if onClose is provided and training not complete) */}
        {onClose && status !== "complete" && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-neutral-400 transition hover:text-neutral-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {status === "training" && (
          <div className="text-center">
            {/* Correct spinner */}
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />

            <h3 className="text-base font-semibold text-neutral-900">
              Training ML model…
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              {progress?.message || "Training in progress."}
            </p>

            {/* Progress Bar */}
            {progress?.estimated_progress !== undefined && (
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-xs text-neutral-600">
                  <span>Progress</span>
                  <span>{progress.estimated_progress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-md border border-neutral-300 bg-neutral-50">
                  <div
                    className="h-full rounded-md bg-neutral-800 transition-all duration-500"
                    style={{ width: `${progress.estimated_progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Detailed Progress Info */}
            {progress && progress.current_experiment && (
              <div className="mt-4 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-left text-xs text-neutral-700">
                {progress.current_experiment &&
                  progress.total_experiments && (
                    <div className="font-medium">
                      Cross-validation: fold {progress.current_experiment} of{" "}
                      {progress.total_experiments}
                    </div>
                  )}
                <div className="flex justify-between gap-4 text-neutral-600">
                  {progress.elapsed_seconds !== undefined && (
                    <div>Elapsed: {formatTime(progress.elapsed_seconds)}</div>
                  )}
                  {progress.eta_seconds !== undefined &&
                    progress.eta_seconds > 0 && (
                      <div>
                        Estimated remaining: {formatTime(progress.eta_seconds)}
                      </div>
                    )}
                </div>
                <div className="mt-2 text-neutral-600">
                  {onClose
                    ? "You can close this window; training will continue in the background."
                    : "The model is training on your dataset. This may take a few minutes."}
                </div>
              </div>
            )}
          </div>
        )}

        {status === "complete" && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-neutral-50 text-neutral-800">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900">
              Training complete
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Your predictor has been trained successfully.
            </p>
            {autoNavigateOnComplete && (
              <p className="mt-1 text-xs text-neutral-500">
                Redirecting to predictor details…
              </p>
            )}
            {onClose && !autoNavigateOnComplete && (
              <button
                onClick={onClose}
                className="mt-4 inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
              >
                Close
              </button>
            )}
          </div>
        )}

        {status === "failed" && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900">
              Training failed
            </h3>
            <p className="mt-2 text-sm text-red-600">
              {error || "An error occurred while training this predictor."}
            </p>
            {onClose && (
              <button
                onClick={onClose}
                className="mt-4 inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
