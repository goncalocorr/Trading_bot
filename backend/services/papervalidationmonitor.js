class PaperValidationMonitor {
  constructor({
    runtime,
    tradeModel,
    paperValidationService,
    promotionEvents,
    telegramService,
    updateRuntimeSettings
  }) {
    this.runtime = runtime;
    this.tradeModel = tradeModel;
    this.paperValidationService = paperValidationService;
    this.promotionEvents = promotionEvents;
    this.telegramService = telegramService;
    this.updateRuntimeSettings = updateRuntimeSettings;
  }

  async monitorChampion() {
    if (!this.runtime.championRunId) {
      return;
    }

    const trades = await this.tradeModel.listTrades({ limit: 250 });
    const summary = await this.paperValidationService.buildSummary(trades);
    const champion = summary.champion;
    const thresholds = this.paperValidationService.getDemotionThresholds();

    if (!champion) {
      return;
    }

    const performance = champion.paperPerformance || {};

    if (Number(performance.tradeCount || 0) < thresholds.minTrades) {
      return;
    }

    const degraded =
      Number(performance.winRate || 0) < thresholds.minWinRate ||
      Number(performance.pnlTotal || 0) < thresholds.minPnl;

    if (!degraded) {
      return;
    }

    const alertKey = `demoted:${champion.runId}:${performance.tradeCount}:${Number(performance.pnlTotal || 0).toFixed(4)}`;

    if (this.runtime.paperValidationAlertKey === alertKey) {
      return;
    }

    this.runtime.paperValidationAlertKey = alertKey;
    this.updateRuntimeSettings({
      botEnabled: false,
      championRunId: null
    });

    await this.promotionEvents.createEvent({
      runId: champion.runId,
      slot: "champion",
      action: "demoted",
      metadata: {
        reason: "paper_degradation",
        performance,
        thresholds
      }
    });

    await this.telegramService.notifyPaperValidationUpdate({
      title: "Champion demoted",
      runId: champion.runId,
      slot: "champion",
      action: "demoted",
      reason: "Paper performance degraded below demotion thresholds.",
      performance
    });
  }

  async monitorRecommendations() {
    const trades = await this.tradeModel.listTrades({ limit: 250 });
    const summary = await this.paperValidationService.buildSummary(trades);
    const recommendation = summary.recommendation;

    if (!recommendation || recommendation.action !== "SWAP_TO_CHALLENGER" || !summary.challenger?.runId) {
      return;
    }

    const alertKey = `swap:${summary.champion?.runId || "none"}:${summary.challenger.runId}:${Number(summary.headToHead?.pnlDelta || 0).toFixed(4)}:${Number(summary.headToHead?.winRateDelta || 0).toFixed(2)}`;

    if (this.runtime.paperValidationAlertKey === alertKey) {
      return;
    }

    this.runtime.paperValidationAlertKey = alertKey;

    await this.promotionEvents.createEvent({
      runId: summary.challenger.runId,
      slot: "challenger",
      action: "swap_recommended",
      metadata: {
        recommendation,
        headToHead: summary.headToHead
      }
    });

    await this.telegramService.notifyPaperValidationRecommendation({
      title: "Challenger swap suggested",
      championRunId: summary.champion?.runId || null,
      challengerRunId: summary.challenger.runId,
      recommendation,
      headToHead: summary.headToHead
    });
  }
}

module.exports = PaperValidationMonitor;
