class CircuitBreakerService {
  constructor({
    runtime,
    telegramService
  }) {
    this.runtime = runtime;
    this.telegramService = telegramService;
  }

  getThresholds() {
    return {
      maxExecutionFailures: Number(process.env.CIRCUIT_BREAKER_MAX_EXECUTION_FAILURES || 3),
      maxExchangeFailures: Number(process.env.CIRCUIT_BREAKER_MAX_EXCHANGE_FAILURES || 3)
    };
  }

  resetCounter(counterKey) {
    if (!this.runtime.circuitBreakers[counterKey]) {
      return this.runtime.circuitBreakers;
    }

    this.runtime.circuitBreakers[counterKey] = 0;
    return this.runtime.circuitBreakers;
  }

  resetAll() {
    this.runtime.circuitBreakers = {
      executionFailures: 0,
      exchangeFailures: 0,
      lastTriggeredAt: null,
      lastReason: null
    };

    return this.runtime.circuitBreakers;
  }

  async trip(reason, metadata = {}) {
    this.runtime.botEnabled = false;
    this.runtime.autoPauseReason = reason;
    this.runtime.circuitBreakers.lastTriggeredAt = new Date().toISOString();
    this.runtime.circuitBreakers.lastReason = reason;

    if (this.telegramService?.notifyCircuitBreakerTriggered) {
      await this.telegramService.notifyCircuitBreakerTriggered({
        reason,
        ...metadata,
        counters: this.runtime.circuitBreakers
      });
    }

    return {
      tripped: true,
      reason
    };
  }

  async recordFailure(type, error, metadata = {}) {
    const thresholds = this.getThresholds();
    const counterKey = type === "exchange" ? "exchangeFailures" : "executionFailures";
    const maxKey = type === "exchange" ? "maxExchangeFailures" : "maxExecutionFailures";
    this.runtime.circuitBreakers[counterKey] = Number(this.runtime.circuitBreakers[counterKey] || 0) + 1;

    if (Number(this.runtime.circuitBreakers[counterKey]) >= Number(thresholds[maxKey])) {
      return this.trip(`${type}_circuit_breaker`, {
        error: error?.message || String(error || "Unknown failure"),
        failureType: type,
        ...metadata
      });
    }

    return {
      tripped: false,
      counter: this.runtime.circuitBreakers[counterKey]
    };
  }

  recordSuccess(type) {
    const counterKey = type === "exchange" ? "exchangeFailures" : "executionFailures";
    return this.resetCounter(counterKey);
  }
}

module.exports = CircuitBreakerService;
