function SettingsPanel({ settings, form, onChange, onSave, saving = false }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">Settings</h2>
        <p className="mt-1 text-sm text-slate-300">
          Runtime controls for bot state, score threshold, risk and tracked pairs.
        </p>
      </div>

      <form
        className="grid gap-4 rounded-[22px] border border-white/10 bg-slate-950/45 p-5 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Bot enabled
          <select
            value={String(form.botEnabled)}
            onChange={(event) => onChange("botEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="true">Enabled</option>
            <option value="false">Paused</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Trading mode
          <select
            value={form.tradingMode}
            onChange={(event) => onChange("tradingMode", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="paper">Paper</option>
            <option value="live">Live</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Score threshold
          <input
            type="number"
            min="1"
            max="12"
            value={form.scoreThreshold}
            onChange={(event) => onChange("scoreThreshold", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Risk per trade
          <input
            type="number"
            step="0.001"
            value={form.riskPerTrade}
            onChange={(event) => onChange("riskPerTrade", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Compound ratio
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={form.compoundRatio}
            onChange={(event) => onChange("compoundRatio", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-200">
          Trading pairs
          <input
            value={form.tradingPairs}
            onChange={(event) => onChange("tradingPairs", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
            placeholder="BTCUSDT,ETHUSDT"
          />
        </label>

        <button
          type="submit"
          className="md:col-span-2 rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-200"
        >
          {saving ? "Saving settings..." : "Save settings"}
        </button>
      </form>

      {settings ? (
        <pre className="mt-5 overflow-x-auto rounded-[22px] border border-white/10 bg-slate-950/45 p-4 text-xs text-slate-300">
          {JSON.stringify(settings, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

export default SettingsPanel;
