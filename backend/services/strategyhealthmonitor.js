class StrategyHealthMonitor {
  constructor({
    runtime,
    tradeModel,
    telegramService
  }) {
    this.runtime = runtime;
    this.tradeModel = tradeModel;
    this.telegramService = telegramService;
  }

  getStrategyId(trade = {}) {
    return trade.metadata?.strategyId || trade.metadata?.strategy || "unknown";
  }

  getConfig() {
    return {
      lookback: Number(process.env.STRATEGY_HEALTH_LOOKBACK || 8),
      minWinRate: Number(process.env.STRATEGY_HEALTH_MIN_WIN_RATE || 35),
      minPnl: Number(process.env.STRATEGY_HEALTH_MIN_PNL || -1)
    };
  }

  async monitor() {
    const { lookback, minWinRate, minPnl } = this.getConfig();
    const [closedTrades, cancelledTrades] = await Promise.all([
      this.tradeModel.listTrades({ status: "closed", limit: 200 }),
      this.tradeModel.listTrades({ status: "cancelled", limit: 200 })
    ]);
    const trades = [...closedTrades, ...cancelledTrades].sort(
      (left, right) => new Date(right.closed_at || right.opened_at) - new Date(left.closed_at || left.opened_at)
    );
    const grouped = new Map();

    trades.forEach((trade) => {
      const strategyId = this.getStrategyId(trade);
      const bucket = grouped.get(strategyId) || [];
      bucket.push(trade);
      grouped.set(strategyId, bucket);
    });

    for (const [strategyId, strategyTrades] of grouped.entries()) {
      const recentTrades = strategyTrades.slice(0, lookback);

      if (recentTrades.length < lookback) {
        continue;
      }

      const pnlTotal = recentTrades.reduce((sum, trade) => sum + Number(trade.result_pnl || 0), 0);
      const wins = recentTrades.filter((trade) => Number(trade.result_pnl || 0) > 0).length;
      const winRate = recentTrades.length === 0 ? 0 : (wins / recentTrades.length) * 100;
      const degraded = winRate < minWinRate || pnlTotal <= minPnl;
      const stateKey = `${strategyId}:${lookback}`;
      const previousState = this.runtime.strategyHealthAlertState?.[stateKey] || "healthy";

      if (degraded && previousState !== "degraded") {
        // eslint-disable-next-line no-await-in-loop
        await this.telegramService.notifyStrategyDegradation({
          strategyId,
          tradeCount: recentTrades.length,
          winRate,
          pnlTotal,
          reason:
            winRate < minWinRate
              ? `Win rate is below threshold ${minWinRate.toFixed(2)}%.`
              : `PnL is below threshold ${minPnl.toFixed(4)}.`
        });
      }

      this.runtime.strategyHealthAlertState[stateKey] = degraded ? "degraded" : "healthy";
    }
  }
}

module.exports = StrategyHealthMonitor;
