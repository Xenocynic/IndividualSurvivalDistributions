/**
 * ----------------------------------------------------------------------------------
 * FolderSortMenu
 * ----------------------------------------------------------------------------------
 * - Dropdown menu for sorting folders by different criteria
 * - Supports sorting by name, date, and item count
 * - Provides ascending/descending options
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ArrowUpDown } from "lucide-react";

export type FolderSortField = "name" | "date" | "item_count";
export type SortDirection = "asc" | "desc";

export interface FolderSortOption {
  field: FolderSortField;
  direction: SortDirection;
  label: string;
}

interface FolderSortMenuProps {
  value: FolderSortOption;
  onChange: (option: FolderSortOption) => void;
  className?: string;
}

const SORT_OPTIONS: FolderSortOption[] = [
  { field: "name", direction: "asc", label: "Name A-Z" },
  { field: "name", direction: "desc", label: "Name Z-A" },
  { field: "date", direction: "desc", label: "Recently Updated" },
  { field: "date", direction: "asc", label: "Oldest First" },
  { field: "item_count", direction: "desc", label: "Most Items" },
  { field: "item_count", direction: "asc", label: "Fewest Items" },
];

export default function FolderSortMenu({
  value,
  onChange,
  className = "",
}: FolderSortMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const currentOption = SORT_OPTIONS.find(
    (opt) => opt.field === value.field && opt.direction === value.direction
  ) || SORT_OPTIONS[0];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative inline-flex h-10 min-w-[140px] cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-md bg-black px-3 text-sm text-white shadow-lg shadow-neutral-500/20 duration-300 [transition-timing-function:cubic-bezier(0.175,0.885,0.32,1.275)] active:translate-y-1 active:scale-x-110 active:scale-y-90 hover:bg-black/90"
      >
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-gray-500" />
          <span>{currentOption.label}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-md border border-black/10 bg-white shadow-lg"
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={`${option.field}-${option.direction}`}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                option.field === value.field && option.direction === value.direction
                  ? "bg-gray-100 font-medium"
                  : ""
              }`}
              onClick={() => {
                setOpen(false);
                onChange(option);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}