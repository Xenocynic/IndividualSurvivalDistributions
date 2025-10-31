/**
 * ----------------------------------------------------------------------------------
 * FolderTypeFilter
 * ----------------------------------------------------------------------------------
 * - Filter folders by content type (all, predictor-only, dataset-only, mixed)
 * - Provides visual indicators for folder content types
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { Filter, BrainCircuit, Table, Boxes, Folder as FolderIcon } from "lucide-react";

export type FolderType = "all" | "predictor-only" | "dataset-only" | "mixed";

interface FolderTypeFilterProps {
  value: FolderType;
  onChange: (type: FolderType) => void;
  className?: string;
}

interface Option {
  value: FolderType;
  label: string;
  icon: JSX.Element;
}

const TYPE_OPTIONS: Option[] = [
  {
    value: "all",
    label: "All Folders",
    icon: <FolderIcon className="h-4 w-4 text-gray-600" />,
  },
  {
    value: "predictor-only",
    label: "Predictors Only",
    icon: <BrainCircuit className="h-4 w-4 text-gray-600" />,
  },
  {
    value: "dataset-only",
    label: "Datasets Only",
    icon: <Table className="h-4 w-4 text-gray-600" />,
  },
  {
    value: "mixed",
    label: "Mixed Content",
    icon: <Boxes className="h-4 w-4 text-gray-600" />,
  },
];

export default function FolderTypeFilter({
  value,
  onChange,
  className = "",
}: FolderTypeFilterProps) {
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

  const currentOption =
    TYPE_OPTIONS.find((opt) => opt.value === value) || TYPE_OPTIONS[0];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
      >
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="hidden sm:inline">{currentOption.label}</span>
        <span className="sm:hidden">{currentOption.icon}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-md border border-black/10 bg-white shadow-lg"
        >
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 ${
                value === option.value ? "bg-gray-100 font-medium" : ""
              }`}
              onClick={() => {
                setOpen(false);
                onChange(option.value);
              }}
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {option.icon}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
