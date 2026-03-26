/*
 * KNOWN APPROXIMATIONS (by design):
 * - Sentiment is assumed neutral (Fear & Greed = 50, news = neutral).
 *   Real historical sentiment data is not available from free APIs.
 * - Order book pressure is approximated from candle close position
 *   within the candle range (high-low).
 * These approximations are documented in README.md and are intentional.
 * The rest of the scoring system is identical to live trading.
 */

const binanceService = require("./binance");
const indicatorsService = require("./indicators");
const candlePatternsService = require("./candlepatterns");
const scorerService = require("./scorer");
const riskManager = require("./riskmanager");

const MARKET_EXECUTION_SCORE = 9;
const LIMIT_EXECUTION_MIN_SCORE = 7;
const LIMIT_EXECUTION_MAX_SCORE = 8;
const LIMIT_ENTRY_DISCOUNT = 0.9995;
const LIMIT_FILL_WINDOW_CANDLES = 5;
const DEFAULT_SCORE_THRESHOLD = 8;
const DEFAULT_MAX_OPEN_TRADES_PER_PAIR = 1;
const DEFAULT_PAIR_COOLDOWN_MINUTES = 30;

function buildBacktestSentimentSnapshot(signalSide) {
  return {
    pair: "BACKTEST",
    signalSide,
    fearGreed: {
      value: 50,
      classification: "Neutral",
      isExtremeFear: false,
      isExtremeGreed: false
    },
    news: [],
    newsSummary: {
      totalArticles: 0,
      totalScore: 0,
      positiveCount: 0,
      negativeCount: 0,
      overallSentiment: "neutral",
      heavilyNegative: false,
      neutralOrPositive: true
    },
    evaluations: {
      fearGreed: {
        allowed: true,
        scoreEligible: true,
        reason: "Backtest neutral sentiment assumption."
      },
      news: {
        scoreAdjustment: 0,
        scoreEligible: true,
        reason: "Backtest neutral news assumption."
      }
    }
  };
}

function buildBacktestOrderBookSnapshot(signalSide, signalCandles) {
  const latest = signalCandles[signalCandles.length - 1];
  const candleRange = Math.max(Number(latest.high) - Number(latest.low), 0.00000001);
  const closePosition = (Number(latest.close) - Number(latest.low)) / candleRange;
  let directionalBias = "neutral";

  if (closePosition >= 0.7) {
    directionalBias = "bullish";
  } else if (closePosition <= 0.3) {
    directionalBias = "bearish";
  }

  return {
    analysis: {
      spreadPercent: 0.05,
      acceptableSpread: true,
      buyPressureRatio: directionalBias === "bullish" ? 0.65 : directionalBias === "bearish" ? 0.35 : 0.5,
      directionalBias
    },
    evaluation: {
      spreadAccepted: true,
      confirmsSignal:
        (signalSide === "BUY" && directionalBias === "bullish") ||
        (signalSide === "SELL" && directionalBias === "bearish"),
      signalSide,
      reason: "Synthetic backtest order book derived from candle position."
    }
  };
}

function sliceCandlesUpToTime(candles, timestamp) {
  return candles.filter((candle) => Number(candle.closeTime) <= Number(timestamp));
}

function getSignalCandidate(indicatorSnapshot, signalTimeframe = "15m") {
  const direction = indicatorSnapshot.multiTimeframe.direction;
  const rsi = indicatorSnapshot[signalTimeframe]?.rsi14;

  if (direction === "BUY" && rsi < 35) {
    return "BUY";
  }

  if (direction === "SELL" && rsi > 65) {
    return "SELL";
  }

  return null;
}

