import { api } from "./apiClient";
import {type PredictorItem} from "../components/PredictorCard";

export type Predictor = { predictor_id: number; name: string; description: string; dataset: number };

export async function createPredictor(body: { name: string; description: string; dataset: number }) {
  return api.post<Predictor>("/api/predictors/", body);
}
export async function grantPredictorViewer(predictorId: number, userId: number) {
  return api.post("/api/predictors/permissions/", { predictor: predictorId, user: userId });
}

// Mapper function from Predictor to UI
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
