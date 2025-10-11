
/**
 * ----------------------------------------------------------------------------------
 * Toolbar
 * ----------------------------------------------------------------------------------
 * - Top-of-page controls: tab switcher (Predictors / Datasets), shared SearchBar,
 *   FilterMenu (All / Owner / Viewer), and a CreateMenu (always visible).
 * - All actions are passed in via props so the parent (Dashboard) stays in control
 *   of data mutations and navigation.
 */

import SearchBar from "./SearchBar";
import CreateMenu from "./CreateMenu";
import FilterMenu, { type Ownership } from "./FilterMenu";

type Tab = "predictors" | "datasets";

interface ToolbarProps {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;

  query: string;
  onQueryChange: (q: string) => void;

  onCreatePredictor: () => void;
  onCreateDataset: () => void;
  onCreateFolder: () => void;

  ownership: Ownership;
  onOwnershipChange: (o: Ownership) => void;
}

export default function Toolbar({
  activeTab,
  onTabChange,
  query,
  onQueryChange,
  onCreatePredictor,
  onCreateDataset,
  onCreateFolder,
  ownership,
  onOwnershipChange,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Left: Tabs + Search */}
      <div className="flex w-full items-center gap-3">
        <div className="inline-flex h-10 overflow-hidden rounded-md border border-black/10 bg-white">
          <button
            type="button"
            className={`px-3 text-sm ${activeTab === "predictors" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"}`}
            onClick={() => onTabChange("predictors")}
          >
            Predictors
          </button>
          <button
            type="button"
            className={`px-3 text-sm ${activeTab === "datasets" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"}`}
            onClick={() => onTabChange("datasets")}
          >
            Datasets
          </button>
        </div>

        <div className="flex-1 md:max-w-md">
          <SearchBar
            value={query}
            onChange={onQueryChange}
            placeholder="Search"
            onClear={() => onQueryChange("")}
          />
        </div>
      </div>

      {/* Right: Filter + Create (always visible) */}
      <div className="flex items-center gap-2 shrink-0">
        <FilterMenu value={ownership} onChange={onOwnershipChange} />
        <CreateMenu
          onCreatePredictor={onCreatePredictor}
          onCreateDataset={onCreateDataset}
          onCreateFolder={onCreateFolder}
        />
      </div>
    </div>
  );
}
