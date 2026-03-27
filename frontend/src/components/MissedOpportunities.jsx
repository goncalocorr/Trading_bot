import { useEffect, useState } from "react";
import { fetchMissedOpportunities } from "../lib/api";

function ScoreBadge({ score }) {
  const color = score >= 6 ? "text-yellow-400" : "text-slate-400";
  return <span className={`font-mono font-bold ${color}`}>{score}/12</span>;
}

export default function MissedOpportunities({ tradingPairs = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pairFilter, setPairFilter] = useState("");

  async function load(pair) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMissedOpportunities({ pair: pair || undefined, limit: 100 });
      setData(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(pairFilter);
  }, [pairFilter]);

  const stats = data?.stats || {};
  const opportunities = data?.opportunities || [];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total (7d)", value: stats.total ?? "—" },
          { label: "Avg score", value: stats.avg_score ? Number(stats.avg_score).toFixed(1) : "—" },
          { label: "Best score", value: stats.max_score ?? "—" },
          { label: "Pairs", value: stats.distinct_pairs ?? "—" }
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-400">Filter by pair:</label>
        <select
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
          value={pairFilter}
          onChange={(e) => setPairFilter(e.target.value)}
        >
          <option value="">All pairs</option>
          {tradingPairs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          onClick={() => load(pairFilter)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading && (
          <p className="p-6 text-center text-sm text-slate-400">Loading...</p>
        )}
        {error && (
          <p className="p-6 text-center text-sm text-red-400">{error}</p>
        )}
        {!loading && !error && opportunities.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-400">No missed opportunities recorded yet.</p>
        )}
        {!loading && !error && opportunities.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-slate-400">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Pair</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Reason blocked</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp) => (
                <tr key={opp.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {new Date(opp.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-white">{opp.pair}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={opp.score} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">{opp.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
