import { api } from "./apiClient";
import {type DatasetItem} from "../components/DatasetCard";

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

// Mapper function from Dataset to UI 
export function mapApiDatasetToUi(item: any, currentUserId?: number): DatasetItem {
  return {
    id: String(item.dataset_id ?? ""),
    title: item.dataset_name ??  "Untitled dataset",
    // If API returns owner as an id, compare with current user id to produce boolean
    owner:
      typeof item.owner_id === "number" && currentUserId !== undefined
        ? item.owner_id === currentUserId
        : Boolean(item.owner),
    ownerId: item.owner ?? null,
    ownerName: item.owner_name ?? item.ownerName ?? null,
    updatedAt: item.updated_at ?? item.updatedAt ?? item.modified ?? undefined,
    notes: item.description ?? item.notes ?? "",
    __raw: item,
  };
  }