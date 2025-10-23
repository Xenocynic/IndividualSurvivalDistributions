import { api, publicApi } from "./apiClient";
import type { PredictorItem } from "../components/PredictorCard";

export type Predictor = { predictor_id: number; name: string; description: string; dataset_id: number };

export async function createPredictor(body: { name: string; description: string; dataset_id: number }) {
  return api.post<Predictor>("/api/predictors/", body);
}

export async function grantPredictorViewer(predictorId: number, userId: number) {
  return api.post("/api/predictors/permissions/", { predictor: predictorId, user: userId });
}

export async function listMyPredictors() {
  return api.get<Predictor[]>("/api/predictors/");
}

// Pin a predictor
export async function pinPredictor(id: string) {
  return api.post(`/api/predictors/${id}/pin/`);
}

// Unpin a predictor
export async function unpinPredictor(id: string) {
  return api.post(`/api/predictors/${id}/unpin/`);
}

export async function listPinnedPredictors() {
  return api.get<any[]>(`/api/predictors/pins/`);
}

/**
 * List all public predictors (no authentication required).
 * This endpoint should be accessible to everyone.
 */
export async function listPublicPredictors() {
  return publicApi.get<Predictor[]>("/api/predictors/public/");
}

/**
 * Mapper function from API Predictor to UI PredictorItem
 */
export function mapApiPredictorToUi(item: any, currentUserId?: number): PredictorItem {
  return {
    id: String(item.predictor_id ?? item.id ?? item.pk ?? ""),
    title: item.name ?? item.title ?? "Untitled predictor",
    status: item.status ?? (item.is_private ? "DRAFT" : "PUBLISHED"), // optional logic
    updatedAt: item.updated_at ?? item.modified ?? item.last_edited ?? undefined,
    owner:
      typeof item.owner === "number" && currentUserId !== undefined
        ? item.owner === currentUserId
        : Boolean(item.owner),
    notes: item.description ?? item.notes ?? "",
  };
}