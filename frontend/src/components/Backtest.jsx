import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function formatDelta(value, suffix = "") {
  const numericValue = Number(value || 0);
  return `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(2)}${suffix}`;
}

function renderInsightBadge(insights) {
  const tier = insights?.tier;

  if (!tier) return null;

  const className =
    tier === "TOP_CANDIDATE"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : tier === "WATCHLIST"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : "border-rose-300/30 bg-rose-300/10 text-rose-100";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${className}`}>
      {tier.replaceAll("_", " ")}
    </span>
  );
}

function renderPerformanceCard(label, value, color) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function RunSetList({ title, description, items = [], emptyLabel, itemLabel }) {
  return (
    <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
            {emptyLabel}
          </div>
        ) : (
          items.map((item, index) => (
            <article
              key={`${item.label}:${item.runId || index}`}
              className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr]"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{itemLabel}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  {renderInsightBadge(item.insights)}
                </div>
                <p className="mt-1 text-xs text-slate-400">{(item.strategies || []).join(", ")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Return</p>
                <p className={`mt-2 text-sm font-semibold ${Number(item.totalReturnPercent || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {formatNumber(item.totalReturnPercent)}%
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Win Rate</p>
                <p className="mt-2 text-sm font-semibold text-sky-300">{formatNumber(item.winRate)}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Drawdown</p>
                <p className="mt-2 text-sm font-semibold text-rose-300">{formatNumber(item.maxDrawdown)}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trades</p>
                <p className="mt-2 text-sm font-semibold text-amber-300">{item.tradeCount || 0}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Backtest({
  form,
  onChange,
  onRun,
  onCompare,
  onRunExperiments,
  onFavoriteRun,
  onPromoteRun,
  onApproveLive,
  loading = false,
  result,
  strategies = [],
  runs = [],
  selectedRun = null,
  onSelectRun,
  runsLoading = false,
  comparisons = [],
  comparisonLoading = false,
  experiments = [],
  experimentLoading = false
}) {
  const displayResult = selectedRun?.result || result;
  const displaySummary = selectedRun?.summary || (displayResult ? { assumptions: displayResult.assumptions } : null);
  const showingSavedRun = Boolean(selectedRun?.id);
  const comparison =
    result && selectedRun?.result && selectedRun.result !== result
      ? {
          returnDelta: Number(selectedRun.result.totalReturnPercent || 0) - Number(result.totalReturnPercent || 0),
          winRateDelta: Number(selectedRun.result.winRate || 0) - Number(result.winRate || 0),
          drawdownDelta: Number(selectedRun.result.maxDrawdown || 0) - Number(result.maxDrawdown || 0),
          tradeCountDelta: Number(selectedRun.result.tradeCount || 0) - Number(result.tradeCount || 0)
        }
      : null;

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">Backtesting</h2>
        <p className="mt-1 text-sm text-slate-300">
          Replay historical Binance candles with the same core risk and score logic.
        </p>
      </div>

      <div className="mb-5 rounded-[22px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
        Backtest sentiment is assumed neutral and order book pressure is approximated from candle close position within the candle range. These are known approximations for strategy validation, not exact performance predictions.
      </div>

      <form
        className="grid gap-3 rounded-[22px] border border-white/10 bg-slate-950/40 p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          onRun();
        }}
      >
        <input className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" placeholder="BTCUSDT" value={form.pair} onChange={(event) => onChange("pair", event.target.value)} />
        <input type="date" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.dateFrom} onChange={(event) => onChange("dateFrom", event.target.value)} />
        <input type="date" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.dateTo} onChange={(event) => onChange("dateTo", event.target.value)} />
        <select className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.timeframe} onChange={(event) => onChange("timeframe", event.target.value)}>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
        </select>
        <select className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.mode} onChange={(event) => onChange("mode", event.target.value)}>
          <option value="standard">Standard</option>
          <option value="walk_forward">Walk Forward</option>
        </select>
        <input type="number" step="0.0001" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.feeRate} onChange={(event) => onChange("feeRate", event.target.value)} placeholder="Fee rate" />
        <input type="number" step="1" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.slippageBps} onChange={(event) => onChange("slippageBps", event.target.value)} placeholder="Slippage bps" />
        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 md:col-span-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Strategies</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {strategies.map((strategy) => {
              const selected = Array.isArray(form.activeStrategies) && form.activeStrategies.includes(strategy.id);

              return (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() =>
                    onChange(
                      "activeStrategies",
                      selected
                        ? form.activeStrategies.filter((item) => item !== strategy.id)
                        : [...(form.activeStrategies || []), strategy.id]
                    )
                  }
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${selected ? "border border-cyan-300/30 bg-cyan-300/15 text-cyan-100" : "border border-white/10 bg-slate-950 text-slate-300 hover:bg-white/10"}`}
                >
                  {strategy.id}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {Array.isArray(form.activeStrategies) && form.activeStrategies.length > 0 ? `${form.activeStrategies.length} strategy(ies) selected` : "No strategy selected. The default active set will be used."}
          </p>
        </div>
        <input type="number" min="1" max="5" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.maxCombinationSize} onChange={(event) => onChange("maxCombinationSize", event.target.value)} placeholder="Max combo size" />
        {form.mode === "walk_forward" ? (
          <>
            <input type="number" step="1" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.walkForwardTrainDays} onChange={(event) => onChange("walkForwardTrainDays", event.target.value)} placeholder="Train days" />
            <input type="number" step="1" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.walkForwardTestDays} onChange={(event) => onChange("walkForwardTestDays", event.target.value)} placeholder="Test days" />
            <input type="number" step="1" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.walkForwardStepDays} onChange={(event) => onChange("walkForwardStepDays", event.target.value)} placeholder="Step days" />
          </>
        ) : null}
        <button type="submit" className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200 md:col-span-4">
          {loading ? "Running backtest..." : "Run backtest"}
        </button>
        <button type="button" onClick={onCompare} disabled={comparisonLoading} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 md:col-span-4">
          {comparisonLoading ? "Comparing strategy sets..." : "Compare strategy sets"}
        </button>
        <button type="button" onClick={onRunExperiments} disabled={experimentLoading} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-50 md:col-span-4">
          {experimentLoading ? "Running auto experiments..." : "Auto-run experiments"}
        </button>
      </form>

      <RunSetList
        title="Strategy Set Comparison"
        description="Compare the selected combo against each selected strategy on its own."
        items={comparisons}
        emptyLabel="No comparison results yet. Select one or more strategies and run a comparison."
        itemLabel="Set"
      />

      <RunSetList
        title="Auto Experiment Runner"
        description="Generate strategy combinations automatically up to the selected combo size and rank them by return."
        items={experiments}
        emptyLabel="No experiment batch results yet. Select strategies, choose a combo size and run the auto experiments."
        itemLabel="Experiment"
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Saved Runs</h3>
              <p className="mt-1 text-sm text-slate-300">Recent experiments you can reopen and compare without rerunning.</p>
            </div>
            {runsLoading ? <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Loading</span> : null}
          </div>

          <div className="space-y-3">
            {runs.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
                No saved backtest runs yet.
              </div>
            ) : (
              runs.map((run) => (
                <article key={run.id} className={`rounded-[18px] border p-4 transition ${selectedRun?.id === run.id ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-slate-950/50 hover:bg-white/10"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <button type="button" onClick={() => onSelectRun?.(run.id)} className="flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{run.pair} · {run.timeframe}</p>
                        {run.mark?.is_favorite || run.mark?.isFavorite ? <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">Favorite</span> : null}
                          {run.mark?.promoted_to_paper || run.mark?.promotedToPaper ? <span className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">Promoted</span> : null}
                        </div>
                      <p className="mt-1 text-xs text-slate-400">{String(run.dateFrom).slice(0, 10)} to {String(run.dateTo).slice(0, 10)}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{(run.config?.activeStrategies || []).join(", ") || "default set"}</p>
                    </button>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">#{run.id}</span>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => onFavoriteRun?.(run.id, !(run.mark?.is_favorite || run.mark?.isFavorite), run.mark?.favorite_label || run.mark?.favoriteLabel || "")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/10">
                          {run.mark?.is_favorite || run.mark?.isFavorite ? "Unfavorite" : "Favorite"}
                        </button>
                        <button type="button" onClick={() => onPromoteRun?.(run.id, "champion")} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
                          Set champion
                        </button>
                        <button type="button" onClick={() => onPromoteRun?.(run.id, "challenger")} className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-[11px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-300/15">
                          Set challenger
                        </button>
                        <button type="button" onClick={() => onApproveLive?.(run.id)} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/15">
                          Approve live
                        </button>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => onSelectRun?.(run.id)} className="mt-3 block w-full text-left">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Return</p><p className="mt-1 text-sm font-semibold text-emerald-300">{formatNumber(run.summary?.totalReturnPercent)}%</p></div>
                      <div><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Win Rate</p><p className="mt-1 text-sm font-semibold text-sky-300">{formatNumber(run.summary?.winRate)}%</p></div>
                      <div><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Drawdown</p><p className="mt-1 text-sm font-semibold text-rose-300">{formatNumber(run.summary?.maxDrawdown)}%</p></div>
                      <div><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Trades</p><p className="mt-1 text-sm font-semibold text-amber-300">{run.summary?.tradeCount || 0}</p></div>
                    </div>
                  </button>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          {displayResult ? (
            <>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{showingSavedRun ? "Selected Run Detail" : "Latest Backtest Result"}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {showingSavedRun ? `Saved run #${selectedRun.id} created ${formatDateTime(selectedRun.createdAt)}` : "Fresh result from the most recent run."}
                    </p>
                  </div>
                  {showingSavedRun ? <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Saved run</div> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                {renderPerformanceCard("Return", `${formatNumber(displayResult.totalReturnPercent)}%`, "text-emerald-300")}
                {renderPerformanceCard("Win Rate", `${formatNumber(displayResult.winRate)}%`, "text-sky-300")}
                {renderPerformanceCard("Max Drawdown", `${formatNumber(displayResult.maxDrawdown)}%`, "text-rose-300")}
                {renderPerformanceCard("Trades", displayResult.tradeCount || 0, "text-amber-300")}
              </div>

              {displaySummary?.assumptions ? (
                <div className="grid gap-4 md:grid-cols-4">
                  {renderPerformanceCard("Sentiment", displaySummary.assumptions.sentiment, "text-white")}
                  {renderPerformanceCard("Order Book", displaySummary.assumptions.orderBook, "text-white")}
                  {renderPerformanceCard("Execution", displaySummary.assumptions.spotMode ? "Spot simulation" : "Unknown", "text-white")}
                  {renderPerformanceCard(
                    "Strategies",
                    Array.isArray(displaySummary.assumptions.activeStrategies) && displaySummary.assumptions.activeStrategies.length > 0
                      ? displaySummary.assumptions.activeStrategies.join(", ")
                      : Array.isArray(selectedRun?.config?.activeStrategies) && selectedRun.config.activeStrategies.length > 0
                        ? selectedRun.config.activeStrategies.join(", ")
                        : "default set",
                    "text-white"
                  )}
                </div>
              ) : null}

              {Array.isArray(displayResult.strategyRankingByPeriod) && displayResult.strategyRankingByPeriod.length > 0 ? (
                <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white">Strategy Ranking By Period</h3>
                    <p className="mt-1 text-sm text-slate-300">Top strategy leaderboard generated from this backtest run.</p>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-3">
                    {displayResult.strategyRankingByPeriod.map((period) => (
                      <div key={period.periodId} className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{period.periodLabel}</p>
                        <div className="mt-3 space-y-3">
                          {(period.ranking || []).slice(0, 3).map((item) => (
                            <div key={`${period.periodId}:${item.strategyId}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                              <p className="text-sm font-semibold text-white">{item.strategyId}</p>
                              <p className="mt-1 text-xs text-slate-400">{item.totalTrades} trades · {formatNumber(item.winRate)}% win · {formatNumber(item.pnlTotal)} pnl</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {comparison ? (
                <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white">Comparison vs Latest Run</h3>
                    <p className="mt-1 text-sm text-slate-300">Quick delta between the selected saved run and the most recent backtest you executed.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    {renderPerformanceCard("Return Delta", formatDelta(comparison.returnDelta, "%"), comparison.returnDelta >= 0 ? "text-emerald-300" : "text-rose-300")}
                    {renderPerformanceCard("Win Rate Delta", formatDelta(comparison.winRateDelta, "%"), comparison.winRateDelta >= 0 ? "text-emerald-300" : "text-rose-300")}
                    {renderPerformanceCard("Drawdown Delta", formatDelta(comparison.drawdownDelta, "%"), comparison.drawdownDelta <= 0 ? "text-emerald-300" : "text-rose-300")}
                    {renderPerformanceCard("Trade Count Delta", formatDelta(comparison.tradeCountDelta), comparison.tradeCountDelta >= 0 ? "text-sky-300" : "text-amber-300")}
                  </div>
                </div>
              ) : null}

              {displayResult.walkForward?.windowCount ? (
                <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white">Walk-Forward Windows</h3>
                    <p className="mt-1 text-sm text-slate-300">In-sample vs out-of-sample checkpoints across the selected range.</p>
                  </div>
                  <div className="space-y-3">
                    {displayResult.walkForward.windows.map((window) => (
                      <article key={window.index} className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Window</p>
                          <p className="mt-2 text-sm font-semibold text-white">#{window.index}</p>
                          <p className="mt-1 text-xs text-slate-400">Test {String(window.testPeriod.start).slice(0, 10)} to {String(window.testPeriod.end).slice(0, 10)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">In Sample</p>
                          <p className="mt-2 text-sm font-semibold text-sky-300">{formatNumber(window.inSample.totalReturnPercent)}% return</p>
                          <p className="mt-1 text-xs text-slate-400">{window.inSample.tradeCount} trades · {formatNumber(window.inSample.winRate)}% win</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Out Of Sample</p>
                          <p className="mt-2 text-sm font-semibold text-emerald-300">{formatNumber(window.outOfSample.totalReturnPercent)}% return</p>
                          <p className="mt-1 text-xs text-slate-400">{window.outOfSample.tradeCount} trades · {formatNumber(window.outOfSample.winRate)}% win</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Capital</p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {formatNumber(window.outOfSample.startingCapital)} {"->"} {formatNumber(window.outOfSample.endingCapital)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">DD {formatNumber(window.outOfSample.maxDrawdown)}%</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="h-72 rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayResult.capitalCurve || []}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="timestamp" tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px" }} />
                    <Line dataKey="capital" stroke="#22d3ee" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
                <h3 className="text-lg font-semibold text-white">Trade Log</h3>
                <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">
                  {JSON.stringify(displayResult.trades, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-8 text-sm text-slate-400">
              Run a backtest or select a saved run to inspect the capital curve and trade log.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Backtest;
