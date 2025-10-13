import { api } from "./apiClient";

export type Dataset = { dataset_id: number; dataset_name: string };
export async function createDataset(name: string) {
  return api.post<Dataset>("/api/datasets/", { dataset_name: name });
}
export async function listMyDatasets() {
  return api.get<Dataset[]>("/api/datasets/");
}
export async function grantDatasetViewer(datasetId: number, userId: number) {
  return api.post("/api/datasets/permissions/", { dataset: datasetId, user: userId });
}
