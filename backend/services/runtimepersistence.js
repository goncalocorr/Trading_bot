class RuntimePersistenceService {
  constructor({
    runtimeStateModel,
    logger
  }) {
    this.runtimeStateModel = runtimeStateModel;
    this.logger = logger;
    this.persistedKeys = [
      "botEnabled",
      "tradingMode",
      "autonomyMode",
      "shadowModeEnabled",
      "autonomyHeartbeatEnabled",
      "autoSwapEnabled",
      "autoApproveLiveEnabled",
      "autoLiveDeployEnabled",
      "notificationLocale",
      "scoreThreshold",
      "riskPerTrade",
      "compoundRatio",
      "tradingPairs",
      "activeStrategies",
      "championRunId",
      "challengerRunId",
      "regimeChampionTrendRunId",
      "regimeChampionSidewaysRunId",
      "regimeChampionVolatileRunId",
      "approvedLiveRunId",
      "autoPauseReason",
      "shadowLastSummary",
      "lastAutonomySnapshot",
      "circuitBreakers",
      "startupStatus"
    ];
  }

  normalizeTradingMode(value, fallback = "paper") {
    return String(value || fallback).toLowerCase() === "live" ? "live" : "paper";
  }

  normalizeAutonomyMode(value, fallback = "manual") {
    const normalized = String(value || fallback).toLowerCase();
    return ["manual", "supervised_auto", "full_auto"].includes(normalized) ? normalized : fallback;
  }

  normalizeNotificationLocale(value, fallback = "en") {
    return String(value || fallback).toLowerCase() === "pt-pt" ? "pt-PT" : "en";
  }

  async hydrateRuntime(runtime) {
    const persisted = await this.runtimeStateModel.getMany(this.persistedKeys);

    if (!persisted || Object.keys(persisted).length === 0) {
      return runtime;
    }

    for (const key of this.persistedKeys) {
      if (persisted[key] === undefined) {
        continue;
      }

      if (key === "activeStrategies") {
        if (Array.isArray(persisted[key]) && persisted[key].length > 0) {
          process.env.ACTIVE_STRATEGIES = persisted[key].filter(Boolean).join(",");
        }
        continue;
      }

      if (key === "tradingPairs") {
        runtime.tradingPairs = Array.isArray(persisted[key]) && persisted[key].length > 0
          ? persisted[key].map((pair) => String(pair).toUpperCase())
          : runtime.tradingPairs;
        process.env.TRADING_PAIRS = runtime.tradingPairs.join(",");
        continue;
      }

      if (key === "tradingMode") {
        runtime.tradingMode = this.normalizeTradingMode(persisted[key], runtime.tradingMode || "paper");
        continue;
      }

      if (key === "autonomyMode") {
        runtime.autonomyMode = this.normalizeAutonomyMode(persisted[key], runtime.autonomyMode || "manual");
        continue;
      }

      if (key === "notificationLocale") {
        runtime.notificationLocale = this.normalizeNotificationLocale(persisted[key], runtime.notificationLocale || "en");
        continue;
      }

      runtime[key] = persisted[key];
    }

    process.env.TRADING_MODE = this.normalizeTradingMode(runtime.tradingMode, "paper");
    process.env.AUTONOMY_MODE = this.normalizeAutonomyMode(runtime.autonomyMode, "manual");
    process.env.TELEGRAM_NOTIFICATION_LOCALE = this.normalizeNotificationLocale(runtime.notificationLocale, "en");

    if (persisted.shadowModeEnabled !== undefined) {
      process.env.SHADOW_MODE_ENABLED = runtime.shadowModeEnabled ? "true" : "false";
    }

    if (persisted.autonomyHeartbeatEnabled !== undefined) {
      process.env.AUTONOMY_HEARTBEAT_ENABLED = runtime.autonomyHeartbeatEnabled ? "true" : "false";
    }

    if (persisted.autoSwapEnabled !== undefined) {
      process.env.AUTO_SWAP_ENABLED = runtime.autoSwapEnabled ? "true" : "false";
    }

    if (persisted.autoApproveLiveEnabled !== undefined) {
      process.env.AUTO_APPROVE_LIVE_ENABLED = runtime.autoApproveLiveEnabled ? "true" : "false";
    }

    if (persisted.autoLiveDeployEnabled !== undefined) {
      process.env.AUTO_LIVE_DEPLOY_ENABLED = runtime.autoLiveDeployEnabled ? "true" : "false";
    }

    if (persisted.scoreThreshold !== undefined) {
      process.env.SCORE_THRESHOLD = String(runtime.scoreThreshold);
    }

    if (persisted.riskPerTrade !== undefined) {
      process.env.RISK_PER_TRADE = String(runtime.riskPerTrade);
    }

    if (persisted.compoundRatio !== undefined) {
      process.env.COMPOUND_RATIO = String(runtime.compoundRatio);
    }

    if (persisted.championRunId !== undefined) {
      process.env.CHAMPION_RUN_ID = runtime.championRunId ? String(runtime.championRunId) : "";
    }

    if (persisted.challengerRunId !== undefined) {
      process.env.CHALLENGER_RUN_ID = runtime.challengerRunId ? String(runtime.challengerRunId) : "";
    }

    if (persisted.regimeChampionTrendRunId !== undefined) {
      process.env.REGIME_CHAMPION_TREND_RUN_ID = runtime.regimeChampionTrendRunId
        ? String(runtime.regimeChampionTrendRunId)
        : "";
    }

    if (persisted.regimeChampionSidewaysRunId !== undefined) {
      process.env.REGIME_CHAMPION_SIDEWAYS_RUN_ID = runtime.regimeChampionSidewaysRunId
        ? String(runtime.regimeChampionSidewaysRunId)
        : "";
    }

    if (persisted.regimeChampionVolatileRunId !== undefined) {
      process.env.REGIME_CHAMPION_VOLATILE_RUN_ID = runtime.regimeChampionVolatileRunId
        ? String(runtime.regimeChampionVolatileRunId)
        : "";
    }

    if (persisted.approvedLiveRunId !== undefined) {
      process.env.APPROVED_LIVE_RUN_ID = runtime.approvedLiveRunId ? String(runtime.approvedLiveRunId) : "";
    }

    this.logger.info("runtime_state_hydrated", {
      tradingMode: runtime.tradingMode,
      autonomyMode: runtime.autonomyMode,
      championRunId: runtime.championRunId || null
    });

    return runtime;
  }

  async persistRuntime(runtime) {
    const payload = {
      botEnabled: Boolean(runtime.botEnabled),
      tradingMode: this.normalizeTradingMode(runtime.tradingMode, "paper"),
      autonomyMode: this.normalizeAutonomyMode(runtime.autonomyMode, "manual"),
      shadowModeEnabled: Boolean(runtime.shadowModeEnabled),
      autonomyHeartbeatEnabled: Boolean(runtime.autonomyHeartbeatEnabled),
      autoSwapEnabled: Boolean(runtime.autoSwapEnabled),
      autoApproveLiveEnabled: Boolean(runtime.autoApproveLiveEnabled),
      autoLiveDeployEnabled: Boolean(runtime.autoLiveDeployEnabled),
      notificationLocale: this.normalizeNotificationLocale(runtime.notificationLocale, "en"),
      scoreThreshold: Number(runtime.scoreThreshold),
      riskPerTrade: Number(runtime.riskPerTrade),
      compoundRatio: Number(runtime.compoundRatio),
      tradingPairs: Array.isArray(runtime.tradingPairs) ? runtime.tradingPairs : [],
      activeStrategies: String(process.env.ACTIVE_STRATEGIES || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      championRunId: runtime.championRunId || null,
      challengerRunId: runtime.challengerRunId || null,
      regimeChampionTrendRunId: runtime.regimeChampionTrendRunId || null,
      regimeChampionSidewaysRunId: runtime.regimeChampionSidewaysRunId || null,
      regimeChampionVolatileRunId: runtime.regimeChampionVolatileRunId || null,
      approvedLiveRunId: runtime.approvedLiveRunId || null,
      autoPauseReason: runtime.autoPauseReason || null,
      shadowLastSummary: runtime.shadowLastSummary || null,
      lastAutonomySnapshot: runtime.lastAutonomySnapshot || null,
      circuitBreakers: runtime.circuitBreakers || {},
      startupStatus: runtime.startupStatus || null
    };

    await this.runtimeStateModel.setMany(payload);
    return payload;
  }
}

module.exports = RuntimePersistenceService;
