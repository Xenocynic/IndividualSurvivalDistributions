/**
 * ----------------------------------------------------------------------------------
 * AdvancedFilterMenu
 * ----------------------------------------------------------------------------------
 * - Small popover for "extra" search / filter options.
 * - First feature: lets the user choose where keyword search applies:
 *   - Title only
 *   - Notes only
 *   - Title + notes
 *
 * Usage:
 * - Parent owns the `keywordTarget` state ("title" | "notes" | "both")
 *   and passes it in along with `onKeywordTargetChange`.
 * - You can extend this component later with more controls (date range,
 *   username, size, etc.) without changing the basic API.
 */

import { useEffect, useRef, useState } from "react";

export type KeywordTarget = "title" | "notes" | "both";

interface AdvancedFilterMenuProps {
  keywordTarget: KeywordTarget;
  onKeywordTargetChange: (value: KeywordTarget) => void;
}

export default function AdvancedFilterMenu({
  keywordTarget,
  onKeywordTargetChange,
}: AdvancedFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span>Filter</span>
        <span className="text-xs">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 rounded-md border border-black/10 bg-white p-3 text-sm shadow-md"
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Search options
          </div>

          {/* Search scope section */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-700">Search in:</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {[
                { key: "title", label: "Title only" },
                { key: "notes", label: "Notes only" },
                { key: "both", label: "Title + notes" },
              ].map((opt) => {
                const selected = keywordTarget === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      selected
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() =>
                      onKeywordTargetChange(opt.key as KeywordTarget)
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Placeholder for future filters */}
          <div className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
            More filters (date, owner, size, etc.) can be added here later.
          </div>
        </div>
      )}
    </div>
  );
}
