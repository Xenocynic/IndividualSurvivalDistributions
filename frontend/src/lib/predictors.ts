/**
 * PREDICTORS API HELPERS
 * -----------------------------------------------------------------------------
 * Server routes (current backend):
 *   POST /api/predictors/                 -> create predictor object with corresponding dataset
 *   GET  /api/predictors/                 -> list predictors (current user scope)
 *   POST /api/predictors/permissions/     -> grant viewer permission to a user
 *
 * Auth: JWT (Authorization: Bearer <access>), handled by apiClient automatically.
 * CORS: already configured 
 */



import { api } from "./apiClient";


export type Predictor = { predictor_id: number; name: string; description: string; dataset: number };

export async function createPredictor(body: { name: string; description: string; dataset: number }) {
  return api.post<Predictor>("/api/predictors/", body);
}

export async function grantPredictorViewer(predictorId: number, userId: number) {
  return api.post("/api/predictors/permissions/", { predictor: predictorId, user: userId });
}

export async function listMyPredictors() {
  return api.get<Predictor[]>("/api/predictors/");
}

/**
 * List all public predictors (no authentication required).
 * This endpoint should be accessible to everyone.
 */
export async function listPublicPredictors() {
  return api.get<Predictor[]>("/api/predictors/public/");
}