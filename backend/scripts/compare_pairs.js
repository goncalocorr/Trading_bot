#!/usr/bin/env node
/**
 * Walk-forward comparison across multiple pairs.
 * Usage: node scripts/compare_pairs.js [days]
 * Example: node scripts/compare_pairs.js 90
 *
 * Runs walk-forward backtests (train=30d, test=7d, step=7d) for each pair
 * and prints a side-by-side ranking to help decide which pairs to trade.
 */

require("dotenv").config();

const { runBacktest } = require("../services/backtester");

const PAIRS = ["ETHUSDT", "XRPUSDT", "BTCUSDT", "ADAUSDT"];
const days  = Number(process.argv[2] || 90);

const dateTo   = new Date();
const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);

const activeStrategies = process.env.ACTIVE_STRATEGIES
  ? process.env.ACTIVE_STRATEGIES.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

function fmt(n, d = 2) { return Number(n || 0).toFixed(d); }
function bar(value, max, width = 16) {
  const filled = Math.round((Math.abs(value) / Math.max(Math.abs(max), 1)) * width);
  return (value >= 0 ? "▓" : "░").repeat(filled) + " ".repeat(width - filled);
}

async function runPair(pair) {
  try {
    return await runBacktest({
      mode: "walk_forward",
      pair,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      timeframe: "15m",
      startingCapital: Number(process.env.INITIAL_CAPITAL || 100),
      scoreThreshold: Number(process.env.SCORE_THRESHOLD || 8),
      activeStrategies
    });
  } catch (err) {
    return { error: err.message, pair };
  }
}

function score(r) {
  // Composite ranking score: win rate weighted by trade count + return - drawdown/2
  const tradeWeight = Math.min(r.tradeCount / 10, 1); // normalise: 10+ trades = full weight
  return (r.winRate * tradeWeight) + r.totalReturnPercent - (r.maxDrawdown / 2);
}

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(` WALK-FORWARD COMPARISON — últimos ${days} dias`);
  console.log(` Período : ${dateFrom.toISOString().slice(0,10)} → ${dateTo.toISOString().slice(0,10)}`);
  console.log(` Janelas : train=30d / test=7d / step=7d`);
  console.log(` Estratégias: ${activeStrategies.length ? activeStrategies.join(", ") : "todas"}`);
  console.log(`${"═".repeat(60)}\n`);

  const results = [];
  for (const pair of PAIRS) {
    process.stdout.write(`  A calcular ${pair}...`);
    const r = await runPair(pair);
    if (r.error) {
      console.log(` ERRO: ${r.error}`);
    } else {
      console.log(` OK (${r.tradeCount} trades, ${r.walkForward?.windowCount ?? "?"} janelas)`);
      results.push(r);
    }
  }

  if (results.length === 0) {
    console.log("\nNenhum resultado disponível.");
    process.exit(1);
  }

  // Sort by composite score descending
  results.sort((a, b) => score(b) - score(a));

  const maxWR  = Math.max(...results.map((r) => r.winRate));
  const maxRet = Math.max(...results.map((r) => Math.abs(r.totalReturnPercent)));
  const maxDD  = Math.max(...results.map((r) => Math.abs(r.maxDrawdown)));

  console.log(`\n${"─".repeat(60)}`);
  console.log(" RANKING FINAL (por score composto)");
  console.log(`${"─".repeat(60)}`);
  console.log(` ${"Par".padEnd(10)} ${"Trades".padStart(6)} ${"Win%".padStart(6)} ${"Retorno%".padStart(9)} ${"Drawdown%".padStart(10)} ${"Score".padStart(7)}`);
  console.log(`${"─".repeat(60)}`);

  results.forEach((r, i) => {
    const medal = i === 0 ? "★" : i === 1 ? "▲" : " ";
    console.log(
      ` ${medal} ${r.pair.padEnd(9)} ${String(r.tradeCount).padStart(6)} ${fmt(r.winRate).padStart(5)}% ${fmt(r.totalReturnPercent).padStart(8)}% ${fmt(r.maxDrawdown).padStart(8)}%  ${fmt(score(r)).padStart(6)}`
    );
  });

  console.log(`\n${"─".repeat(60)}`);
  console.log(" DETALHE POR PAR");
  console.log(`${"─".repeat(60)}`);

  for (const r of results) {
    const allPeriod = r.strategyRankingByPeriod?.find((p) => p.periodId === "all");
    console.log(`\n  ${r.pair}`);
    console.log(`    Win rate   : ${fmt(r.winRate)}%  ${bar(r.winRate, maxWR)}`);
    console.log(`    Retorno    : ${fmt(r.totalReturnPercent)}%  ${bar(r.totalReturnPercent, maxRet)}`);
    console.log(`    Drawdown   : ${fmt(r.maxDrawdown)}%`);
    console.log(`    Capital    : €${fmt(r.startingCapital)} → €${fmt(r.endingCapital)}`);
    console.log(`    Janelas WF : ${r.walkForward?.windowCount ?? "?"}`);

    if (allPeriod?.ranking?.length > 0) {
      console.log("    Por estratégia:");
      allPeriod.ranking.forEach((s) => {
        console.log(`      ${s.strategyId.padEnd(28)} trades:${String(s.totalTrades).padStart(3)}  win:${fmt(s.winRate).padStart(5)}%  pnl:€${fmt(s.pnlTotal,4)}`);
      });
    }

    // Wins vs losses
    const wins   = (r.trades || []).filter((t) => t.resultPnl > 0);
    const losses = (r.trades || []).filter((t) => t.resultPnl <= 0);
    const avgWin  = wins.length   ? wins.reduce((s, t)   => s + t.resultPnl, 0) / wins.length   : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.resultPnl, 0) / losses.length : 0;
    if (wins.length || losses.length) {
      console.log(`    Ganhos     : ${wins.length} × avg €${fmt(avgWin,4)}   |   Perdas: ${losses.length} × avg €${fmt(avgLoss,4)}`);
      if (avgLoss !== 0) {
        console.log(`    Profit fct : ${fmt(Math.abs(avgWin / avgLoss), 2)}`);
      }
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(" RECOMENDAÇÃO");
  console.log(`${"═".repeat(60)}`);
  const top2 = results.slice(0, 2);
  const rejected = results.slice(2);
  console.log(` Usar   : ${top2.map((r) => r.pair).join(", ")}`);
  if (rejected.length) {
    console.log(` Evitar : ${rejected.map((r) => `${r.pair} (win ${fmt(r.winRate)}%)`).join(", ")}`);
  }
  console.log(`\n Nota: sentimento neutro, order book sintético.`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
