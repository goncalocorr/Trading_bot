import { useEffect, useState } from "react";
import { fetchMissedOpportunities } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";

function ScoreBadge({ score }) {
  const pct = Math.round((score / 12) * 100);
  const color = pct >= 60 ? "bg-amber-400/15 text-amber-300" : "bg-white/[0.06] text-slate-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${color}`}>
      {score}/12
    </span>
  );
}

export default function MissedOpportunities({ tradingPairs = [] }) {
  const { t, formatDateTime } = useI18n();
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
    let active = true;
    setLoading(true);
    setError(null);
    fetchMissedOpportunities({ pair: pairFilter || undefined, limit: 100 })
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.response?.data?.message || err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pairFilter]);

  const stats = data?.stats || {};
  const opportunities = data?.opportunities || [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("missed.total7d"), value: stats.total ?? "-" },
          { label: t("missed.avgScore"), value: stats.avg_score ? Number(stats.avg_score).toFixed(1) : "-" },
          { label: t("missed.bestScore"), value: stats.max_score ?? "-" },
          { label: t("missed.pairs"), value: stats.distinct_pairs ?? "-" }
        ].map(({ label, value }) => (
          <div key={label} className="metric-card items-center text-center">
            <p className="metric-label">{label}</p>
            <p className="metric-value text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="glass-card p-3 flex items-center gap-3">
        <label className="text-xs text-slate-500">{t("missed.filterByPair")}</label>
        <select
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white outline-none"
          value={pairFilter}
          onChange={(e) => setPairFilter(e.target.value)}
        >
          <option value="">{t("missed.allPairs")}</option>
          {tradingPairs.map((pair) => (
            <option key={pair} value={pair}>{pair}</option>
          ))}
        </select>
        <button
          onClick={() => load(pairFilter)}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] transition"
        >
          {t("common.refresh")}
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading && (
          <p className="p-6 text-center text-sm text-slate-500 animate-pulse-soft">{t("missed.loading")}</p>
        )}
        {error && (
          <p className="p-6 text-center text-sm text-rose-300">{error}</p>
        )}
        {!loading && !error && opportunities.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">{t("missed.empty")}</p>
        )}
        {!loading && !error && opportunities.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 metric-label">{t("missed.time")}</th>
                  <th className="px-4 py-3 metric-label">{t("dashboard.field.pair")}</th>
                  <th className="px-4 py-3 metric-label">{t("signal.score")}</th>
                  <th className="px-4 py-3 metric-label">{t("missed.reasonBlocked")}</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr key={opp.id} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{formatDateTime(opp.timestamp)}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-white">{opp.pair}</td>
                    <td className="px-4 py-2.5"><ScoreBadge score={opp.score} /></td>
                    <td className="px-4 py-2.5 text-slate-400">{opp.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
