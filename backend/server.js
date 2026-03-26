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
const binanceService = require("./services/binance");
const executionEngine = require("./services/executionengine");
const ExecutionOrchestrator = require("./services/executionorchestrator");
const SignalInspector = require("./services/signalinspector");
const SignalMonitor = require("./services/signalmonitor");
const DashboardBuilder = require("./services/dashboardbuilder");
const StrategyRegistry = require("./services/strategyregistry");
const StrategyRunner = require("./services/strategyrunner");
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

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const DEFAULT_SCORE_THRESHOLD = 8;

const runtime = {
  botEnabled: true,
  tradingMode: executionEngine.getMode(),
  scoreThreshold: Number(process.env.SCORE_THRESHOLD || DEFAULT_SCORE_THRESHOLD),
  riskPerTrade: Number(process.env.RISK_PER_TRADE || 0.01),
  compoundRatio: Number(process.env.COMPOUND_RATIO || 0.5),
  tradingPairs: parseTradingPairs(process.env.TRADING_PAIRS || "BTCUSDT"),
  lastMacroAlertKey: null,
  lastDrawdownAlertKey: null,
  signalAlertState: {}
};

const executionOrchestrator = new ExecutionOrchestrator({
  executionEngine,
  tradeModel: TradeModel,
  orderModel: OrderModel,
  riskManager,
  telegramService
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

function parseTradingPairs(value) {
  return String(value || "")
    .split(",")
    .map((pair) => pair.trim().toUpperCase())
    .filter(Boolean);
}

function getRuntimeSettings() {
  return {
    botEnabled: runtime.botEnabled,
    tradingMode: runtime.tradingMode,
    scoreThreshold: runtime.scoreThreshold,
    riskPerTrade: runtime.riskPerTrade,
    compoundRatio: runtime.compoundRatio,
    tradingPairs: runtime.tradingPairs
  };
}

function updateRuntimeSettings(payload = {}) {
  if (typeof payload.botEnabled === "boolean") {
    runtime.botEnabled = payload.botEnabled;
  }

  if (payload.tradingMode !== undefined) {
    runtime.tradingMode = String(payload.tradingMode).toLowerCase() === "live" ? "live" : "paper";
    process.env.TRADING_MODE = runtime.tradingMode;
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

  return getRuntimeSettings();
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

async function getTradeStatistics() {
  const [closedTrades, cancelledTrades] = await Promise.all([
    TradeModel.listTrades({ status: "closed", limit: 1000 }),
    TradeModel.listTrades({ status: "cancelled", limit: 1000 })
  ]);
  const trades = [...closedTrades, ...cancelledTrades].sort(
    (left, right) => new Date(right.closed_at || right.opened_at) - new Date(left.closed_at || left.opened_at)
  );
  const pnlValues = trades.map((trade) => Number(trade.result_pnl || 0));
  const winningTrades = trades.filter((trade) => Number(trade.result_pnl || 0) > 0);
  const losingTrades = trades.filter((trade) => Number(trade.result_pnl || 0) < 0);
  const bestTrade = trades.reduce(
    (best, trade) => (best === null || Number(trade.result_pnl || 0) > Number(best.result_pnl || 0) ? trade : best),
    null
  );
  const worstTrade = trades.reduce(
    (worst, trade) => (worst === null || Number(trade.result_pnl || 0) < Number(worst.result_pnl || 0) ? trade : worst),
    null
  );
  const byStrategyMap = new Map();

  trades.forEach((trade) => {
    const strategyKey = trade.metadata?.strategyId || trade.metadata?.strategy || "unknown";
    const current = byStrategyMap.get(strategyKey) || {
      strategyId: strategyKey,
      totalTrades: 0,
      wins: 0,
      pnlTotal: 0,
      bestTrade: null,
      worstTrade: null
    };
    const pnl = Number(trade.result_pnl || 0);

    current.totalTrades += 1;
    current.pnlTotal += pnl;

    if (pnl > 0) {
      current.wins += 1;
    }

    if (current.bestTrade === null || pnl > Number(current.bestTrade.result_pnl || 0)) {
      current.bestTrade = trade;
    }

    if (current.worstTrade === null || pnl < Number(current.worstTrade.result_pnl || 0)) {
      current.worstTrade = trade;
    }

    byStrategyMap.set(strategyKey, current);
  });

  return {
    totalTrades: trades.length,
    winRate: trades.length === 0 ? 0 : (winningTrades.length / trades.length) * 100,
    avgProfitPerTrade:
      winningTrades.length === 0
        ? 0
        : winningTrades.reduce((sum, trade) => sum + Number(trade.result_pnl || 0), 0) / winningTrades.length,
    avgLossPerTrade:
      losingTrades.length === 0
        ? 0
        : losingTrades.reduce((sum, trade) => sum + Number(trade.result_pnl || 0), 0) / losingTrades.length,
    bestTrade,
    worstTrade,
    longestWinningStreak: calculateLongestWinningStreak(trades),
    sharpeRatio: calculateSharpeRatio(pnlValues),
    byStrategy: [...byStrategyMap.values()].map((item) => ({
      strategyId: item.strategyId,
      totalTrades: item.totalTrades,
      winRate: item.totalTrades === 0 ? 0 : (item.wins / item.totalTrades) * 100,
      avgPnl: item.totalTrades === 0 ? 0 : item.pnlTotal / item.totalTrades,
      pnlTotal: item.pnlTotal,
      bestTrade: item.bestTrade,
      worstTrade: item.worstTrade
    }))
  };
}

function getBotStatus() {
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
      reason: "Bot is manually paused."
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
    metadata
  });

  if (scoreResult.snapshots.sentiment?.evaluations?.fearGreed?.allowed === false) {
    return {
      ok: false,
      action: "blocked",
      reason: scoreResult.snapshots.sentiment.evaluations.fearGreed.reason,
      score: scoreResult.score
    };
  }

  const executionGuards = evaluateSignalExecutionGuards(scoreResult, normalizedSide);

  if (executionGuards.blocked) {
    return {
      ok: false,
      action: "blocked",
      reason: executionGuards.reason,
      score: scoreResult.score
    };
  }

  const runtimeDecision = determineRuntimeDecision(scoreResult.score.totalScore);

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
        ...metadata,
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
    metadata,
    buildTradeRiskPlan: (payload) => riskManager.buildTradeRiskPlan(payload)
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
    } catch (error) {
      console.error(`Exchange reconciliation failed for ${pair}: ${error.message}`);
    }
  }
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
  orderModel: OrderModel,
  tradeModel: TradeModel,
  reportModel: ReportModel,
  processSignal,
  cancelTrade: (tradeId, cancelReason, metadata) =>
    executionOrchestrator.closeTrade(tradeId, cancelReason, metadata),
  buildDashboardSnapshot: () => dashboardBuilder.buildDashboardSnapshot(),
  buildSignalDebugSnapshot: (payload) => signalInspector.buildSignalDebugSnapshot(payload),
  getCapitalHistory,
  getTradeStatistics,
  backtester: backtesterService,
  reporter: reporterService,
  getRuntimeSettings,
  updateRuntimeSettings
};

app.get("/health", async (_req, res) => {
  const dashboard = await dashboardBuilder.buildDashboardSnapshot();

  res.json({
    ok: true,
    status: "ok",
    botStatus: dashboard.botStatus,
    service: "trading-bot-backend"
  });
});

app.use("/webhook", createWebhookRouter(context));
app.use("/api/trades", createTradesRouter(context));
app.use("/api/trades", createCancelRouter(context));
app.use("/api/dashboard", createDashboardRouter(context));
app.use("/api/backtest", createBacktestRouter(context));

async function startServer() {
  await db.initDatabase();
  await ensureInitialCapitalSnapshot();

  cron.schedule("*/5 * * * *", async () => {
    await strategyRunner.runAutoScan();
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
    console.log(`Trading bot backend listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error(`Failed to start backend: ${error.message}`);
  process.exit(1);
});
