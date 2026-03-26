import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function Backtest({ form, onChange, onRun, loading = false, result }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">Backtesting</h2>
        <p className="mt-1 text-sm text-slate-300">
          Replay historical Binance candles with the same core risk and score logic.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-[22px] border border-white/10 bg-slate-950/40 p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          onRun();
        }}
      >
        <input
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          placeholder="BTCUSDT"
          value={form.pair}
          onChange={(event) => onChange("pair", event.target.value)}
        />
        <input
          type="date"
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={form.dateFrom}
          onChange={(event) => onChange("dateFrom", event.target.value)}
        />
        <input
          type="date"
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={form.dateTo}
          onChange={(event) => onChange("dateTo", event.target.value)}
        />
        <select
          className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          value={form.timeframe}
          onChange={(event) => onChange("timeframe", event.target.value)}
        >
          <option value="15m">15m</option>
          <option value="1h">1h</option>
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200 md:col-span-4"
        >
          {loading ? "Running backtest..." : "Run backtest"}
        </button>
      </form>

      {result ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Return</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">
                {Number(result.totalReturnPercent || 0).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Win Rate</p>
              <p className="mt-2 text-2xl font-semibold text-sky-300">
                {Number(result.winRate || 0).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Max Drawdown</p>
              <p className="mt-2 text-2xl font-semibold text-rose-300">
                {Number(result.maxDrawdown || 0).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trades</p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">{result.tradeCount || 0}</p>
            </div>
          </div>

          <div className="h-72 rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.capitalCurve || []}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fill: "#cbd5e1", fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px"
                  }}
                />
                <Line dataKey="capital" stroke="#22d3ee" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
            <h3 className="text-lg font-semibold text-white">Trade Log</h3>
            <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-300">
              {JSON.stringify(result.trades, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Backtest;
