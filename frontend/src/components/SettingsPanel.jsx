import { useI18n } from "../i18n/I18nProvider";

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
  const { t, formatDateTime } = useI18n();
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
        <h2 className="text-xl font-semibold text-white">{t("settings.title")}</h2>
        <p className="mt-1 text-sm text-slate-300">{t("settings.subtitle")}</p>
      </div>

      <form
        className="grid gap-4 rounded-[22px] border border-white/10 bg-slate-950/45 p-5 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.botEnabled")}
          <select
            value={String(form.botEnabled)}
            onChange={(event) => onChange("botEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="true">{t("common.enabled")}</option>
            <option value="false">{t("settings.paused")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.tradingMode")}
          <select
            value={form.tradingMode}
            onChange={(event) => onChange("tradingMode", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="paper">{t("settings.paper")}</option>
            <option value="live">{t("settings.live")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.autonomyMode")}
          <select
            value={form.autonomyMode}
            onChange={(event) => onChange("autonomyMode", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="manual">{t("settings.manual")}</option>
            <option value="supervised_auto">{t("settings.supervisedAuto")}</option>
            <option value="full_auto">{t("settings.fullAuto")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.shadowMode")}
          <select
            value={String(form.shadowModeEnabled)}
            onChange={(event) => onChange("shadowModeEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.heartbeatAlerts")}
          <select
            value={String(form.autonomyHeartbeatEnabled)}
            onChange={(event) => onChange("autonomyHeartbeatEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.telegramLanguage")}
          <select
            value={form.notificationLocale}
            onChange={(event) => onChange("notificationLocale", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="en">{t("language.english")}</option>
            <option value="pt-PT">{t("language.portuguese")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.autoSwap")}
          <select
            value={String(form.autoSwapEnabled)}
            onChange={(event) => onChange("autoSwapEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.autoApprove")}
          <select
            value={String(form.autoApproveLiveEnabled)}
            onChange={(event) => onChange("autoApproveLiveEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.autoLiveDeploy")}
          <select
            value={String(form.autoLiveDeployEnabled)}
            onChange={(event) => onChange("autoLiveDeployEnabled", event.target.value === "true")}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="false">{t("common.disabled")}</option>
            <option value="true">{t("common.enabled")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.scoreThreshold")}
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
          {t("settings.riskPerTrade")}
          <input
            type="number"
            step="0.001"
            value={form.riskPerTrade}
            onChange={(event) => onChange("riskPerTrade", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-200">
          {t("settings.compoundRatio")}
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
          {t("settings.tradingPairs")}
          <input
            value={form.tradingPairs}
            onChange={(event) => onChange("tradingPairs", event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
            placeholder="BTCUSDT,ETHUSDT"
          />
        </label>

        <div className="md:col-span-2 rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
          <p className="text-sm text-slate-200">{t("settings.activeStrategies")}</p>
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
          {saving ? t("common.savingSettings") : t("common.saveSettings")}
        </button>
      </form>

      {settings ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">{t("settings.operationalSnapshot")}</h3>
              <p className="mt-1 text-sm text-slate-300">{t("settings.operationalSnapshotHint")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard
                label={t("settings.bot")}
                value={settings.botEnabled ? t("common.enabled") : t("settings.paused")}
                detail={settings.autoPauseReason ? t("settings.autoPause", { reason: settings.autoPauseReason }) : t("settings.noActivePauseReason")}
                accent={settings.botEnabled ? "text-emerald-300" : "text-amber-300"}
              />
              <InfoCard
                label={t("settings.trading")}
                value={(settings.tradingMode || "paper").toUpperCase()}
                detail={`${t("settings.autonomyLabel")}: ${settings.autonomyMode || "manual"} | ${t("settings.telegramLanguage")}: ${
                  settings.notificationLocale === "pt-PT" ? t("language.portuguese") : t("language.english")
                }`}
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

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                label={t("settings.regimeChampions")}
                value={regimeChampionDetail || t("settings.notAssigned")}
                detail={t("settings.regimeChampionsHint")}
                accent="text-white"
              />
              <InfoCard
                label={t("settings.activeStrategiesCard")}
                value={Array.isArray(settings.activeStrategies) && settings.activeStrategies.length > 0 ? settings.activeStrategies.join(", ") : t("common.none")}
                detail={t("settings.pairsDetail", { pairs: (settings.tradingPairs || []).join(", ") || t("common.notAvailable") })}
                accent="text-white"
              />
              <InfoCard
                label={t("settings.autonomyFlags")}
                value={[
                  settings.shadowModeEnabled ? "shadow" : null,
                  settings.autoSwapEnabled ? "auto-swap" : null,
                  settings.autoApproveLiveEnabled ? "auto-approve" : null,
                  settings.autonomyHeartbeatEnabled ? "heartbeat" : null
                ].filter(Boolean).join(" | ") || t("settings.allDisabled")}
                detail={t("settings.autonomyFlagsHint")}
                accent="text-white"
              />
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">{t("settings.recoveryHealth")}</h3>
              <p className="mt-1 text-sm text-slate-300">{t("settings.recoveryHealthHint")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard
                label={t("settings.executionFailures")}
                value={String(settings.circuitBreakers?.executionFailures || 0)}
                detail={settings.circuitBreakers?.lastReason ? `Last reason: ${settings.circuitBreakers.lastReason}` : t("settings.noBreakerReason")}
                accent="text-amber-300"
              />
              <InfoCard
                label={t("settings.exchangeFailures")}
                value={String(settings.circuitBreakers?.exchangeFailures || 0)}
                detail={settings.circuitBreakers?.lastTriggeredAt ? `Triggered: ${formatDateTime(settings.circuitBreakers.lastTriggeredAt)}` : t("settings.neverTriggered")}
                accent="text-rose-300"
              />
              <InfoCard
                label={t("settings.lastAutonomySnapshot")}
                value={settings.lastAutonomySnapshot?.currentRegimeId || t("common.notAvailable")}
                detail={settings.lastAutonomySnapshot?.updatedAt ? formatDateTime(settings.lastAutonomySnapshot.updatedAt) : t("settings.noAutonomySnapshot")}
                accent="text-sky-300"
              />
              <InfoCard
                label={t("settings.shadowSummary")}
                value={settings.shadowLastSummary?.strategySelection?.source || t("common.notAvailable")}
                detail={settings.shadowLastSummary?.ranAt ? formatDateTime(settings.shadowLastSummary.ranAt) : t("settings.shadowNotRun")}
                accent="text-fuchsia-300"
              />
            </div>

            <div className="mt-4 rounded-[20px] border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("settings.startupStatus")}</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {settings.startupStatus?.overallOk ? t("settings.startupPassed") : t("settings.startupPending")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t("settings.strictMode", {
                  mode: settings.startupStatus?.strictMode ? t("settings.modeEnabled") : t("settings.modeDisabled"),
                  time: formatDateTime(settings.startupStatus?.ranAt)
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default SettingsPanel;
