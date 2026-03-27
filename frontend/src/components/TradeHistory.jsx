import { useEffect, useMemo, useState } from "react";
import ExecutionTimeline from "./ExecutionTimeline";
import { fetchTradeOrders } from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";

function formatValue(value, t) {
  return value === null || value === undefined ? t("common.notAvailable") : Number(value).toFixed(4);
}

function ScoreBreakdown({ breakdown }) {
  const { t } = useI18n();

  if (!breakdown) {
    return <p className="mt-3 text-sm text-slate-500">{t("history.noBreakdown")}</p>;
  }

  const items = breakdown.items || [];
  const total = breakdown.totalScore ?? "-";
  const max = breakdown.maxScore ?? 12;
  const decision = breakdown.decision;
  const decisionColor = decision === "EXECUTE" ? "text-emerald-300" : decision === "MISSED" ? "text-amber-300" : "text-slate-400";

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-sm text-slate-300">{t("history.totalScore")}</span>
        <span className="font-mono font-bold text-white">{total}/{max}</span>
      </div>
      {items.map((item, index) => (
        <div key={index} className="flex items-center justify-between text-xs">
          <span className={item.passed ? "text-slate-300" : "text-slate-500 line-through"}>{item.label}</span>
          <span className={`font-mono font-semibold ${item.points > 0 ? "text-emerald-400" : "text-slate-600"}`}>
            +{item.points}/{item.maxPoints}
          </span>
        </div>
      ))}
      {decision ? (
        <div className={`border-t border-white/10 pt-2 text-xs font-semibold ${decisionColor}`}>
          {t("history.decision")}: {decision}
        </div>
      ) : null}
    </div>
  );
}

