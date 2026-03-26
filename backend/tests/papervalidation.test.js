const test = require("node:test");
const assert = require("node:assert/strict");

const PaperValidationService = require("../services/papervalidation");
const TradeAnalytics = require("../services/tradeanalytics");

test("paper validation recommends challenger swap when challenger has meaningful edge", async () => {
  process.env.PAPER_APPROVAL_MIN_TRADES = "20";
  process.env.PAPER_CHALLENGER_MIN_TRADES = "2";
  process.env.PAPER_CHALLENGER_MIN_EDGE_PNL = "0.5";
  process.env.PAPER_CHALLENGER_MIN_EDGE_WIN_RATE = "5";

  const service = new PaperValidationService({
    runtime: {
      championRunId: 1,
      challengerRunId: 2,
      regimeChampionTrendRunId: null,
      regimeChampionSidewaysRunId: null,
      regimeChampionVolatileRunId: null
    },
    tradeAnalytics: new TradeAnalytics(),
    backtestRuns: {
      async getBacktestRunById(id) {
        return {
          id,
          pair: "BTCUSDT",
          timeframe: "15m",
          config: {
            activeStrategies: id === 1 ? ["multi_timeframe_rsi"] : ["pullback_continuation"]
          },
          summary: {}
        };
      }
    },
    promotionEvents: {
      async listEvents() {
        return [];
      }
    }
  });

  const trades = [
    {
      status: "closed",
      result_pnl: 0.2,
      metadata: { tradingMode: "PAPER", paperValidation: { promotedRunId: 1 } },
      indicators_snapshot: { "15m": { marketState: { isSideways: false } }, multiTimeframe: { aligned: true } }
    },
    {
      status: "closed",
      result_pnl: -0.1,
      metadata: { tradingMode: "PAPER", paperValidation: { promotedRunId: 1 } },
      indicators_snapshot: { "15m": { marketState: { isSideways: false } }, multiTimeframe: { aligned: true } }
    },
    {
      status: "closed",
      result_pnl: 1.2,
      metadata: { tradingMode: "PAPER", paperValidation: { promotedRunId: 2 } },
      indicators_snapshot: { "15m": { marketState: { isSideways: false } }, multiTimeframe: { aligned: true } }
    },
    {
      status: "closed",
      result_pnl: 0.8,
      metadata: { tradingMode: "PAPER", paperValidation: { promotedRunId: 2 } },
      indicators_snapshot: { "15m": { marketState: { isSideways: false } }, multiTimeframe: { aligned: true } }
    }
  ];

  const summary = await service.buildSummary(trades, { currentRegimeId: "trend" });
  assert.equal(summary.recommendation.action, "SWAP_TO_CHALLENGER");
  assert.equal(summary.headToHead.championRunId, 1);
  assert.equal(summary.headToHead.challengerRunId, 2);
});
