import type { Predictor } from "./predictors";
import type { Dataset } from "./datasets";
import type { PredictorItem } from "../components/PredictorCard";
import type { DatasetItem } from "../components/DatasetCard";

/** Predictor Mapping */
export function toPredictorItem(p: Predictor): PredictorItem {
  return {
    id: String(p.predictor_id),
    title: p.name,
    notes: p.description,
    owner: true,          // map real ownership from backend 
    // updatedAt:    , // when backend provides a timestamp
    // status:   ,        // when backend provides status
    isPublic: (p as any).is_public ?? false,  // update
    pinned: (p as any).pinned ?? false,  // update
  };
}

/** Dataset Mapping */
export function toDatasetItem(d: Dataset): DatasetItem {
  return {
    id: String(d.dataset_id),
    title: d.dataset_name,
    owner: true,          // map real ownership from backend 
    // updatedAt:     // when backend provides a timestamp
    // status:           // when backend provides status

    isPublic: (d as any).is_public ?? false,  // update
    pinned: (d as any).pinned ?? false,  // update
  };
}
