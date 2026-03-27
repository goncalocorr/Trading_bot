module.exports = {
  id: "mean_reversion",
  description: "Fades RSI extremes. BUY when oversold (<30), SELL when overbought (>70). Does not require sideways market.",

  async scan({ pair, candlesByTimeframe, indicatorsService }) {
    const indicators = indicatorsService.buildIndicatorSnapshot(candlesByTimeframe);
    const snapshot15m = indicators["15m"];

    if (!snapshot15m) {
      return [];
    }

    const rsi = Number(snapshot15m.rsi14 || 0);
    const trend = snapshot15m.trend;
    const signals = [];

    // BUY: RSI oversold. Skip if price is far below EMA200 in a confirmed death cross
    // (avoid catching falling knives in a strong structural downtrend).
    if (rsi < 30) {
      const strongBearish = trend?.deathCross && !trend?.priceAboveEma200;
      if (!strongBearish) {
        signals.push({
          pair,
          side: "BUY",
          candlesByTimeframe,
          metadata: {
            strategy: "mean_reversion",
            strategyId: "mean_reversion",
            trigger: `RSI oversold (${rsi.toFixed(1)})`
          }
        });
      }
    }

    // SELL: RSI overbought. Skip if in a confirmed golden cross above EMA200
    // (avoid shorting a strong structural uptrend).
    if (rsi > 70) {
      const strongBullish = trend?.goldenCross && trend?.priceAboveEma200;
      if (!strongBullish) {
        signals.push({
          pair,
          side: "SELL",
          candlesByTimeframe,
          metadata: {
            strategy: "mean_reversion",
            strategyId: "mean_reversion",
            trigger: `RSI overbought (${rsi.toFixed(1)})`
          }
        });
      }
    }

    return signals;
  }
};
