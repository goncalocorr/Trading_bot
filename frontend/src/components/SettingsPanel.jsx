function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function InfoCard({ label, value, detail = null, accent = "text-white" }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-slate-950/50 p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${accent}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

function SettingsPanel({ settings, form, onChange, onSave, saving = false, strategies = [] }) {
  const regimeChampionDetail = [
    settings?.regimeChampionTrendRunId ? `trend #${settings.regimeChampionTrendRunId}` : null,
    settings?.regimeChampionSidewaysRunId ? `sideways #${settings.regimeChampionSidewaysRunId}` : null,
    settings?.regimeChampionVolatileRunId ? `volatile #${settings.regimeChampionVolatileRunId}` : null
  ]
    .filter(Boolean)
    .join(" | ");

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
          Autonomy mode
          <select
            value={form.autonomyMode}
            onChange={(event) => onChange("autonomyMode", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="manual">Manual</option>
            <option value="supervised_auto">Supervised auto</option>
            <option value="full_auto">Full auto</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Shadow mode
          <select
            value={String(form.shadowModeEnabled)}
            onChange={(event) => onChange("shadowModeEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Heartbeat alerts
          <select
            value={String(form.autonomyHeartbeatEnabled)}
            onChange={(event) => onChange("autonomyHeartbeatEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Auto-swap champion
          <select
            value={String(form.autoSwapEnabled)}
            onChange={(event) => onChange("autoSwapEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Auto-approve live
          <select
            value={String(form.autoApproveLiveEnabled)}
            onChange={(event) => onChange("autoApproveLiveEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Auto-live deploy
          <select
            value={String(form.autoLiveDeployEnabled)}
            onChange={(event) => onChange("autoLiveDeployEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
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

        <div className="md:col-span-2 rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
          <p className="text-sm text-slate-200">Active strategies</p>
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
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    selected
                      ? "border border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
                      : "border border-white/10 bg-slate-950 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {strategy.id}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="md:col-span-2 rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-200"
        >
          {saving ? "Saving settings..." : "Save settings"}
        </button>
      </form>

      {settings ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Operational Snapshot</h3>
              <p className="mt-1 text-sm text-slate-300">
                Clean runtime view of autonomy, governance and recovery state.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard
                label="Bot"
                value={settings.botEnabled ? "Enabled" : "Paused"}
                detail={settings.autoPauseReason ? `Auto pause: ${settings.autoPauseReason}` : "No active pause reason."}
                accent={settings.botEnabled ? "text-emerald-300" : "text-amber-300"}
              />
              <InfoCard
                label="Trading"
                value={(settings.tradingMode || "paper").toUpperCase()}
                detail={`Autonomy: ${settings.autonomyMode || "manual"}`}
                accent={settings.tradingMode === "live" ? "text-rose-300" : "text-sky-300"}
              />
              <InfoCard
                label="Champion"
                value={settings.championRunId ? `Run #${settings.championRunId}` : "None"}
                detail={settings.challengerRunId ? `Challenger: #${settings.challengerRunId}` : "No challenger assigned."}
                accent="text-cyan-200"
              />
              <InfoCard
                label="Live Approval"
                value={settings.approvedLiveRunId ? `Run #${settings.approvedLiveRunId}` : "Not approved"}
                detail={settings.autoLiveDeployEnabled ? "Auto-live deploy enabled." : "Manual live deployment only."}
                accent={settings.approvedLiveRunId ? "text-emerald-300" : "text-slate-200"}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                label="Regime Champions"
                value={regimeChampionDetail || "Not assigned"}
                detail="Per-regime champion slots used by adaptive governance."
                accent="text-white"
              />
              <InfoCard
                label="Active Strategies"
                value={Array.isArray(settings.activeStrategies) && settings.activeStrategies.length > 0 ? settings.activeStrategies.join(", ") : "None"}
                detail={`Pairs: ${(settings.tradingPairs || []).join(", ") || "n/a"}`}
                accent="text-white"
              />
              <InfoCard
                label="Autonomy Flags"
                value={[
                  settings.shadowModeEnabled ? "shadow" : null,
                  settings.autoSwapEnabled ? "auto-swap" : null,
                  settings.autoApproveLiveEnabled ? "auto-approve" : null,
                  settings.autonomyHeartbeatEnabled ? "heartbeat" : null
                ].filter(Boolean).join(" | ") || "All disabled"}
                detail="Feature flags for supervised and full-auto behaviour."
                accent="text-white"
              />
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Recovery And Health</h3>
              <p className="mt-1 text-sm text-slate-300">
                Quick visibility into circuit breakers, last autonomy snapshot and startup recovery.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard
                label="Execution Failures"
                value={String(settings.circuitBreakers?.executionFailures || 0)}
                detail={settings.circuitBreakers?.lastReason ? `Last reason: ${settings.circuitBreakers.lastReason}` : "No breaker reason recorded."}
                accent="text-amber-300"
              />
              <InfoCard
                label="Exchange Failures"
                value={String(settings.circuitBreakers?.exchangeFailures || 0)}
                detail={settings.circuitBreakers?.lastTriggeredAt ? `Triggered: ${formatTimestamp(settings.circuitBreakers.lastTriggeredAt)}` : "Never triggered."}
                accent="text-rose-300"
              />
              <InfoCard
                label="Last Autonomy Snapshot"
                value={settings.lastAutonomySnapshot?.currentRegimeId || "n/a"}
                detail={settings.lastAutonomySnapshot?.updatedAt ? formatTimestamp(settings.lastAutonomySnapshot.updatedAt) : "No autonomy snapshot yet."}
                accent="text-sky-300"
              />
              <InfoCard
                label="Shadow Summary"
                value={settings.shadowLastSummary?.strategySelection?.source || "n/a"}
                detail={settings.shadowLastSummary?.ranAt ? formatTimestamp(settings.shadowLastSummary.ranAt) : "Shadow scan has not run yet."}
                accent="text-fuchsia-300"
              />
            </div>

            <div className="mt-4 rounded-[20px] border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Startup Status</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {settings.startupStatus?.overallOk ? "Startup checks passed" : "Startup checks pending or degraded"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Strict mode: {settings.startupStatus?.strictMode ? "enabled" : "disabled"} | Last run: {formatTimestamp(settings.startupStatus?.ranAt)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default SettingsPanel;
