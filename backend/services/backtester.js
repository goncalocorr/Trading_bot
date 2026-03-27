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
const StrategyRegistry = require("./strategyregistry");

const MARKET_EXECUTION_SCORE = 9;
const LIMIT_EXECUTION_MIN_SCORE = 7;
const LIMIT_EXECUTION_MAX_SCORE = 8;
const LIMIT_ENTRY_DISCOUNT = 0.9995;
const LIMIT_FILL_WINDOW_CANDLES = 5;
const DEFAULT_SCORE_THRESHOLD = 8;
const DEFAULT_MAX_OPEN_TRADES_PER_PAIR = 1;
const DEFAULT_PAIR_COOLDOWN_MINUTES = 30;
const DEFAULT_FEE_RATE = 0.001;
const DEFAULT_SLIPPAGE_BPS = 5;
const DEFAULT_WALK_FORWARD_TRAIN_DAYS = 30;
const DEFAULT_WALK_FORWARD_TEST_DAYS = 7;
const DEFAULT_WALK_FORWARD_STEP_DAYS = 7;
const strategyRegistry = new StrategyRegistry();

function toIsoDate(value) {
  return new Date(value).toISOString();
}

function toNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function addDays(timestamp, days) {
  return timestamp + days * 24 * 60 * 60 * 1000;
}

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

function applyExecutionPrice({
  price,
  side = "BUY",
  orderType = "MARKET",
  role = "entry",
  slippageBps = DEFAULT_SLIPPAGE_BPS
}) {
  const numericPrice = toNumber(price);

  if (!numericPrice) {
    return numericPrice;
  }

  if (String(orderType).toUpperCase() === "LIMIT" && role === "entry") {
    return numericPrice;
  }

  const slippageFraction = toNumber(slippageBps) / 10000;

  if (slippageFraction <= 0) {
    return numericPrice;
  }

  if (role === "entry" && String(side).toUpperCase() === "BUY") {
    return numericPrice * (1 + slippageFraction);
  }

  if (role === "exit" && String(side).toUpperCase() === "SELL") {
    return numericPrice * (1 - slippageFraction);
  }

  return numericPrice;
}

function calculateFees({ entryPrice, exitPrice, quantity, feeRate }) {
  const normalizedFeeRate = toNumber(feeRate);

  if (normalizedFeeRate <= 0) {
    return 0;
  }

  const entryNotional = toNumber(entryPrice) * toNumber(quantity);
  const exitNotional = toNumber(exitPrice) * toNumber(quantity);
  return (entryNotional + exitNotional) * normalizedFeeRate;
}

