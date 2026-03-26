const dotenv = require("dotenv");
const db = require("../models/db");

dotenv.config();

const DEFAULT_RISK_PER_TRADE = 0.01;
const DEFAULT_COMPOUND_RATIO = 0.5;
const DEFAULT_DRAWDOWN_LIMIT = 0.05;
const DEFAULT_MAX_OPEN_TRADES = 3;
const DEFAULT_MAX_OPEN_TRADES_PER_PAIR = 1;
const DEFAULT_INITIAL_CAPITAL = 100;
const DEFAULT_PAIR_COOLDOWN_MINUTES = 30;

class RiskManager {
  constructor() {
    this.state = {
      pausedForDrawdown: false,
      pauseReason: null,
      pausedAt: null,
      resumeAt: null
    };
  }

  getConfig() {
    return {
      riskPerTrade: Number(process.env.RISK_PER_TRADE || DEFAULT_RISK_PER_TRADE),
      compoundRatio: Number(process.env.COMPOUND_RATIO || DEFAULT_COMPOUND_RATIO),
      dailyDrawdownLimit: Number(process.env.DAILY_DRAWDOWN_LIMIT || DEFAULT_DRAWDOWN_LIMIT),
      maxOpenTrades: Number(process.env.MAX_OPEN_TRADES || DEFAULT_MAX_OPEN_TRADES),
      maxOpenTradesPerPair: Number(process.env.MAX_OPEN_TRADES_PER_PAIR || DEFAULT_MAX_OPEN_TRADES_PER_PAIR),
      pairCooldownMinutes: Number(process.env.PAIR_COOLDOWN_MINUTES || DEFAULT_PAIR_COOLDOWN_MINUTES),
      initialCapital: Number(process.env.INITIAL_CAPITAL || DEFAULT_INITIAL_CAPITAL)
    };
  }

