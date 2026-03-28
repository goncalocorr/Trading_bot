import { useI18n } from "../i18n/I18nProvider";

function InfoCard({ label, value, detail = null, accent = "text-white" }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className={`text-sm font-bold mt-1 ${accent}`}>{value}</p>
      {detail && <p className="text-[10px] text-slate-500 mt-0.5">{detail}</p>}
    </div>
  );
}

function SettingsPanel({ settings, form, onChange, onSave, saving = false, strategies = [] }) {
  const { t, formatDateTime } = useI18n();
  const regimeChampionDetail = [
    settings?.regimeChampionTrendRunId ? `trend #${settings.regimeChampionTrendRunId}` : null,
    settings?.regimeChampionSidewaysRunId ? `sideways #${settings.regimeChampionSidewaysRunId}` : null,
    settings?.regimeChampionVolatileRunId ? `volatile #${settings.regimeChampionVolatileRunId}` : null
  ].filter(Boolean).join(" | ");

  const selectClass = "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/40 transition";
  const inputClass = selectClass;

  return (
    <section className="space-y-5 animate-fade-in">
      <div>
        <h3 className="text-base font-semibold text-white">{t("settings.title")}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{t("settings.subtitle")}</p>
      </div>

      {/* Settings form */}
      <form
        className="glass-card p-5 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => { e.preventDefault(); onSave(); }}
      >
        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.botEnabled")}
          <select value={String(form.botEnabled)} onChange={(e) => onChange("botEnabled", e.target.value === "true")} className={selectClass}>
            <option value="true">{t("common.enabled")}</option>
            <option value="false">{t("settings.paused")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.tradingMode")}
          <select value={form.tradingMode} onChange={(e) => onChange("tradingMode", e.target.value)} className={selectClass}>
            <option value="paper">{t("settings.paper")}</option>
            <option value="live">{t("settings.live")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.autonomyMode")}
          <select value={form.autonomyMode} onChange={(e) => onChange("autonomyMode", e.target.value)} className={selectClass}>
            <option value="manual">{t("settings.manual")}</option>
            <option value="supervised_auto">{t("settings.supervisedAuto")}</option>
            <option value="full_auto">{t("settings.fullAuto")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.shadowMode")}
          <select value={String(form.shadowModeEnabled)} onChange={(e) => onChange("shadowModeEnabled", e.target.value === "true")} className={selectClass}>
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.heartbeatAlerts")}
          <select value={String(form.autonomyHeartbeatEnabled)} onChange={(e) => onChange("autonomyHeartbeatEnabled", e.target.value === "true")} className={selectClass}>
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.telegramLanguage")}
          <select value={form.notificationLocale} onChange={(e) => onChange("notificationLocale", e.target.value)} className={selectClass}>
            <option value="en">{t("language.english")}</option>
            <option value="pt-PT">{t("language.portuguese")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.autoSwap")}
          <select value={String(form.autoSwapEnabled)} onChange={(e) => onChange("autoSwapEnabled", e.target.value === "true")} className={selectClass}>
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.autoApprove")}
          <select value={String(form.autoApproveLiveEnabled)} onChange={(e) => onChange("autoApproveLiveEnabled", e.target.value === "true")} className={selectClass}>
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.autoLiveDeploy")}
          <select value={String(form.autoLiveDeployEnabled)} onChange={(e) => onChange("autoLiveDeployEnabled", e.target.value === "true")} className={selectClass}>
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.scoreThreshold")}
          <input type="number" min="1" max="12" value={form.scoreThreshold} onChange={(e) => onChange("scoreThreshold", e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.riskPerTrade")}
          <input type="number" step="0.001" value={form.riskPerTrade} onChange={(e) => onChange("riskPerTrade", e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.compoundRatio")}
          <input type="number" step="0.01" min="0" max="1" value={form.compoundRatio} onChange={(e) => onChange("compoundRatio", e.target.value)} className={inputClass} />
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1.5 text-xs text-slate-300">
          {t("settings.tradingPairs")}
          <input value={form.tradingPairs} onChange={(e) => onChange("tradingPairs", e.target.value)} className={inputClass} placeholder="BTCUSDT,ETHUSDT" />
        </label>

        {/* Strategy selector */}
        <div className="sm:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-300 mb-2">{t("settings.activeStrategies")}</p>
          <div className="flex flex-wrap gap-2">
            {strategies.map((strategy) => {
              const selected = Array.isArray(form.activeStrategies) && form.activeStrategies.includes(strategy.id);
              return (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => onChange("activeStrategies", selected ? (form.activeStrategies || []).filter((id) => id !== strategy.id) : [...(form.activeStrategies || []), strategy.id])}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                    selected
                      ? "border border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                      : "border border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
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
          disabled={saving}
          className="sm:col-span-2 rounded-xl bg-emerald-400/90 px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-emerald-300 disabled:opacity-50"
        >
          {saving ? t("common.savingSettings") : t("common.saveSettings")}
        </button>
      </form>

      {/* Operational snapshot */}
      {settings && (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h4 className="text-sm font-semibold text-white mb-3">{t("settings.operationalSnapshot")}</h4>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard
                label={t("settings.bot")}
                value={settings.botEnabled ? t("common.enabled") : t("settings.paused")}
                detail={settings.autoPauseReason ? t("settings.autoPause", { reason: settings.autoPauseReason }) : t("settings.noActivePauseReason")}
                accent={settings.botEnabled ? "text-emerald-300" : "text-amber-300"}
              />
              <InfoCard
                label={t("settings.trading")}
                value={(settings.tradingMode || "paper").toUpperCase()}
                detail={`${t("settings.autonomyLabel")}: ${settings.autonomyMode || "manual"}`}
                accent={settings.tradingMode === "live" ? "text-rose-300" : "text-sky-300"}
              />
              <InfoCard
                label={t("settings.champion")}
                value={settings.championRunId ? `Run #${settings.championRunId}` : t("common.none")}
                detail={settings.challengerRunId ? `Challenger: #${settings.challengerRunId}` : t("settings.noChallengerAssigned")}
                accent="text-cyan-200"
              />
              <InfoCard
                label={t("settings.liveApproval")}
                value={settings.approvedLiveRunId ? `Run #${settings.approvedLiveRunId}` : t("settings.notApproved")}
                detail={settings.autoLiveDeployEnabled ? t("settings.autoLiveEnabled") : t("settings.manualLiveOnly")}
                accent={settings.approvedLiveRunId ? "text-emerald-300" : "text-slate-200"}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <InfoCard label={t("settings.regimeChampions")} value={regimeChampionDetail || t("settings.notAssigned")} accent="text-white" />
              <InfoCard
                label={t("settings.activeStrategiesCard")}
                value={Array.isArray(settings.activeStrategies) && settings.activeStrategies.length > 0 ? settings.activeStrategies.join(", ") : t("common.none")}
                detail={t("settings.pairsDetail", { pairs: (settings.tradingPairs || []).join(", ") || t("common.notAvailable") })}
              />
              <InfoCard
                label={t("settings.autonomyFlags")}
                value={[settings.shadowModeEnabled ? "shadow" : null, settings.autoSwapEnabled ? "auto-swap" : null, settings.autoApproveLiveEnabled ? "auto-approve" : null, settings.autonomyHeartbeatEnabled ? "heartbeat" : null].filter(Boolean).join(" | ") || t("settings.allDisabled")}
              />
            </div>
          </div>

          {/* Recovery health */}
          <div className="glass-card p-5">
            <h4 className="text-sm font-semibold text-white mb-3">{t("settings.recoveryHealth")}</h4>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard label={t("settings.executionFailures")} value={String(settings.circuitBreakers?.executionFailures || 0)} accent="text-amber-300"
                detail={settings.circuitBreakers?.lastReason ? `Last: ${settings.circuitBreakers.lastReason}` : t("settings.noBreakerReason")} />
              <InfoCard label={t("settings.exchangeFailures")} value={String(settings.circuitBreakers?.exchangeFailures || 0)} accent="text-rose-300"
                detail={settings.circuitBreakers?.lastTriggeredAt ? formatDateTime(settings.circuitBreakers.lastTriggeredAt) : t("settings.neverTriggered")} />
              <InfoCard label={t("settings.lastAutonomySnapshot")} value={settings.lastAutonomySnapshot?.currentRegimeId || t("common.notAvailable")} accent="text-sky-300"
                detail={settings.lastAutonomySnapshot?.updatedAt ? formatDateTime(settings.lastAutonomySnapshot.updatedAt) : t("settings.noAutonomySnapshot")} />
              <InfoCard label={t("settings.shadowSummary")} value={settings.shadowLastSummary?.strategySelection?.source || t("common.notAvailable")} accent="text-fuchsia-300"
                detail={settings.shadowLastSummary?.ranAt ? formatDateTime(settings.shadowLastSummary.ranAt) : t("settings.shadowNotRun")} />
            </div>

            <div className="mt-3 metric-card">
              <p className="metric-label">{t("settings.startupStatus")}</p>
              <p className="text-sm font-bold text-white mt-1">
                {settings.startupStatus?.overallOk ? t("settings.startupPassed") : t("settings.startupPending")}
              </p>
              <p className="text-[10px] text-slate-500">
                {t("settings.strictMode", { mode: settings.startupStatus?.strictMode ? t("settings.modeEnabled") : t("settings.modeDisabled"), time: formatDateTime(settings.startupStatus?.ranAt) })}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default SettingsPanel;
