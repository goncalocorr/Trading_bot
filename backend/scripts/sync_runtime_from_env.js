/**
 * Sync runtime state in MySQL to match current .env values.
 *
 * Run this after editing .env directly so the database reflects the new config:
 *   cd backend && node scripts/sync_runtime_from_env.js
 *
 * The server reads from MySQL on startup (overriding .env), so any .env edits
 * must be written to MySQL via this script — or via the Settings panel in the UI.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const db = require("../models/db");
const RuntimeStateModel = require("../models/RuntimeState");

function parseBooleanEnv(value, fallback = false) {
  if (!value) return fallback;
  return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
}

async function main() {
  const tradingPairs = String(process.env.TRADING_PAIRS || "BTCUSDT")
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);

  const activeStrategies = String(process.env.ACTIVE_STRATEGIES || "pullback_continuation")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const updates = {
    tradingPairs,
    activeStrategies,
    tradingMode: String(process.env.TRADING_MODE || "paper").toLowerCase() === "live" ? "live" : "paper",
    scoreThreshold: Number(process.env.SCORE_THRESHOLD || 8),
    riskPerTrade: Number(process.env.RISK_PER_TRADE || 0.01),
    compoundRatio: Number(process.env.COMPOUND_RATIO || 0.5),
    shadowModeEnabled: parseBooleanEnv(process.env.SHADOW_MODE_ENABLED, false),
    autonomyHeartbeatEnabled: parseBooleanEnv(process.env.AUTONOMY_HEARTBEAT_ENABLED, false),
    autoSwapEnabled: parseBooleanEnv(process.env.AUTO_SWAP_ENABLED, false),
    autoApproveLiveEnabled: parseBooleanEnv(process.env.AUTO_APPROVE_LIVE_ENABLED, false),
    autoLiveDeployEnabled: parseBooleanEnv(process.env.AUTO_LIVE_DEPLOY_ENABLED, false)
  };

  console.log("Syncing runtime state from .env...");
  console.log("  Trading pairs  :", tradingPairs.join(", "));
  console.log("  Strategies     :", activeStrategies.join(", "));
  console.log("  Trading mode   :", updates.tradingMode);
  console.log("  Score threshold:", updates.scoreThreshold);
  console.log("  Risk per trade :", updates.riskPerTrade);

  await RuntimeStateModel.setMany(updates);
  console.log("\nDone. Restart the backend for changes to take effect.");
}

main()
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  })
  .finally(() => db.pool?.end?.());
