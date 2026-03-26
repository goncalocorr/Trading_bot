class HealthMonitor {
  constructor({
    runtime,
    db,
    binanceService,
    executionEngine,
    macroEventsService
  }) {
    this.runtime = runtime;
    this.db = db;
    this.binanceService = binanceService;
    this.executionEngine = executionEngine;
    this.macroEventsService = macroEventsService;
  }

  async buildHealthSnapshot() {
    const checks = {
      database: { ok: false, message: "" },
      exchange: { ok: false, message: "" },
      macroFeed: { ok: false, message: "" },
      telegram: {
        ok: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        message: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
          ? "Telegram configured."
          : "Telegram not configured."
      }
    };

    try {
      await this.db.testConnection();
      checks.database = { ok: true, message: "Database OK." };
    } catch (error) {
      checks.database = { ok: false, message: error.message };
    }

    try {
      await this.binanceService.ping();
      checks.exchange = {
        ok: true,
        message: `Exchange OK (${this.executionEngine.getModeLabel()}).`
      };
    } catch (error) {
      checks.exchange = { ok: false, message: error.message };
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

    return {
      ok: Object.values(checks).every((item) => item.ok),
      timestamp: new Date().toISOString(),
      botStatus: this.runtime.botEnabled ? "enabled" : "paused",
      tradingMode: this.runtime.tradingMode,
      autonomyMode: this.runtime.autonomyMode,
      approvedLiveRunId: this.runtime.approvedLiveRunId || null,
      autoPauseReason: this.runtime.autoPauseReason || null,
      startup: this.runtime.startupStatus || null,
      circuitBreakers: this.runtime.circuitBreakers,
      checks
    };
  }
}

module.exports = HealthMonitor;
