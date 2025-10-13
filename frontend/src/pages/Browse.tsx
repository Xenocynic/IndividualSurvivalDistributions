import { useMemo, useState } from "react";
import SearchBar from "../components/SearchBar";
import CardShell from "../components/CardShell";
import PublicFilter, { type Visibility } from "../components/PublicFilter";
import UsernameTag from "../components/UsernameTag";

type Tab = "predictors" | "datasets";

type Item = {
  id: string;
  title: string;
  updatedAt: string;
  isPublic: boolean;
  ownerName: string;
  notes?: string;
};

// mock data; replace from API later
const MOCK_PREDICTORS: Item[] = [
  { id: "p1", title: "Liver Transplant Calculator All", updatedAt: "2d ago", isPublic: true, ownerName: "A", notes: "All livers welcome." },
  { id: "p2", title: "Liver Transplant Calculator 2002", updatedAt: "5d ago", isPublic: false, ownerName: "B", notes: "me when mcr." },
  { id: "p3", title: "That One Predictor", updatedAt: "just now", isPublic: false, ownerName: "CCCC", notes: "Fascinating." },
];

const MOCK_DATASETS: Item[] = [
  { id: "d1", title: "Cancer Registry Cohort", updatedAt: "Aug 20, 2023", isPublic: false, ownerName: "S", notes: "waaaaaaaaaaaa" },
  { id: "d2", title: "Cervical Cancer CSV Upload", updatedAt: "Jul 02, 2010", isPublic: true, ownerName: "D", notes: "wwwwwwwwwww" },
];

export default function Browse() {
  const [activeTab, setActiveTab] = useState<Tab>("predictors");
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [pinnedOpen, setPinnedOpen] = useState(true);

  const [predictors] = useState<Item[]>(MOCK_PREDICTORS);
  const [datasets] = useState<Item[]>(MOCK_DATASETS);

  // Pinned IDs separated per tab
  const [pinnedPredictorIds, setPinnedPredictorIds] = useState<Set<string>>(new Set());
  const [pinnedDatasetIds, setPinnedDatasetIds] = useState<Set<string>>(new Set());

  const list = activeTab === "predictors" ? predictors : datasets;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = list.filter((it) => (q ? it.title.toLowerCase().includes(q) : true));
    if (visibility === "public") arr = arr.filter((it) => it.isPublic);
    if (visibility === "private") arr = arr.filter((it) => !it.isPublic);
    return arr;
  }, [list, query, visibility, activeTab]);

  const pinnedSet = activeTab === "predictors" ? pinnedPredictorIds : pinnedDatasetIds;
  const pinned = list.filter((it) => pinnedSet.has(it.id));

  function togglePin(id: string) {
    if (activeTab === "predictors") {
      setPinnedPredictorIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else {
      setPinnedDatasetIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
  }

  return (
    <section className="flex gap-4">
      {/* Left: Pinned panel */}
      <aside className="w-64 shrink-0">
        <div className="rounded-md border border-black/10 bg-black">
          <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
            <div className="text-xs font-semibold text-white">
              Pinned {activeTab === "predictors" ? "Predictors" : "Datasets"}
            </div>
            <button
              onClick={() => setPinnedOpen((v) => !v)}
              className="rounded border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100"
              aria-expanded={pinnedOpen}
            >
              {pinnedOpen ? "▾" : "▸"}
            </button>
          </div>
          {pinnedOpen && (
            <div className="space-y-2 p-2">
              {pinned.length === 0 ? (
                <div className="rounded-md bg-gray-200 px-3 py-2 text-left text-xs text-gray-600">
                  Nothing pinned yet
                </div>
              ) : (
                pinned.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-black/10 bg-gray-200 px-3 py-2 text-xs"
                  >
                    <span className="truncate">{p.title}</span>
                    <button
                      className="ml-2 rounded px-2 py-0.5 text-xs hover:bg-gray-300"
                      title="Unpin"
                      onClick={() => togglePin(p.id)}
                    >
                      📌
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Right: content */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Mini grey navbar */}
        <div className="rounded-md border border-black/10 bg-gray-400 px-3 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {/* Left cluster: tab switch + search */}
            <div className="flex w-full items-center gap-2">
              <div className="inline-flex h-9 overflow-hidden rounded-md border border-black/10 bg-white">
                <button
                  className={`px-3 text-sm ${
                    activeTab === "predictors" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("predictors")}
                >
                  Predictors
                </button>
                <button
                  className={`px-3 text-sm ${
                    activeTab === "datasets" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("datasets")}
                >
                  Datasets
                </button>
              </div>

              <div className="flex-1 md:max-w-md">
                <SearchBar value={query} onChange={setQuery} placeholder="Search" onClear={() => setQuery("")} />
              </div>
            </div>

            {/* Right cluster: filter */}
            <div className="shrink-0">
              <PublicFilter value={visibility} onChange={setVisibility} />
            </div>
          </div>

          {/* Center title line */}
          <div className="mt-2 text-center font-semibold">
            Browse {activeTab === "predictors" ? "Predictors" : "Datasets"}
          </div>
        </div>

        {/* Grid of cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => {
            const isPinned = pinnedSet.has(it.id);
            return (
              <CardShell
                key={it.id}
                actionVisibility="hover" 
                title={
                  <div>
                    <div className="-mb-1">
                      <UsernameTag name={it.ownerName} />
                    </div>
                    <div className="mt-1 text-sm font-medium">{it.title}</div>
                  </div>
                }
                description={<span>{it.notes}</span>}
                footerLeft={<span className="text-gray-500">{it.updatedAt}</span>}
                footerRight={
                  it.isPublic ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] text-green-700">Public</span>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">Private</span>
                  )
                }
              >
                {/* Hover actions (top-right) */}
                <button
                  className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: route to details page

                  }}
                >
                  View
                </button>
                <button
                  className={`rounded-md border border-black/10 px-2 py-1 text-xs ${
                    isPinned ? "bg-yellow-100 hover:bg-yellow-200" : "bg-white hover:bg-gray-100"
                  }`}
                  title={isPinned ? "Unpin" : "Pin"}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(it.id);
                  }}
                >
                  📌
                </button>
              </CardShell>
            );
          })}
        </div>
      </div>
    </section>
  );
}
