const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const cron = require("node-cron");
const rateLimit = require("express-rate-limit");

const db = require("./models/db");
const OrderModel = require("./models/Order");
const TradeModel = require("./models/Trade");
const ReportModel = require("./models/Report");
const BacktestRunModel = require("./models/BacktestRun");
const BacktestRunMarkModel = require("./models/BacktestRunMark");
const BacktestPromotionEventModel = require("./models/BacktestPromotionEvent");
const RuntimeStateModel = require("./models/RuntimeState");
const binanceService = require("./services/binance");
const executionEngine = require("./services/executionengine");
const ExecutionOrchestrator = require("./services/executionorchestrator");
const SignalInspector = require("./services/signalinspector");
const SignalMonitor = require("./services/signalmonitor");
const StrategyHealthMonitor = require("./services/strategyhealthmonitor");
const DashboardBuilder = require("./services/dashboardbuilder");
const TradeAnalytics = require("./services/tradeanalytics");
const StrategyRegistry = require("./services/strategyregistry");
const StrategyRunner = require("./services/strategyrunner");
const PaperValidationService = require("./services/papervalidation");
const PaperValidationMonitor = require("./services/papervalidationmonitor");
const CapitalAllocator = require("./services/capitalallocator");
const CircuitBreakerService = require("./services/circuitbreaker");
const AutonomousOperator = require("./services/autonomousoperator");
const StartupGuard = require("./services/startupguard");
const HealthMonitor = require("./services/healthmonitor");
const RuntimePersistenceService = require("./services/runtimepersistence");
const logger = require("./services/logger");
const indicatorsService = require("./services/indicators");
const scorerService = require("./services/scorer");
const riskManager = require("./services/riskmanager");
const macroEventsService = require("./services/macroevents");
const telegramService = require("./services/telegram");
const reporterService = require("./services/reporter");

const createWebhookRouter = require("./routes/webhook");
const createTradesRouter = require("./routes/trades");
const createDashboardRouter = require("./routes/dashboard");
const createCancelRouter = require("./routes/cancel");
const createBacktestRouter = require("./routes/backtest");
const backtesterService = require("./services/backtester");
const paperBroker = require("./services/paperbroker");
const { requireApiKey } = require("./middleware/auth");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const DEFAULT_SCORE_THRESHOLD = 8;

const runtime = {
  botEnabled: true,
  tradingMode: executionEngine.getMode(),
  autonomyMode: String(process.env.AUTONOMY_MODE || "manual").toLowerCase(),
  shadowModeEnabled: parseBooleanEnv(process.env.SHADOW_MODE_ENABLED, false),
  autonomyHeartbeatEnabled: parseBooleanEnv(process.env.AUTONOMY_HEARTBEAT_ENABLED, false),
  autoSwapEnabled: parseBooleanEnv(process.env.AUTO_SWAP_ENABLED, false),
  autoApproveLiveEnabled: parseBooleanEnv(process.env.AUTO_APPROVE_LIVE_ENABLED, false),
  autoLiveDeployEnabled: parseBooleanEnv(process.env.AUTO_LIVE_DEPLOY_ENABLED, false),
  scoreThreshold: Number(process.env.SCORE_THRESHOLD || DEFAULT_SCORE_THRESHOLD),
  riskPerTrade: Number(process.env.RISK_PER_TRADE || 0.01),
  compoundRatio: Number(process.env.COMPOUND_RATIO || 0.5),
  tradingPairs: parseTradingPairs(process.env.TRADING_PAIRS || "BTCUSDT"),
  lastMacroAlertKey: null,
  lastDrawdownAlertKey: null,
  signalAlertState: {},
  strategyHealthAlertState: {},
  championRunId: Number(process.env.CHAMPION_RUN_ID || 0) || null,
  challengerRunId: Number(process.env.CHALLENGER_RUN_ID || 0) || null,
  regimeChampionTrendRunId: Number(process.env.REGIME_CHAMPION_TREND_RUN_ID || 0) || null,
  regimeChampionSidewaysRunId: Number(process.env.REGIME_CHAMPION_SIDEWAYS_RUN_ID || 0) || null,
  regimeChampionVolatileRunId: Number(process.env.REGIME_CHAMPION_VOLATILE_RUN_ID || 0) || null,
  approvedLiveRunId: Number(process.env.APPROVED_LIVE_RUN_ID || 0) || null,
  paperValidationAlertKey: null,
  autoPauseReason: null,
  shadowLastSummary: null,
  lastAutonomySnapshot: null,
  circuitBreakers: {
    executionFailures: 0,
    exchangeFailures: 0,
    lastTriggeredAt: null,
    lastReason: null
  }
};

const executionOrchestrator = new ExecutionOrchestrator({
  executionEngine,
  tradeModel: TradeModel,
  orderModel: OrderModel,
  riskManager,
  telegramService,
  logger: logger.child({ component: "execution_orchestrator" })
});

const signalInspector = new SignalInspector({
  runtime,
  executionEngine,
  scorerService,
  determineRuntimeDecision,
  evaluateSignalExecutionGuards,
  checkTradingPauseStatus: () => checkTradingPauseStatus(),
  checkBuyEntryAvailability: (pair) => checkBuyEntryAvailability(pair),
  getBotStatus
});

