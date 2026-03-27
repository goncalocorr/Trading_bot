import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../i18n/I18nProvider";

function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

function formatDelta(value, suffix = "") {
  const numericValue = Number(value || 0);
  return `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(2)}${suffix}`;
}

function toneClass(value) {
  return Number(value || 0) >= 0 ? "text-emerald-300" : "text-rose-300";
}

function StatusPill({ label, tone = "slate" }) {
  const className =
    tone === "success"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : tone === "warning"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : "border-white/10 bg-white/5 text-slate-200";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${className}`}>{label}</span>;
}

function PerformanceCard({ label, value, color }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function RunSetList({ title, description, items = [], emptyLabel }) {
  const { t } = useI18n();

  return (
    <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">{emptyLabel}</div>
        ) : (
          items.map((item, index) => (
            <article key={`${item.label}:${item.runId || index}`} className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.set")}</p>
                <p className="mt-2 text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400">{(item.strategies || []).join(", ")}</p>
              </div>
              <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.return")}</p><p className={`mt-2 text-sm font-semibold ${toneClass(item.totalReturnPercent)}`}>{formatNumber(item.totalReturnPercent)}%</p></div>
              <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("stats.winRate")}</p><p className="mt-2 text-sm font-semibold text-sky-300">{formatNumber(item.winRate)}%</p></div>
              <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.maxDrawdown")}</p><p className="mt-2 text-sm font-semibold text-rose-300">{formatNumber(item.maxDrawdown)}%</p></div>
              <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.trades")}</p><p className="mt-2 text-sm font-semibold text-amber-300">{item.tradeCount || 0}</p></div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Backtest(props) {
  const { t, locale, formatDateTime } = useI18n();
  const {
    form, onChange, onRun, onCompare, onRunExperiments, onFavoriteRun, onPromoteRun, onApproveLive,
    loading = false, result, strategies = [], runs = [], selectedRun = null, onSelectRun,
    runsLoading = false, comparisons = [], comparisonLoading = false, experiments = [], experimentLoading = false
  } = props;
  const displayResult = selectedRun?.result || result;
  const displaySummary = selectedRun?.summary || (displayResult ? { assumptions: displayResult.assumptions } : null);
  const showingSavedRun = Boolean(selectedRun?.id);
  const tradeLogPreview = Array.isArray(displayResult?.trades) ? displayResult.trades.slice(0, 12) : [];
  const comparison = result && selectedRun?.result && selectedRun.result !== result ? {
    returnDelta: Number(selectedRun.result.totalReturnPercent || 0) - Number(result.totalReturnPercent || 0),
    winRateDelta: Number(selectedRun.result.winRate || 0) - Number(result.winRate || 0),
    drawdownDelta: Number(selectedRun.result.maxDrawdown || 0) - Number(result.maxDrawdown || 0),
    tradeCountDelta: Number(selectedRun.result.tradeCount || 0) - Number(result.tradeCount || 0)
  } : null;

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">{t("backtest.title")}</h2>
        <p className="mt-1 text-sm text-slate-300">{t("backtest.subtitle")}</p>
      </div>

      <div className="mb-5 rounded-[22px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
        {t("backtest.warning")}
      </div>

      <form className="grid gap-3 rounded-[22px] border border-white/10 bg-slate-950/40 p-4 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); onRun(); }}>
        <input className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" placeholder="BTCUSDT" value={form.pair} onChange={(event) => onChange("pair", event.target.value)} />
        <input type="date" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.dateFrom} onChange={(event) => onChange("dateFrom", event.target.value)} />
        <input type="date" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.dateTo} onChange={(event) => onChange("dateTo", event.target.value)} />
        <select className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.timeframe} onChange={(event) => onChange("timeframe", event.target.value)}><option value="15m">15m</option><option value="1h">1h</option></select>
        <select className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.mode} onChange={(event) => onChange("mode", event.target.value)}><option value="standard">{t("backtest.mode.standard")}</option><option value="walk_forward">{t("backtest.mode.walkForward")}</option></select>
        <input type="number" step="0.0001" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.feeRate} onChange={(event) => onChange("feeRate", event.target.value)} placeholder={t("backtest.feeRate")} />
        <input type="number" step="1" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.slippageBps} onChange={(event) => onChange("slippageBps", event.target.value)} placeholder={t("backtest.slippageBps")} />
        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 md:col-span-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.strategies")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {strategies.map((strategy) => {
              const selected = Array.isArray(form.activeStrategies) && form.activeStrategies.includes(strategy.id);
              return (
                <button key={strategy.id} type="button" onClick={() => onChange("activeStrategies", selected ? form.activeStrategies.filter((item) => item !== strategy.id) : [...(form.activeStrategies || []), strategy.id])} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${selected ? "border border-cyan-300/30 bg-cyan-300/15 text-cyan-100" : "border border-white/10 bg-slate-950 text-slate-300 hover:bg-white/10"}`}>
                  {strategy.id}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {Array.isArray(form.activeStrategies) && form.activeStrategies.length > 0
              ? t("backtest.selectedStrategies", { count: form.activeStrategies.length })
              : t("backtest.noStrategySelected")}
          </p>
        </div>
        <input type="number" min="1" max="5" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.maxCombinationSize} onChange={(event) => onChange("maxCombinationSize", event.target.value)} placeholder={t("backtest.maxComboSize")} />
        {form.mode === "walk_forward" ? (
          <>
            <input type="number" step="1" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.walkForwardTrainDays} onChange={(event) => onChange("walkForwardTrainDays", event.target.value)} placeholder={t("backtest.trainDays")} />
            <input type="number" step="1" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.walkForwardTestDays} onChange={(event) => onChange("walkForwardTestDays", event.target.value)} placeholder={t("backtest.testDays")} />
            <input type="number" step="1" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" value={form.walkForwardStepDays} onChange={(event) => onChange("walkForwardStepDays", event.target.value)} placeholder={t("backtest.stepDays")} />
          </>
        ) : null}
        <button type="submit" className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200 md:col-span-4">{loading ? t("backtest.running") : t("backtest.run")}</button>
        <button type="button" onClick={onCompare} disabled={comparisonLoading} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 md:col-span-4">{comparisonLoading ? t("backtest.comparing") : t("backtest.compare")}</button>
        <button type="button" onClick={onRunExperiments} disabled={experimentLoading} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-50 md:col-span-4">{experimentLoading ? t("backtest.autoRunning") : t("backtest.autoRun")}</button>
      </form>

      <RunSetList title={t("backtest.setComparison")} description={t("backtest.setComparisonHint")} items={comparisons} emptyLabel={t("backtest.setComparisonEmpty")} />
      <RunSetList title={t("backtest.experimentRunner")} description={t("backtest.experimentRunnerHint")} items={experiments} emptyLabel={t("backtest.experimentRunnerEmpty")} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{t("backtest.savedRuns")}</h3>
              <p className="mt-1 text-sm text-slate-300">{t("backtest.savedRunsHint")}</p>
            </div>
            {runsLoading ? <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.loading")}</span> : null}
          </div>
          <div className="space-y-3">
            {runs.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">{t("backtest.noSavedRuns")}</div>
            ) : runs.map((run) => (
              <article key={run.id} className={`rounded-[18px] border p-4 transition ${selectedRun?.id === run.id ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-slate-950/50 hover:bg-white/10"}`}>
                <div className="flex items-start justify-between gap-4">
                  <button type="button" onClick={() => onSelectRun?.(run.id)} className="flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{run.pair} - {run.timeframe}</p>
                      {run.mark?.is_favorite || run.mark?.isFavorite ? <StatusPill label={t("backtest.favorite")} tone="warning" /> : null}
                      {run.mark?.promoted_to_paper || run.mark?.promotedToPaper ? <StatusPill label={t("backtest.paperPromoted")} tone="success" /> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{String(run.dateFrom).slice(0, 10)} to {String(run.dateTo).slice(0, 10)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{(run.config?.activeStrategies || []).join(", ") || t("backtest.defaultSet")}</p>
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">#{run.id}</span>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => onFavoriteRun?.(run.id, !(run.mark?.is_favorite || run.mark?.isFavorite), run.mark?.favorite_label || run.mark?.favoriteLabel || "")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/10">{run.mark?.is_favorite || run.mark?.isFavorite ? t("backtest.unfavorite") : t("backtest.markFavorite")}</button>
                      <button type="button" onClick={() => onPromoteRun?.(run.id, "champion")} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-300/15">{t("backtest.setChampion")}</button>
                      <button type="button" onClick={() => onPromoteRun?.(run.id, "challenger")} className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-[11px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-300/15">{t("backtest.setChallenger")}</button>
                      <button type="button" onClick={() => onPromoteRun?.(run.id, "champion", "trend")} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/15">{t("backtest.trendChampion")}</button>
                      <button type="button" onClick={() => onPromoteRun?.(run.id, "champion", "sideways")} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-300/15">{t("backtest.sidewaysChampion")}</button>
                      <button type="button" onClick={() => onPromoteRun?.(run.id, "champion", "volatile")} className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-300/15">{t("backtest.volatileChampion")}</button>
                      <button type="button" onClick={() => onApproveLive?.(run.id)} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/15">{t("backtest.approveLive")}</button>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => onSelectRun?.(run.id)} className="mt-3 block w-full text-left">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("backtest.return")}</p><p className="mt-1 text-sm font-semibold text-emerald-300">{formatNumber(run.summary?.totalReturnPercent)}%</p></div>
                    <div><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("stats.winRate")}</p><p className="mt-1 text-sm font-semibold text-sky-300">{formatNumber(run.summary?.winRate)}%</p></div>
                    <div><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("backtest.maxDrawdown")}</p><p className="mt-1 text-sm font-semibold text-rose-300">{formatNumber(run.summary?.maxDrawdown)}%</p></div>
                    <div><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("backtest.trades")}</p><p className="mt-1 text-sm font-semibold text-amber-300">{run.summary?.tradeCount || 0}</p></div>
                  </div>
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {displayResult ? (
            <>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{showingSavedRun ? t("backtest.selectedRun") : t("backtest.latestResult")}</h3>
                    <p className="mt-1 text-sm text-slate-300">{showingSavedRun ? t("backtest.savedRunCreated", { id: selectedRun.id, time: formatDateTime(selectedRun.createdAt) }) : t("backtest.freshResult")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {showingSavedRun ? <StatusPill label={t("backtest.savedRun")} tone="success" /> : null}
                    {selectedRun?.mark?.is_favorite || selectedRun?.mark?.isFavorite ? <StatusPill label={t("backtest.favorite")} tone="warning" /> : null}
                    {selectedRun?.mark?.promoted_to_paper || selectedRun?.mark?.promotedToPaper ? <StatusPill label={t("backtest.paperPromoted")} tone="success" /> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <PerformanceCard label={t("backtest.return")} value={`${formatNumber(displayResult.totalReturnPercent)}%`} color="text-emerald-300" />
                <PerformanceCard label={t("stats.winRate")} value={`${formatNumber(displayResult.winRate)}%`} color="text-sky-300" />
                <PerformanceCard label={t("backtest.maxDrawdown")} value={`${formatNumber(displayResult.maxDrawdown)}%`} color="text-rose-300" />
                <PerformanceCard label={t("backtest.trades")} value={displayResult.tradeCount || 0} color="text-amber-300" />
              </div>

              {displaySummary?.assumptions ? (
                <div className="grid gap-4 md:grid-cols-4">
                  <PerformanceCard label={t("backtest.sentiment")} value={displaySummary.assumptions.sentiment} color="text-white" />
                  <PerformanceCard label={t("backtest.orderBook")} value={displaySummary.assumptions.orderBook} color="text-white" />
                  <PerformanceCard label={t("backtest.execution")} value={displaySummary.assumptions.spotMode ? t("backtest.spotSimulation") : t("common.unknown")} color="text-white" />
                  <PerformanceCard label={t("backtest.strategies")} value={Array.isArray(displaySummary.assumptions.activeStrategies) && displaySummary.assumptions.activeStrategies.length > 0 ? displaySummary.assumptions.activeStrategies.join(", ") : Array.isArray(selectedRun?.config?.activeStrategies) && selectedRun.config.activeStrategies.length > 0 ? selectedRun.config.activeStrategies.join(", ") : t("backtest.defaultSet")} color="text-white" />
                </div>
              ) : null}

              {comparison ? (
                <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white">{t("backtest.comparisonLatest")}</h3>
                    <p className="mt-1 text-sm text-slate-300">{t("backtest.comparisonLatestHint")}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <PerformanceCard label={t("backtest.returnDelta")} value={formatDelta(comparison.returnDelta, "%")} color={comparison.returnDelta >= 0 ? "text-emerald-300" : "text-rose-300"} />
                    <PerformanceCard label={t("backtest.winRateDelta")} value={formatDelta(comparison.winRateDelta, "%")} color={comparison.winRateDelta >= 0 ? "text-emerald-300" : "text-rose-300"} />
                    <PerformanceCard label={t("backtest.drawdownDelta")} value={formatDelta(comparison.drawdownDelta, "%")} color={comparison.drawdownDelta <= 0 ? "text-emerald-300" : "text-rose-300"} />
                    <PerformanceCard label={t("backtest.tradeCountDelta")} value={formatDelta(comparison.tradeCountDelta)} color={comparison.tradeCountDelta >= 0 ? "text-sky-300" : "text-amber-300"} />
                  </div>
                </div>
              ) : null}

              {displayResult.walkForward?.windowCount ? (
                <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white">{t("backtest.walkForwardWindows")}</h3>
                    <p className="mt-1 text-sm text-slate-300">{t("backtest.walkForwardWindowsHint")}</p>
                  </div>
                  <div className="space-y-3">
                    {displayResult.walkForward.windows.map((window) => (
                      <article key={window.index} className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-4">
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.window")}</p><p className="mt-2 text-sm font-semibold text-white">#{window.index}</p><p className="mt-1 text-xs text-slate-400">Test {String(window.testPeriod.start).slice(0, 10)} to {String(window.testPeriod.end).slice(0, 10)}</p></div>
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.inSample")}</p><p className="mt-2 text-sm font-semibold text-sky-300">{formatNumber(window.inSample.totalReturnPercent)}% return</p><p className="mt-1 text-xs text-slate-400">{window.inSample.tradeCount} trades - {formatNumber(window.inSample.winRate)}% win</p></div>
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.outOfSample")}</p><p className="mt-2 text-sm font-semibold text-emerald-300">{formatNumber(window.outOfSample.totalReturnPercent)}% return</p><p className="mt-1 text-xs text-slate-400">{window.outOfSample.tradeCount} trades - {formatNumber(window.outOfSample.winRate)}% win</p></div>
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("backtest.capital")}</p><p className="mt-2 text-sm font-semibold text-white">{formatNumber(window.outOfSample.startingCapital)} to {formatNumber(window.outOfSample.endingCapital)}</p><p className="mt-1 text-xs text-slate-400">DD {formatNumber(window.outOfSample.maxDrawdown)}%</p></div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="h-72 rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayResult.capitalCurve || []}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="timestamp" tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={(value) => new Date(value).toLocaleDateString(locale)} />
                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px" }} labelFormatter={(value) => new Date(value).toLocaleString(locale)} />
                    <Line dataKey="capital" stroke="#22d3ee" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white">{t("backtest.tradeLogPreview")}</h3>
                  <p className="mt-1 text-sm text-slate-300">{t("backtest.tradeLogPreviewHint", { count: tradeLogPreview.length })}</p>
                </div>
                {tradeLogPreview.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">{t("backtest.noTradesForRun")}</div>
                ) : (
                  <div className="space-y-3">
                    {tradeLogPreview.map((trade, index) => (
                      <article key={`${trade.id || trade.openedAt || trade.entryTime || index}`} className="grid gap-3 rounded-[18px] border border-white/10 bg-slate-950/60 p-4 md:grid-cols-[1fr_0.7fr_0.8fr_0.8fr_0.8fr]">
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("backtest.trade")}</p><p className="mt-2 text-sm font-semibold text-white">{trade.pair || displayResult.pair || form.pair} - {trade.side || "BUY"}</p><p className="mt-1 text-xs text-slate-400">{trade.strategyId || trade.strategy || trade.status || "simulated"}</p></div>
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("active.entry")}</p><p className="mt-2 text-sm font-semibold text-white">{formatNumber(trade.entryPrice || trade.entry_price)}</p></div>
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("timeline.exit")}</p><p className="mt-2 text-sm font-semibold text-white">{formatNumber(trade.exitPrice || trade.exit_price)}</p></div>
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("dashboard.field.pnl")}</p><p className={`mt-2 text-sm font-semibold ${toneClass(trade.resultPnl || trade.result_pnl)}`}>{formatNumber(trade.resultPnl || trade.result_pnl)}</p></div>
                        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("backtest.status")}</p><p className="mt-2 text-sm font-semibold text-white">{trade.status || "closed"}</p></div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-8 text-sm text-slate-400">{t("backtest.noRunSelected")}</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Backtest;
