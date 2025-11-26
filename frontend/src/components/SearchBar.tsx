/**
 * ----------------------------------------------------------------------------------
 * SearchBar
 * ----------------------------------------------------------------------------------
 * - Controlled input with a clear (X) button.
 * - Emits value via onChange; supports Escape to clear.
 * - Uses a <label> for accessibility and to tie input+clear semantically.
 */

import { useId, type MouseEvent, type KeyboardEvent } from "react";
import {X} from "lucide-react"

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search",
  onClear,
}: SearchBarProps) {
  const id = useId();

  function clear(e?: MouseEvent | KeyboardEvent) {
    e?.stopPropagation?.();
    onChange("");
    onClear?.();
  }

  return (
    <label htmlFor={id} className="relative block w-full">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") clear(e);
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-black bg-white px-3 py-2 pr-8 text-sm  focus:border-black/30 focus:ring-2 focus:ring-black/10"
      />
      {value && (
        <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded hover:bg-black/10"
        >
            <X size={14} />
        </button>
        )}
    </label>
  );
}
