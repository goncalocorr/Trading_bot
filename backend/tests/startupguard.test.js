const test = require("node:test");
const assert = require("node:assert/strict");

const StartupGuard = require("../services/startupguard");

test("startup guard pauses live trading when exchange account access fails in strict mode", async () => {
  process.env.STARTUP_STRICT_MODE = "true";

  const runtime = {
    tradingMode: "live",
    autonomyMode: "full_auto",
    approvedLiveRunId: 15,
    autoPauseReason: null
  };
  const updates = [];
  const guard = new StartupGuard({
    runtime,
    db: {
      async testConnection() {
        return true;
      }
    },
    binanceService: {
      async ping() {
        return true;
      },
      async getAccountInfo() {
        throw new Error("account denied");
      }
    },
    macroEventsService: {
      async evaluateMacroPause() {
        return { status: { reason: "Macro feed OK." } };
      }
    },
    reconcileExchangeTrades: async () => {},
    executionOrchestrator: {
      async manageOpenTrades() {
        return true;
      }
    },
    updateRuntimeSettings(payload) {
      updates.push(payload);
      if (typeof payload.botEnabled === "boolean") {
        runtime.botEnabled = payload.botEnabled;
      }
    }
  });

  const result = await guard.run();
  assert.equal(result.overallOk, false);
  assert.equal(runtime.botEnabled, false);
  assert.equal(runtime.autoPauseReason, "startup_guard_failed");
  assert.deepEqual(updates[0], { botEnabled: false });
});
