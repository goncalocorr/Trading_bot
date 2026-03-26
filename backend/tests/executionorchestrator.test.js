const test = require("node:test");
const assert = require("node:assert/strict");

const ExecutionOrchestrator = require("../services/executionorchestrator");

test("sell signal closes all open buy trades for the selected pair sequentially", async () => {
  const orchestrator = new ExecutionOrchestrator({
    executionEngine: {},
    tradeModel: {
      async getOpenTrades() {
        return [
          { id: 1, pair: "BTCUSDT", side: "BUY" },
          { id: 2, pair: "BTCUSDT", side: "BUY" },
          { id: 3, pair: "ETHUSDT", side: "BUY" }
        ];
      }
    },
    orderModel: {},
    riskManager: {},
    telegramService: {}
  });

  const executionOrder = [];
  let activeClosures = 0;
  let maxConcurrentClosures = 0;

  orchestrator.closeTrade = async (tradeId) => {
    executionOrder.push(tradeId);
    activeClosures += 1;
    maxConcurrentClosures = Math.max(maxConcurrentClosures, activeClosures);
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeClosures -= 1;
    return { ok: true, action: "trade_closed", tradeId };
  };

  const result = await orchestrator.executeSellSignal({
    pair: "BTCUSDT",
    triggerSource: "auto",
    metadata: {}
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, "all_positions_closed");
  assert.equal(result.closedCount, 2);
  assert.deepEqual(executionOrder, [1, 2]);
  assert.equal(maxConcurrentClosures, 1);
});
