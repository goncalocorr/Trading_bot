class ExperimentInsights {
  getThresholds() {
    return {
      maxDrawdown: Number(process.env.EXPERIMENT_MAX_DRAWDOWN || 15),
      minReturn: Number(process.env.EXPERIMENT_MIN_RETURN || 2),
      minWinRate: Number(process.env.EXPERIMENT_MIN_WIN_RATE || 40)
    };
  }

  annotate(comparisons = []) {
    const thresholds = this.getThresholds();

    return comparisons.map((comparison, index) => {
      const passesDrawdown = Number(comparison.maxDrawdown || 0) <= thresholds.maxDrawdown;
      const passesReturn = Number(comparison.totalReturnPercent || 0) >= thresholds.minReturn;
      const passesWinRate = Number(comparison.winRate || 0) >= thresholds.minWinRate;
      let tier = "REJECTED";

      if (passesDrawdown && passesReturn && passesWinRate) {
        tier = index === 0 ? "TOP_CANDIDATE" : "WATCHLIST";
      } else if (passesDrawdown && (passesReturn || passesWinRate)) {
        tier = "WATCHLIST";
      }

      return {
        ...comparison,
        insights: {
          tier,
          passesDrawdown,
          passesReturn,
          passesWinRate,
          thresholds
        }
      };
    });
  }
}

module.exports = ExperimentInsights;
