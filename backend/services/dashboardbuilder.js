class DashboardBuilder {
  constructor({
    executionEngine,
    orderModel,
    riskManager,
    tradeModel,
    getTradeStatistics,
    getBotStatus
  }) {
    this.executionEngine = executionEngine;
    this.orderModel = orderModel;
    this.riskManager = riskManager;
    this.tradeModel = tradeModel;
    this.getTradeStatistics = getTradeStatistics;
    this.getBotStatus = getBotStatus;
  }

  async enrichOpenTrades(openTrades) {
    const uniquePairs = [...new Set(openTrades.map((trade) => trade.pair))];
    const latestPrices = {};

    await Promise.all(
      uniquePairs.map(async (pair) => {
        try {
          const price = await this.executionEngine.getSymbolPrice(pair);
          latestPrices[pair] = Number(price.price);
        } catch (_error) {
          latestPrices[pair] = null;
        }
      })
    );

    return Promise.all(
      openTrades.map(async (trade) => {
        const orders = await this.orderModel.getOrdersByTradeId(trade.id);
        const activeProtection = [...orders]
          .reverse()
          .find((order) => ["protection", "adjustment"].includes(order.role) && order.status === "open");
        const latestExecution = [...orders].reverse()[0] || null;
        const marketPrice = latestPrices[trade.pair];

        if (marketPrice === null || marketPrice === undefined) {
          return {
            ...trade,
            orders,
            orderSummary: {
              latestExecution,
              activeProtection
            },
            livePnl: null,
            livePnlPercent: null,
            marketPrice: null
          };
        }

        const result = this.riskManager.calculateTradeResult({
          side: trade.side,
          entryPrice: trade.entry_price,
          exitPrice: marketPrice,
          quantity: trade.quantity
        });

        return {
          ...trade,
          orders,
          orderSummary: {
            latestExecution,
            activeProtection
          },
          marketPrice,
          livePnl: result.pnl,
          livePnlPercent: result.resultPercent
        };
      })
    );
  }

  async buildDashboardSnapshot() {
    const [capitalState, openTrades, latestTrades, dailyPnl, stats] = await Promise.all([
      this.riskManager.getLatestCapitalState(),
      this.tradeModel.getOpenTrades(),
      this.tradeModel.listTrades({ limit: 5 }),
      this.riskManager.getDailyPnl(),
      this.getTradeStatistics()
    ]);

    const enrichedOpenTrades = await this.enrichOpenTrades(openTrades);
    const unrealizedPnl = enrichedOpenTrades.reduce((sum, trade) => sum + Number(trade.livePnl || 0), 0);

    return {
      capital: {
        current: capitalState.capitalValue,
        realizedProfit: capitalState.realizedProfit,
        unrealizedPnl,
        totalPnl: capitalState.realizedProfit + unrealizedPnl
      },
      tradingMode: this.executionEngine.getModeLabel(),
      botStatus: this.getBotStatus(),
      daily: {
        pnl: dailyPnl.pnl,
        tradeCount: dailyPnl.tradeCount
      },
      activeTrades: enrichedOpenTrades,
      latestTrades,
      stats
    };
  }
}

module.exports = DashboardBuilder;
