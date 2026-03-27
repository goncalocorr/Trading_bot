const test = require("node:test");
const assert = require("node:assert/strict");

const SignalMonitor = require("../services/signalmonitor");

function buildSnapshot({
  state = "NEAR_READY",
  score = 5,
  reason = "Higher timeframe alignment (1H + 4H) does not support this trade direction.",
  direction = "SELL",
  isSideways = false,
  fearGreed = "Extreme Fear"
} = {}) {
  return {
    readiness: {
      state
    },
    primaryReason: reason,
    score: {
      totalScore: score,
      maxScore: 12
    },
    diagnostics: {
      multiTimeframe: {
        direction
      },
      marketState: {
        isSideways
      },
      fearGreed: {
        classification: fearGreed
      }
    }
  };
}

test("signal monitor does not re-notify near-ready on score-only changes within cooldown", () => {
  const monitor = new SignalMonitor({
    runtime: { signalAlertState: {}, tradingPairs: [] },
    signalInspector: {},
    telegramService: {}
  });

  const previousRecord = {
    currentState: "NEAR_READY",
    lastNotifiedState: "NEAR_READY",
    lastFingerprint: monitor.buildFingerprint(buildSnapshot({ score: 5 })),
    lastNotifiedAt: new Date(Date.now() - 60 * 1000).toISOString()
  };

  assert.equal(monitor.shouldNotify(previousRecord, buildSnapshot({ score: 6 })), false);
});

test("signal monitor re-notifies when a signal upgrades from near-ready to ready", () => {
  const monitor = new SignalMonitor({
    runtime: { signalAlertState: {}, tradingPairs: [] },
    signalInspector: {},
    telegramService: {}
  });

  const previousRecord = {
    currentState: "NEAR_READY",
    lastNotifiedState: "NEAR_READY",
    lastFingerprint: monitor.buildFingerprint(buildSnapshot({ state: "NEAR_READY" })),
    lastNotifiedAt: new Date().toISOString()
  };

  assert.equal(monitor.shouldNotify(previousRecord, buildSnapshot({ state: "READY" })), true);
});

test("signal monitor accepts legacy string state records without crashing", async () => {
  let notifyCount = 0;
  const runtime = {
    signalAlertState: {
      "BTCUSDT:BUY": "NEAR_READY"
    },
    tradingPairs: ["BTCUSDT"]
  };

  const monitor = new SignalMonitor({
    runtime,
    signalInspector: {
      async buildSignalDebugSnapshot() {
        return buildSnapshot({ state: "BLOCKED" });
      }
    },
    telegramService: {
      async notifySignalReadiness() {
        notifyCount += 1;
      }
    }
  });

  await monitor.monitorSignalReadinessAlerts();

  assert.equal(notifyCount, 0);
  assert.equal(runtime.signalAlertState["BTCUSDT:BUY"].currentState, "BLOCKED");
});