  getUtcDayBounds(referenceDate = new Date()) {
    const start = new Date(Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      0,
      0,
      0,
      0
    ));
    const end = new Date(Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      23,
      59,
      59,
      999
    ));

    return {
      start,
      end
    };
  }

  calculateExitLevels({ side, entryPrice, atr }) {
    const normalizedSide = String(side || "").toUpperCase();
    const numericEntry = Number(entryPrice);
    const numericAtr = Number(atr);
    const stopDistance = numericAtr * 1.5;
    const takeProfitDistance = numericAtr * 3;

    if (!Number.isFinite(numericEntry) || !Number.isFinite(numericAtr) || numericAtr <= 0) {
      throw new Error("Invalid entry price or ATR for risk calculation.");
    }

    if (normalizedSide === "BUY") {
      return {
        stopDistance,
        takeProfitDistance,
        stopLoss: numericEntry - stopDistance,
        takeProfit: numericEntry + takeProfitDistance
      };
    }

    return {
      stopDistance,
      takeProfitDistance,
      stopLoss: numericEntry + stopDistance,
      takeProfit: numericEntry - takeProfitDistance
    };
  }

  calculatePositionSize({
    capital,
    entryPrice,
    atr,
    riskPerTrade = this.getConfig().riskPerTrade
  }) {
    const numericCapital = Number(capital);
    const numericEntryPrice = Number(entryPrice);
    const exits = this.calculateExitLevels({ side: "BUY", entryPrice, atr });
    const riskAmount = numericCapital * Number(riskPerTrade);
    const riskSizedQuantity = riskAmount / exits.stopDistance;
    const maxAffordableQuantity = numericEntryPrice > 0 ? numericCapital / numericEntryPrice : 0;
    const quantity = Math.max(0, Math.min(riskSizedQuantity, maxAffordableQuantity));
    const positionNotional = quantity * numericEntryPrice;
    const effectiveRiskAmount = quantity * exits.stopDistance;

    return {
      capital: numericCapital,
      riskPerTrade: Number(riskPerTrade),
      riskAmount,
      effectiveRiskAmount,
      stopDistance: exits.stopDistance,
      quantity,
      positionNotional,
      cappedByCapital: quantity < riskSizedQuantity
    };
  }

  calculateTradeResult({ side, entryPrice, exitPrice, quantity }) {
    const normalizedSide = String(side || "").toUpperCase();
    const numericEntryPrice = Number(entryPrice);
    const numericExitPrice = Number(exitPrice);
    const numericQuantity = Number(quantity);

    const pnl =
      normalizedSide === "BUY"
        ? (numericExitPrice - numericEntryPrice) * numericQuantity
        : (numericEntryPrice - numericExitPrice) * numericQuantity;

    const baseNotional = numericEntryPrice * numericQuantity;
    const resultPercent = baseNotional === 0 ? 0 : (pnl / baseNotional) * 100;

    return {
      pnl,
      resultPercent
    };
  }

  applyCompoundProfit({ currentCapital, currentRealizedProfit = 0, tradePnl, compoundRatio = this.getConfig().compoundRatio }) {
    const numericCapital = Number(currentCapital);
    const numericRealized = Number(currentRealizedProfit);
    const numericTradePnl = Number(tradePnl);
    const numericCompoundRatio = Number(compoundRatio);

    if (numericTradePnl <= 0) {
      return {
        newCapital: Math.max(0, numericCapital + numericTradePnl),
        newRealizedProfit: numericRealized,
        reinvestedAmount: 0,
        reservedProfit: numericTradePnl
      };
    }

    const reinvestedAmount = numericTradePnl * numericCompoundRatio;
    const reservedProfit = numericTradePnl - reinvestedAmount;

    return {
      newCapital: numericCapital + reinvestedAmount,
      newRealizedProfit: numericRealized + reservedProfit,
      reinvestedAmount,
      reservedProfit
    };
  }

  async getLatestCapitalState() {
    const rows = await db.query(
      `SELECT id, timestamp, capital_value, realized_profit, unrealized_pnl
       FROM capital_history
       ORDER BY timestamp DESC, id DESC
       LIMIT 1`
    );

    if (rows.length === 0) {
      const { initialCapital } = this.getConfig();

      return {
        capitalValue: initialCapital,
        realizedProfit: 0,
        unrealizedPnl: 0,
        timestamp: new Date().toISOString()
      };
    }

    return {
      id: rows[0].id,
      capitalValue: Number(rows[0].capital_value),
      realizedProfit: Number(rows[0].realized_profit),
      unrealizedPnl: Number(rows[0].unrealized_pnl),
      timestamp: rows[0].timestamp
    };
  }

  async recordCapitalSnapshot({
    capitalValue,
    realizedProfit = 0,
    unrealizedPnl = 0,
    timestamp = new Date()
  }) {
    const result = await db.execute(
      `INSERT INTO capital_history (timestamp, capital_value, realized_profit, unrealized_pnl)
       VALUES (:timestamp, :capitalValue, :realizedProfit, :unrealizedPnl)`,
      {
        timestamp,
        capitalValue,
        realizedProfit,
        unrealizedPnl
      }
    );

    return result.insertId;
  }

  async getOpenTradeCount() {
    const rows = await db.query(
      `SELECT COUNT(*) AS total
       FROM trades
       WHERE status = 'open'`
    );

    return Number(rows[0]?.total || 0);
  }

  async getOpenTradeCountForPair(pair) {
    const normalizedPair = String(pair || "").toUpperCase();

    if (!normalizedPair) {
      return 0;
    }

    const rows = await db.query(
      `SELECT COUNT(*) AS total
       FROM trades
       WHERE status = 'open'
         AND pair = :pair`,
      {
        pair: normalizedPair
      }
    );

    return Number(rows[0]?.total || 0);
  }

  async getReservedCapital() {
    const rows = await db.query(
      `SELECT COALESCE(SUM(entry_price * quantity), 0) AS reservedCapital
       FROM trades
       WHERE status = 'open'
         AND side = 'BUY'`
    );

    return Number(rows[0]?.reservedCapital || 0);
  }

  async getAvailableCapitalState() {
    const [capitalState, reservedCapital] = await Promise.all([
      this.getLatestCapitalState(),
      this.getReservedCapital()
    ]);
    const availableCapital = Math.max(0, Number(capitalState.capitalValue || 0) - reservedCapital);

    return {
      ...capitalState,
      reservedCapital,
      availableCapital
    };
  }

  async getDailyPnl(referenceDate = new Date()) {
    const { start, end } = this.getUtcDayBounds(referenceDate);
    const rows = await db.query(
      `SELECT
         COALESCE(SUM(result_pnl), 0) AS pnl,
         COUNT(*) AS tradeCount
       FROM trades
       WHERE status IN ('closed', 'cancelled')
         AND closed_at BETWEEN :start AND :end`,
      {
        start,
        end
      }
    );

    return {
      pnl: Number(rows[0]?.pnl || 0),
      tradeCount: Number(rows[0]?.tradeCount || 0),
      start,
      end
    };
  }

  getNextUtcMidnight(referenceDate = new Date()) {
    return new Date(Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() + 1,
      0,
      0,
      0,
      0
    ));
  }

  async evaluateDailyDrawdown(referenceDate = new Date()) {
    const capitalState = await this.getLatestCapitalState();
    const dailyPnl = await this.getDailyPnl(referenceDate);
    const { dailyDrawdownLimit } = this.getConfig();

    const capitalBase = Number(capitalState.capitalValue || 0);
    const drawdownValue = Math.max(0, Number(dailyPnl.pnl) * -1);
    const thresholdValue = capitalBase * dailyDrawdownLimit;
    const limitHit = drawdownValue >= thresholdValue && thresholdValue > 0;

    if (limitHit) {
      this.state.pausedForDrawdown = true;
      this.state.pauseReason = "daily_drawdown_limit";
      this.state.pausedAt = new Date();
      this.state.resumeAt = this.getNextUtcMidnight(referenceDate);
    } else if (this.state.resumeAt && referenceDate >= this.state.resumeAt) {
      this.clearDrawdownPause();
    }

    return {
      limitHit,
      drawdownValue,
      thresholdValue,
      resumeAt: this.state.resumeAt,
      dailyPnl: dailyPnl.pnl,
      tradeCount: dailyPnl.tradeCount
    };
  }

  clearDrawdownPause() {
    this.state.pausedForDrawdown = false;
    this.state.pauseReason = null;
    this.state.pausedAt = null;
    this.state.resumeAt = null;
  }

  isDrawdownPauseActive(referenceDate = new Date()) {
    if (this.state.resumeAt && referenceDate >= this.state.resumeAt) {
      this.clearDrawdownPause();
    }

    return this.state.pausedForDrawdown;
  }

  async getLatestClosedTradeForPair(pair) {
    const normalizedPair = String(pair || "").toUpperCase();

    if (!normalizedPair) {
      return null;
    }

    const rows = await db.query(
      `SELECT id, pair, status, closed_at, opened_at
       FROM trades
       WHERE pair = :pair
         AND status IN ('closed', 'cancelled')
         AND closed_at IS NOT NULL
       ORDER BY closed_at DESC, id DESC
       LIMIT 1`,
      {
        pair: normalizedPair
      }
    );

    return rows[0] || null;
  }

  async evaluatePairCooldown(pair, referenceDate = new Date()) {
    const { pairCooldownMinutes } = this.getConfig();
    const latestClosedTrade = await this.getLatestClosedTradeForPair(pair);

    if (!latestClosedTrade || pairCooldownMinutes <= 0) {
      return {
        active: false,
        latestClosedTrade,
        resumeAt: null,
        remainingMinutes: 0
      };
    }

    const closedAt = new Date(latestClosedTrade.closed_at);
    const resumeAt = new Date(closedAt.getTime() + pairCooldownMinutes * 60 * 1000);
    const active = referenceDate < resumeAt;
    const remainingMinutes = active
      ? Math.max(1, Math.ceil((resumeAt.getTime() - referenceDate.getTime()) / 60000))
      : 0;

    return {
      active,
      latestClosedTrade,
      resumeAt,
      remainingMinutes
    };
  }

  async canOpenNewTrade({ pair } = {}) {
    const { maxOpenTrades, maxOpenTradesPerPair } = this.getConfig();
    const [openTradeCount, drawdown, availableCapitalState, openTradeCountForPair, pairCooldown] = await Promise.all([
      this.getOpenTradeCount(),
      this.evaluateDailyDrawdown(),
      this.getAvailableCapitalState(),
      this.getOpenTradeCountForPair(pair),
      this.evaluatePairCooldown(pair)
    ]);

    if (drawdown.limitHit || this.isDrawdownPauseActive()) {
      return {
        allowed: false,
        reason: "Daily drawdown limit reached.",
        openTradeCount,
        drawdown,
        availableCapital: availableCapitalState.availableCapital
      };
    }

    if (openTradeCount >= maxOpenTrades) {
      return {
        allowed: false,
        reason: `Maximum concurrent trades reached (${maxOpenTrades}).`,
        openTradeCount,
        drawdown,
        availableCapital: availableCapitalState.availableCapital
      };
    }

    if (pair && openTradeCountForPair >= maxOpenTradesPerPair) {
      return {
        allowed: false,
        reason: `Pair trade limit reached for ${String(pair).toUpperCase()} (${maxOpenTradesPerPair}).`,
        openTradeCount,
        openTradeCountForPair,
        drawdown,
        pairCooldown,
        availableCapital: availableCapitalState.availableCapital
      };
    }

    if (pairCooldown.active) {
      return {
        allowed: false,
        reason: `Cooldown active for ${String(pair).toUpperCase()}. Wait ${pairCooldown.remainingMinutes} minute(s).`,
        openTradeCount,
        openTradeCountForPair,
        drawdown,
        pairCooldown,
        availableCapital: availableCapitalState.availableCapital
      };
    }

    if (availableCapitalState.availableCapital <= 0) {
      return {
        allowed: false,
        reason: "No available capital left for a new spot trade.",
        openTradeCount,
        openTradeCountForPair,
        drawdown,
        pairCooldown,
        availableCapital: availableCapitalState.availableCapital
      };
    }

    return {
      allowed: true,
      reason: "Risk checks passed.",
      openTradeCount,
      openTradeCountForPair,
      drawdown,
      pairCooldown,
      availableCapital: availableCapitalState.availableCapital
    };
  }

  async buildTradeRiskPlan({ side, entryPrice, atr, pair }) {
    const [capitalState, pairCooldown] = await Promise.all([
      this.getAvailableCapitalState(),
      this.evaluatePairCooldown(pair)
    ]);
    const positionSizing = this.calculatePositionSize({
      capital: capitalState.availableCapital,
      entryPrice,
      atr
    });
    const exits = this.calculateExitLevels({ side, entryPrice, atr });

    return {
      capitalState,
      pairCooldown,
      positionSizing,
      exits,
      riskConfig: this.getConfig()
    };
  }
}

module.exports = new RiskManager();
