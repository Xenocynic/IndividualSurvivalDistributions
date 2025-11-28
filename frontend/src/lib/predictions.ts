import { api } from "./apiClient";

// Types
export interface Prediction {
  prediction_id: number;
  user: {
    id: number;
    username: string;
    email: string;
  };
  predictor: {
    predictor_id: number;
    name: string;
  };
  dataset: {
    dataset_id: number;
    dataset_name: string;
    original_filename?: string;
  };
  name: string;
  is_labeled: boolean;
  prediction_data: any; // Full prediction response from ML API
  c_index: number | null;
  ibs_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePredictionRequest {
  name: string;
  predictor_id: number;
  dataset_id: number;
  prediction_data: any;
  is_labeled?: boolean;
  c_index?: number | null;
  ibs_score?: number | null;
}

// API Functions
export async function listMyPredictions(search?: string): Promise<Prediction[]> {
  if (search) {
    return api.get<Prediction[]>("/api/predictions/", { params: { search } });
  }
  return api.get<Prediction[]>("/api/predictions/");
}

export async function getPrediction(id: number): Promise<Prediction> {
  return api.get<Prediction>(`/api/predictions/${id}/`);
}

export async function createPrediction(data: CreatePredictionRequest): Promise<Prediction> {
  return api.post<Prediction>("/api/predictions/", data);
}

export async function deletePrediction(id: number): Promise<void> {
  return api.del(`/api/predictions/${id}/`);
}
