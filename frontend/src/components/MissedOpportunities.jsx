import { useEffect, useState } from "react";
import { fetchMissedOpportunities } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";

function ScoreBadge({ score }) {
  const color = score >= 6 ? "text-yellow-400" : "text-slate-400";
  return <span className={`font-mono font-bold ${color}`}>{score}/12</span>;
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
    load(pairFilter);
  }, [pairFilter]);

  const stats = data?.stats || {};
  const opportunities = data?.opportunities || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("missed.total7d"), value: stats.total ?? "-" },
          { label: t("missed.avgScore"), value: stats.avg_score ? Number(stats.avg_score).toFixed(1) : "-" },
          { label: t("missed.bestScore"), value: stats.max_score ?? "-" },
          { label: t("missed.pairs"), value: stats.distinct_pairs ?? "-" }
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-400">{t("missed.filterByPair")}</label>
        <select
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
          value={pairFilter}
          onChange={(event) => setPairFilter(event.target.value)}
        >
          <option value="">{t("missed.allPairs")}</option>
          {tradingPairs.map((pair) => (
            <option key={pair} value={pair}>{pair}</option>
          ))}
        </select>
        <button
          onClick={() => load(pairFilter)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
        >
          {t("common.refresh")}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-400">{t("missed.loading")}</p>
        ) : null}
        {error ? (
          <p className="p-6 text-center text-sm text-red-400">{error}</p>
        ) : null}
        {!loading && !error && opportunities.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">{t("missed.empty")}</p>
        ) : null}
        {!loading && !error && opportunities.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-slate-400">
                <th className="px-4 py-3">{t("missed.time")}</th>
                <th className="px-4 py-3">{t("dashboard.field.pair")}</th>
                <th className="px-4 py-3">{t("signal.score")}</th>
                <th className="px-4 py-3">{t("missed.reasonBlocked")}</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opportunity) => (
                <tr key={opportunity.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                    {formatDateTime(opportunity.timestamp)}
                  </td>
                  <td className="px-4 py-3 font-mono text-white">{opportunity.pair}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={opportunity.score} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">{opportunity.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
