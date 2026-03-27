class CircuitBreakerService {
  constructor({
    runtime,
    telegramService,
    logger
  }) {
    this.runtime = runtime;
    this.telegramService = telegramService;
    this.logger = logger;
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
    this.runtime.persistState?.();
    return this.runtime.circuitBreakers;
  }

  resetAll() {
    this.runtime.circuitBreakers = {
      executionFailures: 0,
      exchangeFailures: 0,
      lastTriggeredAt: null,
      lastReason: null
    };
    this.runtime.persistState?.();

    return this.runtime.circuitBreakers;
  }

  async trip(reason, metadata = {}) {
    this.runtime.botEnabled = false;
    this.runtime.autoPauseReason = reason;
    this.runtime.circuitBreakers.lastTriggeredAt = new Date().toISOString();
    this.runtime.circuitBreakers.lastReason = reason;

    this.logger?.warn("circuit_breaker_tripped", {
      reason,
      ...metadata,
      counters: this.runtime.circuitBreakers
    });

    if (this.telegramService?.notifyCircuitBreakerTriggered) {
      await this.telegramService.notifyCircuitBreakerTriggered({
        reason,
        ...metadata,
        counters: this.runtime.circuitBreakers
      });
    }

    await this.runtime.persistState?.();
    return {
      tripped: true,
      reason
    };
  }

  isTransientError(error) {
    const message = String(error?.message || "").toLowerCase();
    const status = Number(error?.status || 0);
    return (
      status === 429 ||
      status === 503 ||
      status === 502 ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("no response received")
    );
  }

  async recordFailure(type, error, metadata = {}) {
    const thresholds = this.getThresholds();
    const counterKey = type === "exchange" ? "exchangeFailures" : "executionFailures";
    const maxKey = type === "exchange" ? "maxExchangeFailures" : "maxExecutionFailures";
    const isTransient = this.isTransientError(error);

    // Transient errors require more failures before tripping
    const effectiveThreshold = isTransient
      ? Number(thresholds[maxKey]) * 2
      : Number(thresholds[maxKey]);

    this.runtime.circuitBreakers[counterKey] = Number(this.runtime.circuitBreakers[counterKey] || 0) + 1;
    this.logger?.warn("circuit_breaker_failure_recorded", {
      failureType: type,
      counterKey,
      counterValue: this.runtime.circuitBreakers[counterKey],
      effectiveThreshold,
      isTransient,
      message: error?.message || String(error || "Unknown failure")
    });
    await this.runtime.persistState?.();

    if (Number(this.runtime.circuitBreakers[counterKey]) >= effectiveThreshold) {
      return this.trip(`${type}_circuit_breaker`, {
        error: error?.message || String(error || "Unknown failure"),
        failureType: type,
        isTransient,
        ...metadata
      });
    }

    return {
      tripped: false,
      counter: this.runtime.circuitBreakers[counterKey],
      effectiveThreshold
    };
  }

  recordSuccess(type) {
    const counterKey = type === "exchange" ? "exchangeFailures" : "executionFailures";
    return this.resetCounter(counterKey);
  }

  async checkAutoReset() {
    const autoResetMinutes = Number(process.env.CIRCUIT_BREAKER_AUTO_RESET_MINUTES || 30);

    if (this.runtime.botEnabled || autoResetMinutes <= 0) {
      return { reset: false };
    }

    const lastTriggeredAt = this.runtime.circuitBreakers?.lastTriggeredAt;

    if (!lastTriggeredAt) {
      return { reset: false };
    }

    const elapsedMinutes = (Date.now() - new Date(lastTriggeredAt).getTime()) / 60000;

    if (elapsedMinutes < autoResetMinutes) {
      return { reset: false, remainingMinutes: Math.ceil(autoResetMinutes - elapsedMinutes) };
    }

    this.runtime.botEnabled = true;
    this.runtime.autoPauseReason = null;
    this.resetAll();

    this.logger?.info("circuit_breaker_auto_reset", {
      elapsedMinutes: Math.round(elapsedMinutes),
      autoResetMinutes
    });

    if (this.telegramService?.sendMessage) {
      const locale = this.runtime?.notificationLocale || "en";
      const msg = locale === "pt-PT"
        ? `\u26A1 Circuit breaker resetado automaticamente apos ${Math.round(elapsedMinutes)} min. Bot reativado.`
        : `\u26A1 Circuit breaker auto-reset after ${Math.round(elapsedMinutes)} min. Bot reactivated.`;
      await this.telegramService.sendMessage(msg);
    }

    return { reset: true, elapsedMinutes: Math.round(elapsedMinutes) };
  }
}

module.exports = CircuitBreakerService;
