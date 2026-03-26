import { useEffect, useMemo, useState } from "react";
import ExecutionTimeline from "./ExecutionTimeline";
import { fetchTradeOrders } from "../lib/api";

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function formatValue(value) {
  return value === null || value === undefined ? "n/a" : Number(value).toFixed(4);
}

function TradeHistory({ trades = [], filters, onFilterChange, onApplyFilters }) {
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
      } catch (_error) {
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
        <h2 className="text-xl font-semibold text-white">Trade History</h2>
        <p className="mt-1 text-sm text-slate-300">
          Filter past trades and inspect the exact score breakdown behind every entry.
        </p>
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
          placeholder="Pair"
          value={filters.pair}
          onChange={(event) => onFilterChange("pair", event.target.value)}
        />
        <select
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={filters.side}
          onChange={(event) => onFilterChange("side", event.target.value)}
        >
          <option value="">All sides</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <select
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={filters.status}
          onChange={(event) => onFilterChange("status", event.target.value)}
        >
          <option value="">All status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
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
          Apply filters
        </button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-[22px] border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Pair</th>
              <th className="px-4 py-3 text-left">Strategy</th>
              <th className="px-4 py-3 text-left">Side</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Entry</th>
              <th className="px-4 py-3 text-left">Exit</th>
              <th className="px-4 py-3 text-left">PnL</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Opened</th>
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
                <td className="px-4 py-3">{trade.metadata?.strategyId || trade.metadata?.strategy || "manual"}</td>
                <td className="px-4 py-3">{trade.side}</td>
                <td className="px-4 py-3 capitalize">{trade.status}</td>
                <td className="px-4 py-3">{formatValue(trade.entry_price)}</td>
                <td className="px-4 py-3">{formatValue(trade.exit_price)}</td>
                <td className={`px-4 py-3 ${Number(trade.result_pnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {formatValue(trade.result_pnl)}
                </td>
                <td className="px-4 py-3">{trade.score_total}</td>
                <td className="px-4 py-3">{formatDate(trade.opened_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTrade ? (
        <div className="mt-5 grid gap-4 rounded-[22px] border border-white/10 bg-slate-950/50 p-5">
          <div>
            <h3 className="text-lg font-semibold text-white">Execution Timeline</h3>
            <div className="mt-3">
              <ExecutionTimeline orders={selectedTradeOrders} loading={loadingOrders} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-white">Score Breakdown</h3>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">
              {JSON.stringify(selectedTrade.score_breakdown, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Indicator Snapshot</h3>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">
              {JSON.stringify(selectedTrade.indicators_snapshot, null, 2)}
            </pre>
          </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default TradeHistory;
