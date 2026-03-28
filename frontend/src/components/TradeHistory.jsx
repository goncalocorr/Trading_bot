import { useEffect, useMemo, useState } from "react";
import ExecutionTimeline from "./ExecutionTimeline";
import { fetchTradeOrders } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";

function formatValue(value, t) {
  return value === null || value === undefined ? t("common.notAvailable") : Number(value).toFixed(4);
}

function ScoreBreakdown({ breakdown }) {
  const { t } = useI18n();
  if (!breakdown) return <p className="mt-3 text-xs text-slate-500">{t("history.noBreakdown")}</p>;

  const items = breakdown.items || [];
  const total = breakdown.totalScore ?? "-";
  const max = breakdown.maxScore ?? 12;
  const decision = breakdown.decision;
  const decisionColor = decision === "EXECUTE" ? "text-emerald-300" : decision === "MISSED" ? "text-amber-300" : "text-slate-400";

  return (
    <div className="mt-2 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-2">
        <span className="text-xs text-slate-400">{t("history.totalScore")}</span>
        <span className="font-mono text-sm font-bold text-white">{total}/{max}</span>
      </div>
      {items.map((item, index) => (
        <div key={index} className="flex items-center justify-between text-[11px]">
          <span className={item.passed ? "text-slate-300" : "text-slate-600 line-through"}>{item.label}</span>
          <span className={`font-mono font-semibold ${item.points > 0 ? "text-emerald-400" : "text-slate-600"}`}>
            +{item.points}/{item.maxPoints}
          </span>
        </div>
      ))}
      {decision && (
        <div className={`border-t border-white/[0.06] pt-2 text-[11px] font-bold ${decisionColor}`}>
          {t("history.decision")}: {decision}
        </div>
      )}
    </div>
  );
}

function IndicatorSummary({ snapshot }) {
  const { t } = useI18n();
  if (!snapshot) return <p className="mt-3 text-xs text-slate-500">{t("history.noSnapshot")}</p>;

  const tf = snapshot["15m"] || {};
  const multi = snapshot.multiTimeframe || {};

  return (
    <div className="mt-2 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-slate-300">
      {tf.rsi14 !== undefined && (
        <div className="flex justify-between"><span>{t("history.rsi15m")}</span><span className="font-mono text-white">{Number(tf.rsi14).toFixed(1)}</span></div>
      )}
      {tf.atr14 !== undefined && (
        <div className="flex justify-between"><span>{t("history.atr15m")}</span><span className="font-mono text-white">{Number(tf.atr14).toFixed(4)}</span></div>
      )}
      {tf.trend?.bias && (
        <div className="flex justify-between"><span>{t("history.trendBias15m")}</span><span className={`font-bold ${tf.trend.bias === "bullish" ? "text-emerald-400" : tf.trend.bias === "bearish" ? "text-rose-400" : "text-slate-400"}`}>{tf.trend.bias}</span></div>
      )}
      {tf.volume && (
        <div className="flex justify-between"><span>{t("history.volumeAboveAvg")}</span><span className={tf.volume.isAboveAverage ? "text-emerald-400" : "text-slate-500"}>{tf.volume.isAboveAverage ? t("history.yes") : t("history.no")}</span></div>
      )}
      {tf.marketState && (
        <div className="flex justify-between"><span>{t("history.marketState")}</span><span className={tf.marketState.isSideways ? "text-amber-400" : "text-emerald-400"}>{tf.marketState.isSideways ? t("signal.sideways") : t("history.trending")}</span></div>
      )}
      {multi.direction && (
        <div className="flex justify-between border-t border-white/[0.06] pt-2"><span>{t("history.multiTfDirection")}</span><span className="font-bold text-white">{multi.direction}</span></div>
      )}
      {multi.reason && (
        <div className="pt-1 text-[10px] text-slate-500">{multi.reason}</div>
      )}
    </div>
  );
}