function closeOpenPosition(position, exitPrice, timestamp, capitalState, compoundRatio, feeRate) {
  const effectiveExitPrice = applyExecutionPrice({
    price: exitPrice,
    side: "SELL",
    orderType: "MARKET",
    role: "exit",
    slippageBps: position.slippageBps
  });
  const result = riskManager.calculateTradeResult({
    side: "BUY",
    entryPrice: position.entryPrice,
    exitPrice: effectiveExitPrice,
    quantity: position.quantity
  });
  const feesPaid = calculateFees({
    entryPrice: position.entryPrice,
    exitPrice: effectiveExitPrice,
    quantity: position.quantity,
    feeRate
  });
  const netPnl = result.pnl - feesPaid;
  const capitalUpdate = riskManager.applyCompoundProfit({
    currentCapital: capitalState.capital,
    currentRealizedProfit: capitalState.realizedProfit,
    tradePnl: netPnl,
    compoundRatio
  });

  return {
    closedTrade: {
      pair: position.pair,
      side: "BUY",
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      exitPrice: effectiveExitPrice,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      openedAt: position.openedAt,
      closedAt: new Date(timestamp).toISOString(),
      resultPnl: netPnl,
      grossPnl: result.pnl,
      feesPaid,
      resultPercent: result.entryNotional === 0 ? 0 : (netPnl / result.entryNotional) * 100,
      score: position.score,
      orderType: position.orderType,
      strategyId: position.strategyId || "backtest_core",
      marketRegime: position.marketRegime || "unknown",
      slippageBps: position.slippageBps
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
    orderType: position.orderType,
    strategyId: position.strategyId || "backtest_core",
    marketRegime: position.marketRegime || "unknown"
  };
}

function summarizeTrades(trades = []) {
  const winningTrades = trades.filter((trade) => Number(trade.resultPnl || 0) > 0);

  return {
    tradeCount: trades.length,
    winRate: trades.length === 0 ? 0 : (winningTrades.length / trades.length) * 100,
    totalReturnPercent: 0,
    maxDrawdown: 0
  };
}

function rankStrategiesByPeriod(trades = []) {
  const periods = [
    { id: "7d", days: 7, label: "Last 7d" },
    { id: "30d", days: 30, label: "Last 30d" },
    { id: "all", days: null, label: "All" }
  ];
  const now = trades.reduce((latest, trade) => {
    const candidate = new Date(trade.closedAt || trade.openedAt || Date.now()).getTime();
    return Math.max(latest, candidate);
  }, Date.now());

  return periods.map((period) => {
    const filteredTrades = period.days === null
      ? trades
      : trades.filter((trade) => {
          const tradeTime = new Date(trade.closedAt || trade.openedAt || 0).getTime();
          return tradeTime >= addDays(now, -period.days);
        });

    const rankingMap = new Map();

    filteredTrades.forEach((trade) => {
      const strategyId = trade.strategyId || "backtest_core";
      const bucket = rankingMap.get(strategyId) || {
        strategyId,
        totalTrades: 0,
        wins: 0,
        pnlTotal: 0
      };
      const pnl = toNumber(trade.resultPnl);

      bucket.totalTrades += 1;
      bucket.pnlTotal += pnl;

      if (pnl > 0) {
        bucket.wins += 1;
      }

      rankingMap.set(strategyId, bucket);
    });

    return {
      periodId: period.id,
      periodLabel: period.label,
      ranking: [...rankingMap.values()]
        .map((item) => ({
          strategyId: item.strategyId,
          totalTrades: item.totalTrades,
          winRate: item.totalTrades === 0 ? 0 : (item.wins / item.totalTrades) * 100,
          avgPnl: item.totalTrades === 0 ? 0 : item.pnlTotal / item.totalTrades,
          pnlTotal: item.pnlTotal
        }))
        .sort((left, right) => {
          if (Number(right.pnlTotal || 0) !== Number(left.pnlTotal || 0)) {
            return Number(right.pnlTotal || 0) - Number(left.pnlTotal || 0);
          }

          return Number(right.winRate || 0) - Number(left.winRate || 0);
        })
    };
  });
}

function getRegimeId(indicatorSnapshot = {}, signalTimeframe = "15m") {
  const marketState = indicatorSnapshot[signalTimeframe]?.marketState;

  if (marketState?.isSideways) {
    return "sideways";
  }

  if (toNumber(marketState?.atrPercent) >= Math.max(toNumber(marketState?.minAtrPercent) * 2, 0.8)) {
    return "volatile";
  }

  if (indicatorSnapshot.multiTimeframe?.aligned) {
    return "trend";
  }

  return "mixed";
}

async function collectStrategyCandidates({
  pair,
  candlesByTimeframe,
  signalTimeframe,
  scoreThreshold,
  activeStrategies
}) {
  const candidates = [];

  for (const strategy of activeStrategies) {
    // eslint-disable-next-line no-await-in-loop
    const strategySignals = await strategy.scan({
      pair,
      candlesByTimeframe,
      indicatorsService
    });

    for (const signal of strategySignals) {
      const indicatorSnapshot = indicatorsService.buildIndicatorSnapshot(signal.candlesByTimeframe || candlesByTimeframe);
      const sentimentSnapshot = buildBacktestSentimentSnapshot(signal.side);
      const patternSnapshot = candlePatternsService.getPatternConfirmation(
        (signal.candlesByTimeframe || candlesByTimeframe)[signalTimeframe],
        signal.side
      );
      const orderBookSnapshot = buildBacktestOrderBookSnapshot(
        signal.side,
        (signal.candlesByTimeframe || candlesByTimeframe)[signalTimeframe]
      );
      const score = scorerService.computeScoreBreakdown({
        signalSide: signal.side,
        indicatorSnapshot,
        sentimentSnapshot,
        patternSnapshot,
        orderBookSnapshot,
        signalTimeframe,
        executionThreshold: scoreThreshold,
        strategyId: signal.metadata?.strategyId || strategy.id || ""
      });

      candidates.push({
        pair: signal.pair,
        side: signal.side,
        metadata: signal.metadata || {},
        strategyId: signal.metadata?.strategyId || strategy.id,
        strategyDescription: strategy.description,
        score,
        indicatorSnapshot,
        marketState: indicatorSnapshot[signalTimeframe]?.marketState,
        regimeId: getRegimeId(indicatorSnapshot, signalTimeframe)
      });
    }
  }

  return candidates.sort((left, right) => {
    if (Number(right.score?.totalScore || 0) !== Number(left.score?.totalScore || 0)) {
      return Number(right.score?.totalScore || 0) - Number(left.score?.totalScore || 0);
    }

    const rightMarket = Number(right.score?.executionMode === "MARKET");
    const leftMarket = Number(left.score?.executionMode === "MARKET");
    return rightMarket - leftMarket;
  });
}

async function simulateBacktestRange({
  pair = "BTCUSDT",
  dateFrom,
  dateTo,
  timeframe = "15m",
  activeStrategies,
  startingCapital = Number(process.env.INITIAL_CAPITAL || 100),
  scoreThreshold = Number(process.env.SCORE_THRESHOLD || DEFAULT_SCORE_THRESHOLD),
  compoundRatio = Number(process.env.COMPOUND_RATIO || 0.5),
  maxOpenTrades = Number(process.env.MAX_OPEN_TRADES || 3),
  maxOpenTradesPerPair = Number(process.env.MAX_OPEN_TRADES_PER_PAIR || DEFAULT_MAX_OPEN_TRADES_PER_PAIR),
  pairCooldownMinutes = Number(process.env.PAIR_COOLDOWN_MINUTES || DEFAULT_PAIR_COOLDOWN_MINUTES),
  feeRate = Number(process.env.BACKTEST_FEE_RATE || DEFAULT_FEE_RATE),
  slippageBps = Number(process.env.BACKTEST_SLIPPAGE_BPS || DEFAULT_SLIPPAGE_BPS)
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
  const strategies = strategyRegistry.getStrategies(activeStrategies);
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
          compoundRatio,
          feeRate
        );

        trades.push(closure.closedTrade);
        capitalState = closure.nextCapitalState;
        lastClosedAt = new Date(closeTimestamp);
        return;
      }

      remainingPositions.push(position);
    });

    openPositions = remainingPositions;
    // eslint-disable-next-line no-await-in-loop
    const strategyCandidates = await collectStrategyCandidates({
      pair,
      candlesByTimeframe,
      signalTimeframe,
      scoreThreshold,
      activeStrategies: strategies
    });
    const sellCandidates = strategyCandidates.filter((candidate) => candidate.side === "SELL");
    const buyCandidates = strategyCandidates.filter((candidate) => candidate.side === "BUY");
    const bestSellCandidate = sellCandidates[0] || null;
    const bestBuyCandidate = buyCandidates[0] || null;

    if (!bestSellCandidate && !bestBuyCandidate) {
      capitalCurve.push({
        timestamp: new Date(closeTimestamp).toISOString(),
        capital: capitalState.capital + capitalState.realizedProfit
      });
      continue;
    }
    const selectedCandidate = bestSellCandidate || bestBuyCandidate;
    const marketState = selectedCandidate?.marketState;
    const cooldownActive =
      lastClosedAt &&
      pairCooldownMinutes > 0 &&
      (new Date(closeTimestamp).getTime() - lastClosedAt.getTime()) < pairCooldownMinutes * 60 * 1000;

    if (bestSellCandidate && openPositions.length > 0) {
      openPositions.forEach((position) => {
        const closure = closeOpenPosition(
          position,
          Number(currentCandle.close),
          closeTimestamp,
          capitalState,
          compoundRatio,
          feeRate
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
    } else if (bestSellCandidate && pendingEntries.length > 0) {
      pendingEntries.forEach((pendingEntry) => {
        trades.push(buildCancelledPendingEntry(pendingEntry.position, closeTimestamp));
      });
      pendingEntries = [];
    } else if (
      bestBuyCandidate &&
      bestBuyCandidate.score.totalScore >= scoreThreshold &&
      (!(marketState?.isSideways) || bestBuyCandidate.strategyId === "mean_reversion") &&
      !cooldownActive &&
      openPositions.length < Math.min(maxOpenTrades, maxOpenTradesPerPair) &&
      openPositions.length + pendingEntries.length < Math.min(maxOpenTrades, maxOpenTradesPerPair)
    ) {
      const atr = bestBuyCandidate.indicatorSnapshot[signalTimeframe].atr14;
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
        score: bestBuyCandidate.score,
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

      const entryPrice = applyExecutionPrice({
        price: entryPlan.entryPrice,
        side: "BUY",
        orderType: entryPlan.orderType,
        role: "entry",
        slippageBps
      });
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
          score: bestBuyCandidate.score,
          orderType: entryPlan.orderType,
          strategyId: bestBuyCandidate.strategyId || "backtest_core",
          strategyDescription: bestBuyCandidate.strategyDescription || null,
          signalMetadata: bestBuyCandidate.metadata || {},
          marketRegime: bestBuyCandidate.regimeId,
          slippageBps
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
        compoundRatio,
        feeRate
      );
      trades.push(closure.closedTrade);
      capitalState = closure.nextCapitalState;
    });
  }

  const endingValue = capitalState.capital + capitalState.realizedProfit;
  const totalReturnPercent = startingCapital === 0 ? 0 : ((endingValue - startingCapital) / startingCapital) * 100;
  const winningTrades = trades.filter((trade) => trade.resultPnl > 0);
  const totalFeesPaid = trades.reduce((sum, trade) => sum + toNumber(trade.feesPaid), 0);

  return {
    pair,
    timeframe,
    dateFrom,
    dateTo,
    startingCapital,
    endingCapital: endingValue,
    totalReturnPercent,
    winRate: trades.length === 0 ? 0 : (winningTrades.length / trades.length) * 100,
    maxDrawdown: calculateMaxDrawdown(capitalCurve),
    tradeCount: trades.length,
    totalFeesPaid,
    trades,
    capitalCurve,
    strategyRankingByPeriod: rankStrategiesByPeriod(trades),
    assumptions: {
      sentiment: "neutral",
      orderBook: "synthetic_from_candles",
      spotMode: true,
      feeRate,
      slippageBps
    }
  };
}

