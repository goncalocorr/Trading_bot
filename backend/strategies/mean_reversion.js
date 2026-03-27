module.exports = {
  id: "mean_reversion",
  description: "Fades RSI extremes in sideways/compressed markets. BUY when oversold, SELL when overbought.",

  async scan({ pair, candlesByTimeframe, indicatorsService }) {
    const indicators = indicatorsService.buildIndicatorSnapshot(candlesByTimeframe);
    const snapshot15m = indicators["15m"];

    if (!snapshot15m) {
      return [];
    }

    const isSideways = Boolean(snapshot15m.marketState?.isSideways);

    if (!isSideways) {
      return [];
    }

    const rsi = Number(snapshot15m.rsi14 || 0);
    const signals = [];

    if (rsi < 30) {
      signals.push({
        pair,
        side: "BUY",
        candlesByTimeframe,
        metadata: {
          strategy: "mean_reversion",
          strategyId: "mean_reversion",
          trigger: `RSI oversold (${rsi.toFixed(1)}) in sideways market`
        }
      });
    }

    if (rsi > 70) {
      signals.push({
        pair,
        side: "SELL",
        candlesByTimeframe,
        metadata: {
          strategy: "mean_reversion",
          strategyId: "mean_reversion",
          trigger: `RSI overbought (${rsi.toFixed(1)}) in sideways market`
        }
      });
    }

    return signals;
  }
};
