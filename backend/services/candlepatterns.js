function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getBodySize(candle) {
  return Math.abs(toNumber(candle.close) - toNumber(candle.open));
}

function getRange(candle) {
  return Math.max(toNumber(candle.high) - toNumber(candle.low), 0);
}

function isBullish(candle) {
  return toNumber(candle.close) > toNumber(candle.open);
}

function isBearish(candle) {
  return toNumber(candle.close) < toNumber(candle.open);
}

function upperShadow(candle) {
  return toNumber(candle.high) - Math.max(toNumber(candle.open), toNumber(candle.close));
}

function lowerShadow(candle) {
  return Math.min(toNumber(candle.open), toNumber(candle.close)) - toNumber(candle.low);
}

function detectDoji(candle) {
  const body = getBodySize(candle);
  const range = getRange(candle);

  return {
    detected: range > 0 && body / range <= 0.1,
    direction: "neutral",
    name: "Doji"
  };
}

function detectHammer(candle) {
  const body = getBodySize(candle);
  const range = getRange(candle);
  const lower = lowerShadow(candle);
  const upper = upperShadow(candle);

  return {
    detected: range > 0 && lower >= body * 2 && upper <= body * 0.5,
    direction: "bullish",
    name: "Hammer"
  };
}

function detectInvertedHammer(candle) {
  const body = getBodySize(candle);
  const range = getRange(candle);
  const lower = lowerShadow(candle);
  const upper = upperShadow(candle);

  return {
    detected: range > 0 && upper >= body * 2 && lower <= body * 0.5,
    direction: "bullish",
    name: "Inverted Hammer"
  };
}

function detectShootingStar(candle) {
  const body = getBodySize(candle);
  const range = getRange(candle);
  const lower = lowerShadow(candle);
  const upper = upperShadow(candle);

  return {
    detected: range > 0 && upper >= body * 2 && lower <= body * 0.5,
    direction: "bearish",
    name: "Shooting Star"
  };
}

function detectBullishEngulfing(previous, current) {
  const previousBodyHigh = Math.max(toNumber(previous.open), toNumber(previous.close));
  const previousBodyLow = Math.min(toNumber(previous.open), toNumber(previous.close));
  const currentBodyHigh = Math.max(toNumber(current.open), toNumber(current.close));
  const currentBodyLow = Math.min(toNumber(current.open), toNumber(current.close));

  return {
    detected:
      isBearish(previous) &&
      isBullish(current) &&
      currentBodyLow <= previousBodyLow &&
      currentBodyHigh >= previousBodyHigh,
    direction: "bullish",
    name: "Bullish Engulfing"
  };
}

function detectBearishEngulfing(previous, current) {
  const previousBodyHigh = Math.max(toNumber(previous.open), toNumber(previous.close));
  const previousBodyLow = Math.min(toNumber(previous.open), toNumber(previous.close));
  const currentBodyHigh = Math.max(toNumber(current.open), toNumber(current.close));
  const currentBodyLow = Math.min(toNumber(current.open), toNumber(current.close));

  return {
    detected:
      isBullish(previous) &&
      isBearish(current) &&
      currentBodyHigh >= previousBodyHigh &&
      currentBodyLow <= previousBodyLow,
    direction: "bearish",
    name: "Bearish Engulfing"
  };
}

function detectMorningStar(first, second, third) {
  const firstBody = getBodySize(first);
  const secondBody = getBodySize(second);
  const thirdBody = getBodySize(third);
  const firstMidpoint = (toNumber(first.open) + toNumber(first.close)) / 2;

  return {
    detected:
      isBearish(first) &&
      secondBody < firstBody * 0.6 &&
      isBullish(third) &&
      thirdBody >= firstBody * 0.5 &&
      toNumber(third.close) > firstMidpoint,
    direction: "bullish",
    name: "Morning Star"
  };
}

function detectEveningStar(first, second, third) {
  const firstBody = getBodySize(first);
  const secondBody = getBodySize(second);
  const thirdBody = getBodySize(third);
  const firstMidpoint = (toNumber(first.open) + toNumber(first.close)) / 2;

  return {
    detected:
      isBullish(first) &&
      secondBody < firstBody * 0.6 &&
      isBearish(third) &&
      thirdBody >= firstBody * 0.5 &&
      toNumber(third.close) < firstMidpoint,
    direction: "bearish",
    name: "Evening Star"
  };
}

function detectPatterns(candles = []) {
  if (!Array.isArray(candles) || candles.length < 3) {
    throw new Error("Candlestick pattern detection requires at least 3 candles.");
  }

  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const first = candles[candles.length - 3];

  const detections = [
    detectDoji(current),
    detectHammer(current),
    detectInvertedHammer(current),
    detectShootingStar(current),
    detectBullishEngulfing(previous, current),
    detectBearishEngulfing(previous, current),
    detectMorningStar(first, previous, current),
    detectEveningStar(first, previous, current)
  ];

  const matches = detections.filter((pattern) => pattern.detected);

  return {
    matches,
    bullish: matches.filter((pattern) => pattern.direction === "bullish"),
    bearish: matches.filter((pattern) => pattern.direction === "bearish"),
    neutral: matches.filter((pattern) => pattern.direction === "neutral")
  };
}

function getPatternConfirmation(candles, signalSide) {
  const patterns = detectPatterns(candles);
  const normalizedSide = String(signalSide || "").toUpperCase();
  const confirmingPatterns =
    normalizedSide === "BUY"
      ? patterns.bullish
      : normalizedSide === "SELL"
        ? patterns.bearish
        : [];

  return {
    matched: confirmingPatterns.length > 0,
    signalSide: normalizedSide,
    confirmingPatterns,
    allMatches: patterns.matches
  };
}

module.exports = {
  detectBearishEngulfing,
  detectBullishEngulfing,
  detectDoji,
  detectEveningStar,
  detectHammer,
  detectInvertedHammer,
  detectMorningStar,
  detectPatterns,
  detectShootingStar,
  getPatternConfirmation
};
