/**
 * DATASETS API HELPERS
 * -----------------------------------------------------------------------------
 * Server routes (current backend):
 *   POST /api/datasets/                 -> create dataset object
 *   GET  /api/datasets/                 -> list datasets (current user scope)
 *   POST /api/datasets/permissions/     -> grant viewer permission to a user
 *
 * Auth: JWT (Authorization: Bearer <access>), handled by apiClient automatically.
 * CORS: already configured 
 *
 * NOTES FOR FUTURE WIRING:
 * - "dataset_name" is the only required field for creation at the moment. FIX THIS
 * - File upload is not implemented here yet. When backend provides an endpoint,
 *   add a function below that uses FormData and POSTs the file alongside
 *   the dataset id 
 * - "notes", "time_unit", "is_public" are UI fields right now. Once the backend
 *   exposes them, EXTEND THE CREATE PAYLOAD
 * - Name availability in the UI is derived by calling listMyDatasets() and
 *   comparing names case-insensitively. Replace with a real endpoint if existent
 */
import { api } from "./apiClient";

export type Dataset = { dataset_id: number; dataset_name: string };

/**
 * Create a dataset object.
 * Only sends `dataset_name` for now to match the current serializer/POST view - INCLUDE notes/timeUnit/isPublic 
 * WHEN BACKEND IS PUSHED
 */
export async function createDataset(dataset_name: string) {
  return api.post<Dataset>("/api/datasets/", { dataset_name });
}

/** List the datasets visible to the current user (owner + shared)
 * I thiiiink this is how it works.
 */
export async function listMyDatasets() {
  return api.get<Dataset[]>("/api/datasets/");
}

/**
 * Grant a user viewer access (permissions are "viewer" only for datasets).
 */
export async function grantDatasetViewer(dataset: number, user: number) {
  return api.post("/api/datasets/permissions/", { dataset, user });
}
