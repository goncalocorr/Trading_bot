import { useState } from "react";
import ConfirmModal from "./ConfirmModal";
import { useI18n } from "../i18n/I18nProvider";

function formatValue(value, t) {
  if (value === null || value === undefined) return t("common.notAvailable");
  return Number(value).toFixed(4);
}

function PnlProgressBar({ entry, stop, target, current }) {
  const entryN = Number(entry || 0);
  const stopN = Number(stop || 0);
  const targetN = Number(target || 0);
  const currentN = Number(current || entryN);

  if (!entryN || !stopN || !targetN || targetN === stopN) return null;

  const range = targetN - stopN;
  const position = ((currentN - stopN) / range) * 100;
  const clamped = Math.max(0, Math.min(100, position));
  const entryMark = ((entryN - stopN) / range) * 100;

  const isProfit = currentN >= entryN;

  return (
    <div className="relative mt-3">
      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
        <span>SL</span>
        <span>TP</span>
      </div>
      <div className="progress-bar relative">
        {/* Entry marker */}
        <div
          className="absolute top-0 h-full w-px bg-white/30 z-10"
          style={{ left: `${Math.max(0, Math.min(100, entryMark))}%` }}
        />
        {/* Current position fill */}
        <div
          className={`progress-bar-fill ${isProfit ? "bg-emerald-400" : "bg-rose-400"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function ActiveTrades({ trades = [], onCancel, actionLoading = false }) {
  const { t, formatCurrency } = useI18n();
  const [confirmTrade, setConfirmTrade] = useState(null);

  const handleConfirmCancel = () => {
    if (confirmTrade) onCancel(confirmTrade.id);
    setConfirmTrade(null);
  };

  return (
    <section className="glass-card p-5">
      <ConfirmModal
        open={Boolean(confirmTrade)}
        title={t("active.cancelTitle")}
        message={confirmTrade ? t("active.cancelMessage", { side: confirmTrade.side, pair: confirmTrade.pair }) : ""}
        confirmLabel={t("active.cancelConfirm")}
        confirmClass="bg-rose-500 text-white hover:bg-rose-400"
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmTrade(null)}
      />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{t("active.title")}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{t("active.subtitle")}</p>
        </div>
        <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-white/[0.08] px-2.5 text-xs font-bold text-slate-300">
          {trades.length}
        </span>
      </div>

      <div className="space-y-3">
        {trades.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-sm text-slate-500">
            {t("active.empty")}
          </div>
        ) : (
          trades.map((trade) => {
            const capitalAtRisk = Number(trade.entry_price || 0) * Number(trade.quantity || 0);
            const stopDistance = Number(trade.entry_price || 0) - Number(trade.stop_loss || 0);
            const maxLoss = stopDistance * Number(trade.quantity || 0);
            const pnl = Number(trade.livePnl || 0);
            const pnlPercent = Number(trade.livePnlPercent || 0);

            return (
              <article key={trade.id} className="glass-card-hover p-4">
                {/* Header row */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <h4 className="text-sm font-bold text-white">{trade.pair}</h4>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      trade.side === "BUY"
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-rose-400/15 text-rose-300"
                    }`}>
                      {trade.side}
                    </span>
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">
                      {trade.metadata?.strategyId || trade.metadata?.strategy || t("common.manual")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmTrade(trade)}
                    disabled={actionLoading}
                    className="rounded-lg border border-rose-400/20 bg-rose-500/[0.08] px-3 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/[0.15] disabled:opacity-50"
                  >
                    {t("active.cancelButton")}
                  </button>
                </div>

                {/* PnL highlight */}
                <div className="flex items-baseline gap-3 mb-3">
                  <span className={`text-xl font-bold ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {pnl >= 0 ? "+" : ""}{formatValue(trade.livePnl, t)}
                  </span>
                  <span className={`text-sm ${pnlPercent >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                    {pnlPercent >= 0 ? "+" : ""}{formatValue(trade.livePnlPercent, t)}%
                  </span>
                </div>

                {/* SL/TP progress bar */}
                <PnlProgressBar
                  entry={trade.entry_price}
                  stop={trade.stop_loss}
                  target={trade.take_profit}
                  current={trade.marketPrice}
                />

                {/* Price grid */}
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <span className="text-slate-500">{t("active.entry")}</span>
                  <span className="text-right text-slate-200">{formatValue(trade.entry_price, t)}</span>
                  <span className="text-slate-500">{t("active.market")}</span>
                  <span className="text-right text-white font-medium">{formatValue(trade.marketPrice, t)}</span>
                  <span className="text-slate-500">{t("active.stop")}</span>
                  <span className="text-right text-rose-300/80">{formatValue(trade.stop_loss, t)}</span>
                  <span className="text-slate-500">{t("active.target")}</span>
                  <span className="text-right text-emerald-300/80">{formatValue(trade.take_profit, t)}</span>
                </div>

                {/* Footer details */}
                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500 border-t border-white/[0.06] pt-3">
                  <span>{t("active.qty")}: {formatValue(trade.quantity, t)}</span>
                  <span>{t("active.capital")}: {formatCurrency(capitalAtRisk)}</span>
                  <span className="text-rose-400/60">{t("active.maxLoss")}: {formatCurrency(maxLoss)}</span>
                  {trade.orderSummary?.activeProtection && (
                    <span>{t("active.protection")}: {trade.orderSummary.activeProtection.role}</span>
                  )}
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
