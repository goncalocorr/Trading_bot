const multiTimeframeRsiStrategy = require("../strategies/multi_timeframe_rsi");
const pullbackContinuationStrategy = require("../strategies/pullback_continuation");
const meanReversionStrategy = require("../strategies/mean_reversion");

class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
    this.register(multiTimeframeRsiStrategy);
    this.register(pullbackContinuationStrategy);
    this.register(meanReversionStrategy);
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

    return this.getStrategies(configured);
  }

  getStrategies(strategyIds = []) {
    if (!Array.isArray(strategyIds) || strategyIds.length === 0) {
      return [...this.strategies.values()];
    }

    return strategyIds
      .map((strategyId) => this.strategies.get(strategyId))
      .filter(Boolean);
  }

  listStrategies() {
    const activeIds = new Set(this.getActiveStrategies().map((strategy) => strategy.id));

    return [...this.strategies.values()].map((strategy) => ({
      id: strategy.id,
      description: strategy.description,
      activeByDefault: activeIds.has(strategy.id)
    }));
  }
}

module.exports = StrategyRegistry;