function IndicatorSummary({ snapshot }) {
  const { t } = useI18n();

  if (!snapshot) {
    return <p className="mt-3 text-sm text-slate-500">{t("history.noSnapshot")}</p>;
  }

  const tf = snapshot["15m"] || {};
  const multi = snapshot.multiTimeframe || {};

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">
      {tf.rsi14 !== undefined ? (
        <div className="flex justify-between"><span>{t("history.rsi15m")}</span><span className="font-mono">{Number(tf.rsi14).toFixed(1)}</span></div>
      ) : null}
      {tf.atr14 !== undefined ? (
        <div className="flex justify-between"><span>{t("history.atr15m")}</span><span className="font-mono">{Number(tf.atr14).toFixed(4)}</span></div>
      ) : null}
      {tf.trend?.bias ? (
        <div className="flex justify-between"><span>{t("history.trendBias15m")}</span><span className={`font-semibold ${tf.trend.bias === "bullish" ? "text-emerald-400" : tf.trend.bias === "bearish" ? "text-rose-400" : "text-slate-400"}`}>{tf.trend.bias}</span></div>
      ) : null}
      {tf.volume ? (
        <div className="flex justify-between"><span>{t("history.volumeAboveAvg")}</span><span className={tf.volume.isAboveAverage ? "text-emerald-400" : "text-slate-500"}>{tf.volume.isAboveAverage ? t("history.yes") : t("history.no")}</span></div>
      ) : null}
      {tf.marketState ? (
        <div className="flex justify-between"><span>{t("history.marketState")}</span><span className={tf.marketState.isSideways ? "text-amber-400" : "text-emerald-400"}>{tf.marketState.isSideways ? t("signal.sideways") : t("history.trending")}</span></div>
      ) : null}
      {multi.direction ? (
        <div className="flex justify-between border-t border-white/10 pt-2"><span>{t("history.multiTfDirection")}</span><span className="font-semibold">{multi.direction}</span></div>
      ) : null}
      {multi.reason ? (
        <div className="pt-1 text-slate-500">{multi.reason}</div>
      ) : null}
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
      if (!selectedTradeId) {
        setSelectedTradeOrders([]);
        return;
      }

      try {
        setLoadingOrders(true);
        const response = await fetchTradeOrders(selectedTradeId);

        if (active) {
          setSelectedTradeOrders(response.orders || []);
        }
      } catch {
        if (active) {
          setSelectedTradeOrders([]);
        }
      } finally {
        if (active) {
          setLoadingOrders(false);
        }
      }
    };

    loadOrders();

    return () => {
      active = false;
    };
  }, [selectedTradeId]);

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">{t("history.title")}</h2>
        <p className="mt-1 text-sm text-slate-300">{t("history.subtitle")}</p>
      </div>

      <form
        className="grid gap-3 rounded-[22px] border border-white/10 bg-slate-950/40 p-4 md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          onApplyFilters();
        }}
      >
        <input
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          placeholder={t("dashboard.field.pair")}
          value={filters.pair}
          onChange={(event) => onFilterChange("pair", event.target.value)}
        />
        <select
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={filters.side}
          onChange={(event) => onFilterChange("side", event.target.value)}
        >
          <option value="">{t("history.allSides")}</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <select
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={filters.status}
          onChange={(event) => onFilterChange("status", event.target.value)}
        >
          <option value="">{t("history.allStatus")}</option>
          <option value="open">{t("common.open")}</option>
          <option value="closed">{t("common.closed")}</option>
          <option value="cancelled">{t("common.cancelled")}</option>
        </select>
        <input
          type="date"
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={filters.dateFrom}
          onChange={(event) => onFilterChange("dateFrom", event.target.value)}
        />
        <input
          type="date"
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={filters.dateTo}
          onChange={(event) => onFilterChange("dateTo", event.target.value)}
        />
        <button
          type="submit"
          className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-200"
        >
          {t("history.applyFilters")}
        </button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-[22px] border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">{t("dashboard.field.pair")}</th>
              <th className="px-4 py-3 text-left">{t("dashboard.field.strategy")}</th>
              <th className="px-4 py-3 text-left">{t("dashboard.field.side")}</th>
              <th className="px-4 py-3 text-left">{t("dashboard.field.status")}</th>
              <th className="px-4 py-3 text-left">{t("active.entry")}</th>
              <th className="px-4 py-3 text-left">{t("timeline.exit")}</th>
              <th className="px-4 py-3 text-left">{t("dashboard.field.pnl")}</th>
              <th className="px-4 py-3 text-left">{t("signal.score")}</th>
              <th className="px-4 py-3 text-left">{t("dashboard.field.opened")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-slate-950/35">
            {trades.map((trade) => (
              <tr
                key={trade.id}
                className="cursor-pointer transition hover:bg-white/5"
                onClick={() => setSelectedTradeId(trade.id === selectedTradeId ? null : trade.id)}
              >
                <td className="px-4 py-3">{trade.pair}</td>
                <td className="px-4 py-3">{trade.metadata?.strategyId || trade.metadata?.strategy || t("common.manual")}</td>
                <td className="px-4 py-3">{trade.side}</td>
                <td className="px-4 py-3 capitalize">{trade.status}</td>
                <td className="px-4 py-3">{formatValue(trade.entry_price, t)}</td>
                <td className="px-4 py-3">{formatValue(trade.exit_price, t)}</td>
                <td className={`px-4 py-3 ${Number(trade.result_pnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {formatValue(trade.result_pnl, t)}
                </td>
                <td className="px-4 py-3">{trade.score_total}</td>
                <td className="px-4 py-3">{formatDateTime(trade.opened_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTrade ? (
        <div className="mt-5 grid gap-4 rounded-[22px] border border-white/10 bg-slate-950/50 p-5">
          <div>
            <h3 className="text-lg font-semibold text-white">{t("history.executionTimeline")}</h3>
            <div className="mt-3">
              <ExecutionTimeline orders={selectedTradeOrders} loading={loadingOrders} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold text-white">{t("history.scoreBreakdown")}</h3>
              <ScoreBreakdown breakdown={selectedTrade.score_breakdown} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{t("history.marketSnapshot")}</h3>
              <IndicatorSummary snapshot={selectedTrade.indicators_snapshot} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default TradeHistory;
