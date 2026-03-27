const binanceService = require("./binance");
const indicatorsService = require("./indicators");
const sentimentService = require("./sentiment");
const candlePatternsService = require("./candlepatterns");
const orderBookService = require("./orderbook");

const DEFAULT_TIMEFRAMES = ["5m", "15m", "1h", "4h"];
const MAX_SCORE = 12;

function normalizeSide(side) {
  return String(side || "").toUpperCase();
}

function evaluateRsi(signalSide, indicatorSnapshot, signalTimeframe = "15m", strategyId = "") {
  const rsi = indicatorSnapshot?.[signalTimeframe]?.rsi14;
  const normalizedSide = normalizeSide(signalSide);

  let confirms;
  if (strategyId === "mean_reversion") {
    // mean_reversion fires exactly when RSI is extreme — reward it
    confirms = (normalizedSide === "BUY" && rsi < 35) || (normalizedSide === "SELL" && rsi > 65);
  } else {
    // pullback_continuation and others: RSI should be in the pullback/distribution zone
    confirms = (normalizedSide === "BUY" && rsi >= 30 && rsi <= 65) || (normalizedSide === "SELL" && rsi >= 35 && rsi <= 70);
  }

  return {
    label: "RSI confirms signal direction",
    points: confirms ? 2 : 0,
    maxPoints: 2,
    passed: confirms,
    details: {
      value: rsi,
      signalSide: normalizedSide,
      strategyId: strategyId || "default"
    }
  };
}

function evaluateEmaTrend(signalSide, indicatorSnapshot, signalTimeframe = "15m", strategyId = "") {
  const trend = indicatorSnapshot?.[signalTimeframe]?.trend;
  const normalizedSide = normalizeSide(signalSide);
  const bullish = trend?.goldenCross && trend?.priceAboveEma200;
  const bearish = trend?.deathCross && !trend?.priceAboveEma200;
  const isMeanReversion = strategyId === "mean_reversion";
  const structurallyHostile =
    (normalizedSide === "BUY" && bearish) ||
    (normalizedSide === "SELL" && bullish);
  const confirms = isMeanReversion
    ? !structurallyHostile
    : (normalizedSide === "BUY" && bullish) || (normalizedSide === "SELL" && bearish);
  const points = isMeanReversion
    ? confirms ? 1 : 0
    : confirms ? 2 : 0;

  return {
    label: isMeanReversion
      ? "EMA structure not hostile to mean reversion"
      : "EMA trend confirms signal direction",
    points,
    maxPoints: 2,
    passed: confirms,
    details: {
      signalSide: normalizedSide,
      strategyId: strategyId || "default",
      bias: trend?.bias || "neutral",
      ema9: trend?.ema9,
      ema21: trend?.ema21,
      ema50: trend?.ema50,
      ema200: trend?.ema200,
      priceAboveEma200: trend?.priceAboveEma200
    }
  };
}

function evaluateMultiTimeframe(signalSide, indicatorSnapshot, strategyId = "") {
  const multiTimeframe = indicatorSnapshot?.multiTimeframe;
  const normalizedSide = normalizeSide(signalSide);
  const isMeanReversion = strategyId === "mean_reversion";
  const oppositeSide = normalizedSide === "BUY" ? "SELL" : "BUY";
  const fullAlignment = multiTimeframe?.aligned && multiTimeframe?.direction === normalizedSide;
  const partialAlignment = !fullAlignment && multiTimeframe?.aligned1h && multiTimeframe?.direction1h === normalizedSide;
  const stronglyOpposed =
    Boolean(multiTimeframe?.aligned && multiTimeframe?.direction === oppositeSide) &&
    Boolean(multiTimeframe?.aligned1h && multiTimeframe?.direction1h === oppositeSide);
  const points = isMeanReversion
    ? stronglyOpposed ? 0 : 1
    : fullAlignment ? 2 : partialAlignment ? 1 : 0;

  return {
    label: isMeanReversion
      ? "Higher timeframes not strongly hostile"
      : "Multi-timeframe alignment (1H + 4H)",
    points,
    maxPoints: 2,
    passed: points > 0,
    partial: partialAlignment,
    details: multiTimeframe || {
      aligned: false,
      aligned1h: false,
      direction: "neutral",
      reason: "No higher timeframe context available."
    }
  };
}

