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