const test = require("node:test");
const assert = require("node:assert/strict");

const CircuitBreakerService = require("../services/circuitbreaker");

test("circuit breaker trips after configured execution failure threshold", async () => {
  process.env.CIRCUIT_BREAKER_MAX_EXECUTION_FAILURES = "2";

  const runtime = {
    botEnabled: true,
    autoPauseReason: null,
    circuitBreakers: {
      executionFailures: 0,
      exchangeFailures: 0,
      lastTriggeredAt: null,
      lastReason: null
    }
  };
  const notifications = [];
  const service = new CircuitBreakerService({
    runtime,
    telegramService: {
      async notifyCircuitBreakerTriggered(payload) {
        notifications.push(payload);
      }
    }
  });

  const first = await service.recordFailure("execution", new Error("first failure"));
  assert.equal(first.tripped, false);
  assert.equal(runtime.circuitBreakers.executionFailures, 1);

  const second = await service.recordFailure("execution", new Error("second failure"));
  assert.equal(second.tripped, true);
  assert.equal(runtime.botEnabled, false);
  assert.equal(runtime.autoPauseReason, "execution_circuit_breaker");
  assert.equal(runtime.circuitBreakers.lastReason, "execution_circuit_breaker");
  assert.equal(notifications.length, 1);
});

test("circuit breaker resetAll clears counters and trigger reason", () => {
  const runtime = {
    circuitBreakers: {
      executionFailures: 3,
      exchangeFailures: 1,
      lastTriggeredAt: "2026-03-26T00:00:00.000Z",
      lastReason: "execution_circuit_breaker"
    }
  };
  const service = new CircuitBreakerService({
    runtime,
    telegramService: null
  });

  const result = service.resetAll();
  assert.deepEqual(result, {
    executionFailures: 0,
    exchangeFailures: 0,
    lastTriggeredAt: null,
    lastReason: null
  });
});
