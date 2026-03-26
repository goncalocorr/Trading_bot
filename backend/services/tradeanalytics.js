class TradeAnalytics {
  inferStrategyId(trade = {}) {
    return trade.metadata?.strategyId || trade.metadata?.strategy || "unknown";
  }

  inferRegime(trade = {}) {
    const indicators = trade.indicators_snapshot || {};
    const market15m = indicators["15m"]?.marketState || null;
    const trend15m = indicators["15m"]?.trend || null;
    const multiTimeframe = indicators.multiTimeframe || null;

    if (market15m?.isSideways) {
      return {
        regimeId: "sideways",
        regimeLabel: "Sideways"
      };
    }

    const atrPercent = Number(market15m?.atrPercent || 0);
    const minAtrPercent = Number(market15m?.minAtrPercent || 0);
    const volatileThreshold = Math.max(minAtrPercent * 2, 0.8);

    if (atrPercent >= volatileThreshold) {
      return {
        regimeId: "volatile",
        regimeLabel: "Volatile"
      };
    }

    if (multiTimeframe?.aligned) {
      return {
        regimeId: "trend",
        regimeLabel: "Trend"
      };
    }

    if (trend15m?.bias && trend15m.bias !== "neutral") {
      return {
        regimeId: "mixed",
        regimeLabel: "Mixed"
      };
    }

    return {
      regimeId: "unknown",
      regimeLabel: "Unknown"
    };
  }

  buildBucketSummary(bucket) {
    return {
      ...bucket,
      winRate: bucket.totalTrades === 0 ? 0 : (bucket.wins / bucket.totalTrades) * 100,
      avgPnl: bucket.totalTrades === 0 ? 0 : bucket.pnlTotal / bucket.totalTrades
    };
  }

  buildStrategyRankingByPeriod(trades = []) {
    const periods = [
      { id: "7d", label: "Last 7d", days: 7 },
      { id: "30d", label: "Last 30d", days: 30 },
      { id: "all", label: "All", days: null }
    ];

    const latestTimestamp = trades.reduce((latest, trade) => {
      const timestamp = new Date(trade.closed_at || trade.opened_at || Date.now()).getTime();
      return Math.max(latest, timestamp);
    }, Date.now());

    return periods.map((period) => {
      const filteredTrades = period.days === null
        ? trades
        : trades.filter((trade) => {
            const timestamp = new Date(trade.closed_at || trade.opened_at || 0).getTime();
            return timestamp >= latestTimestamp - period.days * 24 * 60 * 60 * 1000;
          });

      const rankingMap = new Map();

      filteredTrades.forEach((trade) => {
        const strategyId = this.inferStrategyId(trade);
        const bucket = rankingMap.get(strategyId) || {
          strategyId,
          totalTrades: 0,
          wins: 0,
          pnlTotal: 0
        };
        const pnl = Number(trade.result_pnl || 0);

        bucket.totalTrades += 1;
        bucket.pnlTotal += pnl;

        if (pnl > 0) {
          bucket.wins += 1;
        }

        rankingMap.set(strategyId, bucket);
      });

      return {
        periodId: period.id,
        periodLabel: period.label,
        ranking: [...rankingMap.values()]
          .map((item) => ({
            strategyId: item.strategyId,
            totalTrades: item.totalTrades,
            winRate: item.totalTrades === 0 ? 0 : (item.wins / item.totalTrades) * 100,
            avgPnl: item.totalTrades === 0 ? 0 : item.pnlTotal / item.totalTrades,
            pnlTotal: item.pnlTotal
          }))
          .sort((left, right) => {
            if (Number(right.pnlTotal || 0) !== Number(left.pnlTotal || 0)) {
              return Number(right.pnlTotal || 0) - Number(left.pnlTotal || 0);
            }

            return Number(right.winRate || 0) - Number(left.winRate || 0);
          })
      };
    });
  }

  computeStatistics(trades = []) {
    const pnlValues = trades.map((trade) => Number(trade.result_pnl || 0));
    const winningTrades = trades.filter((trade) => Number(trade.result_pnl || 0) > 0);
    const losingTrades = trades.filter((trade) => Number(trade.result_pnl || 0) < 0);
    const bestTrade = trades.reduce(
      (best, trade) => (best === null || Number(trade.result_pnl || 0) > Number(best.result_pnl || 0) ? trade : best),
      null
    );
    const worstTrade = trades.reduce(
      (worst, trade) =>
        worst === null || Number(trade.result_pnl || 0) < Number(worst.result_pnl || 0) ? trade : worst,
      null
    );

    const byStrategyMap = new Map();
    const byRegimeMap = new Map();
    const byStrategyRegimeMap = new Map();

    trades.forEach((trade) => {
      const pnl = Number(trade.result_pnl || 0);
      const strategyId = this.inferStrategyId(trade);
      const regime = this.inferRegime(trade);

      const strategyBucket = byStrategyMap.get(strategyId) || {
        strategyId,
        totalTrades: 0,
        wins: 0,
        pnlTotal: 0,
        bestTrade: null,
        worstTrade: null
      };

      strategyBucket.totalTrades += 1;
      strategyBucket.pnlTotal += pnl;

      if (pnl > 0) {
        strategyBucket.wins += 1;
      }

      if (strategyBucket.bestTrade === null || pnl > Number(strategyBucket.bestTrade.result_pnl || 0)) {
        strategyBucket.bestTrade = trade;
      }

      if (strategyBucket.worstTrade === null || pnl < Number(strategyBucket.worstTrade.result_pnl || 0)) {
        strategyBucket.worstTrade = trade;
      }

      byStrategyMap.set(strategyId, strategyBucket);

      const regimeBucket = byRegimeMap.get(regime.regimeId) || {
        regimeId: regime.regimeId,
        regimeLabel: regime.regimeLabel,
        totalTrades: 0,
        wins: 0,
        pnlTotal: 0,
        bestTrade: null,
        worstTrade: null
      };

      regimeBucket.totalTrades += 1;
      regimeBucket.pnlTotal += pnl;

      if (pnl > 0) {
        regimeBucket.wins += 1;
      }

      if (regimeBucket.bestTrade === null || pnl > Number(regimeBucket.bestTrade.result_pnl || 0)) {
        regimeBucket.bestTrade = trade;
      }

      if (regimeBucket.worstTrade === null || pnl < Number(regimeBucket.worstTrade.result_pnl || 0)) {
        regimeBucket.worstTrade = trade;
      }

      byRegimeMap.set(regime.regimeId, regimeBucket);

      const strategyRegimeKey = `${strategyId}:${regime.regimeId}`;
      const strategyRegimeBucket = byStrategyRegimeMap.get(strategyRegimeKey) || {
        strategyId,
        regimeId: regime.regimeId,
        regimeLabel: regime.regimeLabel,
        totalTrades: 0,
        wins: 0,
        pnlTotal: 0
      };

      strategyRegimeBucket.totalTrades += 1;
      strategyRegimeBucket.pnlTotal += pnl;

      if (pnl > 0) {
        strategyRegimeBucket.wins += 1;
      }

      byStrategyRegimeMap.set(strategyRegimeKey, strategyRegimeBucket);
    });

    const byStrategy = [...byStrategyMap.values()]
      .map((item) => this.buildBucketSummary(item))
      .sort((left, right) => Number(right.pnlTotal || 0) - Number(left.pnlTotal || 0));

    const byRegime = [...byRegimeMap.values()]
      .map((item) => this.buildBucketSummary(item))
      .sort((left, right) => Number(right.pnlTotal || 0) - Number(left.pnlTotal || 0));

    const byStrategyRegime = [...byStrategyRegimeMap.values()]
      .map((item) => this.buildBucketSummary(item))
      .sort((left, right) => {
        if (right.totalTrades !== left.totalTrades) {
          return right.totalTrades - left.totalTrades;
        }

        return Number(right.pnlTotal || 0) - Number(left.pnlTotal || 0);
      });

    return {
      totalTrades: trades.length,
      winRate: trades.length === 0 ? 0 : (winningTrades.length / trades.length) * 100,
      avgProfitPerTrade:
        winningTrades.length === 0
          ? 0
          : winningTrades.reduce((sum, trade) => sum + Number(trade.result_pnl || 0), 0) / winningTrades.length,
      avgLossPerTrade:
        losingTrades.length === 0
          ? 0
          : losingTrades.reduce((sum, trade) => sum + Number(trade.result_pnl || 0), 0) / losingTrades.length,
      bestTrade,
      worstTrade,
      pnlValues,
      byStrategy,
      byRegime,
      byStrategyRegime,
      strategyRankingByPeriod: this.buildStrategyRankingByPeriod(trades)
    };
  }
}

module.exports = TradeAnalytics;
