function StatCard({ label, value, accent = "text-emerald-300" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

function StatsPanel({ stats }) {
  const byStrategy = Array.isArray(stats?.byStrategy) ? stats.byStrategy : [];
  const byRegime = Array.isArray(stats?.byRegime) ? stats.byRegime : [];
  const byStrategyRegime = Array.isArray(stats?.byStrategyRegime) ? stats.byStrategyRegime.slice(0, 6) : [];
  const strategyRankingByPeriod = Array.isArray(stats?.strategyRankingByPeriod) ? stats.strategyRankingByPeriod : [];
  const paperValidation = stats?.paperValidation || {};
  const promotionHistory = Array.isArray(paperValidation?.promotionHistory) ? paperValidation.promotionHistory : [];
  const headToHead = paperValidation?.headToHead || null;
  const recommendation = paperValidation?.recommendation || null;

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">Statistics</h2>
        <p className="mt-1 text-sm text-slate-300">
          Win rate, trade quality and simple risk-adjusted performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Win Rate" value={`${formatNumber(stats?.winRate)}%`} />
        <StatCard label="Total Trades" value={String(stats?.totalTrades || 0)} accent="text-sky-300" />
        <StatCard label="Avg Profit" value={formatNumber(stats?.avgProfitPerTrade)} accent="text-emerald-300" />
        <StatCard label="Avg Loss" value={formatNumber(stats?.avgLossPerTrade)} accent="text-rose-300" />
        <StatCard label="Best Trade" value={formatNumber(stats?.bestTrade?.result_pnl)} accent="text-emerald-300" />
        <StatCard label="Worst Trade" value={formatNumber(stats?.worstTrade?.result_pnl)} accent="text-rose-300" />
        <StatCard label="Win Streak" value={String(stats?.longestWinningStreak || 0)} accent="text-amber-300" />
        <StatCard label="Sharpe Ratio" value={formatNumber(stats?.sharpeRatio)} accent="text-fuchsia-300" />
      </div>

      <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">By Strategy</h3>
          <p className="mt-1 text-sm text-slate-300">
            Compare trade count, win rate and average P&amp;L per strategy.
          </p>
        </div>

        <div className="space-y-3">
          {byStrategy.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
              No strategy statistics available yet.
            </div>
          ) : (
            byStrategy.map((item) => (
              <article
                key={item.strategyId}
                className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-5"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Strategy</p>
                  <p className="mt-2 text-sm font-semibold text-white">{item.strategyId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trades</p>
                  <p className="mt-2 text-sm font-semibold text-sky-300">{item.totalTrades}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Win Rate</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-300">{formatNumber(item.winRate)}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Avg P&amp;L</p>
                  <p className={`mt-2 text-sm font-semibold ${Number(item.avgPnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatNumber(item.avgPnl)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total P&amp;L</p>
                  <p className={`mt-2 text-sm font-semibold ${Number(item.pnlTotal || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatNumber(item.pnlTotal)}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">By Regime</h3>
            <p className="mt-1 text-sm text-slate-300">
              See whether the bot performs better in trend, sideways, volatile or mixed conditions.
            </p>
          </div>

          <div className="space-y-3">
            {byRegime.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
                No regime analytics available yet.
              </div>
            ) : (
              byRegime.map((item) => (
                <article
                  key={item.regimeId}
                  className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-4"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Regime</p>
                    <p className="mt-2 text-sm font-semibold text-white">{item.regimeLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trades</p>
                    <p className="mt-2 text-sm font-semibold text-sky-300">{item.totalTrades}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Win Rate</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-300">{formatNumber(item.winRate)}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total P&amp;L</p>
                    <p className={`mt-2 text-sm font-semibold ${Number(item.pnlTotal || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {formatNumber(item.pnlTotal)}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Strategy x Regime</h3>
            <p className="mt-1 text-sm text-slate-300">
              Rank the most active strategy and regime combinations to find the cleanest fit.
            </p>
          </div>

          <div className="space-y-3">
            {byStrategyRegime.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
                No cross-regime strategy analytics available yet.
              </div>
            ) : (
              byStrategyRegime.map((item) => (
                <article
                  key={`${item.strategyId}:${item.regimeId}`}
                  className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr]"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Strategy</p>
                    <p className="mt-2 text-sm font-semibold text-white">{item.strategyId}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.regimeLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trades</p>
                    <p className="mt-2 text-sm font-semibold text-sky-300">{item.totalTrades}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Win Rate</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-300">{formatNumber(item.winRate)}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Avg P&amp;L</p>
                    <p className={`mt-2 text-sm font-semibold ${Number(item.avgPnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {formatNumber(item.avgPnl)}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Paper Validation</h3>
          <p className="mt-1 text-sm text-slate-300">
            Champion-challenger tracking for promoted strategy sets before live approval.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Champion</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {paperValidation?.champion?.runId ? `Run #${paperValidation.champion.runId}` : "No champion"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {(paperValidation?.champion?.activeStrategies || []).join(", ") || "n/a"}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Paper trades: {paperValidation?.champion?.paperPerformance?.tradeCount || 0} | Win rate: {formatNumber(paperValidation?.champion?.paperPerformance?.winRate)}% | PnL: {formatNumber(paperValidation?.champion?.paperPerformance?.pnlTotal)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Regime fit: {paperValidation?.champion?.regimeSnapshot?.topRegime?.regimeLabel || "n/a"}
            </p>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Challenger</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {paperValidation?.challenger?.runId ? `Run #${paperValidation.challenger.runId}` : "No challenger"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {(paperValidation?.challenger?.activeStrategies || []).join(", ") || "n/a"}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Backtest return: {formatNumber(paperValidation?.challenger?.backtestSummary?.totalReturnPercent)}% | Win rate: {formatNumber(paperValidation?.challenger?.backtestSummary?.winRate)}%
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Regime fit: {paperValidation?.challenger?.regimeSnapshot?.topRegime?.regimeLabel || "n/a"}
            </p>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Approval Gate</p>
            <p className="mt-2 text-sm font-semibold text-white">{paperValidation?.approvalGate?.status || "UNKNOWN"}</p>
            <p className="mt-1 text-xs text-slate-400">{paperValidation?.approvalGate?.reason || "No approval data yet."}</p>
            <p className="mt-3 text-xs text-slate-400">
              Thresholds: {paperValidation?.approvalGate?.thresholds?.minTrades || 0} trades, {formatNumber(paperValidation?.approvalGate?.thresholds?.minWinRate)}% win, {formatNumber(paperValidation?.approvalGate?.thresholds?.minPnl)} pnl
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Champion vs Challenger</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {headToHead ? "Head-to-head comparison" : "No comparison available yet"}
            </p>
            {headToHead ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">PnL Delta</p>
                  <p className={`mt-1 text-sm font-semibold ${Number(headToHead.pnlDelta || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatNumber(headToHead.pnlDelta)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Win Rate Delta</p>
                  <p className={`mt-1 text-sm font-semibold ${Number(headToHead.winRateDelta || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {formatNumber(headToHead.winRateDelta)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Trade Delta</p>
                  <p className="mt-1 text-sm font-semibold text-sky-300">{formatNumber(headToHead.tradeCountDelta)}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recommendation</p>
            <p className="mt-2 text-sm font-semibold text-white">{recommendation?.action || "WAIT"}</p>
            <p className="mt-1 text-xs text-slate-400">{recommendation?.reason || "No recommendation yet."}</p>
            <p className="mt-3 text-xs text-slate-500">
              Confidence: {recommendation?.confidence || "n/a"}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {promotionHistory.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
              No promotion history yet.
            </div>
          ) : (
            promotionHistory.map((event) => (
              <article key={event.id} className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-[0.9fr_0.8fr_0.8fr_1.5fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Action</p>
                  <p className="mt-2 text-sm font-semibold text-white">{event.action}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Slot</p>
                  <p className="mt-2 text-sm font-semibold text-white">{event.slot}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Run</p>
                  <p className="mt-2 text-sm font-semibold text-white">{event.run_id ? `#${event.run_id}` : "n/a"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">When</p>
                  <p className="mt-2 text-sm font-semibold text-white">{event.created_at ? new Date(event.created_at).toLocaleString() : "n/a"}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Strategy Ranking By Period</h3>
          <p className="mt-1 text-sm text-slate-300">
            Quick leaderboard for recent and full-history strategy performance.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {strategyRankingByPeriod.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400 xl:col-span-3">
              No strategy ranking data available yet.
            </div>
          ) : (
            strategyRankingByPeriod.map((period) => (
              <div key={period.periodId} className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{period.periodLabel}</p>
                <div className="mt-3 space-y-3">
                  {(period.ranking || []).slice(0, 3).map((item) => (
                    <div key={`${period.periodId}:${item.strategyId}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                      <p className="text-sm font-semibold text-white">{item.strategyId}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Trades</p>
                          <p className="mt-1 text-xs font-semibold text-sky-300">{item.totalTrades}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Win Rate</p>
                          <p className="mt-1 text-xs font-semibold text-emerald-300">{formatNumber(item.winRate)}%</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Total P&amp;L</p>
                          <p className={`mt-1 text-xs font-semibold ${Number(item.pnlTotal || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {formatNumber(item.pnlTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(period.ranking || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-3 text-xs text-slate-500">
                      No trades for this period yet.
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default StatsPanel;
