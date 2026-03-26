const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || "";
    this.chatId = process.env.TELEGRAM_CHAT_ID || "";
    this.http = axios.create({
      timeout: 12000
    });
  }

  isConfigured() {
    return Boolean(this.token && this.chatId);
  }

  getApiUrl(method) {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  formatScoreBreakdown(scoreBreakdown = {}) {
    const items = Array.isArray(scoreBreakdown.items) ? scoreBreakdown.items : [];

    return items
      .map((item) => `${item.passed ? "OK" : "NO"} ${item.label}: ${item.points}/${item.maxPoints}`)
      .join("\n");
  }

  formatTradeOpenedMessage(trade = {}) {
    return [
      `Trade opened`,
      `Pair: ${trade.pair}`,
      `Side: ${trade.side}`,
      `Order type: ${trade.orderType}`,
      `Entry: ${trade.entryPrice}`,
      `Quantity: ${trade.quantity}`,
      `Stop Loss: ${trade.stopLoss}`,
      `Take Profit: ${trade.takeProfit}`,
      `Score: ${trade.scoreTotal}/12`,
      trade.scoreBreakdown ? this.formatScoreBreakdown(trade.scoreBreakdown) : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatTradeClosedMessage(trade = {}) {
    return [
      `Trade closed`,
      `Pair: ${trade.pair}`,
      `Side: ${trade.side}`,
      `Exit: ${trade.exitPrice}`,
      `PnL: ${trade.resultPnl}`,
      `PnL %: ${trade.resultPercent}`,
      `Duration: ${trade.durationSeconds || 0}s`,
      trade.status ? `Status: ${trade.status}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatDrawdownPauseMessage(payload = {}) {
    return [
      `Trading paused`,
      `Reason: Daily drawdown limit hit`,
      `Daily PnL: ${payload.dailyPnl}`,
      `Drawdown value: ${payload.drawdownValue}`,
      `Threshold: ${payload.thresholdValue}`,
      payload.resumeAt ? `Resume at: ${new Date(payload.resumeAt).toISOString()}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatMacroPauseMessage(payload = {}) {
    return [
      `Macro pause`,
      `Event: ${payload.event?.title || "Unknown event"}`,
      payload.pauseWindowStart ? `Pause from: ${new Date(payload.pauseWindowStart).toISOString()}` : null,
      payload.pauseWindowEnd ? `Resume at: ${new Date(payload.pauseWindowEnd).toISOString()}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatReportMessage(report = {}) {
    return [
      `${String(report.type || "report").toUpperCase()} report`,
      `Period: ${report.period || "n/a"}`,
      report.summary || null,
      report.paperSummary || null,
      report.liveSummary || null,
      report.autonomySummary || null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatSignalReadinessMessage(payload = {}) {
    const timeframeSummary = [
      `15m: ${payload.timeframes?.["15m"]?.trend?.bias || "neutral"}`,
      `1h: ${payload.timeframes?.["1h"]?.trend?.bias || "neutral"}`,
      `4h: ${payload.timeframes?.["4h"]?.trend?.bias || "neutral"}`
    ].join(" | ");

    return [
      `Signal ${payload.readiness?.state || "UPDATE"}`,
      `Pair: ${payload.pair || "n/a"}`,
      `Side: ${payload.side || "BUY"}`,
      `Mode: ${payload.tradingMode || "n/a"}`,
      `Score: ${payload.score?.totalScore || 0}/${payload.score?.maxScore || 12}`,
      `Reason: ${payload.primaryReason || payload.readiness?.reason || "No reason provided."}`,
      `Higher TF: ${payload.diagnostics?.multiTimeframe?.aligned ? "aligned" : "not aligned"} (${payload.diagnostics?.multiTimeframe?.direction || "neutral"})`,
      `Market regime: ${payload.diagnostics?.marketState?.isSideways ? "sideways" : "tradeable"}`,
      `Fear & Greed: ${payload.diagnostics?.fearGreed?.classification || "n/a"}`,
      timeframeSummary
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatStrategyDegradationMessage(payload = {}) {
    return [
      "Strategy degradation alert",
      `Strategy: ${payload.strategyId || "unknown"}`,
      `Trades reviewed: ${payload.tradeCount || 0}`,
      `Win rate: ${Number(payload.winRate || 0).toFixed(2)}%`,
      `Total PnL: ${Number(payload.pnlTotal || 0).toFixed(4)}`,
      payload.reason || null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatPaperValidationUpdate(payload = {}) {
    return [
      payload.title || "Paper validation update",
      payload.slot ? `Slot: ${payload.slot}` : null,
      payload.action ? `Action: ${payload.action}` : null,
      payload.runId ? `Run: #${payload.runId}` : null,
      payload.reason || null,
      payload.performance
        ? `Trades: ${payload.performance.tradeCount || 0} | Win rate: ${Number(payload.performance.winRate || 0).toFixed(2)}% | PnL: ${Number(payload.performance.pnlTotal || 0).toFixed(4)}`
        : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatPaperValidationRecommendation(payload = {}) {
    return [
      payload.title || "Paper recommendation",
      payload.championRunId ? `Champion: #${payload.championRunId}` : "Champion: none",
      payload.challengerRunId ? `Challenger: #${payload.challengerRunId}` : null,
      payload.recommendation?.action ? `Recommendation: ${payload.recommendation.action}` : null,
      payload.recommendation?.reason || null,
      payload.headToHead
        ? `PnL delta: ${Number(payload.headToHead.pnlDelta || 0).toFixed(4)} | Win rate delta: ${Number(payload.headToHead.winRateDelta || 0).toFixed(2)}%`
        : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatCircuitBreakerMessage(payload = {}) {
    return [
      "Circuit breaker triggered",
      payload.reason ? `Reason: ${payload.reason}` : null,
      payload.failureType ? `Failure type: ${payload.failureType}` : null,
      payload.error ? `Error: ${payload.error}` : null,
      payload.counters
        ? `Execution failures: ${Number(payload.counters.executionFailures || 0)} | Exchange failures: ${Number(payload.counters.exchangeFailures || 0)}`
        : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatAutonomyHeartbeat(payload = {}) {
    return [
      "Autonomy heartbeat",
      payload.mode ? `Mode: ${payload.mode}` : null,
      payload.tradingMode ? `Trading: ${payload.tradingMode}` : null,
      payload.currentRegimeId ? `Regime: ${payload.currentRegimeId}` : null,
      payload.strategySelection?.strategyIds?.length
        ? `Strategies: ${payload.strategySelection.strategyIds.join(", ")}`
        : null,
      payload.liveReadiness?.approvalGate?.status
        ? `Live gate: ${payload.liveReadiness.approvalGate.status}`
        : null,
      payload.autoPauseReason ? `Auto pause: ${payload.autoPauseReason}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  async sendMessage(text, options = {}) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        skipped: true,
        reason: "Telegram not configured."
      };
    }

    try {
      const response = await this.http.post(this.getApiUrl("sendMessage"), {
        chat_id: this.chatId,
        text,
        parse_mode: options.parseMode || "HTML",
        disable_web_page_preview: true
      });

      return {
        ok: true,
        data: response.data
      };
    } catch (error) {
      return {
        ok: false,
        skipped: false,
        reason: error.response?.data?.description || error.message
      };
    }
  }

  async notifyTradeOpened(trade) {
    return this.sendMessage(this.formatTradeOpenedMessage(trade));
  }

  async notifyTradeClosed(trade) {
    return this.sendMessage(this.formatTradeClosedMessage(trade));
  }

  async notifyDrawdownPause(payload) {
    return this.sendMessage(this.formatDrawdownPauseMessage(payload));
  }

  async notifyMacroPause(payload) {
    return this.sendMessage(this.formatMacroPauseMessage(payload));
  }

  async notifyReport(report) {
    return this.sendMessage(this.formatReportMessage(report));
  }

  async notifySignalReadiness(payload) {
    return this.sendMessage(this.formatSignalReadinessMessage(payload));
  }

  async notifyStrategyDegradation(payload) {
    return this.sendMessage(this.formatStrategyDegradationMessage(payload));
  }

  async notifyPaperValidationUpdate(payload) {
    return this.sendMessage(this.formatPaperValidationUpdate(payload));
  }

  async notifyPaperValidationRecommendation(payload) {
    return this.sendMessage(this.formatPaperValidationRecommendation(payload));
  }

  async notifyCircuitBreakerTriggered(payload) {
    return this.sendMessage(this.formatCircuitBreakerMessage(payload));
  }

  async notifyAutonomyHeartbeat(payload) {
    return this.sendMessage(this.formatAutonomyHeartbeat(payload));
  }
}

module.exports = new TelegramService();
