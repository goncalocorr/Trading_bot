const db = require("../models/db");
const ReportModel = require("../models/Report");
const telegramService = require("./telegram");

function getUtcPeriodBounds(type, referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();
  const dayOfWeek = referenceDate.getUTCDay();

  if (type === "daily") {
    return {
      start: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
    };
  }

  if (type === "weekly") {
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(Date.UTC(year, month, day - diffToMonday, 0, 0, 0, 0));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);

    return { start, end };
  }

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function formatPeriod(type, start) {
  if (type === "daily") {
    return start.toISOString().slice(0, 10);
  }

  if (type === "weekly") {
    const weekEnd = new Date(start);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    return `${start.toISOString().slice(0, 10)}_${weekEnd.toISOString().slice(0, 10)}`;
  }

  return start.toISOString().slice(0, 7);
}

function safeParseScoreBreakdown(value) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (_error) {
    return null;
  }
}

function summarizeTrades(trades = []) {
  const winningTrades = trades.filter((trade) => Number(trade.result_pnl || 0) > 0);
  const losingTrades = trades.filter((trade) => Number(trade.result_pnl || 0) < 0);
  const totalPnl = trades.reduce((sum, trade) => sum + Number(trade.result_pnl || 0), 0);
  const bestTrade = trades.reduce(
    (best, trade) => (best === null || Number(trade.result_pnl || 0) > Number(best.result_pnl || 0) ? trade : best),
    null
  );
  const worstTrade = trades.reduce(
    (worst, trade) => (worst === null || Number(trade.result_pnl || 0) < Number(worst.result_pnl || 0) ? trade : worst),
    null
  );

  return {
    tradeCount: trades.length,
    winRate: trades.length === 0 ? 0 : (winningTrades.length / trades.length) * 100,
    totalPnl,
    bestTrade,
    worstTrade,
    averageWin:
      winningTrades.length === 0
        ? 0
        : winningTrades.reduce((sum, trade) => sum + Number(trade.result_pnl || 0), 0) / winningTrades.length,
    averageLoss:
      losingTrades.length === 0
        ? 0
        : losingTrades.reduce((sum, trade) => sum + Number(trade.result_pnl || 0), 0) / losingTrades.length
  };
}

function analyzeIndicatorEffectiveness(trades = []) {
  const winningTrades = trades.filter((trade) => Number(trade.result_pnl || 0) > 0);
  const counters = {};

  winningTrades.forEach((trade) => {
    const scoreBreakdown = safeParseScoreBreakdown(trade.score_breakdown);
    const items = Array.isArray(scoreBreakdown?.items) ? scoreBreakdown.items : [];

    items.forEach((item) => {
      if (!item.passed) {
        return;
      }

      counters[item.label] = (counters[item.label] || 0) + 1;
    });
  });

  return Object.entries(counters)
    .sort((left, right) => right[1] - left[1])
    .map(([label, wins]) => ({ label, wins }));
}

class ReporterService {
  async getClosedTradesForPeriod(type, referenceDate = new Date()) {
    const bounds = getUtcPeriodBounds(type, referenceDate);

    const trades = await db.query(
      `SELECT *
       FROM trades
       WHERE status IN ('closed', 'cancelled')
         AND closed_at BETWEEN :start AND :end
       ORDER BY closed_at ASC, id ASC`,
      {
        start: bounds.start,
        end: bounds.end
      }
    );

    const capitalRows = await db.query(
      `SELECT capital_value, realized_profit, unrealized_pnl, timestamp
       FROM capital_history
       WHERE timestamp BETWEEN :start AND :end
       ORDER BY timestamp ASC, id ASC`,
      {
        start: bounds.start,
        end: bounds.end
      }
    );

    return {
      bounds,
      trades,
      capitalRows
    };
  }

  buildSummaryText(type, summary) {
    return `${type} summary: ${summary.tradeCount} trades, ${summary.winRate.toFixed(2)}% win rate, PnL ${summary.totalPnl.toFixed(4)}`;
  }

  async generateReport(type, referenceDate = new Date()) {
    const { bounds, trades, capitalRows } = await this.getClosedTradesForPeriod(type, referenceDate);
    const summary = summarizeTrades(trades);
    const period = formatPeriod(type, bounds.start);
    const reportData = {
      type,
      period,
      start: bounds.start.toISOString(),
      end: bounds.end.toISOString(),
      summary,
      capitalChange: capitalRows.length >= 2
        ? Number(capitalRows[capitalRows.length - 1].capital_value) - Number(capitalRows[0].capital_value)
        : 0,
      chartData: capitalRows.map((row) => ({
        timestamp: row.timestamp,
        capitalValue: Number(row.capital_value),
        realizedProfit: Number(row.realized_profit),
        unrealizedPnl: Number(row.unrealized_pnl)
      }))
    };

    if (type === "monthly") {
      reportData.indicatorEffectiveness = analyzeIndicatorEffectiveness(trades);
    }

    const savedReport = await ReportModel.createReport({
      type,
      period,
      data: reportData
    });

    await telegramService.notifyReport({
      type,
      period,
      summary: this.buildSummaryText(type, summary)
    });

    return savedReport;
  }
}

module.exports = new ReporterService();
