import type { FC, ReactNode } from "react";
import SearchBar from "./SearchBar";

type Tab = "predictors" | "datasets" | "folders";

interface ToolbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onCreatePredictor: () => void;
  onCreateDataset: () => void;
  onCreateFolder: () => void;
  /** Rendered to the right of the search bar, left of Create (e.g. Filters menu) */
  filterControl: ReactNode;
}

/**
 * Toolbar
 *
 * Layout:
 * - Left cluster: tab buttons + search bar
 * - Right cluster: filter control + Create dropdown
 *
 * Filter UI is passed in via `filterControl` so Dashboard can decide
 * whether to show AdvancedFilterMenu or FolderAdvancedFilterMenu.
 */
const Toolbar: FC<ToolbarProps> = ({
  activeTab,
  onTabChange,
  query,
  onQueryChange,
  onCreatePredictor,
  onCreateDataset,
  onCreateFolder,
  filterControl,
}) => {
  return (
    <div className="mx-auto max-w-6xl px-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-md">
        {/* Left: tabs + search */}
        <div className="flex w-full items-center gap-2">
          {/* Tabs */}
          <div className="inline-flex h-9 overflow-hidden rounded-md border bg-white">
            <ToolbarTabButton
              isActive={activeTab === "predictors"}
              onClick={() => onTabChange("predictors")}
            >
              Predictors
            </ToolbarTabButton>
            <ToolbarTabButton
              isActive={activeTab === "datasets"}
              onClick={() => onTabChange("datasets")}
            >
              Datasets
            </ToolbarTabButton>
            <ToolbarTabButton
              isActive={activeTab === "folders"}
              onClick={() => onTabChange("folders")}
            >
              Folders
            </ToolbarTabButton>
          </div>

          {/* Search bar (to the right of tabs, still on the left side overall) */}
          <div className="flex-1 md:max-w-md">
            <SearchBar
              value={query}
              onChange={onQueryChange}
              onClear={() => onQueryChange("")}
              placeholder={
                activeTab === "predictors"
                  ? "Search your predictors…"
                  : activeTab === "datasets"
                  ? "Search your datasets…"
                  : "Search your folders…"
              }
            />
          </div>
        </div>

        {/* Right: filters + Create */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Filters (passed from Dashboard) */}
          {filterControl}

          {/* Create dropdown (rightmost) */}
          <details className="group relative">
            <summary className="inline-flex h-9.5 cursor-pointer select-none items-center gap-1 rounded-md border bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-700">
              Create
              <span className="text-[20px] text-neutral-200 group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="absolute right-0 mt-1 w-40 rounded-md border bg-white py-1 text-sm shadow-lg z-30">
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-neutral-800 hover:bg-neutral-50"
                onClick={onCreatePredictor}
              >
                New predictor
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-neutral-800 hover:bg-neutral-50"
                onClick={onCreateDataset}
              >
                New dataset
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-neutral-800 hover:bg-neutral-50"
                onClick={onCreateFolder}
              >
                New folder
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

function ToolbarTabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 text-xs ${
        isActive
          ? "bg-neutral-900 text-white"
          : "text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

export default Toolbar;
