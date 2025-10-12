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

  const list = activeTab === "predictors" ? predictors : datasets;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = list.filter((it) => (q ? it.title.toLowerCase().includes(q) : true));
    if (visibility === "public") arr = arr.filter((it) => it.isPublic);
    if (visibility === "private") arr = arr.filter((it) => !it.isPublic);
    return arr;
  }, [list, query, visibility, activeTab]);

  // pretend these are the first two “pinned” public items for demo
  const pinned = list.slice(0, 3);

  return (
    <section className="flex gap-4">
      {/* Left: Pinned panel */}
      <aside className="w-64 shrink-0">
        <div className="rounded-md border border-black/10 bg-black">
          <div className="flex items-center justify-between px-3 py-2 border-b border-black/10">
            <div className="text-xs text-white font-semibold">Pinned {activeTab === "predictors" ? "Predictors" : "Datasets"}</div>
            <button
              onClick={() => setPinnedOpen((v) => !v)}
              className="rounded border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100"
              aria-expanded={pinnedOpen}
            >
              {pinnedOpen ? "▾" : "▸"}
            </button>
          </div>
          {pinnedOpen && (
            <div className="p-2 space-y-2">
              {pinned.map((p) => (
                <button
                  key={p.id}
                  className="w-full rounded-md border border-black/10 bg-gray-200 px-3 py-2 text-left text-xs hover:bg-gray-100"
                >
                  {p.title}
                </button>
              ))}
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
                  className={`px-3 text-sm ${activeTab === "predictors" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"}`}
                  onClick={() => setActiveTab("predictors")}
                >
                  Predictors
                </button>
                <button
                  className={`px-3 text-sm ${activeTab === "datasets" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"}`}
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
          {filtered.map((it) => (
            <CardShell
              key={it.id}
              title={
                <div>
                  {/* username tag sits on top area */}
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
              {/* actions for the browse page are simple (view only) */}
              <button className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs hover:bg-gray-100">
                View
              </button>
            </CardShell>
          ))}
        </div>
      </div>
    </section>
  );
}
