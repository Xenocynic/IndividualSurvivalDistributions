import { api, publicApi } from "./apiClient";
import type { PredictorItem } from "../components/PredictorCard";

export type Predictor = {
  predictor_id: number;
  name: string;
  description: string;
  dataset: number;
  owner: number;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  time_unit: "year" | "month" | "day" | "hour";
};

/**
 * Create a new predictor.
 */
export async function createPredictor(body: {
  name: string;
  description: string;
  dataset_id: number;
}) {
  return api.post<Predictor>("/api/predictors/", body);
}

/**
 * Grant user access to predictor.
 */
export async function grantPredictorViewer(
  predictorId: number,
  userId: number
) {
  return api.post("/api/predictors/permissions/", {
    predictor: predictorId,
    user: userId,
  });
}

/**
 * List all predictors user owns or has access to.
 */
export async function listMyPredictors() {
  return api.get<Predictor[]>("/api/predictors/");
}

/**
 * Get a single predictor by ID.
 */
export async function getPredictor(id: number): Promise<Predictor> {
  return api.get<Predictor>(`/api/predictors/${id}/`);
}

/**
 * Update a predictor
 */
export async function updatePredictor(id: number, updatedData: {
  name?: string,
  description?: string,
  time_unit?: string,
  is_private?: boolean,
  }): Promise<Predictor> {
    return api.patch(`/api/predictors/${id}/`, updatedData);
}

/**
 * Pin a predictor
 */
export async function pinPredictor(id: string) {
  return api.post(`/api/predictors/${id}/pin/`);
}

/**
 * Unpin a predictor
 */
export async function unpinPredictor(id: string) {
  return api.post(`/api/predictors/${id}/unpin/`);
}

/**
 * UList pinned predictors
 */
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
  // Format the uploaded date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return {
    id: String(item.predictor_id ?? item.id ?? item.pk ?? ""),
    title: item.name ?? item.title ?? "Untitled predictor",
    status: item.status ?? (item.is_private ? "DRAFT" : "PUBLISHED"), // optional logic
    updatedAt: formatDate(item.updated_at) ?? item.modified ?? item.last_edited ?? undefined,
    owner:
      typeof item.owner === "number" && currentUserId !== undefined
        ? item.owner === currentUserId
        : Boolean(item.owner),
    notes: item.description ?? item.notes ?? "",
  };
}