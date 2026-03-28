import { useI18n } from "../i18n/I18nProvider";

function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

function formatWhen(value) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function StatusBadge({ label, tone = "slate" }) {
  const toneClass =
    tone === "success" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
    : tone === "warning" ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
    : tone === "danger" ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
    : "border-white/10 bg-white/5 text-slate-200";

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneClass}`}>
      {label}
    </span>
  );
}

/* ── Win rate mini ring ── */
function WinRateRing({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 60 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#fb7185";

  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 24 24)"
        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
      />
      <text x="24" y="27" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function StatsPanel({ stats }) {
  const { t } = useI18n();
  const byStrategy = Array.isArray(stats?.byStrategy) ? stats.byStrategy : [];
  const byRegime = Array.isArray(stats?.byRegime) ? stats.byRegime : [];
  const byStrategyRegime = Array.isArray(stats?.byStrategyRegime) ? stats.byStrategyRegime.slice(0, 6) : [];
  const strategyRankingByPeriod = Array.isArray(stats?.strategyRankingByPeriod) ? stats.strategyRankingByPeriod : [];
  const paperValidation = stats?.paperValidation || {};
  const promotionHistory = Array.isArray(paperValidation?.promotionHistory) ? paperValidation.promotionHistory : [];
  const headToHead = paperValidation?.headToHead || null;
  const recommendation = paperValidation?.recommendation || null;
  const autonomy = stats?.autonomy || null;

  return (
    <section className="glass-card p-5 space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white">{t("stats.title")}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{t("stats.subtitle")}</p>
      </div>

      {/* Main stats grid */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <div className="metric-card items-center">
          <WinRateRing value={stats?.winRate} />
          <p className="metric-label mt-1">{t("stats.winRate")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("stats.totalTrades")}</p>
          <p className="metric-value text-sky-300">{stats?.totalTrades || 0}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("stats.avgProfit")}</p>
          <p className="metric-value text-emerald-300">{formatNumber(stats?.avgProfitPerTrade)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("stats.avgLoss")}</p>
          <p className="metric-value text-rose-300">{formatNumber(stats?.avgLossPerTrade)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("stats.bestTrade")}</p>
          <p className="text-lg font-bold text-emerald-300">{formatNumber(stats?.bestTrade?.result_pnl)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("stats.worstTrade")}</p>
          <p className="text-lg font-bold text-rose-300">{formatNumber(stats?.worstTrade?.result_pnl)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("stats.winStreak")}</p>
          <p className="metric-value text-amber-300">{stats?.longestWinningStreak || 0}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">{t("stats.sharpeRatio")}</p>
          <p className="metric-value text-fuchsia-300">{formatNumber(stats?.sharpeRatio)}</p>
        </div>
      </div>

      {/* Autonomy Control */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <h4 className="text-sm font-semibold text-white">Autonomy Control</h4>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <p className="metric-label">Mode</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-bold text-white">{autonomy?.mode || "manual"}</p>
              <StatusBadge label={autonomy?.tradingMode || "paper"} tone={autonomy?.tradingMode === "live" ? "danger" : "success"} />
            </div>
          </div>
          <div className="metric-card">
            <p className="metric-label">Regime</p>
            <p className="text-sm font-bold text-white mt-1">{autonomy?.currentRegimeId || "mixed"}</p>
            <p className="text-[10px] text-slate-500">Shadow: {autonomy?.shadowModeEnabled ? "on" : "off"}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Strategy Set</p>
            <p className="text-sm font-bold text-white mt-1">{autonomy?.strategySelection?.source || "runtime"}</p>
            <p className="text-[10px] text-slate-500 truncate">{(autonomy?.strategySelection?.strategyIds || []).join(", ") || "n/a"}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Live Gate</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-bold text-white">{autonomy?.liveReadiness?.approvalGate?.status || "?"}</p>
              <StatusBadge
                label={autonomy?.liveReadiness?.isApprovedForLive ? "approved" : "waiting"}
                tone={autonomy?.liveReadiness?.isApprovedForLive ? "success" : "warning"}
              />
            </div>
          </div>
        </div>

        {/* Governance + allocation + breakers in compact rows */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="metric-label">Auto Governance</p>
            <p className="mt-1 text-xs text-slate-300">
              Swap: {autonomy?.automationFlags?.autoSwapEnabled ? "on" : "off"} | Approve: {autonomy?.automationFlags?.autoApproveLiveEnabled ? "on" : "off"} | Deploy: {autonomy?.automationFlags?.autoLiveDeployEnabled ? "on" : "off"}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="metric-label">Capital Allocation</p>
            <p className="mt-1 text-xs text-slate-300">
              Deployable: {formatNumber(autonomy?.strategyAllocation?.deployableCapital)} | Risk: {formatNumber((autonomy?.strategyAllocation?.effectiveRiskPerTrade || 0) * 100)}%
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="metric-label">Circuit Breakers</p>
            <p className="mt-1 text-xs text-slate-300">
              Exec: {Number(autonomy?.circuitBreakers?.executionFailures || 0)} | Exchange: {Number(autonomy?.circuitBreakers?.exchangeFailures || 0)}
            </p>
          </div>
        </div>

        {/* Strategy targets */}
        {(autonomy?.strategyAllocation?.strategyTargets || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {autonomy.strategyAllocation.strategyTargets.map((target) => (
              <div key={target.strategyId} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase">{target.strategyId}</p>
                <p className="text-xs font-bold text-white">{formatNumber(target.capitalTarget)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By Strategy */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h4 className="text-sm font-semibold text-white mb-3">By Strategy</h4>
        {byStrategy.length === 0 ? (
          <p className="text-xs text-slate-500">No strategy statistics available yet.</p>
        ) : (
          <div className="space-y-2">
            {byStrategy.map((item) => (
              <div key={item.strategyId} className="glass-card-hover grid gap-2 p-3 sm:grid-cols-5">
                <div><p className="metric-label">Strategy</p><p className="text-xs font-bold text-white mt-0.5">{item.strategyId}</p></div>
                <div><p className="metric-label">Trades</p><p className="text-xs font-bold text-sky-300 mt-0.5">{item.totalTrades}</p></div>
                <div><p className="metric-label">Win Rate</p><p className="text-xs font-bold text-emerald-300 mt-0.5">{formatNumber(item.winRate)}%</p></div>
                <div><p className="metric-label">Avg P&L</p><p className={`text-xs font-bold mt-0.5 ${Number(item.avgPnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatNumber(item.avgPnl)}</p></div>
                <div><p className="metric-label">Total P&L</p><p className={`text-xs font-bold mt-0.5 ${Number(item.pnlTotal || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatNumber(item.pnlTotal)}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By Regime + Strategy x Regime side-by-side */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h4 className="text-sm font-semibold text-white mb-3">By Regime</h4>
          {byRegime.length === 0 ? (
            <p className="text-xs text-slate-500">No regime analytics yet.</p>
          ) : (
            <div className="space-y-2">
              {byRegime.map((item) => (
                <div key={item.regimeId} className="glass-card-hover grid gap-2 p-3 grid-cols-4">
                  <div><p className="text-xs font-bold text-white">{item.regimeLabel}</p></div>
                  <div><p className="text-xs text-sky-300">{item.totalTrades}</p></div>
                  <div><p className="text-xs text-emerald-300">{formatNumber(item.winRate)}%</p></div>
                  <div><p className={`text-xs ${Number(item.pnlTotal || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatNumber(item.pnlTotal)}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Strategy x Regime</h4>
          {byStrategyRegime.length === 0 ? (
            <p className="text-xs text-slate-500">No cross-regime data yet.</p>
          ) : (
            <div className="space-y-2">
              {byStrategyRegime.map((item) => (
                <div key={`${item.strategyId}:${item.regimeId}`} className="glass-card-hover grid gap-2 p-3 grid-cols-4">
                  <div>
                    <p className="text-xs font-bold text-white">{item.strategyId}</p>
                    <p className="text-[10px] text-slate-500">{item.regimeLabel}</p>
                  </div>
                  <div><p className="text-xs text-sky-300">{item.totalTrades}</p></div>
                  <div><p className="text-xs text-emerald-300">{formatNumber(item.winRate)}%</p></div>
                  <div><p className={`text-xs ${Number(item.avgPnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatNumber(item.avgPnl)}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Paper Validation */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <h4 className="text-sm font-semibold text-white">Paper Validation</h4>

        <div className="grid gap-3 xl:grid-cols-3">
          <div className="metric-card">
            <p className="metric-label">Champion</p>
            <p className="text-sm font-bold text-white mt-1">
              {paperValidation?.champion?.runId ? `Run #${paperValidation.champion.runId}` : "None"}
            </p>
            <p className="text-[10px] text-slate-500">{(paperValidation?.champion?.activeStrategies || []).join(", ") || "n/a"}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              {paperValidation?.champion?.paperPerformance?.tradeCount || 0} trades | {formatNumber(paperValidation?.champion?.paperPerformance?.winRate)}% win | {formatNumber(paperValidation?.champion?.paperPerformance?.pnlTotal)} pnl
            </p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Challenger</p>
            <p className="text-sm font-bold text-white mt-1">
              {paperValidation?.challenger?.runId ? `Run #${paperValidation.challenger.runId}` : "None"}
            </p>
            <p className="text-[10px] text-slate-500">{(paperValidation?.challenger?.activeStrategies || []).join(", ") || "n/a"}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              BT return: {formatNumber(paperValidation?.challenger?.backtestSummary?.totalReturnPercent)}% | {formatNumber(paperValidation?.challenger?.backtestSummary?.winRate)}% win
            </p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Approval Gate</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-bold text-white">{paperValidation?.approvalGate?.status || "?"}</p>
              <StatusBadge
                label={paperValidation?.approvalGate?.canApproveLive ? "ready" : "waiting"}
                tone={paperValidation?.approvalGate?.canApproveLive ? "success" : "warning"}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{paperValidation?.approvalGate?.reason || "No data yet."}</p>
          </div>
        </div>

        {/* Head-to-head + recommendation */}
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="metric-label">Champion vs Challenger</p>
            {headToHead ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-slate-500">PnL Delta</p>
                  <p className={`text-xs font-bold ${Number(headToHead.pnlDelta || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatNumber(headToHead.pnlDelta)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Win Rate</p>
                  <p className={`text-xs font-bold ${Number(headToHead.winRateDelta || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatNumber(headToHead.winRateDelta)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Trades</p>
                  <p className="text-xs font-bold text-sky-300">{formatNumber(headToHead.tradeCountDelta)}</p>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 mt-1">No comparison yet</p>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="metric-label">Recommendation</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs font-bold text-white">{recommendation?.action || "WAIT"}</p>
              <StatusBadge
                label={recommendation?.confidence || "n/a"}
                tone={recommendation?.action === "SWAP_TO_CHALLENGER" || recommendation?.action === "READY_FOR_LIVE_REVIEW" ? "success" : "warning"}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{recommendation?.reason || "No recommendation yet."}</p>
          </div>
        </div>

        {/* Regime governance */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="metric-label mb-2">Regime Champions</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {["trend", "sideways", "volatile"].map((regimeId) => {
              const slot = paperValidation?.regimeGovernance?.slots?.[regimeId];
              return (
                <div key={regimeId} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <p className="text-[10px] text-slate-500 uppercase">{regimeId}</p>
                  <p className="text-xs font-bold text-white">{slot?.runId ? `#${slot.runId}` : "none"}</p>
                  <p className="text-[10px] text-slate-500 truncate">{(slot?.activeStrategies || []).join(", ") || "n/a"}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Promotion history */}
        {promotionHistory.length > 0 && (
          <div className="space-y-1.5">
            {promotionHistory.map((event) => (
              <div key={event.id} className="glass-card-hover grid gap-2 p-3 grid-cols-4 text-xs">
                <span className="font-bold text-white">{event.action}</span>
                <span className="text-slate-300">{event.slot}</span>
                <span className="text-slate-300">{event.run_id ? `#${event.run_id}` : "n/a"}</span>
                <span className="text-slate-500">{formatWhen(event.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Strategy Ranking By Period */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Strategy Ranking By Period</h4>
        <div className="grid gap-3 xl:grid-cols-3">
          {strategyRankingByPeriod.length === 0 ? (
            <p className="text-xs text-slate-500 xl:col-span-3">No ranking data yet.</p>
          ) : (
            strategyRankingByPeriod.map((period) => (
              <div key={period.periodId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="metric-label mb-2">{period.periodLabel}</p>
                <div className="space-y-2">
                  {(period.ranking || []).slice(0, 3).map((item, i) => (
                    <div key={`${period.periodId}:${item.strategyId}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-slate-400">
                          {i + 1}
                        </span>
                        <span className="text-xs font-bold text-white">{item.strategyId}</span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]">
                        <span className="text-sky-300">{item.totalTrades} trades</span>
                        <span className="text-emerald-300">{formatNumber(item.winRate)}%</span>
                        <span className={Number(item.pnlTotal || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatNumber(item.pnlTotal)}</span>
                      </div>
                    </div>
                  ))}
                  {(period.ranking || []).length === 0 && (
                    <p className="text-[10px] text-slate-500">No trades yet.</p>
                  )}
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
