const logger = require("./logger");

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
    const processedSides = new Set();

    for (const strategy of strategies) {
      // eslint-disable-next-line no-await-in-loop
      const candidates = await strategy.scan({
        pair,
        candlesByTimeframe,
        indicatorsService: this.indicatorsService
      });

      for (const candidate of candidates) {
        const deduplicationKey = `${candidate.pair}:${candidate.side}`;

        if (processedSides.has(deduplicationKey)) {
          logger.info("signal_deduplicated", {
            pair: candidate.pair,
            side: candidate.side,
            skippedStrategy: strategy.id
          });
          results.push({
            strategyId: strategy.id,
            strategyDescription: strategy.description,
            pair: candidate.pair,
            side: candidate.side,
            result: { ok: false, action: "deduplicated", reason: "Signal already processed for this pair and side." }
          });
          continue;
        }

        processedSides.add(deduplicationKey);

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

    const concurrency = Number(process.env.AUTO_SCAN_CONCURRENCY || 3);
    const pairs = [...this.runtime.tradingPairs];
    const summary = [];

    // Process pairs in parallel batches
    for (let i = 0; i < pairs.length; i += concurrency) {
      const batch = pairs.slice(i, i + concurrency);
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.allSettled(
        batch.map((pair) =>
          this.scanPair(pair, options).then(
            (results) => ({ pair, results }),
            (error) => {
              logger.error(`Auto scan failed for ${pair}: ${error.message}`);
              return { pair, error: error.message, results: [] };
            }
          )
        )
      );

      for (const result of batchResults) {
        summary.push(result.status === "fulfilled" ? result.value : {
          pair: "unknown",
          error: result.reason?.message || "Unknown error",
          results: []
        });
      }
    }

    return summary;
  }
}

module.exports = StrategyRunner;
