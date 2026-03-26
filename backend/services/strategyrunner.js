function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class StrategyRunner {
  constructor({
    runtime,
    binanceService,
    indicatorsService,
    processSignal,
    strategyRegistry
  }) {
    this.runtime = runtime;
    this.binanceService = binanceService;
    this.indicatorsService = indicatorsService;
    this.processSignal = processSignal;
    this.strategyRegistry = strategyRegistry;
  }

  async scanPair(pair, options = {}) {
    const candlesByTimeframe = await this.binanceService.getMultiTimeframeCandles(pair);
    const strategies = Array.isArray(options.strategyIds) && options.strategyIds.length > 0
      ? this.strategyRegistry.getStrategies(options.strategyIds)
      : this.strategyRegistry.getActiveStrategies();
    const results = [];

    for (const strategy of strategies) {
      const candidates = await strategy.scan({
        pair,
        candlesByTimeframe,
        indicatorsService: this.indicatorsService
      });

      for (const candidate of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const result = await this.processSignal({
          pair: candidate.pair,
          side: candidate.side,
          triggerSource: "auto",
          candlesByTimeframe: candidate.candlesByTimeframe || candlesByTimeframe,
          metadata: {
            ...(candidate.metadata || {}),
            ...(options.signalMetadata || {})
          }
        });

        results.push({
          strategyId: strategy.id,
          strategyDescription: strategy.description,
          pair: candidate.pair,
          side: candidate.side,
          result
        });
      }
    }

    return results;
  }

  async runAutoScan(options = {}) {
    if (!this.runtime.botEnabled) {
      return [];
    }

    const summary = [];

    for (const pair of this.runtime.tradingPairs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const pairResults = await this.scanPair(pair, options);
        summary.push({
          pair,
          results: pairResults
        });
      } catch (error) {
        console.error(`Auto scan failed for ${pair}: ${error.message}`);
        summary.push({
          pair,
          error: error.message,
          results: []
        });
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(500);
    }

    return summary;
  }
}

module.exports = StrategyRunner;
