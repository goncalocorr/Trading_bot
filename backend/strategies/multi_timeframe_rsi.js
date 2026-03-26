module.exports = {
  id: "multi_timeframe_rsi",
  description: "Trades with higher-timeframe direction plus 15m RSI extremes.",

  async scan({ pair, candlesByTimeframe, indicatorsService }) {
    const indicators = indicatorsService.buildIndicatorSnapshot(candlesByTimeframe);
    const highTimeframeDirection = indicators.multiTimeframe.direction;
    const rsi = Number(indicators["15m"]?.rsi14 || 0);
    const signals = [];

    if (highTimeframeDirection === "BUY" && rsi < 35) {
      signals.push({
        pair,
        side: "BUY",
        candlesByTimeframe,
        metadata: {
          strategy: "multi_timeframe_rsi_buy",
          strategyId: "multi_timeframe_rsi"
        }
      });
    }

    if (highTimeframeDirection === "SELL" && rsi > 65) {
      signals.push({
        pair,
        side: "SELL",
        candlesByTimeframe,
        metadata: {
          strategy: "multi_timeframe_rsi_sell",
          strategyId: "multi_timeframe_rsi"
        }
      });
    }

    return signals;
  }
};
