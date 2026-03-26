const multiTimeframeRsiStrategy = require("../strategies/multi_timeframe_rsi");
const pullbackContinuationStrategy = require("../strategies/pullback_continuation");

class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
    this.register(multiTimeframeRsiStrategy);
    this.register(pullbackContinuationStrategy);
  }

  register(strategy) {
    if (!strategy?.id || typeof strategy.scan !== "function") {
      throw new Error("Invalid strategy registration.");
    }

    this.strategies.set(strategy.id, strategy);
  }

  getActiveStrategies() {
    const configured = String(process.env.ACTIVE_STRATEGIES || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (configured.length === 0) {
      return [...this.strategies.values()];
    }

    return configured
      .map((strategyId) => this.strategies.get(strategyId))
      .filter(Boolean);
  }
}

module.exports = StrategyRegistry;
