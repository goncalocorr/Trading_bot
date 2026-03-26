class SignalInspector {
  constructor({
    runtime,
    executionEngine,
    scorerService,
    determineRuntimeDecision,
    evaluateSignalExecutionGuards,
    checkTradingPauseStatus,
    checkBuyEntryAvailability,
    getBotStatus
  }) {
    this.runtime = runtime;
    this.executionEngine = executionEngine;
    this.scorerService = scorerService;
    this.determineRuntimeDecision = determineRuntimeDecision;
    this.evaluateSignalExecutionGuards = evaluateSignalExecutionGuards;
    this.checkTradingPauseStatus = checkTradingPauseStatus;
    this.checkBuyEntryAvailability = checkBuyEntryAvailability;
    this.getBotStatus = getBotStatus;
  }

  async buildSignalDebugSnapshot({
    pair,
    side,
    triggerSource = "manual",
    candlesByTimeframe,
    metadata = {}
  }) {
    const normalizedPair = String(pair || this.runtime.tradingPairs[0]).toUpperCase();
    const normalizedSide = String(side || "BUY").toUpperCase();
    const availability = await this.checkTradingPauseStatus();

    const scoreResult = await this.scorerService.scoreSignal({
      pair: normalizedPair,
      side: normalizedSide,
      triggerSource,
      candlesByTimeframe,
      scoreThreshold: this.runtime.scoreThreshold,
      metadata
    });

    const blockers = [];

    if (!availability.allowed) {
      blockers.push(availability.reason);
    }

    if (scoreResult.snapshots.sentiment?.evaluations?.fearGreed?.allowed === false) {
      blockers.push(scoreResult.snapshots.sentiment.evaluations.fearGreed.reason);
    }

    const executionGuards = this.evaluateSignalExecutionGuards(scoreResult, normalizedSide);

    if (executionGuards.blocked) {
      blockers.push(executionGuards.reason);
    }

    let buyAvailability = { allowed: true };

    if (normalizedSide === "BUY" && availability.allowed) {
      buyAvailability = await this.checkBuyEntryAvailability(normalizedPair);

      if (!buyAvailability.allowed) {
        blockers.push(buyAvailability.reason);
      }
    }

    const runtimeDecision = this.determineRuntimeDecision(scoreResult.score.totalScore);
    const canExecute = blockers.length === 0 && runtimeDecision === "EXECUTE";
    const multiTimeframe = scoreResult.snapshots.indicators?.multiTimeframe;
    const highTimeframeNearReady =
      !multiTimeframe?.aligned &&
      ["BUY", "SELL"].includes(normalizedSide) &&
      (
        scoreResult.snapshots.indicators?.["1h"]?.trend?.bias ===
          (normalizedSide === "BUY" ? "bullish" : "bearish") ||
        scoreResult.snapshots.indicators?.["4h"]?.trend?.bias ===
          (normalizedSide === "BUY" ? "bullish" : "bearish")
      );
    const signalTimeframeTradeable = !scoreResult.snapshots.indicators?.["15m"]?.marketState?.isSideways;

    let readiness = {
      state: "BLOCKED",
      tone: "warning",
      label: "Blocked",
      reason: blockers[0] || "Signal is blocked by the current strategy conditions."
    };

    if (canExecute) {
      readiness = {
        state: "READY",
        tone: "success",
        label: "Ready",
        reason: "Signal passes the strategy, risk and execution checks."
      };
    } else if (
      runtimeDecision !== "IGNORE" &&
      signalTimeframeTradeable &&
      (multiTimeframe?.aligned || highTimeframeNearReady)
    ) {
      readiness = {
        state: "NEAR_READY",
        tone: "info",
        label: "Near ready",
        reason: blockers[0] || "The setup is improving, but one or more confirmations are still missing."
      };
    }

    return {
      pair: normalizedPair,
      side: normalizedSide,
      triggerSource,
      tradingMode: this.executionEngine.getModeLabel(),
      botStatus: this.getBotStatus(),
      runtimeThreshold: this.runtime.scoreThreshold,
      canExecute,
      readiness,
      decision: canExecute ? "EXECUTE" : runtimeDecision,
      primaryReason:
        blockers[0] ||
        scoreResult.score.reason ||
        (runtimeDecision === "EXECUTE"
          ? "Signal is executable."
          : "Signal is not executable under the current strategy rules."),
      blockers,
      score: scoreResult.score,
      diagnostics: {
        availability,
        buyAvailability,
        timeframes: {
          "5m": scoreResult.snapshots.indicators?.["5m"] || null,
          "15m": scoreResult.snapshots.indicators?.["15m"] || null,
          "1h": scoreResult.snapshots.indicators?.["1h"] || null,
          "4h": scoreResult.snapshots.indicators?.["4h"] || null
        },
        multiTimeframe: scoreResult.snapshots.indicators?.multiTimeframe || null,
        marketState: scoreResult.snapshots.indicators?.["15m"]?.marketState || null,
        trend15m: scoreResult.snapshots.indicators?.["15m"]?.trend || null,
        rsi15m: scoreResult.snapshots.indicators?.["15m"]?.rsi14 ?? null,
        volume15m: scoreResult.snapshots.indicators?.["15m"]?.volume || null,
        fearGreed: scoreResult.snapshots.sentiment?.fearGreed || null,
        fearGreedEvaluation: scoreResult.snapshots.sentiment?.evaluations?.fearGreed || null,
        newsEvaluation: scoreResult.snapshots.sentiment?.evaluations?.news || null,
        pattern: scoreResult.snapshots.patterns || null,
        orderBook: scoreResult.snapshots.orderBook || null
      }
    };
  }
}

module.exports = SignalInspector;
