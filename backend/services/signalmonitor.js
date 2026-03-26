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
        const previousState = this.runtime.signalAlertState[stateKey] || "BLOCKED";
        const nextState = debugSnapshot.readiness?.state || "BLOCKED";

        if (["NEAR_READY", "READY"].includes(nextState) && previousState !== nextState) {
          // eslint-disable-next-line no-await-in-loop
          await this.telegramService.notifySignalReadiness(debugSnapshot);
        }

        this.runtime.signalAlertState[stateKey] = nextState;
      } catch (error) {
        console.error(`Signal readiness monitor failed for ${pair}: ${error.message}`);
      }
    }
  }
}

module.exports = SignalMonitor;
