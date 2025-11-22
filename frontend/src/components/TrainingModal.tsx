import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrainingStatus } from '../lib/predictors';

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
  autoNavigateOnComplete = false
}: TrainingModalProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [status, setStatus] = useState<'training' | 'complete' | 'failed'>('training');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: number;

    const pollTrainingStatus = async () => {
      try {
        const statusData = await getTrainingStatus(predictorId);

        // Update progress
        if (statusData.progress) {
          setProgress(statusData.progress);
        }

        // Check if training is complete
        if (statusData.status === 'trained') {
          clearInterval(pollInterval);
          setStatus('complete');
          setProgress({
            ...statusData.progress,
            estimated_progress: 100,
            message: 'Training completed successfully!'
          });

          if (autoNavigateOnComplete) {
            setTimeout(() => {
              navigate(`/predictors/${predictorId}`);
            }, 2000);
          }
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval);
          setStatus('failed');
          setError(statusData.error || 'Training failed');
        }
      } catch (err: any) {
        console.error('Error polling training status:', err);
        // Don't stop polling on error, might be temporary network issue
      }
    };

    // Start polling immediately
    pollTrainingStatus();
    pollInterval = setInterval(pollTrainingStatus, 1000); // Poll every 1 second

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  }, [predictorId, autoNavigateOnComplete, navigate]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        {/* Close button (only if onClose is provided) */}
        {onClose && status !== 'complete' && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {status === 'training' && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
            <h3 className="text-lg font-semibold">Training ML Model...</h3>
            <p className="mt-2 text-sm text-neutral-600">
              {progress?.message || 'Training in progress...'}
            </p>

            {/* Progress Bar */}
            {progress?.estimated_progress !== undefined && (
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-xs text-neutral-600">
                  <span>Progress</span>
                  <span>{progress.estimated_progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${progress.estimated_progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Detailed Progress Info */}
            {progress && progress.current_experiment && (
              <div className="mt-4 space-y-1 rounded-md bg-blue-50 p-3 text-xs text-blue-800">
                {progress.current_experiment && progress.total_experiments && (
                  <div className="font-medium">
                    📊 Running cross-validation: Fold {progress.current_experiment} of {progress.total_experiments}
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  {progress.elapsed_seconds !== undefined && (
                    <div>
                      ⏱️ Elapsed: {Math.floor(progress.elapsed_seconds / 60)}m {progress.elapsed_seconds % 60}s
                    </div>
                  )}
                  {progress.eta_seconds !== undefined && progress.eta_seconds > 0 && (
                    <div>
                      🕐 Remaining: ~{Math.floor(progress.eta_seconds / 60)}m {progress.eta_seconds % 60}s
                    </div>
                  )}
                </div>
                <div className="mt-2 text-neutral-600">
                  {onClose
                    ? "You can close this window and training will continue in the background."
                    : "The model is learning from your dataset. This may take a few minutes."}
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'complete' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
              ✓
            </div>
            <h3 className="text-lg font-semibold">Training Complete!</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Your predictor has been trained successfully.
            </p>
            {autoNavigateOnComplete && (
              <p className="mt-1 text-xs text-neutral-500">Redirecting to predictor details...</p>
            )}
            {onClose && !autoNavigateOnComplete && (
              <button
                onClick={onClose}
                className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Close
              </button>
            )}
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
              ✕
            </div>
            <h3 className="text-lg font-semibold">Training Failed</h3>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            {onClose && (
              <button
                onClick={onClose}
                className="mt-4 rounded-md bg-neutral-600 px-4 py-2 text-sm text-white hover:bg-neutral-700"
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
