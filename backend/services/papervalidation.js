class PaperValidationService {
  constructor({
    runtime,
    tradeAnalytics,
    backtestRuns,
    promotionEvents
  }) {
    this.runtime = runtime;
    this.tradeAnalytics = tradeAnalytics;
    this.backtestRuns = backtestRuns;
    this.promotionEvents = promotionEvents;
  }

  getApprovalThresholds() {
    return {
      minTrades: Number(process.env.PAPER_APPROVAL_MIN_TRADES || 8),
      minWinRate: Number(process.env.PAPER_APPROVAL_MIN_WIN_RATE || 45),
      minPnl: Number(process.env.PAPER_APPROVAL_MIN_PNL || 0)
    };
  }

  getDemotionThresholds() {
    return {
      minTrades: Number(process.env.PAPER_DEMOTION_MIN_TRADES || 5),
      minWinRate: Number(process.env.PAPER_DEMOTION_MIN_WIN_RATE || 30),
      minPnl: Number(process.env.PAPER_DEMOTION_MIN_PNL || -1)
    };
  }

  getChallengerThresholds() {
    return {
      minTrades: Number(process.env.PAPER_CHALLENGER_MIN_TRADES || 5),
      minPnlEdge: Number(process.env.PAPER_CHALLENGER_MIN_EDGE_PNL || 0.5),
      minWinRateEdge: Number(process.env.PAPER_CHALLENGER_MIN_EDGE_WIN_RATE || 5)
    };
  }

  getRegimeChampionRunIds() {
    return {
      trend: this.runtime.regimeChampionTrendRunId || null,
      sideways: this.runtime.regimeChampionSidewaysRunId || null,
      volatile: this.runtime.regimeChampionVolatileRunId || null
    };
  }

  getTradingMode(trade = {}) {
    return String(trade.metadata?.tradingMode || "").toUpperCase();
  }

  getValidationContext(trade = {}) {
    return trade.metadata?.paperValidation || {};
  }

  filterPaperTrades(trades = []) {
    return trades.filter((trade) => this.getTradingMode(trade) === "PAPER" && trade.status !== "open");
  }

  filterTradesByRun(trades = [], runId) {
    const normalizedRunId = Number(runId);

    if (!Number.isFinite(normalizedRunId) || normalizedRunId <= 0) {
      return [];
    }

    return trades.filter((trade) => Number(this.getValidationContext(trade).promotedRunId) === normalizedRunId);
  }

  buildPerformance(trades = []) {
    const analytics = this.tradeAnalytics.computeStatistics(trades);

    return {
      tradeCount: analytics.totalTrades,
      winRate: analytics.winRate,
      pnlTotal: analytics.pnlValues.reduce((sum, value) => sum + Number(value || 0), 0),
      avgPnl: analytics.totalTrades === 0
        ? 0
        : analytics.pnlValues.reduce((sum, value) => sum + Number(value || 0), 0) / analytics.totalTrades,
      bestTrade: analytics.bestTrade,
      worstTrade: analytics.worstTrade
    };
  }

  buildRegimeSnapshot(trades = []) {
    const analytics = this.tradeAnalytics.computeStatistics(trades);
    const topRegime = Array.isArray(analytics.byRegime) && analytics.byRegime.length > 0
      ? analytics.byRegime[0]
      : null;

    return {
      byRegime: analytics.byRegime || [],
      topRegime: topRegime
        ? {
            regimeId: topRegime.regimeId,
            regimeLabel: topRegime.regimeLabel,
            winRate: topRegime.winRate,
            pnlTotal: topRegime.pnlTotal
          }
        : null
    };
  }

  buildApprovalGate(performance, regimeSnapshot = null) {
    const thresholds = this.getApprovalThresholds();
    const positiveRegime = regimeSnapshot?.topRegime && Number(regimeSnapshot.topRegime.pnlTotal || 0) > 0;

    if (performance.tradeCount < thresholds.minTrades) {
      return {
        canApproveLive: false,
        status: "NEEDS_MORE_DATA",
        reason: `Needs at least ${thresholds.minTrades} paper trades before live approval.`,
        thresholds
      };
    }

    if (performance.winRate < thresholds.minWinRate) {
      return {
        canApproveLive: false,
        status: "NOT_READY",
        reason: `Win rate below ${thresholds.minWinRate}%.`,
        thresholds
      };
    }

    if (performance.pnlTotal < thresholds.minPnl) {
      return {
        canApproveLive: false,
        status: "NOT_READY",
        reason: `Paper PnL below ${thresholds.minPnl}.`,
        thresholds
      };
    }

    if (!positiveRegime) {
      return {
        canApproveLive: false,
        status: "REGIME_UNCLEAR",
        reason: "Champion has not shown a positive regime-specific edge yet.",
        thresholds
      };
    }

    return {
      canApproveLive: true,
      status: "READY_FOR_LIVE_REVIEW",
      reason: "Champion meets the current paper validation gate.",
      thresholds
    };
  }

  async buildRunSummary(runId, trades = []) {
    const normalizedRunId = Number(runId);

    if (!Number.isFinite(normalizedRunId) || normalizedRunId <= 0) {
      return null;
    }

    const run = await this.backtestRuns.getBacktestRunById(normalizedRunId);

    if (!run) {
      return null;
    }

    const relatedTrades = this.filterTradesByRun(trades, normalizedRunId);
    const regimeSnapshot = this.buildRegimeSnapshot(relatedTrades);

    return {
      runId: normalizedRunId,
      pair: run.pair,
      timeframe: run.timeframe,
      activeStrategies: run.config?.activeStrategies || [],
      backtestSummary: run.summary || {},
      paperPerformance: this.buildPerformance(relatedTrades),
      regimeSnapshot
    };
  }

  buildHeadToHead(champion, challenger) {
    if (!champion && !challenger) {
      return null;
    }

    const championPerformance = champion?.paperPerformance || this.buildPerformance([]);
    const challengerPerformance = challenger?.paperPerformance || this.buildPerformance([]);

    return {
      championRunId: champion?.runId || null,
      challengerRunId: challenger?.runId || null,
      pnlDelta: Number(challengerPerformance.pnlTotal || 0) - Number(championPerformance.pnlTotal || 0),
      winRateDelta: Number(challengerPerformance.winRate || 0) - Number(championPerformance.winRate || 0),
      tradeCountDelta: Number(challengerPerformance.tradeCount || 0) - Number(championPerformance.tradeCount || 0)
    };
  }

  buildRecommendation({ champion, challenger, approvalGate, headToHead }) {
    const thresholds = this.getChallengerThresholds();

    if (!champion && challenger) {
      return {
        action: "PROMOTE_CHALLENGER",
        confidence: "medium",
        reason: "No champion is currently active and a challenger is available.",
        thresholds
      };
    }

    if (approvalGate?.canApproveLive) {
      return {
        action: "READY_FOR_LIVE_REVIEW",
        confidence: "high",
        reason: approvalGate.reason,
        thresholds
      };
    }

    if (champion && challenger) {
      const challengerPerformance = challenger.paperPerformance || {};
      const enoughData = Number(challengerPerformance.tradeCount || 0) >= thresholds.minTrades;
      const enoughPnlEdge = Number(headToHead?.pnlDelta || 0) >= thresholds.minPnlEdge;
      const enoughWinRateEdge = Number(headToHead?.winRateDelta || 0) >= thresholds.minWinRateEdge;

      if (enoughData && enoughPnlEdge && enoughWinRateEdge) {
        return {
          action: "SWAP_TO_CHALLENGER",
          confidence: "high",
          reason: "Challenger is outperforming the champion on paper with a meaningful edge.",
          thresholds
        };
      }
    }

    return {
      action: "KEEP_COLLECTING_DATA",
      confidence: "medium",
      reason: "Keep collecting paper evidence before changing the active champion.",
      thresholds
    };
  }

  async buildRegimeGovernance(trades = [], currentRegimeId = null) {
    const paperTrades = this.filterPaperTrades(trades);
    const regimeRunIds = this.getRegimeChampionRunIds();
    const entries = await Promise.all(
      Object.entries(regimeRunIds).map(async ([regimeId, runId]) => [
        regimeId,
        await this.buildRunSummary(runId, paperTrades)
      ])
    );
    const slots = Object.fromEntries(entries);
    const activeChampion = currentRegimeId && slots[currentRegimeId]
      ? slots[currentRegimeId]
      : null;

    return {
      currentRegimeId: currentRegimeId || null,
      slots,
      activeChampionRunId: activeChampion?.runId || null,
      activeChampion
    };
  }

  async buildSummary(trades = [], options = {}) {
    const paperTrades = this.filterPaperTrades(trades);
    const [promotionHistory, champion, challenger] = await Promise.all([
      this.promotionEvents.listEvents({ limit: 10 }),
      this.buildRunSummary(this.runtime.championRunId, paperTrades),
      this.buildRunSummary(this.runtime.challengerRunId, paperTrades)
    ]);
    const headToHead = this.buildHeadToHead(champion, challenger);
    const approvalGate = this.buildApprovalGate(
      champion?.paperPerformance || this.buildPerformance([]),
      champion?.regimeSnapshot || null
    );
    const recommendation = this.buildRecommendation({
      champion,
      challenger,
      approvalGate,
      headToHead
    });
    const regimeGovernance = await this.buildRegimeGovernance(trades, options.currentRegimeId || null);

    return {
      champion,
      challenger,
      approvalGate,
      promotionHistory,
      headToHead,
      recommendation,
      regimeGovernance
    };
  }
}

module.exports = PaperValidationService;
