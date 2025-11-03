/**
 * DATASETS API HELPERS
 * -----------------------------------------------------------------------------
 * Server routes (current backend):
 *   POST /api/datasets/                 -> create dataset object with file upload
 *   GET  /api/datasets/                 -> list datasets (current user scope)
 *   POST /api/datasets/permissions/     -> grant viewer permission to a user
 *
 * Auth: JWT (Authorization: Bearer <access>), handled by apiClient automatically.
 * CORS: already configured
 */
import { api, publicApi } from "./apiClient";
import type { DatasetItem } from "../components/DatasetCard";

export type Dataset = {
  dataset_id: number;
  dataset_name: string;
  owner: number;
  owner_name: string;
  file_path?: string;
  original_filename?: string;
  file_size?: number;
  file_size_display?: string;
  file_display_name?: string;
  has_file?: boolean;
  notes?: string;
  time_unit: "year" | "month" | "day" | "hour";
  is_public: boolean;
  uploaded_at: string;
  folder_id?: string;
  folder_name?: string;
  num_features: number | null;
  num_labels: number | null;
};

export type CreateDatasetRequest = {
  dataset_name: string;
  file: File;
  notes?: string;
  time_unit: "year" | "month" | "day" | "hour";
  is_public: boolean;
  folder_id?: string;
};

/**
 * Create a dataset object with file upload.
 * Sends multipart form data with all required fields.
 */
export async function createDataset(request: CreateDatasetRequest) {
  const formData = new FormData();
  formData.append('dataset_name', request.dataset_name);
  formData.append('file', request.file);
  formData.append('time_unit', request.time_unit);
  formData.append('is_public', request.is_public.toString());

  if (request.notes) {
    formData.append("notes", request.notes);
  }

  if (request.folder_id) {
    formData.append("folder_id", request.folder_id);
  }

  return api.post<Dataset>("/api/datasets/", formData);
}

/** List the datasets visible to the current user (owner + shared)
 * I thiiiink this is how it works.
 */
export async function listMyDatasets(folderId?: string) {
  const url = folderId ? `/api/datasets/?folder=${folderId}` : "/api/datasets/";
  return api.get<Dataset[]>(url);
}

// Pin a dataset
export async function pinDataset(id: string) {
  return api.post(`/api/datasets/${id}/pin/`);
}

// Unpin a dataset
export async function unpinDataset(id: string) {
  return api.post(`/api/datasets/${id}/unpin/`);
}

export async function listPinnedDatasets() {
  return api.get<any[]>(`/api/datasets/pins/`);
}

/**
 * List all public datasets (no authentication required).
 * This endpoint should be accessible to everyone.
 */
export async function listPublicDatasets(folderId?: string) {
  const url = folderId
    ? `/api/datasets/public/?folder=${folderId}`
    : "/api/datasets/public/";
  return publicApi.get<Dataset[]>(url);
}

/**
 * Grant a user viewer access (permissions are "viewer" only for datasets).
 */
export async function grantDatasetViewer(dataset: number, user: number) {
  return api.post("/api/datasets/permissions/", { dataset, user });
}

/**
 * Get a single dataset by ID.
 */
export async function getDataset(datasetId: number): Promise<Dataset> {
  return api.get<Dataset>(`/api/datasets/${datasetId}/`);
}

/**
 * Update a dataset (metadata only - file cannot be changed).
 */
export async function updateDataset(
  datasetId: number,
  data: {
    dataset_name?: string;
    notes?: string;
    time_unit?: "year" | "month" | "day" | "hour";
    is_public?: boolean;
    folder_id?: string;
  }
): Promise<Dataset> {
  return api.patch<Dataset>(`/api/datasets/${datasetId}/`, data);
}

/**
 * Delete a dataset.
 * Removes the dataset and its associated file from the backend.
 */
export async function deleteDataset(datasetId: number): Promise<void> {
  return api.del(`/api/datasets/${datasetId}/`);
}

/**
 * Download a dataset file.
 * Returns a blob that can be used to create a download link.
 */
export async function downloadDatasetFile(
  datasetId: number
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(
    `${
      import.meta.env.VITE_API_BASE_URL || ""
    }/api/datasets/${datasetId}/download/`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${
          localStorage.getItem("auth_tokens")
            ? JSON.parse(localStorage.getItem("auth_tokens")!).access
            : ""
        }`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Download failed: ${response.statusText}`
    );
  }

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = `dataset_${datasetId}.csv`; // fallback filename

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  const blob = await response.blob();
  return { blob, filename };
}

/**
 * Mapper function from API Dataset to UI DatasetItem
 */
export function mapApiDatasetToUi(
  item: any,
  currentUserId?: number
): DatasetItem {
  // Format the uploaded date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Convert file size from bytes to MB
  const fileSizeMB = item.file_size
    ? Math.round((item.file_size / (1024 * 1024)) * 10) / 10
    : undefined;

  return {
    id: String(item.dataset_id ?? item.id ?? item.pk ?? ""),
    title: item.dataset_name ?? item.name ?? item.title ?? "Untitled dataset",
    // If API returns owner as an id, compare with current user id to produce boolean
    owner:
      typeof item.owner === "number" && currentUserId !== undefined
        ? item.owner === currentUserId
        : Boolean(item.owner),
    ownerId: item.owner ?? null,
    ownerName: item.owner_name ?? item.ownerName ?? null,
    updatedAt: item.uploaded_at
      ? formatDate(item.uploaded_at)
      : item.updated_at ?? item.updatedAt ?? item.modified ?? undefined,
    notes: item.notes ?? item.description ?? "",
    sizeMB: fileSizeMB,
    hasFile: item.has_file ?? Boolean(item.file_path),
    originalFilename: item.original_filename ?? item.originalFilename,
    folderId: item.folder_id ?? undefined,
    folderName: item.folder_name ?? undefined,
    __raw: item,
  };
}
