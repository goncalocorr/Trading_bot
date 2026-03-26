function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "n/a";
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
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${styles}`}>
      {children}
    </span>
  );
}

function getTimeframeTone(bias, isSignalTimeframe = false, isSideways = false) {
  if (isSignalTimeframe && isSideways) {
    return "warning";
  }

  if (bias === "bullish") {
    return "success";
  }

  if (bias === "bearish") {
    return "info";
  }

  return "warning";
}

function TimeframeCard({ label, snapshot, signalTimeframe = false }) {
  const bias = snapshot?.trend?.bias || "neutral";
  const tone = getTimeframeTone(bias, signalTimeframe, snapshot?.marketState?.isSideways);
  const cardStyles =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-500/10"
      : tone === "warning"
        ? "border-amber-400/20 bg-amber-500/10"
        : "border-sky-400/20 bg-sky-500/10";

  let summary = "Mixed trend";

  if (signalTimeframe) {
    summary = snapshot?.marketState?.isSideways ? "Sideways regime" : "Tradeable regime";
  } else if (snapshot?.trend?.goldenCross) {
    summary = "Golden cross";
  } else if (snapshot?.trend?.deathCross) {
    summary = "Death cross";
  }

  return (
    <div className={`rounded-[22px] border p-4 ${cardStyles}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-200">{label}</p>
        <ToneBadge tone={tone}>{bias}</ToneBadge>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-100">
        <p>RSI: {formatNumber(snapshot?.rsi14)}</p>
        <p>ATR: {formatNumber(snapshot?.atr14)}</p>
        <p>EMA200: {snapshot?.trend?.priceAboveEma200 ? "Above" : "Below"}</p>
        <p>{summary}</p>
      </div>
    </div>
  );
}

function SignalDebugPanel({ debug, loading = false }) {
  const blockers = debug?.blockers || [];
  const marketState = debug?.diagnostics?.marketState;
  const multiTimeframe = debug?.diagnostics?.multiTimeframe;
  const timeframes = debug?.diagnostics?.timeframes || {};
  const fearGreed = debug?.diagnostics?.fearGreed;
  const orderBook = debug?.diagnostics?.orderBook;
  const tone = debug?.canExecute ? "success" : blockers.length > 0 ? "warning" : "info";
  const readiness = debug?.readiness || {
    state: "BLOCKED",
    tone: "warning",
    label: "Blocked",
    reason: "Signal is blocked by the current strategy conditions."
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Signal Debug</h2>
          <p className="mt-1 text-sm text-slate-300">
            Live preview of alignment, score, blockers and market regime for the selected manual signal.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ToneBadge tone={readiness.tone}>{readiness.state}</ToneBadge>
          <ToneBadge tone={tone}>{debug?.decision || "Loading"}</ToneBadge>
          <ToneBadge tone="info">{debug?.tradingMode || "Mode"}</ToneBadge>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-8 text-sm text-slate-400">
          Refreshing signal diagnostics...
        </div>
      ) : !debug ? (
        <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-8 text-sm text-slate-400">
          No signal diagnostics available yet.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div
              className={`rounded-[22px] border px-5 py-4 text-sm ${
                readiness.tone === "success"
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                  : readiness.tone === "warning"
                    ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
                    : "border-sky-400/25 bg-sky-500/10 text-sky-100"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em]">Readiness</p>
              <p className="mt-2 text-xl font-semibold">{readiness.label}</p>
              <p className="mt-2">{readiness.reason}</p>
            </div>

            <div
              className={`rounded-[22px] border px-5 py-4 text-sm ${
                tone === "success"
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                  : tone === "warning"
                    ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
                    : "border-sky-400/25 bg-sky-500/10 text-sky-100"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em]">Primary reason</p>
              <p className="mt-2">{debug.primaryReason}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Score</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {debug.score?.totalScore}/{debug.score?.maxScore}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">1H + 4H</p>
              <p className="mt-2 text-lg font-semibold text-white">{multiTimeframe?.direction || "neutral"}</p>
              <p className="mt-1 text-xs text-slate-400">{multiTimeframe?.aligned ? "Aligned" : "Not aligned"}</p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Market Regime</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {marketState?.isSideways ? "Sideways" : "Tradeable"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                ATR {formatNumber(marketState?.atrPercent)}% • EMA compression {formatNumber(marketState?.emaCompressionPercent)}%
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fear & Greed</p>
              <p className="mt-2 text-lg font-semibold text-white">{fearGreed?.classification || "n/a"}</p>
              <p className="mt-1 text-xs text-slate-400">
                Value {formatNumber(fearGreed?.value, 0)} • RSI {formatNumber(debug.diagnostics?.rsi15m)}
              </p>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Timeframe Alignment</p>
              <ToneBadge tone={multiTimeframe?.aligned ? "success" : "warning"}>
                {multiTimeframe?.aligned ? "Aligned" : "Blocked"}
              </ToneBadge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TimeframeCard label="5m" snapshot={timeframes["5m"]} />
              <TimeframeCard label="15m" snapshot={timeframes["15m"]} signalTimeframe />
              <TimeframeCard label="1h" snapshot={timeframes["1h"]} />
              <TimeframeCard label="4h" snapshot={timeframes["4h"]} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-sm font-semibold text-white">Blockers</p>
              <div className="mt-3 space-y-2">
                {blockers.length === 0 ? (
                  <p className="text-sm text-emerald-200">No blockers detected for the current manual signal preview.</p>
                ) : (
                  blockers.map((blocker) => (
                    <div
                      key={blocker}
                      className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                    >
                      {blocker}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Execution context</p>
              <div className="mt-3 space-y-2">
                <p>Pair: <span className="text-white">{debug.pair}</span></p>
                <p>Side: <span className="text-white">{debug.side}</span></p>
                <p>Bot status: <span className="text-white">{debug.botStatus}</span></p>
                <p>Runtime threshold: <span className="text-white">{debug.runtimeThreshold}</span></p>
                <p>Expected mode: <span className="text-white">{debug.score?.executionMode || "SKIP"}</span></p>
                <p>Spread: <span className="text-white">{formatNumber(orderBook?.spreadPercent)}%</span></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default SignalDebugPanel;
