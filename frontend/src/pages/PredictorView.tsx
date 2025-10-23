import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { listPublicPredictors } from "../lib/predictors";

export default function PredictorView() {
    const { id } = useParams();
    const [predictor, setPredictor] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPredictor() {
            try {
                setLoading(true);
                const predictors = await listPublicPredictors();
                const found = predictors.find((p: any) => p.predictor_id.toString() === id);
                if (!found) {
                    setError("Predictor not found");
                } else {
                    setPredictor(found);
                }
            } catch (err: any) {
                setError("Failed to load predictor details");
            } finally {
                setLoading(false);
            }
        }
        fetchPredictor();
    }, [id]);

    if (loading) return <div className="p-8 text-gray-600">Loading...</div>;
    if (error) return <div className="p-8 text-red-600">{error}</div>;
    if (!predictor) return null;

    const dataset = predictor.dataset ?? {};
    const owner = predictor.owner ?? {};

    return (
        <div className="p-8 max-w-3xl mx-auto">
            <Link to="/browse" className="text-blue-600 hover:underline text-sm">
                ← Back to Browse
            </Link>

            <h1 className="text-2xl font-bold mt-4 mb-2">{predictor.name}</h1>
            <p className="text-gray-700 mb-4">{predictor.description || "No description provided."}</p>

            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div>
                    <span className="font-semibold">Predictor ID:</span> {predictor.predictor_id}
                </div>
                <div>
                    <span className="font-semibold">Visibility:</span>{" "}
                    {predictor.is_private ? "Private" : "Public"}
                </div>
                <div>
                    <span className="font-semibold">Dataset:</span>{" "}
                    {dataset.dataset_name || "Unknown"} (ID: {dataset.dataset_id || "N/A"})
                </div>
                <div>
                    <span className="font-semibold">Owner:</span>{" "}
                    {owner.username || "Unknown"} ({owner.email || "N/A"})
                </div>
                <div>
                    <span className="font-semibold">Time Unit:</span> {predictor.time_unit || "N/A"}
                </div>
            </div>
        </div>
    );
}
