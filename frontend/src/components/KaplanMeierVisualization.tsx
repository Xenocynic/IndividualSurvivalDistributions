import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { FullPredictionsData } from "../lib/predictors";
import { getPredictorFullPredictionsData } from "../lib/predictors";

interface KaplanMeierVisualizationProps {
  predictorId: number;
  predictorName: string;
  timeUnit?: string | null;
}

interface KMPoint {
  time: number;
  survival: number;
}

interface GroupData {
  groupId: number;
  subjects: number[];
  times: number[];
  events: number[];
  kmCurve: KMPoint[];
  color: string;
  meanRisk: number;
}

const GROUP_COLORS = ["#3b82f6", "#dc2626", "#10b981", "#8b5cf6"];

export default function KaplanMeierVisualization({
  predictorId,
  predictorName,
  timeUnit,
}: KaplanMeierVisualizationProps) {
  const [numGroups, setNumGroups] = useState(4);
  const [numHistogramBins, setNumHistogramBins] = useState(15);
  const [riskScore, setRiskScore] = useState<"median" | "mean">("median");
  const [fullPredictions, setFullPredictions] = useState<FullPredictionsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load full predictions data
  useEffect(() => {
    if (!predictorId) return;

    setIsLoading(true);
    setError(null);
    getPredictorFullPredictionsData(predictorId)
      .then(setFullPredictions)
      .catch((err) => {
        console.error("Failed to load full predictions", err);
        setError("Failed to load Kaplan-Meier data.");
      })
      .finally(() => setIsLoading(false));
  }, [predictorId]);

  // Calculate risk groups and KM curves
  const { groups, logRankResults } = useMemo(() => {
    if (!fullPredictions) {
      return { groups: [], logRankResults: [] };
    }

    const { test_indices, actual_times, actual_events, median_predictions, mean_predictions } = fullPredictions;
    
    // Choose risk score
    const riskScores = riskScore === "median" ? median_predictions : mean_predictions;
    
    // Create array of subjects with their data
    const subjects = test_indices.map((id, idx) => ({
      id,
      time: actual_times[idx],
      event: actual_events[idx],
      risk: riskScores[idx],
    }));

    // Sort by risk score
    subjects.sort((a, b) => a.risk - b.risk);

    // Split into groups
    const groupSize = Math.ceil(subjects.length / numGroups);
    const groupsData: GroupData[] = [];

    for (let g = 0; g < numGroups; g++) {
      const start = g * groupSize;
      const end = Math.min(start + groupSize, subjects.length);
      const groupSubjects = subjects.slice(start, end);

      const groupTimes = groupSubjects.map(s => s.time);
      const groupEvents = groupSubjects.map(s => s.event);
      const meanRisk = groupSubjects.reduce((sum, s) => sum + s.risk, 0) / groupSubjects.length;

      // Calculate Kaplan-Meier curve for this group
      const kmCurve = calculateKaplanMeier(groupTimes, groupEvents);

      groupsData.push({
        groupId: g + 1,
        subjects: groupSubjects.map(s => s.id),
        times: groupTimes,
        events: groupEvents,
        kmCurve,
        color: GROUP_COLORS[g % GROUP_COLORS.length],
        meanRisk,
      });
    }

    // Calculate log-rank test
    const logRank = calculateLogRankTest(groupsData);

    return { groups: groupsData, logRankResults: logRank };
  }, [fullPredictions, numGroups, riskScore]);

  // Prepare chart data
  const kmChartData = useMemo(() => {
    if (groups.length === 0) return [];

    // Collect all unique time points, including 0
    const allTimes = new Set<number>([0]);
    groups.forEach(group => {
      group.kmCurve.forEach(point => allTimes.add(point.time));
    });

    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

    // Create data points for each time
    return sortedTimes.map(time => {
      const point: any = { time };
      
      groups.forEach(group => {
        // Find survival probability at this time (step function - use last known value)
        let survival = 100; // Start at 100%
        for (const kmPoint of group.kmCurve) {
          if (kmPoint.time <= time) {
            survival = kmPoint.survival;
          } else {
            break;
          }
        }
        point[`group${group.groupId}`] = survival;
      });

      return point;
    });
  }, [groups]);

  // Histogram data
  const histogramData = useMemo(() => {
    if (!fullPredictions) return [];

    const riskScores = riskScore === "median" 
      ? fullPredictions.median_predictions 
      : fullPredictions.mean_predictions;

    const min = Math.min(...riskScores);
    const max = Math.max(...riskScores);
    const binWidth = (max - min) / numHistogramBins;

    const bins = Array.from({ length: numHistogramBins }, (_, i) => ({
      binStart: min + i * binWidth,
      binEnd: min + (i + 1) * binWidth,
      count: 0,
    }));

    riskScores.forEach(score => {
      const binIndex = Math.min(
        numHistogramBins - 1,
        Math.floor((score - min) / binWidth)
      );
      bins[binIndex].count++;
    });

    return bins.map(bin => ({
      binLabel: `${bin.binStart.toFixed(0)}-${bin.binEnd.toFixed(0)}`,
      binCenter: (bin.binStart + bin.binEnd) / 2,
      count: bin.count,
    }));
  }, [fullPredictions, numHistogramBins, riskScore]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
        <p className="ml-3 text-sm text-neutral-500">Loading Kaplan-Meier data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!fullPredictions || groups.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-neutral-500">No Kaplan-Meier data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-800">
        Kaplan Meier Visualization for Predictor "{predictorName}"
      </h2>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          Number of Groups:
          <input
            type="number"
            min="2"
            max="6"
            value={numGroups}
            onChange={(e) => setNumGroups(Math.max(2, Math.min(6, parseInt(e.target.value) || 4)))}
            className="w-20 rounded-md border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          Risk Score:
          <select
            value={riskScore}
            onChange={(e) => setRiskScore(e.target.value as "median" | "mean")}
            className="rounded-md border border-neutral-300 px-3 py-1"
          >
            <option value="median">Median</option>
            <option value="mean">Mean</option>
          </select>
        </label>
        <div className="flex gap-2">
          {groups.map(group => (
            <div
              key={group.groupId}
              className="rounded border px-3 py-1 text-sm"
              style={{ borderColor: group.color, color: group.color }}
            >
              {group.meanRisk.toFixed(2)}
            </div>
          ))}
        </div>
      </div>

      {/* Kaplan-Meier Curves */}
      <div className="rounded-md border bg-white p-4">
        <h3 className="mb-4 text-center text-sm font-semibold text-neutral-700">
          Kaplan-Meier Curves of Groups, based on PSSP-estimates of {riskScore === "median" ? "Median" : "Mean"} Survival Time
        </h3>
        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={kmChartData}
              margin={{ top: 10, right: 30, bottom: 60, left: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, "auto"]}
                label={{
                  value: `Time${timeUnit ? ` (${timeUnit})` : ""}`,
                  position: "insideBottom",
                  offset: -10,
                  style: { fill: "#4b5563", fontSize: 12 },
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, 100]}
                label={{
                  value: "Survival Probability (%)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#4b5563", fontSize: 12 },
                }}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: "20px" }}
                iconType="line"
              />
              {groups.map(group => (
                <Line
                  key={group.groupId}
                  type="stepAfter"
                  dataKey={`group${group.groupId}`}
                  name={`Group ${group.groupId}`}
                  stroke={group.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Log-rank Test Results */}
      <div className="rounded-md border bg-white p-4">
        <h3 className="mb-4 text-center text-sm font-semibold text-neutral-700">Log-rank test</h3>
        <LogRankTable results={logRankResults} groups={groups} />
        <p className="mt-4 text-xs text-neutral-500">
          For above graph, patients were separated into groups based on the {riskScore} value of their PSSP curve. 
          If the number of groups is {numGroups}, group 1 is the {(100/numGroups).toFixed(0)}% of patients with the lowest predicted survival, 
          group 2 is the next {(100/numGroups).toFixed(0)}% of patients, and so on. We then plot the Kaplan-Meier curves based on actual 
          survival times of the patients in each group. The result of log-rank test is reported in the format of Z(Q): Z is the result of 
          log-rank test; Q is the corresponding upper cumulative of |Z| based on the unified normal distribution.
        </p>
      </div>

      {/* Subject Histogram */}
      <div className="rounded-md border bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">Subject Histogram</h3>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            Number of Histogram Bins:
            <input
              type="number"
              min="5"
              max="30"
              value={numHistogramBins}
              onChange={(e) => setNumHistogramBins(Math.max(5, Math.min(30, parseInt(e.target.value) || 15)))}
              className="w-20 rounded-md border border-neutral-300 px-2 py-1"
            />
          </label>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={histogramData}
              margin={{ top: 10, right: 30, bottom: 60, left: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="binCenter"
                type="number"
                domain={["dataMin - 20", "dataMax + 20"]}
                label={{
                  value: "Predicted Survival Time",
                  position: "insideBottom",
                  offset: -10,
                  style: { fill: "#4b5563", fontSize: 12 },
                }}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => value.toFixed(0)}
                scale="linear"
                padding={{ left: 20, right: 20 }}
              />
              <YAxis
                label={{
                  value: "#Subjects",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#4b5563", fontSize: 12 },
                }}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                labelFormatter={(value) => `Range: ${value.toFixed(0)}`}
              />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Kaplan-Meier calculation
function calculateKaplanMeier(times: number[], events: number[]): KMPoint[] {
  // Combine times and events, sort by time
  const data = times.map((time, idx) => ({ time, event: events[idx] }))
    .sort((a, b) => a.time - b.time);

  const kmCurve: KMPoint[] = [{ time: 0, survival: 100 }];
  let atRisk = data.length;
  let survival = 1.0; // Start at 1.0 (100%)

  // Group by unique times
  const timeGroups = new Map<number, { events: number; total: number }>();
  data.forEach(({ time, event }) => {
    if (!timeGroups.has(time)) {
      timeGroups.set(time, { events: 0, total: 0 });
    }
    const group = timeGroups.get(time)!;
    group.total++;
    if (event === 1) group.events++;
  });

  // Calculate survival at each time point
  const sortedTimes = Array.from(timeGroups.keys()).sort((a, b) => a - b);
  
  sortedTimes.forEach(time => {
    const group = timeGroups.get(time)!;
    if (group.events > 0 && atRisk > 0) {
      // KM formula: S(t) = S(t-1) * (n - d) / n
      survival *= (atRisk - group.events) / atRisk;
      kmCurve.push({ time, survival: survival * 100 }); // Convert to percentage
    }
    atRisk -= group.total;
  });

  return kmCurve;
}

// Log-rank test calculation
function calculateLogRankTest(groups: GroupData[]): Array<{g1: number; g2: number; z: number; q: number}> {
  const results: Array<{g1: number; g2: number; z: number; q: number}> = [];

  // Compare each pair of groups
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const z = logRankStatistic(groups[i], groups[j]);
      const q = normalCDF(Math.abs(z));
      results.push({ g1: i + 1, g2: j + 1, z, q });
    }
  }

  return results;
}

function logRankStatistic(group1: GroupData, group2: GroupData): number {
  // Combine all times from both groups
  const allTimes = [...group1.times, ...group2.times];
  const uniqueTimes = Array.from(new Set(allTimes)).sort((a, b) => a - b);

  let observed1 = 0;
  let expected1 = 0;
  let variance = 0;

  uniqueTimes.forEach(time => {
    const atRisk1 = group1.times.filter(t => t >= time).length;
    const atRisk2 = group2.times.filter(t => t >= time).length;
    const atRiskTotal = atRisk1 + atRisk2;

    if (atRiskTotal === 0) return;

    const events1 = group1.times.filter((t, idx) => t === time && group1.events[idx] === 1).length;
    const events2 = group2.times.filter((t, idx) => t === time && group2.events[idx] === 1).length;
    const eventsTotal = events1 + events2;

    if (eventsTotal === 0) return;

    observed1 += events1;
    expected1 += (atRisk1 * eventsTotal) / atRiskTotal;
    
    const v = (atRisk1 * atRisk2 * eventsTotal * (atRiskTotal - eventsTotal)) / 
              (atRiskTotal * atRiskTotal * (atRiskTotal - 1 || 1));
    variance += v;
  });

  if (variance === 0) return 0;
  return (observed1 - expected1) / Math.sqrt(variance);
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp(-z * z / 2);
  return 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
}

// Log-rank table component
function LogRankTable({ results, groups }: { results: any[]; groups: GroupData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b-2 border-neutral-800">
            <th className="bg-black p-2"></th>
            {groups.map(group => (
              <th
                key={group.groupId}
                className="p-2 text-center text-sm font-semibold text-white"
                style={{ backgroundColor: group.color }}
              >
                G{group.groupId}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((rowGroup, rowIdx) => (
            <tr key={rowGroup.groupId} className="border-b">
              <td
                className="p-2 text-center text-sm font-semibold text-white"
                style={{ backgroundColor: rowGroup.color }}
              >
                G{rowGroup.groupId}
              </td>
              {groups.map((colGroup, colIdx) => {
                if (colIdx <= rowIdx) {
                  return <td key={colGroup.groupId} className="bg-neutral-100 p-2"></td>;
                }
                const result = results.find(r => 
                  (r.g1 === rowGroup.groupId && r.g2 === colGroup.groupId) ||
                  (r.g1 === colGroup.groupId && r.g2 === rowGroup.groupId)
                );
                return (
                  <td key={colGroup.groupId} className="p-2 text-center text-sm">
                    {result ? `${result.z.toFixed(3)} (${result.q.toFixed(3)})` : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
