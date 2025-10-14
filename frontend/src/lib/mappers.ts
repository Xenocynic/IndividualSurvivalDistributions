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
    // isPublic:   // privacy
    // pinned:     // is it pinned
  };
}

/** Dataset Mapping */
export function toDatasetItem(d: Dataset): DatasetItem {
  return {
    id: String(d.dataset_id),
    title: d.dataset_name,
    owner: true,          // map real ownership from backend 
    // updatedAt:   , // when backend provides a timestamp
    // notes:   ,          // once backend adds itafter alex's merge
    // isPublic:   // privacy
    // pinned:     // is it pinned
  };
}
