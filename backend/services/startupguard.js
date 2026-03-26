class StartupGuard {
  constructor({
    runtime,
    db,
    binanceService,
    macroEventsService,
    reconcileExchangeTrades,
    executionOrchestrator,
    updateRuntimeSettings,
    logger
  }) {
    this.runtime = runtime;
    this.db = db;
    this.binanceService = binanceService;
    this.macroEventsService = macroEventsService;
    this.reconcileExchangeTrades = reconcileExchangeTrades;
    this.executionOrchestrator = executionOrchestrator;
    this.updateRuntimeSettings = updateRuntimeSettings;
    this.logger = logger;
  }

  isStrictMode() {
    return String(process.env.STARTUP_STRICT_MODE || "true").toLowerCase() !== "false";
  }

  computeOverallOk(checks) {
    if (this.runtime.tradingMode === "live") {
      return (
        checks.database.ok &&
        checks.exchangePing.ok &&
        checks.exchangeAccount.ok &&
        checks.liveReadiness.ok &&
        checks.reconciliation.ok
      );
    }

    return checks.database.ok && checks.exchangePing.ok && checks.reconciliation.ok;
  }

  async run() {
    const checks = {
      database: { ok: false, message: "" },
      exchangePing: { ok: false, message: "" },
      exchangeAccount: { ok: false, message: "" },
      macroFeed: { ok: false, message: "" },
      liveReadiness: { ok: true, message: "Not in live mode." },
      reconciliation: { ok: false, message: "Not run." }
    };

    try {
      await this.db.testConnection();
      checks.database = { ok: true, message: "Database connection OK." };
    } catch (error) {
      checks.database = { ok: false, message: error.message };
    }

    try {
      await this.binanceService.ping();
      checks.exchangePing = { ok: true, message: "Binance ping OK." };
    } catch (error) {
      checks.exchangePing = { ok: false, message: error.message };
    }

    try {
      await this.binanceService.getAccountInfo();
      checks.exchangeAccount = { ok: true, message: "Exchange account access OK." };
    } catch (error) {
      checks.exchangeAccount = { ok: false, message: error.message };
    }

    try {
      const macroStatus = await this.macroEventsService.evaluateMacroPause();
      checks.macroFeed = {
        ok: true,
        message: macroStatus?.status?.reason || "Macro feed OK."
      };
    } catch (error) {
      checks.macroFeed = { ok: false, message: error.message };
    }

    if (this.runtime.tradingMode === "live") {
      const hasApprovedLiveRun = Boolean(this.runtime.approvedLiveRunId);
      const fullAutoLiveReady =
        this.runtime.autonomyMode !== "full_auto" || Boolean(this.runtime.approvedLiveRunId);

      if (!hasApprovedLiveRun) {
        checks.liveReadiness = {
          ok: false,
          message: "Live mode requires an approved live run."
        };
      } else if (!fullAutoLiveReady) {
        checks.liveReadiness = {
          ok: false,
          message: "Full-auto live requires approved live governance."
        };
      } else {
        checks.liveReadiness = {
          ok: true,
          message: "Live startup gate passed."
        };
      }
    }

    const shouldPause =
      this.isStrictMode() &&
      (this.runtime.tradingMode === "live"
        ? !checks.database.ok || !checks.exchangePing.ok || !checks.exchangeAccount.ok || !checks.liveReadiness.ok
        : !checks.database.ok || !checks.exchangePing.ok);

    if (shouldPause) {
      this.updateRuntimeSettings({
        botEnabled: false
      });
      this.runtime.autoPauseReason = "startup_guard_failed";
    }

    try {
      await this.reconcileExchangeTrades();
      await this.executionOrchestrator.manageOpenTrades();
      checks.reconciliation = { ok: true, message: "Startup reconciliation completed." };
    } catch (error) {
      checks.reconciliation = { ok: false, message: error.message };

      if (this.isStrictMode() && this.runtime.tradingMode === "live") {
        this.updateRuntimeSettings({
          botEnabled: false
        });
        this.runtime.autoPauseReason = "startup_reconciliation_failed";
      }
    }

    const result = {
      strictMode: this.isStrictMode(),
      ranAt: new Date().toISOString(),
      checks,
      overallOk: this.computeOverallOk(checks)
    };

    if (this.logger) {
      this.logger.info("startup_guard_completed", {
        overallOk: result.overallOk,
        strictMode: result.strictMode,
        tradingMode: this.runtime.tradingMode,
        autoPauseReason: this.runtime.autoPauseReason || null
      });
    }

    await this.runtime.persistState?.();
    return result;
  }
}

module.exports = StartupGuard;