async function runWalkForwardBacktest({
  pair = "BTCUSDT",
  dateFrom,
  dateTo,
  timeframe = "15m",
  activeStrategies,
  startingCapital = Number(process.env.INITIAL_CAPITAL || 100),
  scoreThreshold = Number(process.env.SCORE_THRESHOLD || DEFAULT_SCORE_THRESHOLD),
  compoundRatio = Number(process.env.COMPOUND_RATIO || 0.5),
  maxOpenTrades = Number(process.env.MAX_OPEN_TRADES || 3),
  maxOpenTradesPerPair = Number(process.env.MAX_OPEN_TRADES_PER_PAIR || DEFAULT_MAX_OPEN_TRADES_PER_PAIR),
  pairCooldownMinutes = Number(process.env.PAIR_COOLDOWN_MINUTES || DEFAULT_PAIR_COOLDOWN_MINUTES),
  feeRate = Number(process.env.BACKTEST_FEE_RATE || DEFAULT_FEE_RATE),
  slippageBps = Number(process.env.BACKTEST_SLIPPAGE_BPS || DEFAULT_SLIPPAGE_BPS),
  walkForwardTrainDays = Number(process.env.WALK_FORWARD_TRAIN_DAYS || DEFAULT_WALK_FORWARD_TRAIN_DAYS),
  walkForwardTestDays = Number(process.env.WALK_FORWARD_TEST_DAYS || DEFAULT_WALK_FORWARD_TEST_DAYS),
  walkForwardStepDays = Number(process.env.WALK_FORWARD_STEP_DAYS || DEFAULT_WALK_FORWARD_STEP_DAYS)
} = {}) {
  const startTime = new Date(dateFrom).getTime();
  const endTime = new Date(dateTo).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || startTime >= endTime) {
    throw new Error("Invalid walk-forward date range.");
  }

  let rollingCapital = startingCapital;
  let cursor = startTime;
  const windows = [];
  let combinedTrades = [];
  let combinedCapitalCurve = [];

  while (cursor < endTime) {
    const trainStart = cursor;
    const trainEnd = Math.min(addDays(trainStart, walkForwardTrainDays), endTime);
    const testStart = trainEnd;
    const testEnd = Math.min(addDays(testStart, walkForwardTestDays), endTime);

    if (testStart >= endTime || testStart >= testEnd) {
      break;
    }

    // eslint-disable-next-line no-await-in-loop
    const inSample = await simulateBacktestRange({
      pair,
      timeframe,
      dateFrom: toIsoDate(trainStart),
      dateTo: toIsoDate(trainEnd),
      activeStrategies,
      startingCapital,
      scoreThreshold,
      compoundRatio,
      maxOpenTrades,
      maxOpenTradesPerPair,
      pairCooldownMinutes,
      feeRate,
      slippageBps
    });

    // eslint-disable-next-line no-await-in-loop
    const outOfSample = await simulateBacktestRange({
      pair,
      timeframe,
      dateFrom: toIsoDate(testStart),
      dateTo: toIsoDate(testEnd),
      activeStrategies,
      startingCapital: rollingCapital,
      scoreThreshold,
      compoundRatio,
      maxOpenTrades,
      maxOpenTradesPerPair,
      pairCooldownMinutes,
      feeRate,
      slippageBps
    });

    rollingCapital = outOfSample.endingCapital;
    combinedTrades = [...combinedTrades, ...outOfSample.trades];
    combinedCapitalCurve = [...combinedCapitalCurve, ...outOfSample.capitalCurve];

    windows.push({
      index: windows.length + 1,
      trainPeriod: {
        start: toIsoDate(trainStart),
        end: toIsoDate(trainEnd)
      },
      testPeriod: {
        start: toIsoDate(testStart),
        end: toIsoDate(testEnd)
      },
      inSample: {
        totalReturnPercent: inSample.totalReturnPercent,
        winRate: inSample.winRate,
        maxDrawdown: inSample.maxDrawdown,
        tradeCount: inSample.tradeCount
      },
      outOfSample: {
        totalReturnPercent: outOfSample.totalReturnPercent,
        winRate: outOfSample.winRate,
        maxDrawdown: outOfSample.maxDrawdown,
        tradeCount: outOfSample.tradeCount,
        startingCapital: outOfSample.startingCapital,
        endingCapital: outOfSample.endingCapital
      }
    });

    cursor = addDays(cursor, walkForwardStepDays);
  }

  const winningTrades = combinedTrades.filter((trade) => toNumber(trade.resultPnl) > 0);
  const maxDrawdown = calculateMaxDrawdown(combinedCapitalCurve);
  const totalReturnPercent =
    startingCapital === 0 ? 0 : ((rollingCapital - startingCapital) / startingCapital) * 100;
  const strategyRankingByPeriod = rankStrategiesByPeriod(combinedTrades);

  return {
    pair,
    timeframe,
    dateFrom,
    dateTo,
    mode: "walk_forward",
    startingCapital,
    endingCapital: rollingCapital,
    totalReturnPercent,
    winRate: combinedTrades.length === 0 ? 0 : (winningTrades.length / combinedTrades.length) * 100,
    maxDrawdown,
    tradeCount: combinedTrades.length,
    trades: combinedTrades,
    capitalCurve: combinedCapitalCurve,
    walkForward: {
      trainDays: walkForwardTrainDays,
      testDays: walkForwardTestDays,
      stepDays: walkForwardStepDays,
      windowCount: windows.length,
      windows
    },
    strategyRankingByPeriod,
    assumptions: {
      sentiment: "neutral",
      orderBook: "synthetic_from_candles",
      spotMode: true,
      feeRate,
      slippageBps,
      activeStrategies: strategyRegistry.getStrategies(activeStrategies).map((strategy) => strategy.id)
    }
  };
}

async function runBacktest({
  mode = "standard",
  ...options
} = {}) {
  if (String(mode).toLowerCase() === "walk_forward") {
    return runWalkForwardBacktest(options);
  }

  return simulateBacktestRange(options);
}

module.exports = {
  runBacktest,
  runWalkForwardBacktest
};
