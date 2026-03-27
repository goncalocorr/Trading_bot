import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

function formatValue(value) {
  if (value === null || value === undefined) return "n/a";
  return Number(value).toFixed(4);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function ActiveTrades({ trades = [], onCancel, actionLoading = false }) {
  const [confirmTrade, setConfirmTrade] = useState(null);

  const handleCancelClick = (trade) => {
    setConfirmTrade(trade);
  };

  const handleConfirmCancel = () => {
    if (confirmTrade) {
      onCancel(confirmTrade.id);
    }
    setConfirmTrade(null);
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <ConfirmModal
        open={Boolean(confirmTrade)}
        title="Cancel trade?"
        message={confirmTrade ? `Cancel the open ${confirmTrade.side} position on ${confirmTrade.pair}? The OCO protection orders will also be cancelled.` : ""}
        confirmLabel="Yes, cancel"
        confirmClass="bg-rose-500 text-white hover:bg-rose-400"
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmTrade(null)}
      />

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Active Trades</h2>
          <p className="mt-1 text-sm text-slate-300">Open spot positions with live mark-to-market P&L.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
          {trades.length} open
        </span>
      </div>

      <div className="space-y-4">
        {trades.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-8 text-sm text-slate-400">
            No active trades right now.
          </div>
        ) : (
          trades.map((trade) => {
            const capitalAtRisk = Number(trade.entry_price || 0) * Number(trade.quantity || 0);
            const stopDistance = Number(trade.entry_price || 0) - Number(trade.stop_loss || 0);
            const maxLoss = stopDistance * Number(trade.quantity || 0);

            return (
              <article
                key={trade.id}
                className="grid gap-4 rounded-[22px] border border-white/10 bg-slate-950/50 p-5 md:grid-cols-[1.2fr_1fr_auto]"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{trade.pair}</h3>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                      {trade.side}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      {trade.metadata?.strategyId || trade.metadata?.strategy || "manual"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <span>Entry: {formatValue(trade.entry_price)}</span>
                    <span>Market: {formatValue(trade.marketPrice)}</span>
                    <span>Stop: {formatValue(trade.stop_loss)}</span>
                    <span>Target: {formatValue(trade.take_profit)}</span>
                    <span>
                      Protection: {trade.orderSummary?.activeProtection ? `${trade.orderSummary.activeProtection.role} (${trade.orderSummary.activeProtection.status})` : "n/a"}
                    </span>
                    <span>
                      Last step: {trade.orderSummary?.latestExecution ? `${trade.orderSummary.latestExecution.role} (${trade.orderSummary.latestExecution.status})` : "n/a"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-slate-300">
                  <span>Qty: {formatValue(trade.quantity)}</span>
                  <span className={Number(trade.livePnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    Live P&L: {formatValue(trade.livePnl)}
                  </span>
                  <span className={Number(trade.livePnlPercent || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    P&L %: {formatValue(trade.livePnlPercent)}%
                  </span>
                  <span className="text-slate-400">
                    Capital: {formatCurrency(capitalAtRisk)}
                  </span>
                  <span className="text-rose-400/80">
                    Max loss: {formatCurrency(maxLoss)}
                  </span>
                </div>

                <div className="flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => handleCancelClick(trade)}
                    disabled={actionLoading}
                    className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default ActiveTrades;
