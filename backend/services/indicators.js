function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function ensureMinimumLength(values, period, indicatorName) {
  if (!Array.isArray(values) || values.length < period) {
    throw new Error(`${indicatorName} requires at least ${period} data points.`);
  }
}

function getClosingPrices(candles = []) {
  return candles.map((candle) => toNumber(candle.close));
}

function getVolumes(candles = []) {
  return candles.map((candle) => toNumber(candle.volume));
}

function getIndicatorConfig() {
  return {
    minAtrPercent: Number(process.env.MIN_ATR_PERCENT || 0.25),
    emaCompressionThresholdPercent: Number(process.env.EMA_COMPRESSION_THRESHOLD_PERCENT || 0.15)
  };
}

function calculateSMA(values, period) {
  ensureMinimumLength(values, period, "SMA");

  const window = values.slice(-period).map(toNumber);
  const sum = window.reduce((total, value) => total + value, 0);

  return sum / period;
}

function calculateEMA(values, period) {
  ensureMinimumLength(values, period, "EMA");

  const numericValues = values.map(toNumber);
  const multiplier = 2 / (period + 1);
  let ema = numericValues.slice(0, period).reduce((total, value) => total + value, 0) / period;

  for (let index = period; index < numericValues.length; index += 1) {
    ema = (numericValues[index] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateRSI(values, period = 14) {
  ensureMinimumLength(values, period + 1, "RSI");

  const numericValues = values.map(toNumber);
  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = numericValues[index] - numericValues[index - 1];

    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let index = period + 1; index < numericValues.length; index += 1) {
    const change = numericValues[index] - numericValues[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function calculateTrueRanges(candles = []) {
  if (!Array.isArray(candles) || candles.length < 2) {
    throw new Error("ATR requires at least 2 candles.");
  }

  const trueRanges = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];

    const high = toNumber(current.high);
    const low = toNumber(current.low);
    const previousClose = toNumber(previous.close);

    const intradayRange = high - low;
    const highGap = Math.abs(high - previousClose);
    const lowGap = Math.abs(low - previousClose);

    trueRanges.push(Math.max(intradayRange, highGap, lowGap));
  }

  return trueRanges;
}

function calculateATR(candles, period = 14) {
  const trueRanges = calculateTrueRanges(candles);
  ensureMinimumLength(trueRanges, period, "ATR");

  let atr = trueRanges.slice(0, period).reduce((total, value) => total + value, 0) / period;

  for (let index = period; index < trueRanges.length; index += 1) {
    atr = (atr * (period - 1) + trueRanges[index]) / period;
  }

  return atr;
}

function calculateVolumeAverage(candles, period = 20) {
  const volumes = getVolumes(candles);
  return calculateSMA(volumes, period);
}

function isVolumeAboveAverage(candles, period = 20) {
  ensureMinimumLength(candles, period, "Volume average");

  const averageVolume = calculateVolumeAverage(candles, period);
  const latestVolume = toNumber(candles[candles.length - 1].volume);

  return {
    averageVolume,
    latestVolume,
    isAboveAverage: latestVolume > averageVolume
  };
}

function getPriceVsLevel(price, level) {
  return {
    price: toNumber(price),
    level: toNumber(level),
    isAbove: toNumber(price) > toNumber(level),
    distancePercent: toNumber(level) === 0 ? 0 : ((toNumber(price) - toNumber(level)) / toNumber(level)) * 100
  };
}

function analyzeTrend(candles) {
  const closes = getClosingPrices(candles);
  const latestClose = closes[closes.length - 1];
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);

  const goldenCross = ema9 > ema21 && ema21 > ema50;
  const deathCross = ema9 < ema21 && ema21 < ema50;
  const priceAboveEma200 = latestClose > ema200;
  const priceAboveSma200 = latestClose > sma200;
  const bias = goldenCross && priceAboveEma200 ? "bullish" : deathCross && !priceAboveEma200 ? "bearish" : "neutral";

  return {
    close: latestClose,
    ema9,
    ema21,
    ema50,
    ema200,
    sma50,
    sma200,
    goldenCross,
    deathCross,
    priceAboveEma200,
    priceAboveSma200,
    bias
  };
}

function analyzeMarketState(trend = {}, atr = 0) {
  const { minAtrPercent, emaCompressionThresholdPercent } = getIndicatorConfig();
  const close = toNumber(trend.close);
  const atrPercent = close === 0 ? 0 : (toNumber(atr) / close) * 100;
  const emaDistances = [
    Math.abs(toNumber(trend.ema9) - toNumber(trend.ema21)),
    Math.abs(toNumber(trend.ema21) - toNumber(trend.ema50)),
    Math.abs(toNumber(trend.ema9) - toNumber(trend.ema50))
  ];
  const maxEmaDistance = Math.max(...emaDistances, 0);
  const emaCompressionPercent = close === 0 ? 0 : (maxEmaDistance / close) * 100;
  const isLowVolatility = atrPercent < minAtrPercent;
  const isCompressed = emaCompressionPercent < emaCompressionThresholdPercent;
  const isSideways = isLowVolatility || isCompressed;

  let reason = "Volatility and EMA spacing look healthy.";

  if (isLowVolatility && isCompressed) {
    reason = "ATR is low and EMAs are tightly compressed, suggesting sideways conditions.";
  } else if (isLowVolatility) {
    reason = "ATR is too low for a fast, high-quality entry.";
  } else if (isCompressed) {
    reason = "EMAs are too compressed, suggesting a choppy or sideways market.";
  }

  return {
    atrPercent,
    emaCompressionPercent,
    minAtrPercent,
    emaCompressionThresholdPercent,
    isLowVolatility,
    isCompressed,
    isSideways,
    reason
  };
}

function analyzeSignalAlignment(timeframeIndicators = {}) {
  const hourly = timeframeIndicators["1h"];
  const fourHour = timeframeIndicators["4h"];

  if (!hourly) {
    return {
      aligned: false,
      aligned1h: false,
      aligned4h: false,
      direction: "neutral",
      direction1h: "neutral",
      reason: "Missing 1h trend context."
    };
  }

  const direction1h = hourly.bias === "bullish" ? "BUY" : hourly.bias === "bearish" ? "SELL" : "neutral";
  const aligned1h = direction1h !== "neutral";
  const direction4h = fourHour?.bias === "bullish" ? "BUY" : fourHour?.bias === "bearish" ? "SELL" : "neutral";
  const aligned4h = direction4h !== "neutral" && direction4h === direction1h;

  // Full alignment: both 1h and 4h agree.
  if (aligned1h && aligned4h) {
    return {
      aligned: true,
      aligned1h: true,
      aligned4h: true,
      direction: direction1h,
      direction1h,
      reason: `1h and 4h both confirm ${direction1h === "BUY" ? "bullish" : "bearish"} direction.`
    };
  }

  // Partial alignment: only 1h has a clear bias (4h is neutral or disagrees).
  if (aligned1h) {
    return {
      aligned: false,
      aligned1h: true,
      aligned4h: false,
      direction: direction1h,
      direction1h,
      reason: `1h confirms ${direction1h === "BUY" ? "bullish" : "bearish"} direction but 4h is not aligned.`
    };
  }

  return {
    aligned: false,
    aligned1h: false,
    aligned4h: false,
    direction: "neutral",
    direction1h: "neutral",
    reason: "Higher timeframes are not aligned."
  };
}

function buildIndicatorSnapshot(candlesByTimeframe = {}) {
  const snapshot = {};

  for (const [timeframe, candles] of Object.entries(candlesByTimeframe)) {
    const closes = getClosingPrices(candles);
    const atr14 = calculateATR(candles, 14);
    const trend = analyzeTrend(candles);

    snapshot[timeframe] = {
      rsi14: calculateRSI(closes, 14),
      atr14,
      volume: isVolumeAboveAverage(candles, 20),
      trend,
      marketState: analyzeMarketState(trend, atr14)
    };
  }

  snapshot.multiTimeframe = analyzeSignalAlignment(
    Object.fromEntries(
      Object.entries(snapshot)
        .filter(([key]) => key !== "multiTimeframe")
        .map(([key, value]) => [key, value.trend])
    )
  );

  return snapshot;
}

module.exports = {
  analyzeSignalAlignment,
  analyzeTrend,
  buildIndicatorSnapshot,
  calculateATR,
  calculateEMA,
  calculateRSI,
  calculateSMA,
  calculateTrueRanges,
  calculateVolumeAverage,
  getClosingPrices,
  getIndicatorConfig,
  getPriceVsLevel,
  getVolumes,
  isVolumeAboveAverage,
  analyzeMarketState
};
