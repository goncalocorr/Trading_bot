#!/usr/bin/env node
/**
 * Standalone backtest runner.
 * Usage: node scripts/run_backtest.js [pair] [days]
 * Example: node scripts/run_backtest.js BTCUSDT 60
 */

require("dotenv").config();

const { runBacktest } = require("../services/backtester");

const pair = process.argv[2] || "BTCUSDT";
const days = Number(process.argv[3] || 60);

const dateTo = new Date();
const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);

function fmt(n, decimals = 2) {
  return Number(n || 0).toFixed(decimals);
}

function bar(value, max, width = 20) {
  const filled = Math.round((Math.abs(value) / Math.max(Math.abs(max), 1)) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

async function main() {
  console.log(`\n=== BACKTEST: ${pair} | últimos ${days} dias ===`);
  console.log(`Período: ${dateFrom.toISOString().slice(0, 10)} → ${dateTo.toISOString().slice(0, 10)}`);
  console.log("A carregar dados e a simular...\n");

  const activeStrategies = process.env.ACTIVE_STRATEGIES
    ? process.env.ACTIVE_STRATEGIES.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (activeStrategies.length > 0) {
    console.log(`Estratégias ativas: ${activeStrategies.join(", ")}`);
  } else {
    console.log("Estratégias ativas: todas");
  }
  console.log();

  const result = await runBacktest({
    mode: "standard",
    pair,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    timeframe: "15m",
    startingCapital: Number(process.env.INITIAL_CAPITAL || 100),
    scoreThreshold: Number(process.env.SCORE_THRESHOLD || 8),
    activeStrategies
  });

  const { tradeCount, winRate, totalReturnPercent, maxDrawdown, startingCapital, endingCapital, totalFeesPaid } = result;

  console.log("━".repeat(50));
  console.log("RESULTADOS GLOBAIS");
  console.log("━".repeat(50));
  console.log(`Trades total     : ${tradeCount}`);
  console.log(`Win rate         : ${fmt(winRate)}%  ${bar(winRate, 100)}`);
  console.log(`Retorno total    : ${fmt(totalReturnPercent)}%`);
  console.log(`Capital inicial  : €${fmt(startingCapital)}`);
  console.log(`Capital final    : €${fmt(endingCapital)}`);
  console.log(`Drawdown máximo  : ${fmt(maxDrawdown)}%`);
  console.log(`Comissões pagas  : €${fmt(totalFeesPaid, 4)}`);

  // Por estratégia
  const allPeriod = result.strategyRankingByPeriod?.find((p) => p.periodId === "all");
  if (allPeriod?.ranking?.length > 0) {
    console.log("\n" + "━".repeat(50));
    console.log("POR ESTRATÉGIA (todos os trades)");
    console.log("━".repeat(50));
    allPeriod.ranking.forEach((s) => {
      console.log(`  ${s.strategyId.padEnd(25)} | trades: ${String(s.totalTrades).padStart(3)} | win: ${fmt(s.winRate).padStart(5)}% | pnl: €${fmt(s.pnlTotal, 4)}`);
    });
  }

  // Score distribution
  if (result.trades?.length > 0) {
    console.log("\n" + "━".repeat(50));
    console.log("DISTRIBUIÇÃO DE SCORES (trades executados)");
    console.log("━".repeat(50));
    const scoreBuckets = {};
    result.trades.forEach((t) => {
      const s = t.score?.totalScore ?? "?";
      scoreBuckets[s] = (scoreBuckets[s] || 0) + 1;
    });
    Object.entries(scoreBuckets)
      .sort(([a], [b]) => Number(b) - Number(a))
      .forEach(([score, count]) => {
        console.log(`  Score ${score}: ${count} trade(s)`);
      });

    // Wins vs losses
    const wins = result.trades.filter((t) => t.resultPnl > 0);
    const losses = result.trades.filter((t) => t.resultPnl <= 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.resultPnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.resultPnl, 0) / losses.length : 0;

    console.log("\n" + "━".repeat(50));
    console.log("QUALIDADE DAS OPERAÇÕES");
    console.log("━".repeat(50));
    console.log(`  Ganhos    : ${wins.length} trades | avg €${fmt(avgWin, 4)}`);
    console.log(`  Perdas    : ${losses.length} trades | avg €${fmt(avgLoss, 4)}`);
    if (avgLoss !== 0) {
      console.log(`  Profit factor: ${fmt(Math.abs(avgWin / avgLoss), 2)}`);
    }
  }

  console.log("\n" + "━".repeat(50));
  console.log("Nota: sentimento assumido neutro (F&G=50, news=neutral).");
  console.log("      Order book sintético baseado na posição de fecho da vela.");
  console.log("━".repeat(50) + "\n");
}

main().catch((err) => {
  console.error("Erro no backtest:", err.message);
  process.exit(1);
});