function TradeHistory({ trades = [], filters, onFilterChange, onApplyFilters }) {
  const { t, formatDateTime } = useI18n();
  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [selectedTradeOrders, setSelectedTradeOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const selectedTrade = useMemo(
    () => trades.find((trade) => trade.id === selectedTradeId) || null,
    [selectedTradeId, trades]
  );

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      if (!selectedTradeId) { setSelectedTradeOrders([]); return; }
      try {
        setLoadingOrders(true);
        const response = await fetchTradeOrders(selectedTradeId);
        if (active) setSelectedTradeOrders(response.orders || []);
      } catch {
        if (active) setSelectedTradeOrders([]);
      } finally {
        if (active) setLoadingOrders(false);
      }
    };
    loadOrders();
    return () => { active = false; };
  }, [selectedTradeId]);

  const inputClass = "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/40 transition";

  return (
    <section className="space-y-5 animate-fade-in">
      <div>
        <h3 className="text-base font-semibold text-white">{t("history.title")}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{t("history.subtitle")}</p>
      </div>

      {/* Filter form */}
      <form
        className="glass-card p-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6"
        onSubmit={(e) => { e.preventDefault(); onApplyFilters(); }}
      >
        <input className={inputClass} placeholder={t("dashboard.field.pair")} value={filters.pair} onChange={(e) => onFilterChange("pair", e.target.value)} />
        <select className={inputClass} value={filters.side} onChange={(e) => onFilterChange("side", e.target.value)}>
          <option value="">{t("history.allSides")}</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <select className={inputClass} value={filters.status} onChange={(e) => onFilterChange("status", e.target.value)}>
          <option value="">{t("history.allStatus")}</option>
          <option value="open">{t("common.open")}</option>
          <option value="closed">{t("common.closed")}</option>
          <option value="cancelled">{t("common.cancelled")}</option>
        </select>
        <input type="date" className={inputClass} value={filters.dateFrom} onChange={(e) => onFilterChange("dateFrom", e.target.value)} />
        <input type="date" className={inputClass} value={filters.dateTo} onChange={(e) => onFilterChange("dateTo", e.target.value)} />
        <button type="submit" className="rounded-xl bg-amber-400/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-300">
          {t("history.applyFilters")}
        </button>
      </form>

      {/* Trade table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <th className="px-3 py-2.5 metric-label">{t("dashboard.field.pair")}</th>
                <th className="px-3 py-2.5 metric-label">{t("dashboard.field.strategy")}</th>
                <th className="px-3 py-2.5 metric-label">{t("dashboard.field.side")}</th>
                <th className="px-3 py-2.5 metric-label">{t("dashboard.field.status")}</th>
                <th className="px-3 py-2.5 metric-label">{t("active.entry")}</th>
                <th className="px-3 py-2.5 metric-label">{t("timeline.exit")}</th>
                <th className="px-3 py-2.5 metric-label">{t("dashboard.field.pnl")}</th>
                <th className="px-3 py-2.5 metric-label">{t("signal.score")}</th>
                <th className="px-3 py-2.5 metric-label">{t("dashboard.field.opened")}</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">{t("history.empty") || "No trades found."}</td></tr>
              ) : (
                trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className={`cursor-pointer border-b border-white/[0.03] transition hover:bg-white/[0.03] ${trade.id === selectedTradeId ? "bg-white/[0.04]" : ""}`}
                    onClick={() => setSelectedTradeId(trade.id === selectedTradeId ? null : trade.id)}
                  >
                    <td className="px-3 py-2.5 font-semibold text-white">{trade.pair}</td>
                    <td className="px-3 py-2.5 text-slate-300">{trade.metadata?.strategyId || trade.metadata?.strategy || t("common.manual")}</td>
                    <td className={`px-3 py-2.5 font-semibold ${trade.side === "BUY" ? "text-emerald-300" : "text-rose-300"}`}>{trade.side}</td>
                    <td className="px-3 py-2.5 capitalize text-slate-300">{trade.status}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">{formatValue(trade.entry_price, t)}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">{formatValue(trade.exit_price, t)}</td>
                    <td className={`px-3 py-2.5 font-mono font-semibold ${Number(trade.result_pnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {formatValue(trade.result_pnl, t)}
                    </td>
                    <td className="px-3 py-2.5">{trade.score_total}</td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{formatDateTime(trade.opened_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected trade detail */}
      {selectedTrade && (
        <div className="glass-card p-5 space-y-4 animate-fade-in">
          <div>
            <h4 className="text-sm font-semibold text-white">{t("history.executionTimeline")}</h4>
            <div className="mt-2">
              <ExecutionTimeline orders={selectedTradeOrders} loading={loadingOrders} compact />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-white">{t("history.scoreBreakdown")}</h4>
              <ScoreBreakdown breakdown={selectedTrade.score_breakdown} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{t("history.marketSnapshot")}</h4>
              <IndicatorSummary snapshot={selectedTrade.indicators_snapshot} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default TradeHistory;
