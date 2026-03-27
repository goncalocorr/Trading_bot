module.exports = {
  id: "multi_timeframe_rsi",
  description: "Trades with higher-timeframe direction plus 15m RSI extremes.",

  async scan({ pair, candlesByTimeframe, indicatorsService }) {
    const indicators = indicatorsService.buildIndicatorSnapshot(candlesByTimeframe);
    const highTimeframeDirection = indicators.multiTimeframe.direction;
    const rsi = Number(indicators["15m"]?.rsi14 || 0);
    const buyThreshold = Number(process.env.MTF_RSI_BUY_THRESHOLD || 35);
    const sellThreshold = Number(process.env.MTF_RSI_SELL_THRESHOLD || 65);
    const signals = [];

    if (highTimeframeDirection === "BUY" && rsi < buyThreshold) {
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

    if (highTimeframeDirection === "SELL" && rsi > sellThreshold) {
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
