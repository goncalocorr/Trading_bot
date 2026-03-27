const logger = require("./logger");

class SignalMonitor {
  constructor({
    runtime,
    signalInspector,
    telegramService
  }) {
    this.runtime = runtime;
    this.signalInspector = signalInspector;
    this.telegramService = telegramService;
  }

  getCooldownMs(state) {
    const nearReadyMinutes = Number(process.env.TELEGRAM_NEAR_READY_COOLDOWN_MINUTES || 90);
    const readyMinutes = Number(process.env.TELEGRAM_READY_COOLDOWN_MINUTES || 30);
    return (state === "READY" ? readyMinutes : nearReadyMinutes) * 60 * 1000;
  }

  normalizeRecord(record) {
    if (!record) {
      return null;
    }

    // Support older in-memory shape where only the raw state string was stored.
    if (typeof record === "string") {
      return {
        currentState: record,
        lastNotifiedState: null,
        lastFingerprint: null,
        lastNotifiedAt: null
      };
    }

    return record;
  }

  buildFingerprint(debugSnapshot = {}) {
    return [
      debugSnapshot.readiness?.state || "BLOCKED",
      debugSnapshot.primaryReason || "",
      debugSnapshot.diagnostics?.multiTimeframe?.direction || "neutral",
      debugSnapshot.diagnostics?.marketState?.isSideways ? "sideways" : "tradeable",
      debugSnapshot.diagnostics?.fearGreed?.classification || "n/a"
    ].join("|");
  }

  shouldNotify(record, debugSnapshot) {
    const normalizedRecord = this.normalizeRecord(record);
    const nextState = debugSnapshot.readiness?.state || "BLOCKED";

    if (!["NEAR_READY", "READY"].includes(nextState)) {
      return false;
    }

    const now = Date.now();
    const fingerprint = this.buildFingerprint(debugSnapshot);
    const previousObservedState = normalizedRecord?.currentState || "BLOCKED";
    const lastNotifiedState = normalizedRecord?.lastNotifiedState || null;
    const lastFingerprint = normalizedRecord?.lastFingerprint || null;
    const lastNotifiedAt = normalizedRecord?.lastNotifiedAt
      ? new Date(normalizedRecord.lastNotifiedAt).getTime()
      : 0;
    const cooldownMs = this.getCooldownMs(nextState);
    const cooldownElapsed = !lastNotifiedAt || now - lastNotifiedAt >= cooldownMs;
    const enteredNewState = previousObservedState !== nextState;
    const upgradedToReady = nextState === "READY" && lastNotifiedState !== "READY";
    const fingerprintChanged = fingerprint !== lastFingerprint;

    if (!lastNotifiedAt) {
      return true;
    }

    if (upgradedToReady) {
      return true;
    }

    // Re-entering NEAR_READY should not spam unless enough time passed.
    if (enteredNewState && cooldownElapsed) {
      return true;
    }

    // READY can be reminded when the context meaningfully changes.
    if (nextState === "READY" && fingerprintChanged && cooldownElapsed) {
      return true;
    }

    // NEAR_READY only re-notifies when the reason/context changed after cooldown.
    if (nextState === "NEAR_READY" && fingerprintChanged && cooldownElapsed) {
      return true;
    }

    return false;
  }

  async monitorSignalReadinessAlerts() {
    for (const pair of this.runtime.tradingPairs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const debugSnapshot = await this.signalInspector.buildSignalDebugSnapshot({
          pair,
          side: "BUY",
          triggerSource: "auto",
          metadata: {
            monitor: "signal_readiness"
          }
        });
        const stateKey = `${pair}:BUY`;
        const previousRecord = this.normalizeRecord(this.runtime.signalAlertState[stateKey] || null);
        const nextState = debugSnapshot.readiness?.state || "BLOCKED";
        const fingerprint = this.buildFingerprint(debugSnapshot);
        const shouldNotify = this.shouldNotify(previousRecord, debugSnapshot);
        const nowIso = new Date().toISOString();

        if (shouldNotify) {
          // eslint-disable-next-line no-await-in-loop
          await this.telegramService.notifySignalReadiness(debugSnapshot);
        }

        this.runtime.signalAlertState[stateKey] = {
          currentState: nextState,
          lastObservedAt: nowIso,
          lastNotifiedState: shouldNotify
            ? nextState
            : previousRecord?.lastNotifiedState || null,
          lastFingerprint: shouldNotify
            ? fingerprint
            : previousRecord?.lastFingerprint || null,
          lastNotifiedAt: shouldNotify
            ? nowIso
            : previousRecord?.lastNotifiedAt || null
        };
      } catch (error) {
        logger.error(`Signal readiness monitor failed for ${pair}: ${error.message}`);
      }
    }
  }
}

module.exports = SignalMonitor;
