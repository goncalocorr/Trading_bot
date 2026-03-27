module.exports = {
  id: "mean_reversion",
  description: "Fades RSI extremes. BUY when oversold (<30), SELL when overbought (>70). Blocked only by confirmed 4h structural trend against the trade.",

  async scan({ pair, candlesByTimeframe, indicatorsService }) {
    const indicators = indicatorsService.buildIndicatorSnapshot(candlesByTimeframe);
    const snapshot15m = indicators["15m"];

    if (!snapshot15m) {
      return [];
    }

    const rsi = Number(snapshot15m.rsi14 || 0);
    const oversoldThreshold = Number(process.env.MEAN_REVERSION_RSI_OVERSOLD || 30);
    const overboughtThreshold = Number(process.env.MEAN_REVERSION_RSI_OVERBOUGHT || 70);
    // Use 4h structural bias to filter — far less sensitive than 15m EMA alignment,
    // so only truly strong directional trends block the contrarian signal.
    const bias4h = indicators["4h"]?.trend?.bias || "neutral";
    const signals = [];

    // BUY: RSI oversold. Block only when the 4h timeframe is in a confirmed
    // structural bearish trend (not just any short-term pullback).
    if (rsi < oversoldThreshold) {
      if (bias4h !== "bearish") {
        signals.push({
          pair,
          side: "BUY",
          candlesByTimeframe,
          metadata: {
            strategy: "mean_reversion",
            strategyId: "mean_reversion",
            trigger: `RSI oversold (${rsi.toFixed(1)})`,
            bias4h
          }
        });
      }
    }

    // SELL: RSI overbought. Block only when the 4h timeframe is in a confirmed
    // structural bullish trend (not just any short-term rally).
    if (rsi > overboughtThreshold) {
      if (bias4h !== "bullish") {
        signals.push({
          pair,
          side: "SELL",
          candlesByTimeframe,
          metadata: {
            strategy: "mean_reversion",
            strategyId: "mean_reversion",
            trigger: `RSI overbought (${rsi.toFixed(1)})`,
            bias4h
          }
        });
      }
    }

    return signals;
  }
};
