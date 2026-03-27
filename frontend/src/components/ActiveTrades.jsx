import { useState } from "react";
import ConfirmModal from "./ConfirmModal";
import { useI18n } from "../i18n/I18nProvider";

function formatValue(value, t) {
  if (value === null || value === undefined) return t("common.notAvailable");
  return Number(value).toFixed(4);
}

function ActiveTrades({ trades = [], onCancel, actionLoading = false }) {
  const { t, formatCurrency } = useI18n();
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
        title={t("active.cancelTitle")}
        message={confirmTrade ? t("active.cancelMessage", { side: confirmTrade.side, pair: confirmTrade.pair }) : ""}
        confirmLabel={t("active.cancelConfirm")}
        confirmClass="bg-rose-500 text-white hover:bg-rose-400"
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmTrade(null)}
      />

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{t("active.title")}</h2>
          <p className="mt-1 text-sm text-slate-300">{t("active.subtitle")}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
          {t("active.count", { count: trades.length })}
        </span>
      </div>

      <div className="space-y-4">
        {trades.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-8 text-sm text-slate-400">
            {t("active.empty")}
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
                      {trade.metadata?.strategyId || trade.metadata?.strategy || t("common.manual")}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <span>{t("active.entry")}: {formatValue(trade.entry_price, t)}</span>
                    <span>{t("active.market")}: {formatValue(trade.marketPrice, t)}</span>
                    <span>{t("active.stop")}: {formatValue(trade.stop_loss, t)}</span>
                    <span>{t("active.target")}: {formatValue(trade.take_profit, t)}</span>
                    <span>
                      {t("active.protection")}: {trade.orderSummary?.activeProtection ? `${trade.orderSummary.activeProtection.role} (${trade.orderSummary.activeProtection.status})` : t("common.notAvailable")}
                    </span>
                    <span>
                      {t("active.lastStep")}: {trade.orderSummary?.latestExecution ? `${trade.orderSummary.latestExecution.role} (${trade.orderSummary.latestExecution.status})` : t("common.notAvailable")}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-slate-300">
                  <span>{t("active.qty")}: {formatValue(trade.quantity, t)}</span>
                  <span className={Number(trade.livePnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {t("active.livePnl")}: {formatValue(trade.livePnl, t)}
                  </span>
                  <span className={Number(trade.livePnlPercent || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {t("active.pnlPercent")}: {formatValue(trade.livePnlPercent, t)}%
                  </span>
                  <span className="text-slate-400">
                    {t("active.capital")}: {formatCurrency(capitalAtRisk)}
                  </span>
                  <span className="text-rose-400/80">
                    {t("active.maxLoss")}: {formatCurrency(maxLoss)}
                  </span>
                </div>

                <div className="flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => handleCancelClick(trade)}
                    disabled={actionLoading}
                    className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("active.cancelButton")}
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
