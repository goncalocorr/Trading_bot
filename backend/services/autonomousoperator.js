class AutonomousOperator {
  constructor({
    runtime,
    signalInspector,
    strategyRunner,
    paperValidationService,
    backtestRuns,
    capitalAllocator,
    riskManager,
    circuitBreaker,
    telegramService,
    inferCurrentRegimeId,
    logger
  }) {
    this.runtime = runtime;
    this.signalInspector = signalInspector;
    this.strategyRunner = strategyRunner;
    this.paperValidationService = paperValidationService;
    this.backtestRuns = backtestRuns;
    this.capitalAllocator = capitalAllocator;
    this.riskManager = riskManager;
    this.circuitBreaker = circuitBreaker;
    this.telegramService = telegramService;
    this.inferCurrentRegimeId = inferCurrentRegimeId;
    this.logger = logger;
  }

  parseActiveStrategies() {
    return String(process.env.ACTIVE_STRATEGIES || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  getAutonomyModes() {
    return ["manual", "supervised_auto", "full_auto"];
  }

  async resolveCurrentRegimeId() {
    try {
      const debug = await this.signalInspector.buildSignalDebugSnapshot({
        pair: this.runtime.tradingPairs[0],
        side: "BUY",
        triggerSource: "auto"
      });

      return this.inferCurrentRegimeId
        ? this.inferCurrentRegimeId(debug)
        : debug?.marketRegime?.id || debug?.marketRegimeId || "mixed";
    } catch (_error) {
      return "mixed";
    }
  }

  async buildPaperValidationSummary(currentRegimeId = null) {
    if (!this.paperValidationService?.buildSummary || !this.runtime.getAllTradesForValidation) {
      return null;
    }

    const trades = await this.runtime.getAllTradesForValidation();
    return this.paperValidationService.buildSummary(trades, { currentRegimeId });
  }

  async getStrategyIdsFromRun(runId) {
    const normalizedRunId = Number(runId);

    if (!Number.isFinite(normalizedRunId) || normalizedRunId <= 0) {
      return [];
    }

    const run = await this.backtestRuns.getBacktestRunById(normalizedRunId);
    return Array.isArray(run?.config?.activeStrategies)
      ? run.config.activeStrategies.filter(Boolean)
      : [];
  }

  async resolveStrategySelection(currentRegimeId = "mixed") {
    const regimeKeyMap = {
      trend: "regimeChampionTrendRunId",
      sideways: "regimeChampionSidewaysRunId",
      volatile: "regimeChampionVolatileRunId"
    };
    const regimeRunId = this.runtime[regimeKeyMap[currentRegimeId]] || null;
    const regimeChampionStrategies = await this.getStrategyIdsFromRun(regimeRunId);

    if (regimeChampionStrategies.length > 0) {
      return {
        source: "regime_champion",
        runId: regimeRunId,
        strategyIds: regimeChampionStrategies
      };
    }

    const championStrategies = await this.getStrategyIdsFromRun(this.runtime.championRunId);

    if (championStrategies.length > 0) {
      return {
        source: "champion",
        runId: this.runtime.championRunId,
        strategyIds: championStrategies
      };
    }

    return {
      source: "runtime_active_strategies",
      runId: null,
      strategyIds: this.parseActiveStrategies()
    };
  }

  async evaluateLiveReadiness(currentRegimeId = "mixed") {
    const summary = await this.buildPaperValidationSummary(currentRegimeId);
    const approvalGate = summary?.approvalGate || null;
    const regimeGovernance = summary?.regimeGovernance || null;
    const activeRegimeChampionRunId = regimeGovernance?.activeChampionRunId || null;
    const activeChampionRunId = activeRegimeChampionRunId || this.runtime.championRunId || null;

    return {
      summary,
      approvalGate,
      activeChampionRunId,
      approvedLiveRunId: this.runtime.approvedLiveRunId || null,
      isApprovedForLive:
        Boolean(this.runtime.approvedLiveRunId) &&
        Number(this.runtime.approvedLiveRunId) === Number(activeChampionRunId),
      canRunLiveAutonomously: Boolean(
        this.runtime.autonomyMode === "full_auto" &&
        this.runtime.tradingMode === "live" &&
        approvalGate?.canApproveLive &&
        activeChampionRunId &&
        Number(this.runtime.approvedLiveRunId || 0) === Number(activeChampionRunId)
      )
    };
  }

  async buildAutonomyStatus() {
    const currentRegimeId = await this.resolveCurrentRegimeId();
    const strategySelection = await this.resolveStrategySelection(currentRegimeId);
    const liveReadiness = await this.evaluateLiveReadiness(currentRegimeId);
    const capitalState = this.riskManager?.getAvailableCapitalState
      ? await this.riskManager.getAvailableCapitalState()
      : { availableCapital: 0, reservedCapital: 0 };
    const strategyAllocation = this.capitalAllocator?.buildStrategySetAllocation
      ? this.capitalAllocator.buildStrategySetAllocation({
          currentRegimeId,
          strategyIds: strategySelection.strategyIds,
          availableCapital: capitalState.availableCapital,
          reservedCapital: capitalState.reservedCapital
        })
      : null;

    const pairStates = Object.fromEntries(
      Object.entries(this.runtime.signalAlertState || {}).map(([key, val]) => [
        key,
        val?.currentState || "UNKNOWN"
      ])
    );

    return {
      mode: this.runtime.autonomyMode,
      tradingMode: this.runtime.tradingMode,
      shadowModeEnabled: Boolean(this.runtime.shadowModeEnabled),
      currentRegimeId,
      strategySelection,
      strategyAllocation,
      liveReadiness,
      circuitBreakers: this.runtime.circuitBreakers,
      autoPauseReason: this.runtime.autoPauseReason || null,
      approvedLiveRunId: this.runtime.approvedLiveRunId || null,
      pairStates,
      automationFlags: {
        autoSwapEnabled: Boolean(this.runtime.autoSwapEnabled),
        autoApproveLiveEnabled: Boolean(this.runtime.autoApproveLiveEnabled),
        autoLiveDeployEnabled: Boolean(this.runtime.autoLiveDeployEnabled)
      }
    };
  }

  async runShadowScan(currentRegimeId, strategySelection) {
    const summary = await this.strategyRunner.runAutoScan({
      strategyIds: strategySelection.strategyIds,
      signalMetadata: {
        shadowMode: true,
        shadowModeExecutionIntent: "shadow_only",
        paperValidation: {
          promotedRunId: strategySelection.runId || this.runtime.championRunId || null,
          slot: "shadow"
        }
      }
    });

    this.runtime.shadowLastSummary = {
      ranAt: new Date().toISOString(),
      currentRegimeId,
      strategySelection,
      summary
    };
    await this.runtime.persistState?.();

    return this.runtime.shadowLastSummary;
  }

  async runAutonomousLoop() {
    const status = await this.buildAutonomyStatus();
    this.runtime.lastAutonomySnapshot = {
      ...status,
      updatedAt: new Date().toISOString()
    };
    await this.runtime.persistState?.();

    if (!this.runtime.botEnabled) {
      return {
        ok: true,
        action: "skipped",
        reason: "Bot is paused.",
        status
      };
    }

    if (this.runtime.autonomyMode === "manual") {
      return {
        ok: true,
        action: "skipped",
        reason: "Autonomy mode is manual.",
        status
      };
    }

    if (this.runtime.tradingMode === "live" && !status.liveReadiness.canRunLiveAutonomously) {
      return {
        ok: true,
        action: "blocked",
        reason: status.liveReadiness.approvalGate?.reason || "Live readiness gate not passed.",
        status
      };
    }

    try {
      const summary = await this.strategyRunner.runAutoScan({
        strategyIds: status.strategySelection.strategyIds,
        signalMetadata: {
          autonomyMode: this.runtime.autonomyMode,
          paperValidation: {
            promotedRunId: status.strategySelection.runId || this.runtime.championRunId || null,
            slot: status.strategySelection.source
          }
        }
      });

      this.circuitBreaker.recordSuccess("execution");

      if (this.runtime.shadowModeEnabled && this.runtime.tradingMode === "live") {
        await this.runShadowScan(status.currentRegimeId, status.strategySelection);
      }

      this.logger?.info("autonomous_loop_completed", {
        mode: this.runtime.autonomyMode,
        tradingMode: this.runtime.tradingMode,
        currentRegimeId: status.currentRegimeId,
        strategySource: status.strategySelection?.source || null
      });

      return {
        ok: true,
        action: "scan_completed",
        status,
        summary
      };
    } catch (error) {
      await this.circuitBreaker.recordFailure("execution", error, {
        currentRegimeId: status.currentRegimeId,
        strategySelection: status.strategySelection
      });
      this.logger?.error("autonomous_loop_failed", {
        mode: this.runtime.autonomyMode,
        tradingMode: this.runtime.tradingMode,
        message: error.message
      });

      return {
        ok: false,
        action: "scan_failed",
        reason: error.message,
        status
      };
    }
  }

  async monitorDailyLoop() {
    const snapshot = await this.buildAutonomyStatus();
    this.runtime.lastAutonomySnapshot = {
      ...snapshot,
      updatedAt: new Date().toISOString()
    };
    await this.runtime.persistState?.();

    if (this.telegramService?.notifyAutonomyHeartbeat && this.runtime.autonomyHeartbeatEnabled) {
      await this.telegramService.notifyAutonomyHeartbeat(this.runtime.lastAutonomySnapshot);
    }

    return this.runtime.lastAutonomySnapshot;
  }
}

module.exports = AutonomousOperator;