const signalMonitor = new SignalMonitor({
  runtime,
  signalInspector,
  telegramService
});

const strategyHealthMonitor = new StrategyHealthMonitor({
  runtime,
  tradeModel: TradeModel,
  telegramService
});

const tradeAnalytics = new TradeAnalytics();
const paperValidationService = new PaperValidationService({
  runtime,
  tradeAnalytics,
  backtestRuns: BacktestRunModel,
  promotionEvents: BacktestPromotionEventModel
});
const paperValidationMonitor = new PaperValidationMonitor({
  runtime,
  tradeModel: TradeModel,
  paperValidationService,
  promotionEvents: BacktestPromotionEventModel,
  telegramService,
  updateRuntimeSettings
});

const dashboardBuilder = new DashboardBuilder({
  executionEngine,
  orderModel: OrderModel,
  riskManager,
  tradeModel: TradeModel,
  getTradeStatistics: () => getTradeStatistics(),
  getBotStatus
});

const strategyRegistry = new StrategyRegistry();
const strategyRunner = new StrategyRunner({
  runtime,
  binanceService,
  indicatorsService,
  processSignal: (payload) => processSignal(payload),
  strategyRegistry
});
const capitalAllocator = new CapitalAllocator();
const circuitBreaker = new CircuitBreakerService({
  runtime,
  telegramService,
  logger: logger.child({ component: "circuit_breaker" })
});
const autonomousOperator = new AutonomousOperator({
  runtime,
  signalInspector,
  strategyRunner,
  paperValidationService,
  backtestRuns: BacktestRunModel,
  capitalAllocator,
  riskManager,
  circuitBreaker,
  telegramService,
  inferCurrentRegimeId: inferCurrentRegimeIdFromDebug,
  logger: logger.child({ component: "autonomous_operator" })
});
const runtimePersistence = new RuntimePersistenceService({
  runtimeStateModel: RuntimeStateModel,
  logger: logger.child({ component: "runtime_persistence" })
});
const startupGuard = new StartupGuard({
  runtime,
  db,
  binanceService,
  macroEventsService,
  reconcileExchangeTrades,
  executionOrchestrator,
  updateRuntimeSettings,
  logger: logger.child({ component: "startup_guard" })
});
const healthMonitor = new HealthMonitor({
  runtime,
  db,
  binanceService,
  executionEngine,
  macroEventsService
});

function persistRuntimeState() {
  return runtimePersistence.persistRuntime(runtime).catch((error) => {
    logger.error("runtime_state_persist_failed", {
      message: error.message
    });
  });
}

runtime.persistState = persistRuntimeState;

function parseTradingPairs(value) {
  return String(value || "")
    .split(",")
    .map((pair) => pair.trim().toUpperCase())
    .filter(Boolean);
}

function parseBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function getRuntimeSettings() {
  return {
    botEnabled: runtime.botEnabled,
    tradingMode: runtime.tradingMode,
    autonomyMode: runtime.autonomyMode,
    shadowModeEnabled: runtime.shadowModeEnabled,
    autonomyHeartbeatEnabled: runtime.autonomyHeartbeatEnabled,
    autoSwapEnabled: runtime.autoSwapEnabled,
    autoApproveLiveEnabled: runtime.autoApproveLiveEnabled,
    autoLiveDeployEnabled: runtime.autoLiveDeployEnabled,
    scoreThreshold: runtime.scoreThreshold,
    riskPerTrade: runtime.riskPerTrade,
    compoundRatio: runtime.compoundRatio,
    tradingPairs: runtime.tradingPairs,
    activeStrategies: String(process.env.ACTIVE_STRATEGIES || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    championRunId: runtime.championRunId,
    challengerRunId: runtime.challengerRunId,
    regimeChampionTrendRunId: runtime.regimeChampionTrendRunId,
    regimeChampionSidewaysRunId: runtime.regimeChampionSidewaysRunId,
    regimeChampionVolatileRunId: runtime.regimeChampionVolatileRunId,
    approvedLiveRunId: runtime.approvedLiveRunId,
    autoPauseReason: runtime.autoPauseReason,
    shadowLastSummary: runtime.shadowLastSummary,
    lastAutonomySnapshot: runtime.lastAutonomySnapshot,
    circuitBreakers: runtime.circuitBreakers
  };
}

function updateRuntimeSettings(payload = {}) {
  if (typeof payload.botEnabled === "boolean") {
    runtime.botEnabled = payload.botEnabled;
    if (payload.botEnabled) {
      runtime.autoPauseReason = null;
      circuitBreaker.resetAll();
    }
  }

  if (payload.tradingMode !== undefined) {
    runtime.tradingMode = String(payload.tradingMode).toLowerCase() === "live" ? "live" : "paper";
    process.env.TRADING_MODE = runtime.tradingMode;
  }

  if (payload.autonomyMode !== undefined) {
    runtime.autonomyMode = ["manual", "supervised_auto", "full_auto"].includes(String(payload.autonomyMode).toLowerCase())
      ? String(payload.autonomyMode).toLowerCase()
      : "manual";
    process.env.AUTONOMY_MODE = runtime.autonomyMode;
  }

  if (payload.shadowModeEnabled !== undefined) {
    runtime.shadowModeEnabled = Boolean(payload.shadowModeEnabled);
    process.env.SHADOW_MODE_ENABLED = runtime.shadowModeEnabled ? "true" : "false";
  }

  if (payload.autonomyHeartbeatEnabled !== undefined) {
    runtime.autonomyHeartbeatEnabled = Boolean(payload.autonomyHeartbeatEnabled);
    process.env.AUTONOMY_HEARTBEAT_ENABLED = runtime.autonomyHeartbeatEnabled ? "true" : "false";
  }

  if (payload.autoSwapEnabled !== undefined) {
    runtime.autoSwapEnabled = Boolean(payload.autoSwapEnabled);
    process.env.AUTO_SWAP_ENABLED = runtime.autoSwapEnabled ? "true" : "false";
  }

  if (payload.autoApproveLiveEnabled !== undefined) {
    runtime.autoApproveLiveEnabled = Boolean(payload.autoApproveLiveEnabled);
    process.env.AUTO_APPROVE_LIVE_ENABLED = runtime.autoApproveLiveEnabled ? "true" : "false";
  }

  if (payload.autoLiveDeployEnabled !== undefined) {
    runtime.autoLiveDeployEnabled = Boolean(payload.autoLiveDeployEnabled);
    process.env.AUTO_LIVE_DEPLOY_ENABLED = runtime.autoLiveDeployEnabled ? "true" : "false";
  }

  if (payload.scoreThreshold !== undefined) {
    runtime.scoreThreshold = Number(payload.scoreThreshold);
    process.env.SCORE_THRESHOLD = String(runtime.scoreThreshold);
  }

  if (payload.riskPerTrade !== undefined) {
    runtime.riskPerTrade = Number(payload.riskPerTrade);
    process.env.RISK_PER_TRADE = String(runtime.riskPerTrade);
  }

  if (payload.compoundRatio !== undefined) {
    runtime.compoundRatio = Number(payload.compoundRatio);
    process.env.COMPOUND_RATIO = String(runtime.compoundRatio);
  }

  if (Array.isArray(payload.tradingPairs) && payload.tradingPairs.length > 0) {
    runtime.tradingPairs = payload.tradingPairs.map((pair) => String(pair).toUpperCase());
    process.env.TRADING_PAIRS = runtime.tradingPairs.join(",");
  }

  if (Array.isArray(payload.activeStrategies) && payload.activeStrategies.length > 0) {
    process.env.ACTIVE_STRATEGIES = payload.activeStrategies.map((item) => String(item).trim()).filter(Boolean).join(",");
  }

  if (payload.championRunId !== undefined) {
    runtime.championRunId = payload.championRunId ? Number(payload.championRunId) : null;
    process.env.CHAMPION_RUN_ID = runtime.championRunId ? String(runtime.championRunId) : "";
  }

  if (payload.challengerRunId !== undefined) {
    runtime.challengerRunId = payload.challengerRunId ? Number(payload.challengerRunId) : null;
    process.env.CHALLENGER_RUN_ID = runtime.challengerRunId ? String(runtime.challengerRunId) : "";
  }

  if (payload.regimeChampionTrendRunId !== undefined) {
    runtime.regimeChampionTrendRunId = payload.regimeChampionTrendRunId ? Number(payload.regimeChampionTrendRunId) : null;
    process.env.REGIME_CHAMPION_TREND_RUN_ID = runtime.regimeChampionTrendRunId ? String(runtime.regimeChampionTrendRunId) : "";
  }

  if (payload.regimeChampionSidewaysRunId !== undefined) {
    runtime.regimeChampionSidewaysRunId = payload.regimeChampionSidewaysRunId ? Number(payload.regimeChampionSidewaysRunId) : null;
    process.env.REGIME_CHAMPION_SIDEWAYS_RUN_ID = runtime.regimeChampionSidewaysRunId ? String(runtime.regimeChampionSidewaysRunId) : "";
  }

  if (payload.regimeChampionVolatileRunId !== undefined) {
    runtime.regimeChampionVolatileRunId = payload.regimeChampionVolatileRunId ? Number(payload.regimeChampionVolatileRunId) : null;
    process.env.REGIME_CHAMPION_VOLATILE_RUN_ID = runtime.regimeChampionVolatileRunId ? String(runtime.regimeChampionVolatileRunId) : "";
  }

  if (payload.approvedLiveRunId !== undefined) {
    runtime.approvedLiveRunId = payload.approvedLiveRunId ? Number(payload.approvedLiveRunId) : null;
    process.env.APPROVED_LIVE_RUN_ID = runtime.approvedLiveRunId ? String(runtime.approvedLiveRunId) : "";
  }

  persistRuntimeState();
  return getRuntimeSettings();
}

function inferCurrentRegimeIdFromDebug(debug) {
  const marketState = debug?.diagnostics?.marketState;
  const multiTimeframe = debug?.diagnostics?.multiTimeframe;
  const atrPercent = Number(marketState?.atrPercent || 0);
  const minAtrPercent = Number(marketState?.minAtrPercent || 0);
  const volatileThreshold = Math.max(minAtrPercent * 2, 0.8);

  if (marketState?.isSideways) {
    return "sideways";
  }

  if (atrPercent >= volatileThreshold) {
    return "volatile";
  }

  if (multiTimeframe?.aligned) {
    return "trend";
  }

  return "mixed";
}

function inferRegimeIdFromIndicators(indicators = {}) {
  const marketState = indicators?.["15m"]?.marketState;
  const multiTimeframe = indicators?.multiTimeframe;
  const atrPercent = Number(marketState?.atrPercent || 0);
  const minAtrPercent = Number(marketState?.minAtrPercent || 0);
  const volatileThreshold = Math.max(minAtrPercent * 2, 0.8);

  if (marketState?.isSideways) {
    return "sideways";
  }

  if (atrPercent >= volatileThreshold) {
    return "volatile";
  }

  if (multiTimeframe?.aligned) {
    return "trend";
  }

  return "mixed";
}

function buildPaperValidationMetadata(currentRegimeId = null) {
  const regimeChampionRunIds = {
    trend: runtime.regimeChampionTrendRunId,
    sideways: runtime.regimeChampionSidewaysRunId,
    volatile: runtime.regimeChampionVolatileRunId
  };
  const activeRegimeChampionRunId =
    currentRegimeId && regimeChampionRunIds[currentRegimeId]
      ? regimeChampionRunIds[currentRegimeId]
      : null;
  const promotedRunId = activeRegimeChampionRunId || runtime.championRunId || runtime.approvedLiveRunId || null;

  return {
    promotedRunId,
    championRunId: runtime.championRunId || null,
    challengerRunId: runtime.challengerRunId || null,
    approvedLiveRunId: runtime.approvedLiveRunId || null,
    slot: activeRegimeChampionRunId ? "regime_champion" : runtime.championRunId ? "champion" : null,
    currentRegimeId: currentRegimeId || null,
    activeRegimeChampionRunId,
    regimeChampionRunIds,
    activeStrategies: String(process.env.ACTIVE_STRATEGIES || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

function determineRuntimeDecision(scoreTotal) {
  if (scoreTotal >= runtime.scoreThreshold) {
    return "EXECUTE";
  }

  if (scoreTotal >= 5) {
    return "MISSED";
  }

  return "IGNORE";
}

function evaluateSignalExecutionGuards(scoreResult, signalSide) {
  const normalizedSide = String(signalSide || "").toUpperCase();
  const multiTimeframe = scoreResult?.snapshots?.indicators?.multiTimeframe;
  const spreadAccepted = Boolean(scoreResult?.snapshots?.orderBook?.acceptableSpread);
  const signalMarketState = scoreResult?.snapshots?.indicators?.["15m"]?.marketState;

  if (!multiTimeframe?.aligned || multiTimeframe.direction !== normalizedSide) {
    return {
      blocked: true,
      reason: "Higher timeframe alignment (1H + 4H) does not support this trade direction."
    };
  }

  if (!spreadAccepted) {
    return {
      blocked: true,
      reason: "Spread above 0.1%, market considered too illiquid for execution."
    };
  }

  if (normalizedSide === "BUY" && signalMarketState?.isSideways) {
    return {
      blocked: true,
      reason: signalMarketState.reason
    };
  }

  return {
    blocked: false
  };
}

function isLastUtcDayOfMonth(date = new Date()) {
  const tomorrow = new Date(date);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.getUTCDate() === 1;
}

async function ensureInitialCapitalSnapshot() {
  const capitalState = await riskManager.getLatestCapitalState();

  if (!capitalState.id) {
    await riskManager.recordCapitalSnapshot({
      capitalValue: capitalState.capitalValue,
      realizedProfit: capitalState.realizedProfit,
      unrealizedPnl: capitalState.unrealizedPnl
    });
  }
}

async function getCapitalHistory(range = "ALL") {
  const normalizedRange = String(range || "ALL").toUpperCase();
  const params = {};
  let whereClause = "";

  if (normalizedRange !== "ALL") {
    const now = new Date();
    const start = new Date(now);

    if (normalizedRange === "1D") {
      start.setUTCDate(start.getUTCDate() - 1);
    } else if (normalizedRange === "1W") {
      start.setUTCDate(start.getUTCDate() - 7);
    } else if (normalizedRange === "1M") {
      start.setUTCMonth(start.getUTCMonth() - 1);
    }

    whereClause = "WHERE timestamp >= :start";
    params.start = start;
  }

  const rows = await db.query(
    `SELECT id, timestamp, capital_value, realized_profit, unrealized_pnl
     FROM capital_history
     ${whereClause}
     ORDER BY timestamp ASC, id ASC`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    capitalValue: Number(row.capital_value),
    realizedProfit: Number(row.realized_profit),
    unrealizedPnl: Number(row.unrealized_pnl)
  }));
}

function calculateSharpeRatio(returns = []) {
  if (returns.length < 2) {
    return 0;
  }

  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (returns.length - 1);
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) {
    return 0;
  }

  return average / standardDeviation;
}

function calculateLongestWinningStreak(trades = []) {
  let best = 0;
  let current = 0;

  trades.forEach((trade) => {
    if (Number(trade.result_pnl || 0) > 0) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
}

async function getAllTradesForValidation() {
  const [closedTrades, cancelledTrades] = await Promise.all([
    TradeModel.listTrades({ status: "closed", limit: 1000 }),
    TradeModel.listTrades({ status: "cancelled", limit: 1000 })
  ]);

  return [...closedTrades, ...cancelledTrades].sort(
    (left, right) => new Date(right.closed_at || right.opened_at) - new Date(left.closed_at || left.opened_at)
  );
}

runtime.getAllTradesForValidation = getAllTradesForValidation;

async function getAutonomyStatus() {
  return autonomousOperator.buildAutonomyStatus();
}

async function getTradeStatistics() {
  const trades = await getAllTradesForValidation();
  const analytics = tradeAnalytics.computeStatistics(trades);
  let currentRegimeId = null;

  try {
    const debugSnapshot = await signalInspector.buildSignalDebugSnapshot({
      pair: runtime.tradingPairs[0],
      side: "BUY",
      triggerSource: "auto"
    });
    currentRegimeId = inferCurrentRegimeIdFromDebug(debugSnapshot);
  } catch (_error) {
    currentRegimeId = null;
  }

  const paperValidation = await paperValidationService.buildSummary(trades, { currentRegimeId });
  const autonomy = await getAutonomyStatus();

  return {
    totalTrades: analytics.totalTrades,
    winRate: analytics.winRate,
    avgProfitPerTrade: analytics.avgProfitPerTrade,
    avgLossPerTrade: analytics.avgLossPerTrade,
    bestTrade: analytics.bestTrade,
    worstTrade: analytics.worstTrade,
    longestWinningStreak: calculateLongestWinningStreak(trades),
    sharpeRatio: calculateSharpeRatio(analytics.pnlValues),
    byStrategy: analytics.byStrategy,
    byRegime: analytics.byRegime,
    byStrategyRegime: analytics.byStrategyRegime,
    strategyRankingByPeriod: analytics.strategyRankingByPeriod,
    paperValidation,
    autonomy
  };
}

function getBotStatus() {
  if (runtime.autoPauseReason) {
    return "AUTO PAUSED";
  }

  if (!runtime.botEnabled) {
    return "PAUSED";
  }

  if (riskManager.isDrawdownPauseActive()) {
    return "DRAWDOWN LIMIT";
  }

  if (macroEventsService.state.paused) {
    return "PAUSED";
  }

  return executionEngine.getModeLabel();
}

async function handleDrawdownNotification(drawdown) {
  const dayKey = new Date().toISOString().slice(0, 10);

  if (!drawdown.limitHit || runtime.lastDrawdownAlertKey === dayKey) {
    return;
  }

  runtime.lastDrawdownAlertKey = dayKey;
  await telegramService.notifyDrawdownPause(drawdown);
}

async function handleMacroStatusNotifications(status) {
  if (status.paused && status.event) {
    const alertKey = `${status.event.title}:${new Date(status.pauseWindowStart).toISOString()}`;

    if (runtime.lastMacroAlertKey !== alertKey) {
      runtime.lastMacroAlertKey = alertKey;
      await telegramService.notifyMacroPause(status);
    }

    return;
  }

  if (status.upcoming && status.upcoming.minutesUntilPause <= 30) {
    const alertKey = `${status.upcoming.event.title}:${new Date(status.upcoming.pauseWindowStart).toISOString()}`;

    if (runtime.lastMacroAlertKey !== alertKey) {
      runtime.lastMacroAlertKey = alertKey;
      await telegramService.notifyMacroPause({
        event: status.upcoming.event,
        pauseWindowStart: status.upcoming.pauseWindowStart,
        pauseWindowEnd: status.upcoming.pauseWindowEnd
      });
    }
  }
}


async function checkTradingPauseStatus() {
  if (!runtime.botEnabled) {
    return {
      allowed: false,
      reason: runtime.autoPauseReason
        ? `Bot is auto-paused: ${runtime.autoPauseReason}.`
        : "Bot is manually paused."
    };
  }

  const macroPause = await macroEventsService.evaluateMacroPause();
  await handleMacroStatusNotifications(macroPause.status);

  if (macroPause.status.paused) {
    return {
      allowed: false,
      reason: macroPause.status.reason,
      macroPause: macroPause.status
    };
  }

  const drawdown = await riskManager.evaluateDailyDrawdown();
  await handleDrawdownNotification(drawdown);

  if (drawdown.limitHit || riskManager.isDrawdownPauseActive()) {
    return {
      allowed: false,
      reason: "Daily drawdown limit reached.",
      drawdown
    };
  }

  return {
    allowed: true
  };
}

async function checkBuyEntryAvailability(pair) {
  const riskState = await riskManager.canOpenNewTrade({ pair });
  await handleDrawdownNotification(riskState.drawdown);

  if (!riskState.allowed) {
    return {
      allowed: false,
      reason: riskState.reason,
      drawdown: riskState.drawdown
    };
  }

  return {
    allowed: true
  };
}

async function evaluateAutoExecutionPolicy(currentRegimeId) {
  if (runtime.autonomyMode === "manual") {
    return {
      allowed: false,
      reason: "Autonomous execution is disabled in manual mode."
    };
  }

  if (runtime.tradingMode === "live" && runtime.autonomyMode !== "full_auto") {
    return {
      allowed: false,
      reason: "Live autonomous execution requires full_auto mode."
    };
  }

  if (runtime.tradingMode !== "live") {
    return {
      allowed: true,
      paperValidation: null
    };
  }

  const trades = await getAllTradesForValidation();
  const summary = await paperValidationService.buildSummary(trades, { currentRegimeId });
  const activeChampionRunId =
    summary?.regimeGovernance?.activeChampionRunId ||
    runtime.championRunId ||
    null;

  if (!summary?.approvalGate?.canApproveLive) {
    return {
      allowed: false,
      reason: summary?.approvalGate?.reason || "Live readiness gate not passed.",
      paperValidation: summary
    };
  }

  if (!runtime.approvedLiveRunId || Number(runtime.approvedLiveRunId) !== Number(activeChampionRunId)) {
    return {
      allowed: false,
      reason: "The active champion has not been approved for live autonomous trading yet.",
      paperValidation: summary
    };
  }

  return {
    allowed: true,
    paperValidation: summary
  };
}

async function processSignal({
  pair,
  side,
  triggerSource = "auto",
  metadata = {},
  candlesByTimeframe
}) {
  const normalizedPair = String(pair || runtime.tradingPairs[0]).toUpperCase();
  const normalizedSide = String(side || "BUY").toUpperCase();
  const availability = await checkTradingPauseStatus();
  const scoreMetadata = {
    ...metadata,
    tradingMode: executionEngine.getModeLabel()
  };

  if (!availability.allowed) {
    return {
      ok: false,
      action: "blocked",
      reason: availability.reason
    };
  }

  const scoreResult = await scorerService.scoreSignal({
    pair: normalizedPair,
    side: normalizedSide,
    triggerSource,
    candlesByTimeframe,
    scoreThreshold: runtime.scoreThreshold,
    metadata: scoreMetadata
  });
  const currentRegimeId = inferRegimeIdFromIndicators(scoreResult.snapshots.indicators);
  const availableCapitalState = await riskManager.getAvailableCapitalState();
  const capitalAllocation = capitalAllocator.buildAllocationPlan({
    currentRegimeId,
    runtimeRiskPerTrade: runtime.riskPerTrade,
    availableCapital: availableCapitalState.availableCapital,
    reservedCapital: availableCapitalState.reservedCapital
  });
  const enrichedMetadata = {
    ...scoreMetadata,
    paperValidation: buildPaperValidationMetadata(currentRegimeId),
    capitalAllocation,
    autonomyMode: runtime.autonomyMode
  };

  if (scoreResult.snapshots.sentiment?.evaluations?.fearGreed?.allowed === false) {
    return {
      ok: false,
      action: "blocked",
      reason: scoreResult.snapshots.sentiment.evaluations.fearGreed.reason,
      score: scoreResult.score
    };
  }

  const executionGuards = evaluateSignalExecutionGuards(scoreResult, normalizedSide);
  const runtimeDecision = determineRuntimeDecision(scoreResult.score.totalScore);

  if (executionGuards.blocked) {
    // Still record as missed opportunity when guards block an otherwise scoreable signal.
    if (runtimeDecision === "MISSED") {
      TradeModel.createMissedOpportunity({
        pair: normalizedPair,
        score: scoreResult.score.totalScore,
        reason: executionGuards.reason,
        indicatorsSnapshot: scoreResult.snapshots.indicators
      }).catch(() => {});
    }

    return {
      ok: false,
      action: "blocked",
      reason: executionGuards.reason,
      score: scoreResult.score
    };
  }

  if (triggerSource === "auto" && metadata.shadowModeExecutionIntent === "shadow_only") {
    return {
      ok: true,
      action: runtimeDecision === "EXECUTE" && !executionGuards.blocked ? "shadow_ready" : "shadow_blocked",
      reason:
        runtimeDecision === "EXECUTE" && !executionGuards.blocked
          ? "Shadow mode found an executable setup."
          : executionGuards.reason || scoreResult.score.reason,
      score: scoreResult.score,
      regimeId: currentRegimeId
    };
  }

  if (triggerSource === "auto") {
    const autoExecutionPolicy = await evaluateAutoExecutionPolicy(currentRegimeId);

    if (!autoExecutionPolicy.allowed) {
      return {
        ok: false,
        action: "blocked",
        reason: autoExecutionPolicy.reason,
        score: scoreResult.score
      };
    }
  }

  if (runtimeDecision === "IGNORE") {
    return {
      ok: true,
      action: "ignored",
      reason: scoreResult.score.reason,
      score: scoreResult.score
    };
  }

  if (runtimeDecision === "MISSED") {
    await TradeModel.createMissedOpportunity({
      pair: normalizedPair,
      score: scoreResult.score.totalScore,
      reason: `Score below runtime threshold ${runtime.scoreThreshold}.`,
      indicatorsSnapshot: scoreResult.snapshots.indicators
    });

    return {
      ok: true,
      action: "missed_opportunity",
      reason: `Signal scored ${scoreResult.score.totalScore}/${scoreResult.score.maxScore} and was not executed.`,
      score: scoreResult.score
    };
  }

  if (normalizedSide === "SELL") {
    return executionOrchestrator.executeSellSignal({
      pair: normalizedPair,
      triggerSource,
      metadata: {
        ...enrichedMetadata,
        score: scoreResult.score
      }
    });
  }

  const buyAvailability = await checkBuyEntryAvailability(normalizedPair);

  if (!buyAvailability.allowed) {
    return {
      ok: false,
      action: "blocked",
      reason: buyAvailability.reason,
      score: scoreResult.score
    };
  }

  return executionOrchestrator.executeBuyTrade({
    pair: normalizedPair,
    scoreResult,
    triggerSource,
    metadata: enrichedMetadata,
    buildTradeRiskPlan: (payload) => riskManager.buildTradeRiskPlan({
      ...payload,
      riskPerTradeOverride: capitalAllocation.effectiveRiskPerTrade
    })
  });
}

async function reconcileExchangeTrades() {
  const openTrades = await TradeModel.getOpenTrades();

  if (openTrades.length === 0) {
    return;
  }

  const pairs = [...new Set(openTrades.map((trade) => trade.pair))];

  for (const pair of pairs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const exchangeOpenOrders = await executionEngine.getOpenOrders(pair);
      const exchangeOrderIds = new Set(
        exchangeOpenOrders
          .map((order) => Number(order.orderId))
          .filter((value) => Number.isFinite(value) && value > 0)
      );
      const exchangeOrderListIds = new Set(
        exchangeOpenOrders
          .map((order) => Number(order.orderListId))
          .filter((value) => Number.isFinite(value) && value > 0)
      );
      const pairTrades = openTrades.filter((trade) => trade.pair === pair);

      for (const trade of pairTrades) {
        const hasExchangeOrder =
          trade.exchange_order_id && exchangeOrderIds.has(Number(trade.exchange_order_id));
        const hasExchangeOrderList =
          trade.oco_order_list_id && exchangeOrderListIds.has(Number(trade.oco_order_list_id));

        if (!hasExchangeOrder && !hasExchangeOrderList) {
          // eslint-disable-next-line no-await-in-loop
          const exchangeClosureSnapshot = await executionOrchestrator.buildExchangeClosureSnapshot(trade);
          // eslint-disable-next-line no-await-in-loop
          await executionOrchestrator.finalizeTradeClosure(trade, {
            exitPrice: exchangeClosureSnapshot.exitPrice,
            closedAt: exchangeClosureSnapshot.closedAt,
            cancelReason: "exchange_closed",
            status: "closed",
            metadata: {
              reconciled: true,
              exchangeSource: exchangeClosureSnapshot.source
            }
          });
        }
      }

      circuitBreaker.recordSuccess("exchange");
    } catch (error) {
      logger.error("exchange_reconciliation_failed", {
        pair,
        message: error.message
      });
      // eslint-disable-next-line no-await-in-loop
      await circuitBreaker.recordFailure("exchange", error, { pair });
    }
  }
}

/**
 * Forces a market BUY in paper mode only. Used to validate the full execution pipeline
 * (entry order → OCO → trade record → Telegram notification → P&L tracking).
 * Never allowed in live mode.
 */
async function forcePaperTrade({ pair, side = "BUY" }) {
  if (runtime.tradingMode !== "paper") {
    return {
      ok: false,
      action: "blocked",
      reason: "Force trade is only allowed in paper mode."
    };
  }

  const normalizedPair = String(pair || runtime.tradingPairs[0]).toUpperCase();
  const normalizedSide = String(side).toUpperCase();

  // Score the signal for real to get accurate ATR and indicator snapshots.
  const scoreResult = await scorerService.scoreSignal({
    pair: normalizedPair,
    side: normalizedSide,
    triggerSource: "manual",
    scoreThreshold: 0, // always execute regardless of score
    metadata: { tradingMode: "PAPER", forcedTest: true }
  });

  // Override the decision so it always executes.
  scoreResult.score.totalScore = Math.max(scoreResult.score.totalScore, runtime.scoreThreshold);
  scoreResult.score.executionMode = "MARKET";

  if (normalizedSide !== "BUY") {
    return {
      ok: false,
      action: "blocked",
      reason: "Force trade currently only supports BUY side."
    };
  }

  const availableCapitalState = await riskManager.getAvailableCapitalState();
  const currentRegimeId = inferRegimeIdFromIndicators(scoreResult.snapshots.indicators);
  const capitalAllocation = capitalAllocator.buildAllocationPlan({
    currentRegimeId,
    runtimeRiskPerTrade: runtime.riskPerTrade,
    availableCapital: availableCapitalState.availableCapital,
    reservedCapital: availableCapitalState.reservedCapital
  });

  return executionOrchestrator.executeBuyTrade({
    pair: normalizedPair,
    scoreResult,
    triggerSource: "manual",
    metadata: {
      tradingMode: "PAPER",
      forcedTest: true,
      capitalAllocation,
      autonomyMode: runtime.autonomyMode
    },
    buildTradeRiskPlan: (payload) => riskManager.buildTradeRiskPlan({
      ...payload,
      riskPerTradeOverride: capitalAllocation.effectiveRiskPerTrade
    })
  });
}

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const context = {
  runtime,
  strategyRegistry,
  orderModel: OrderModel,
  tradeModel: TradeModel,
  reportModel: ReportModel,
  backtestRuns: BacktestRunModel,
  backtestRunMarks: BacktestRunMarkModel,
  backtestPromotionEvents: BacktestPromotionEventModel,
  processSignal,
  forcePaperTrade,
  cancelTrade: (tradeId, cancelReason, metadata) =>
    executionOrchestrator.closeTrade(tradeId, cancelReason, metadata),
  buildDashboardSnapshot: () => dashboardBuilder.buildDashboardSnapshot(),
  buildSignalDebugSnapshot: (payload) => signalInspector.buildSignalDebugSnapshot(payload),
  getCapitalHistory,
  getTradeStatistics,
  getAutonomyStatus,
  backtester: backtesterService,
  reporter: reporterService,
  paperValidationService,
  getRuntimeSettings,
  updateRuntimeSettings
};

reporterService.setProviders({
  getPaperValidationSummary: async () => {
    const trades = await getAllTradesForValidation();
    const currentRegimeId = await autonomousOperator.resolveCurrentRegimeId();
    return paperValidationService.buildSummary(trades, { currentRegimeId });
  },
  getAutonomyStatus
});

app.get("/health", async (_req, res) => {
  const snapshot = await healthMonitor.buildHealthSnapshot();

  res.status(snapshot.ok ? 200 : 503).json({
    ok: snapshot.ok,
    status: snapshot.ok ? "ok" : "degraded",
    service: "trading-bot-backend",
    ...snapshot
  });
});

app.use("/webhook", createWebhookRouter(context));
app.use("/api", requireApiKey);
app.use("/api/trades", createTradesRouter(context));
app.use("/api/trades", createCancelRouter(context));
app.use("/api/dashboard", createDashboardRouter(context));
app.use("/api/backtest", createBacktestRouter(context));

async function startServer() {
  await db.initDatabase();
  await paperBroker.init();
  await runtimePersistence.hydrateRuntime(runtime);
  await ensureInitialCapitalSnapshot();
  runtime.startupStatus = await startupGuard.run();
  await persistRuntimeState();

  cron.schedule("*/5 * * * *", async () => {
    await autonomousOperator.runAutonomousLoop();
  });

  cron.schedule("*/5 * * * *", async () => {
    const macroStatus = await macroEventsService.evaluateMacroPause();
    await handleMacroStatusNotifications(macroStatus.status);
  });

  cron.schedule("*/2 * * * *", async () => {
    await reconcileExchangeTrades();
  });

  cron.schedule("* * * * *", async () => {
    await executionOrchestrator.manageOpenTrades();
  });

  cron.schedule("* * * * *", async () => {
    await signalMonitor.monitorSignalReadinessAlerts();
  });

  cron.schedule("0 * * * *", async () => {
    await strategyHealthMonitor.monitor();
  });

  cron.schedule("15 * * * *", async () => {
    let currentRegimeId = null;

    try {
      const debugSnapshot = await signalInspector.buildSignalDebugSnapshot({
        pair: runtime.tradingPairs[0],
        side: "BUY",
        triggerSource: "auto"
      });
      currentRegimeId = inferCurrentRegimeIdFromDebug(debugSnapshot);
    } catch (_error) {
      currentRegimeId = null;
    }

    await paperValidationMonitor.monitorChampion();
    await paperValidationMonitor.monitorRecommendations(currentRegimeId);
    await paperValidationMonitor.monitorAutoGovernance(currentRegimeId);
  });

  cron.schedule("0 */6 * * *", async () => {
    await autonomousOperator.monitorDailyLoop();
  });

  cron.schedule("*/10 * * * *", async () => {
    runtime.healthSnapshot = await healthMonitor.buildHealthSnapshot();
  });

  cron.schedule("*/5 * * * *", async () => {
    await persistRuntimeState();
  });

  cron.schedule("55 23 * * *", async () => {
    await reporterService.generateReport("daily");
  }, { timezone: "UTC" });

  cron.schedule("55 23 * * 0", async () => {
    await reporterService.generateReport("weekly");
  }, { timezone: "UTC" });

  cron.schedule("55 23 * * *", async () => {
    if (isLastUtcDayOfMonth(new Date())) {
      await reporterService.generateReport("monthly");
    }
  }, { timezone: "UTC" });

  app.listen(port, () => {
    logger.info("backend_started", {
      port,
      tradingMode: runtime.tradingMode,
      autonomyMode: runtime.autonomyMode
    });
  });
}

startServer().catch((error) => {
  logger.error("backend_start_failed", {
    message: error.message
  });
  process.exit(1);
});
