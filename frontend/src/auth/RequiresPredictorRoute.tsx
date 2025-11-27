import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/apiClient";
import { mapApiPredictorToUi } from "../lib/predictors";
import { useAuth } from "./AuthContext";

interface RequiresPredictorRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that ensures the user has at least one trained predictor
 * before allowing access to the wrapped route.
 * Redirects to /predictors/new if no trained predictors are found.
 */
export default function RequiresPredictorRoute({ children }: RequiresPredictorRouteProps) {
  const { user } = useAuth();
  const currentUserId = (user as any)?.id ?? (user as any)?.pk;
  const [loading, setLoading] = useState(true);
  const [hasTrainedPredictor, setHasTrainedPredictor] = useState(false);

  useEffect(() => {
    async function checkPredictors() {
      try {
        const predData = await api.get<any[]>("/api/predictors/");
        const mappedPreds = Array.isArray(predData)
          ? predData.map((p) => mapApiPredictorToUi(p, currentUserId))
          : [];
        
        // Check if user has any trained predictors
        const trainedPreds = mappedPreds.filter(
          p => p.ml_training_status === "Trained" || p.ml_training_status === "trained"
        );
        
        setHasTrainedPredictor(trainedPreds.length > 0);
      } catch (err) {
        console.error("Failed to check predictors", err);
        setHasTrainedPredictor(false);
      } finally {
        setLoading(false);
      }
    }

    checkPredictors();
  }, [currentUserId]);

  // Show loading state while checking
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking predictors...</p>
        </div>
      </div>
    );
  }

  // Redirect to create predictor page if no trained predictors
  if (!hasTrainedPredictor) {
    return <Navigate to="/predictors/new" replace state={{ from: "use-predictor" }} />;
  }

  // User has trained predictors, allow access
  return <>{children}</>;
}