function calculateMaxDrawdown(capitalCurve = []) {
  let peak = capitalCurve[0]?.capital || 0;
  let maxDrawdown = 0;

  capitalCurve.forEach((point) => {
    peak = Math.max(peak, point.capital);

    if (peak > 0) {
      const drawdown = ((peak - point.capital) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  });

  return maxDrawdown;
}

function findLimitOrderFill(signalCandles, signalIndex, limitPrice) {
  for (let lookahead = 1; lookahead <= LIMIT_FILL_WINDOW_CANDLES; lookahead += 1) {
    const fillIndex = signalIndex + lookahead;
    const fillCandle = signalCandles[fillIndex];

    if (!fillCandle) {
      break;
    }

    if (Number(fillCandle.low) <= Number(limitPrice)) {
      return {
        fillIndex,
        fillCandle
      };
    }
  }

  return null;
}

function buildBacktestEntryPlan({ score, currentCandle, signalCandles, signalIndex }) {
  const totalScore = Number(score?.totalScore || 0);

  if (totalScore >= MARKET_EXECUTION_SCORE) {
    return {
      orderType: "MARKET",
      entryPrice: Number(currentCandle.close),
      fillIndex: signalIndex,
      fillCandle: currentCandle
    };
  }

  if (totalScore >= LIMIT_EXECUTION_MIN_SCORE && totalScore <= LIMIT_EXECUTION_MAX_SCORE) {
    const limitPrice = Number(currentCandle.close) * LIMIT_ENTRY_DISCOUNT;
    const limitFill = findLimitOrderFill(signalCandles, signalIndex, limitPrice);

    if (!limitFill) {
      return null;
    }

    return {
      orderType: "LIMIT",
      entryPrice: limitPrice,
      fillIndex: limitFill.fillIndex,
      fillCandle: limitFill.fillCandle
    };
  }

  return null;
}

function closeOpenPosition(position, exitPrice, timestamp, capitalState, compoundRatio) {
  const result = riskManager.calculateTradeResult({
    side: "BUY",
    entryPrice: position.entryPrice,
    exitPrice,
    quantity: position.quantity
  });
  const capitalUpdate = riskManager.applyCompoundProfit({
    currentCapital: capitalState.capital,
    currentRealizedProfit: capitalState.realizedProfit,
    tradePnl: result.pnl,
    compoundRatio
  });

  return {
    closedTrade: {
      pair: position.pair,
      side: "BUY",
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      exitPrice,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      openedAt: position.openedAt,
      closedAt: new Date(timestamp).toISOString(),
      resultPnl: result.pnl,
      resultPercent: result.resultPercent,
      score: position.score
    },
    nextCapitalState: {
      capital: capitalUpdate.newCapital,
      realizedProfit: capitalUpdate.newRealizedProfit
    }
  };
}

function buildCancelledPendingEntry(position, timestamp) {
  return {
    pair: position.pair,
    side: "BUY",
    quantity: position.quantity,
    entryPrice: position.entryPrice,
    exitPrice: null,
    stopLoss: position.stopLoss,
    takeProfit: position.takeProfit,
    openedAt: position.openedAt,
    closedAt: new Date(timestamp).toISOString(),
    resultPnl: 0,
    resultPercent: 0,
    status: "limit_cancelled_by_sell_signal",
    score: position.score,
    orderType: position.orderType
  };
}

function activatePendingEntries(pendingEntries, openPositions, currentIndex, maxOpenTrades) {
  const nextPendingEntries = [];
  const activatedPositions = [];

  pendingEntries.forEach((pendingEntry) => {
    if (pendingEntry.fillIndex <= currentIndex) {
      if (openPositions.length + activatedPositions.length < maxOpenTrades) {
        activatedPositions.push(pendingEntry.position);
      }

      return;
    }

    nextPendingEntries.push(pendingEntry);
  });

  return {
    activatedPositions,
    nextPendingEntries
  };
}

function calculateCommittedCapital(openPositions = []) {
  return openPositions.reduce(
    (sum, position) => sum + Number(position.entryPrice || 0) * Number(position.quantity || 0),
    0
  );
}

function calculatePendingCapital(pendingEntries = [], capitalState, riskPerTrade) {
  return pendingEntries.length * (Number(capitalState.capital || 0) * Number(riskPerTrade || 0));
}

async function runBacktest({
  pair = "BTCUSDT",
  dateFrom,
  dateTo,
  timeframe = "15m",
  startingCapital = Number(process.env.INITIAL_CAPITAL || 100),
  scoreThreshold = Number(process.env.SCORE_THRESHOLD || DEFAULT_SCORE_THRESHOLD),
  compoundRatio = Number(process.env.COMPOUND_RATIO || 0.5),
  maxOpenTrades = Number(process.env.MAX_OPEN_TRADES || 3),
  maxOpenTradesPerPair = Number(process.env.MAX_OPEN_TRADES_PER_PAIR || DEFAULT_MAX_OPEN_TRADES_PER_PAIR),
  pairCooldownMinutes = Number(process.env.PAIR_COOLDOWN_MINUTES || DEFAULT_PAIR_COOLDOWN_MINUTES)
} = {}) {
  if (!dateFrom || !dateTo) {
    throw new Error("Backtest requires dateFrom and dateTo.");
  }

  const startTime = new Date(dateFrom).getTime();
  const endTime = new Date(dateTo).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || startTime >= endTime) {
    throw new Error("Invalid backtest date range.");
  }

  const signalTimeframe = timeframe;
  const [candles5m, signalCandles, candles1h, candles4h] = await Promise.all([
    binanceService.getAllCandles(pair, "5m", { startTime, endTime }),
    binanceService.getAllCandles(pair, signalTimeframe, { startTime, endTime }),
    binanceService.getAllCandles(pair, "1h", { startTime, endTime }),
    binanceService.getAllCandles(pair, "4h", { startTime, endTime })
  ]);

  let capitalState = {
    capital: startingCapital,
    realizedProfit: 0
  };
  let openPositions = [];
  let pendingEntries = [];
  let lastClosedAt = null;
  const trades = [];
  const capitalCurve = [];

  for (let index = 200; index < signalCandles.length; index += 1) {
    const currentCandle = signalCandles[index];
    const closeTimestamp = currentCandle.closeTime;
    const pendingActivation = activatePendingEntries(pendingEntries, openPositions, index, maxOpenTrades);
    openPositions = [...openPositions, ...pendingActivation.activatedPositions];
    pendingEntries = pendingActivation.nextPendingEntries;

    const candlesByTimeframe = {
      "5m": sliceCandlesUpToTime(candles5m, closeTimestamp),
      [signalTimeframe]: signalCandles.slice(0, index + 1),
      "1h": sliceCandlesUpToTime(candles1h, closeTimestamp),
      "4h": sliceCandlesUpToTime(candles4h, closeTimestamp)
    };

    if (
      candlesByTimeframe["5m"].length < 50 ||
      candlesByTimeframe[signalTimeframe].length < 200 ||
      candlesByTimeframe["1h"].length < 200 ||
      candlesByTimeframe["4h"].length < 200
    ) {
      continue;
    }

    const remainingPositions = [];

    openPositions.forEach((position) => {
      const stopHit = Number(currentCandle.low) <= Number(position.stopLoss);
      const takeProfitHit = Number(currentCandle.high) >= Number(position.takeProfit);

      if (stopHit || takeProfitHit) {
        const exitPrice = stopHit ? position.stopLoss : position.takeProfit;
        const closure = closeOpenPosition(
          position,
          exitPrice,
          closeTimestamp,
          capitalState,
          compoundRatio
        );

        trades.push(closure.closedTrade);
        capitalState = closure.nextCapitalState;
        lastClosedAt = new Date(closeTimestamp);
        return;
      }

      remainingPositions.push(position);
    });

    openPositions = remainingPositions;

    const indicatorSnapshot = indicatorsService.buildIndicatorSnapshot(candlesByTimeframe);
    const signalSide = getSignalCandidate(indicatorSnapshot, signalTimeframe);

    if (!signalSide) {
      capitalCurve.push({
        timestamp: new Date(closeTimestamp).toISOString(),
        capital: capitalState.capital + capitalState.realizedProfit
      });
      continue;
    }

    const sentimentSnapshot = buildBacktestSentimentSnapshot(signalSide);
    const patternSnapshot = candlePatternsService.getPatternConfirmation(candlesByTimeframe[signalTimeframe], signalSide);
    const orderBookSnapshot = buildBacktestOrderBookSnapshot(signalSide, candlesByTimeframe[signalTimeframe]);
    const score = scorerService.computeScoreBreakdown({
      signalSide,
      indicatorSnapshot,
      sentimentSnapshot,
      patternSnapshot,
      orderBookSnapshot,
      signalTimeframe,
      executionThreshold: scoreThreshold
    });
    const marketState = indicatorSnapshot[signalTimeframe]?.marketState;
    const cooldownActive =
      lastClosedAt &&
      pairCooldownMinutes > 0 &&
      (new Date(closeTimestamp).getTime() - lastClosedAt.getTime()) < pairCooldownMinutes * 60 * 1000;

    if (signalSide === "SELL" && openPositions.length > 0) {
      openPositions.forEach((position) => {
        const closure = closeOpenPosition(
          position,
          Number(currentCandle.close),
          closeTimestamp,
          capitalState,
          compoundRatio
        );

        trades.push(closure.closedTrade);
        capitalState = closure.nextCapitalState;
        lastClosedAt = new Date(closeTimestamp);
      });

      openPositions = [];
      pendingEntries.forEach((pendingEntry) => {
        trades.push(buildCancelledPendingEntry(pendingEntry.position, closeTimestamp));
      });
      pendingEntries = [];
    } else if (signalSide === "SELL" && pendingEntries.length > 0) {
      pendingEntries.forEach((pendingEntry) => {
        trades.push(buildCancelledPendingEntry(pendingEntry.position, closeTimestamp));
      });
      pendingEntries = [];
    } else if (
      signalSide === "BUY" &&
      score.totalScore >= scoreThreshold &&
      !(marketState?.isSideways) &&
      !cooldownActive &&
      openPositions.length < Math.min(maxOpenTrades, maxOpenTradesPerPair) &&
      openPositions.length + pendingEntries.length < Math.min(maxOpenTrades, maxOpenTradesPerPair)
    ) {
      const atr = indicatorSnapshot[signalTimeframe].atr14;
      const riskPerTrade = Number(process.env.RISK_PER_TRADE || 0.01);
      const committedCapital = calculateCommittedCapital(openPositions);
      const pendingCapital = calculatePendingCapital(pendingEntries, capitalState, riskPerTrade);
      const availableCapital = Math.max(0, Number(capitalState.capital || 0) - committedCapital - pendingCapital);

      if (availableCapital <= 0) {
        capitalCurve.push({
          timestamp: new Date(closeTimestamp).toISOString(),
          capital: capitalState.capital + capitalState.realizedProfit
        });
        continue;
      }

      const entryPlan = buildBacktestEntryPlan({
        score,
        currentCandle,
        signalCandles,
        signalIndex: index
      });

      if (!entryPlan) {
        capitalCurve.push({
          timestamp: new Date(closeTimestamp).toISOString(),
          capital: capitalState.capital + capitalState.realizedProfit
        });
        continue;
      }

      const entryPrice = entryPlan.entryPrice;
      const positionSizing = riskManager.calculatePositionSize({
        capital: availableCapital,
        entryPrice,
        atr,
        riskPerTrade
      });

      if (positionSizing.quantity > 0) {
        const exits = riskManager.calculateExitLevels({
          side: "BUY",
          entryPrice,
          atr
        });

        const nextPosition = {
          pair,
          quantity: positionSizing.quantity,
          entryPrice,
          stopLoss: exits.stopLoss,
          takeProfit: exits.takeProfit,
          openedAt: new Date(entryPlan.fillCandle.closeTime).toISOString(),
          score,
          orderType: entryPlan.orderType
        };

        if (entryPlan.orderType === "LIMIT" && entryPlan.fillIndex > index) {
          pendingEntries.push({
            fillIndex: entryPlan.fillIndex,
            position: nextPosition
          });
        } else {
          openPositions.push(nextPosition);
        }
      }
    }

    capitalCurve.push({
      timestamp: new Date(closeTimestamp).toISOString(),
      capital: capitalState.capital + capitalState.realizedProfit
    });
  }

  if (openPositions.length > 0) {
    const lastCandle = signalCandles[signalCandles.length - 1];

    openPositions.forEach((position) => {
      const closure = closeOpenPosition(
        position,
        Number(lastCandle.close),
        lastCandle.closeTime,
        capitalState,
        compoundRatio
      );
      trades.push(closure.closedTrade);
      capitalState = closure.nextCapitalState;
    });
  }

  const endingValue = capitalState.capital + capitalState.realizedProfit;
  const totalReturnPercent = startingCapital === 0 ? 0 : ((endingValue - startingCapital) / startingCapital) * 100;
  const winningTrades = trades.filter((trade) => trade.resultPnl > 0);

  return {
    pair,
    timeframe,
    dateFrom,
    dateTo,
    totalReturnPercent,
    winRate: trades.length === 0 ? 0 : (winningTrades.length / trades.length) * 100,
    maxDrawdown: calculateMaxDrawdown(capitalCurve),
    tradeCount: trades.length,
    trades,
    capitalCurve,
    assumptions: {
      sentiment: "neutral",
      orderBook: "synthetic_from_candles",
      spotMode: true
    }
  };
}

module.exports = {
  runBacktest
};
