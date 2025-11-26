import { useEffect, useRef, useState } from "react";

export type Visibility = "all" | "public" | "private";

export default function PublicFilter({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
          className="relative overflow-hidden rounded-md bg-neutral-950 px-5 py-2.5 text-sm text-white duration-300 [transition-timing-function:cubic-bezier(0.175,0.885,0.32,1.275)] active:translate-y-1 active:scale-x-110 active:scale-y-90">
        {value === "all" ? "Filter" : value[0].toUpperCase() + value.slice(1)}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-40 overflow-hidden rounded-md border border-black/10 bg-white shadow-md">
          {(["all", "public", "private"] as const).map((opt) => (
            <button
              key={opt}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 capitalize ${
                value === opt ? "bg-gray-100" : ""
              }`}
              onClick={() => {
                setOpen(false);
                onChange(opt);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
