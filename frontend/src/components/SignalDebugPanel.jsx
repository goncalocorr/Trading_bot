import { useI18n } from "../i18n/I18nProvider";

function formatNumber(value, digits = 2, t) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return t("common.notAvailable");
  }
  return Number(value).toFixed(digits);
}

function ToneBadge({ tone = "neutral", children }) {
  const styles =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warning"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
        : "border-sky-400/30 bg-sky-500/10 text-sky-200";

  return (
    <span className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${styles}`}>
      {children}
    </span>
  );
}

/* ── Score gauge (SVG ring) ── */
function ScoreGauge({ score, maxScore }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const pct = maxScore > 0 ? (score / maxScore) : 0;
  const offset = circumference * (1 - pct);

  const color = pct >= 0.7 ? "#34d399" : pct >= 0.4 ? "#fbbf24" : "#fb7185";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          className="score-ring"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="44" textAnchor="middle" fill="white" fontSize="20" fontWeight="700">
          {score}
        </text>
        <text x="48" y="60" textAnchor="middle" fill="#64748b" fontSize="10">
          / {maxScore}
        </text>
      </svg>
    </div>
  );
}

function getTimeframeTone(bias, isSignalTimeframe = false, isSideways = false) {
  if (isSignalTimeframe && isSideways) return "warning";
  if (bias === "bullish") return "success";
  if (bias === "bearish") return "info";
  return "warning";
}

function TimeframeCard({ label, snapshot, signalTimeframe = false }) {
  const { t } = useI18n();
  const bias = snapshot?.trend?.bias || "neutral";
  const tone = getTimeframeTone(bias, signalTimeframe, snapshot?.marketState?.isSideways);

  const borderColor =
    tone === "success" ? "border-emerald-400/20" :
    tone === "warning" ? "border-amber-400/20" : "border-sky-400/20";

  let summary = t("signal.mixedTrend");
  if (signalTimeframe) {
    summary = snapshot?.marketState?.isSideways ? t("signal.sidewaysRegime") : t("signal.tradeableRegime");
  } else if (snapshot?.trend?.goldenCross) {
    summary = t("signal.goldenCross");
  } else if (snapshot?.trend?.deathCross) {
    summary = t("signal.deathCross");
  }

  return (
    <div className={`rounded-xl border ${borderColor} bg-white/[0.02] p-3`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{label}</span>
        <ToneBadge tone={tone}>{bias}</ToneBadge>
      </div>
      <div className="space-y-1 text-[11px] text-slate-400">
        <p>RSI: <span className="text-slate-200">{formatNumber(snapshot?.rsi14, 1, t)}</span></p>
        <p>ATR: <span className="text-slate-200">{formatNumber(snapshot?.atr14, 2, t)}</span></p>
        <p>EMA200: <span className="text-slate-200">{snapshot?.trend?.priceAboveEma200 ? t("signal.above") : t("signal.below")}</span></p>
        <p className="text-[10px] text-slate-500">{summary}</p>
      </div>
    </div>
  );
}

function SignalDebugPanel({ debug, loading = false }) {
  const { t } = useI18n();
  const blockers = debug?.blockers || [];
  const marketState = debug?.diagnostics?.marketState;
  const multiTimeframe = debug?.diagnostics?.multiTimeframe;
  const timeframes = debug?.diagnostics?.timeframes || {};
  const fearGreed = debug?.diagnostics?.fearGreed;
  const orderBook = debug?.diagnostics?.orderBook;
  const tone = debug?.canExecute ? "success" : blockers.length > 0 ? "warning" : "info";
  const readiness = debug?.readiness || {
    state: "BLOCKED", tone: "warning",
    label: t("common.blocked"),
    reason: "Signal is blocked by the current strategy conditions."
  };

  return (
    <section className="glass-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{t("signal.title")}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{t("signal.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToneBadge tone={readiness.tone}>{readiness.state}</ToneBadge>
          <ToneBadge tone={tone}>{debug?.decision || t("common.loading")}</ToneBadge>
          <ToneBadge tone="info">{debug?.tradingMode || t("common.loading")}</ToneBadge>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-sm text-slate-500 animate-pulse-soft">
          {t("signal.loading")}
        </div>
      ) : !debug ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-sm text-slate-500">
          {t("signal.empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top row: readiness + score + key metrics */}
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
            {/* Readiness card */}
            <div className={`rounded-xl border p-4 text-sm ${
              readiness.tone === "success"
                ? "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100"
                : readiness.tone === "warning"
                  ? "border-amber-400/20 bg-amber-500/[0.06] text-amber-100"
                  : "border-sky-400/20 bg-sky-500/[0.06] text-sky-100"
            }`}>
              <p className="metric-label">{t("signal.readiness")}</p>
              <p className="mt-2 text-lg font-bold">{readiness.label}</p>
              <p className="mt-1.5 text-xs opacity-80">{readiness.reason}</p>
            </div>

            {/* Score gauge */}
            <div className="flex items-center justify-center">
              <ScoreGauge
                score={debug.score?.totalScore || 0}
                maxScore={debug.score?.maxScore || 12}
              />
            </div>

            {/* Primary reason */}
            <div className={`rounded-xl border p-4 text-sm ${
              tone === "success"
                ? "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100"
                : tone === "warning"
                  ? "border-amber-400/20 bg-amber-500/[0.06] text-amber-100"
                  : "border-sky-400/20 bg-sky-500/[0.06] text-sky-100"
            }`}>
              <p className="metric-label">{t("signal.primaryReason")}</p>
              <p className="mt-2 text-sm">{debug.primaryReason}</p>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <p className="metric-label">{t("signal.multiTf")}</p>
              <p className="mt-1 text-sm font-bold text-white">{multiTimeframe?.direction || "neutral"}</p>
              <p className="text-[10px] text-slate-500">{multiTimeframe?.aligned ? t("common.aligned") : t("common.notAligned")}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">{t("signal.marketRegime")}</p>
              <p className="mt-1 text-sm font-bold text-white">{marketState?.isSideways ? t("signal.sideways") : t("signal.tradeable")}</p>
              <p className="text-[10px] text-slate-500">
                ATR: {formatNumber(marketState?.atrPercent, 2, t)}% | Comp: {formatNumber(marketState?.emaCompressionPercent, 2, t)}%
              </p>
            </div>
            <div className="metric-card">
              <p className="metric-label">{t("signal.fearGreed")}</p>
              <p className="mt-1 text-sm font-bold text-white">{fearGreed?.classification || t("common.notAvailable")}</p>
              <p className="text-[10px] text-slate-500">
                {t("signal.valueRsi", { value: formatNumber(fearGreed?.value, 0, t), rsi: formatNumber(debug.diagnostics?.rsi15m, 1, t) })}
              </p>
            </div>
            <div className="metric-card">
              <p className="metric-label">{t("signal.spread")}</p>
              <p className="mt-1 text-sm font-bold text-white">{formatNumber(orderBook?.spreadPercent, 3, t)}%</p>
              <p className="text-[10px] text-slate-500">{t("signal.expectedMode")}: {debug.score?.executionMode || "SKIP"}</p>
            </div>
          </div>

          {/* Timeframe alignment */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{t("signal.timeframeAlignment")}</p>
              <ToneBadge tone={multiTimeframe?.aligned ? "success" : "warning"}>
                {multiTimeframe?.aligned ? t("common.aligned") : t("common.blocked")}
              </ToneBadge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TimeframeCard label="5m" snapshot={timeframes["5m"]} />
              <TimeframeCard label="15m" snapshot={timeframes["15m"]} signalTimeframe />
              <TimeframeCard label="1h" snapshot={timeframes["1h"]} />
              <TimeframeCard label="4h" snapshot={timeframes["4h"]} />
            </div>
          </div>

          {/* Blockers + context */}
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-sm font-semibold text-white mb-3">{t("signal.blockers")}</p>
              {blockers.length === 0 ? (
                <p className="text-xs text-emerald-300/70">{t("signal.noBlockers")}</p>
              ) : (
                <div className="space-y-1.5">
                  {blockers.map((blocker) => (
                    <div key={blocker} className="rounded-lg border border-amber-400/15 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">
                      {blocker}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-sm font-semibold text-white mb-3">{t("signal.executionContext")}</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">{t("dashboard.field.pair")}</span><span className="text-white">{debug.pair}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t("dashboard.field.side")}</span><span className="text-white">{debug.side}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t("signal.botStatus")}</span><span className="text-white">{debug.botStatus}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t("signal.runtimeThreshold")}</span><span className="text-white">{debug.runtimeThreshold}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default SignalDebugPanel;