function evaluateVolume(indicatorSnapshot, signalTimeframe = "15m") {
  const volume = indicatorSnapshot?.[signalTimeframe]?.volume;
  const confirms = Boolean(volume?.isAboveAverage);

  return {
    label: "Volume above 20-period average",
    points: confirms ? 1 : 0,
    maxPoints: 1,
    passed: confirms,
    details: volume || {
      averageVolume: null,
      latestVolume: null,
      isAboveAverage: false
    }
  };
}

function evaluateFearGreed(sentimentSnapshot) {
  const evaluation = sentimentSnapshot?.evaluations?.fearGreed;
  const confirms = Boolean(evaluation?.scoreEligible);

  return {
    label: "Fear & Greed not extreme",
    points: confirms ? 1 : 0,
    maxPoints: 1,
    passed: confirms,
    details: {
      ...evaluation,
      value: sentimentSnapshot?.fearGreed?.value,
      classification: sentimentSnapshot?.fearGreed?.classification
    }
  };
}

function evaluateNews(sentimentSnapshot) {
  const evaluation = sentimentSnapshot?.evaluations?.news;
  const confirms = Boolean(evaluation?.scoreEligible);

  return {
    label: "News sentiment neutral or positive",
    points: confirms ? 1 : 0,
    maxPoints: 1,
    passed: confirms,
    details: {
      ...evaluation,
      summary: sentimentSnapshot?.newsSummary
    }
  };
}

function evaluateCandlePatterns(signalSide, patternSnapshot) {
  const confirms = Boolean(patternSnapshot?.matched);

  return {
    label: "Candlestick pattern confirms",
    points: confirms ? 1 : 0,
    maxPoints: 1,
    passed: confirms,
    details: patternSnapshot || {
      matched: false,
      confirmingPatterns: [],
      allMatches: []
    }
  };
}

function evaluateOrderBookPressure(orderBookSnapshot) {
  const confirms = Boolean(orderBookSnapshot?.evaluation?.confirmsSignal);

  return {
    label: "Order book pressure confirms",
    points: confirms ? 1 : 0,
    maxPoints: 1,
    passed: confirms,
    details: orderBookSnapshot?.evaluation || {
      confirmsSignal: false,
      spreadAccepted: false,
      reason: "Order book analysis unavailable."
    }
  };
}

function evaluateSpread(orderBookSnapshot) {
  const confirms = Boolean(orderBookSnapshot?.evaluation?.spreadAccepted);

  return {
    label: "Spread acceptable (<0.1%)",
    points: confirms ? 1 : 0,
    maxPoints: 1,
    passed: confirms,
    details: {
      spreadPercent: orderBookSnapshot?.analysis?.spreadPercent,
      acceptableSpread: confirms
    }
  };
}

function buildDecision(totalScore, executionThreshold = 8) {
  const normalizedThreshold = Number(executionThreshold || 8);

  if (totalScore >= normalizedThreshold) {
    return "EXECUTE";
  }

  if (totalScore >= 5) {
    return "MISSED";
  }

  return "IGNORE";
}

function buildReason(decision, totalScore) {
  if (decision === "EXECUTE") {
    return `Signal approved with score ${totalScore}/${MAX_SCORE}.`;
  }

  if (decision === "MISSED") {
    return `Signal logged as missed opportunity with score ${totalScore}/${MAX_SCORE}.`;
  }

  return `Signal ignored with score ${totalScore}/${MAX_SCORE}.`;
}

