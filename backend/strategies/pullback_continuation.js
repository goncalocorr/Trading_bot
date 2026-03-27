function isBullishPullback(snapshot15m, snapshot1h, snapshot4h) {
  const trend15m = snapshot15m?.trend;
  const trend1h = snapshot1h?.trend;
  const trend4h = snapshot4h?.trend;
  const rsi15m = Number(snapshot15m?.rsi14 || 0);
  const volume15m = snapshot15m?.volume;
  const marketState15m = snapshot15m?.marketState;
  const close = Number(trend15m?.close || 0);
  const ema9 = Number(trend15m?.ema9 || 0);
  const ema21 = Number(trend15m?.ema21 || 0);
  const atr14 = Number(snapshot15m?.atr14 || 0);
  // ATR-based pullback zone: allows price to dip up to 0.75 ATR below EMA21,
  // and up to 2% above EMA9 (realistic pullback range before continuation).
  const pullbackFloor = ema21 - atr14 * 0.75;
  const pullbackCeiling = ema9 * 1.02;
  const priceNearPullbackZone = close >= pullbackFloor && close <= pullbackCeiling;

  return (
    trend1h?.bias === "bullish" &&
    trend4h?.bias === "bullish" &&
    trend15m?.priceAboveEma200 &&
    priceNearPullbackZone &&
    rsi15m >= 35 &&
    rsi15m <= 65 &&
    volume15m?.isAboveAverage &&
    !marketState15m?.isSideways
  );
}

module.exports = {
  id: "pullback_continuation",
  description: "Buys 15m pullbacks inside strong 1h/4h bullish continuation structure.",

  async scan({ pair, candlesByTimeframe, indicatorsService }) {
    const indicators = indicatorsService.buildIndicatorSnapshot(candlesByTimeframe);
    const snapshot15m = indicators["15m"];
    const snapshot1h = indicators["1h"];
    const snapshot4h = indicators["4h"];
    const signals = [];

    if (isBullishPullback(snapshot15m, snapshot1h, snapshot4h)) {
      signals.push({
        pair,
        side: "BUY",
        candlesByTimeframe,
        metadata: {
          strategy: "pullback_continuation_buy",
          strategyId: "pullback_continuation"
        }
      });
    }

    return signals;
  }
};
