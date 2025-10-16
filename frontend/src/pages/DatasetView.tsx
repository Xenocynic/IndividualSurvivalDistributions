/**
 * View Dataset (Read-only)
 *
 * Shows dataset information in read-only mode for viewers who don't own the dataset.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDataset, downloadDatasetFile, type Dataset } from "../lib/datasets";

export default function DatasetView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const datasetId = id ? parseInt(id) : null;

  // dataset info
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Load dataset data
  useEffect(() => {
    if (!datasetId) {
      setError("Invalid dataset ID");
      setLoading(false);
      return;
    }

    async function loadDataset() {
      try {
        const data = await getDataset(datasetId!);
        setDataset(data);
      } catch (err: any) {
        if (err?.status === 404) {
          setError("Dataset not found");
        } else if (err?.status === 403) {
          setError("You don't have permission to view this dataset");
        } else {
          setError("Failed to load dataset");
        }
      } finally {
        setLoading(false);
      }
    }

    loadDataset();
  }, [datasetId]);

  // Download file
  const handleDownload = async () => {
    if (!datasetId || downloading) return;
    
    setDownloading(true);
    try {
      const { blob, filename } = await downloadDatasetFile(datasetId);
      
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Download failed: ${error.message || 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-700 mx-auto"></div>
          <div className="mt-2 text-sm text-gray-600">Loading dataset...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold">{error}</div>
          <button
            onClick={() => navigate("/dashboard", { state: { tab: "datasets" } })}
            className="mt-4 rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!dataset) return null;

  return (
    <div className="min-h-[60vh]">
      {/* Header */}
      <div className="sticky top-14 md:top-16 z-40 border-b border-black/10 bg-gray-400">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-3">
          <button
            onClick={() => navigate("/dashboard", { state: { tab: "datasets" } })}
            className="rounded border border-black/10 bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Back
          </button>
          <div className="font-semibold">View Dataset</div>
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-4xl space-y-8 p-4">
        {/* Dataset Title */}
        <section className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{dataset.dataset_name}</h1>
          <div className="mt-2 text-sm text-gray-600">
            Owned by {dataset.owner_name} • Uploaded {new Date(dataset.uploaded_at).toLocaleDateString()}
          </div>
        </section>

        {/* Dataset Info Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Dataset Information</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Time Unit</label>
                <div className="text-sm bg-gray-50 rounded-md px-3 py-2 capitalize">
                  {dataset.time_unit}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Visibility</label>
                <div className="text-sm bg-gray-50 rounded-md px-3 py-2">
                  {dataset.is_public ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Public
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                      Private
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* File Info */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">File Information</h2>
            
            {dataset.has_file ? (
              <div className="space-y-3">
                <div className="rounded-md border border-black/10 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📄</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{dataset.file_display_name || dataset.original_filename}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {dataset.file_size_display}
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {downloading ? "Downloading..." : "Download File"}
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
                No file associated with this dataset.
              </div>
            )}
          </section>
        </div>

        {/* Notes */}
        {dataset.notes && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            <div className="rounded-md border border-black/10 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {dataset.notes}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}