function computeScoreBreakdown({
  signalSide,
  indicatorSnapshot,
  sentimentSnapshot,
  patternSnapshot,
  orderBookSnapshot,
  signalTimeframe = "15m",
  executionThreshold = 8,
  strategyId = ""
}) {
  const breakdownItems = [
    evaluateRsi(signalSide, indicatorSnapshot, signalTimeframe, strategyId),
    evaluateEmaTrend(signalSide, indicatorSnapshot, signalTimeframe, strategyId),
    evaluateMultiTimeframe(signalSide, indicatorSnapshot, strategyId),
    evaluateVolume(indicatorSnapshot, signalTimeframe),
    evaluateFearGreed(sentimentSnapshot),
    evaluateNews(sentimentSnapshot),
    evaluateCandlePatterns(signalSide, patternSnapshot),
    evaluateOrderBookPressure(orderBookSnapshot),
    evaluateSpread(orderBookSnapshot)
  ];

  const baseScore = breakdownItems.reduce((sum, item) => sum + item.points, 0);
  const newsScoreAdjustment = Number(sentimentSnapshot?.evaluations?.news?.scoreAdjustment || 0);

  // Penalty for contradictory signals: overbought RSI on BUY, oversold on SELL.
  // mean_reversion intentionally fires at RSI extremes — no penalty for it.
  const rsi15m = indicatorSnapshot?.[signalTimeframe]?.rsi14;
  const normalizedSignalSide = normalizeSide(signalSide);
  let signalPenalty = 0;
  if (strategyId !== "mean_reversion") {
    if (normalizedSignalSide === "BUY" && rsi15m > 70) signalPenalty -= 1;
    if (normalizedSignalSide === "SELL" && rsi15m < 30) signalPenalty -= 1;
  }

  const totalScore = Math.max(0, Math.min(MAX_SCORE, baseScore + newsScoreAdjustment + signalPenalty));
  const decision = buildDecision(totalScore, executionThreshold);
  const executionMode = binanceService.getExecutionMode(totalScore);
  const blockingReasons = breakdownItems.filter((item) => !item.passed).map((item) => item.label);

  return {
    totalScore,
    baseScore,
    adjustments: {
      newsScoreAdjustment
    },
    maxScore: MAX_SCORE,
    decision,
    executionMode,
    reason: buildReason(decision, totalScore),
    blockingReasons,
    items: breakdownItems
  };
}

async function collectScoringContext({
  pair = "BTCUSDT",
  side = "BUY",
  candlesByTimeframe,
  sentimentSnapshot,
  orderBookSnapshot
} = {}) {
  const normalizedSide = normalizeSide(side);
  const marketCandles =
    candlesByTimeframe || (await binanceService.getMultiTimeframeCandles(pair, DEFAULT_TIMEFRAMES));
  const indicatorSnapshot = indicatorsService.buildIndicatorSnapshot(marketCandles);
  const finalSentimentSnapshot =
    sentimentSnapshot || (await sentimentService.getSentimentSnapshot({ pair, signalSide: normalizedSide }));
  const patternSnapshot = candlePatternsService.getPatternConfirmation(marketCandles["15m"], normalizedSide);
  const finalOrderBookSnapshot =
    orderBookSnapshot || (await orderBookService.getSignalAwareOrderBook(pair, normalizedSide, 20));

  return {
    pair: pair.toUpperCase(),
    side: normalizedSide,
    candlesByTimeframe: marketCandles,
    indicatorSnapshot,
    sentimentSnapshot: finalSentimentSnapshot,
    patternSnapshot,
    orderBookSnapshot: finalOrderBookSnapshot
  };
}

async function scoreSignal({
  pair = "BTCUSDT",
  side = "BUY",
  triggerSource = "auto",
  candlesByTimeframe,
  sentimentSnapshot,
  orderBookSnapshot,
  scoreThreshold = 8,
  metadata = {}
} = {}) {
  const context = await collectScoringContext({
    pair,
    side,
    candlesByTimeframe,
    sentimentSnapshot,
    orderBookSnapshot
  });

  const breakdown = computeScoreBreakdown({
    signalSide: context.side,
    indicatorSnapshot: context.indicatorSnapshot,
    sentimentSnapshot: context.sentimentSnapshot,
    patternSnapshot: context.patternSnapshot,
    orderBookSnapshot: context.orderBookSnapshot,
    executionThreshold: scoreThreshold,
    strategyId: metadata?.strategyId || metadata?.strategy || ""
  });

  return {
    pair: context.pair,
    side: context.side,
    triggerSource,
    metadata,
    score: breakdown,
    snapshots: {
      indicators: context.indicatorSnapshot,
      sentiment: context.sentimentSnapshot,
      patterns: context.patternSnapshot,
      orderBook: context.orderBookSnapshot.analysis
    },
    tradePlan: {
      executionMode: breakdown.executionMode,
      canTrade: breakdown.decision === "EXECUTE",
      shouldLogMissedOpportunity: breakdown.decision === "MISSED",
      shouldIgnore: breakdown.decision === "IGNORE"
    }
  };
}

module.exports = {
  collectScoringContext,
  computeScoreBreakdown,
  scoreSignal
};
