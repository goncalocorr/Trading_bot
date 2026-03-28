#!/usr/bin/env node

/**
 * MCP Server for Trading Bot — lets Claude Code query the bot's API directly.
 *
 * Configure in .claude/settings.local.json:
 * {
 *   "mcpServers": {
 *     "trading-bot": {
 *       "command": "node",
 *       "args": ["mcp/trading-bot-server.js"],
 *       "env": {
 *         "BOT_API_URL": "https://your-domain.com",
 *         "BOT_API_SECRET": "your-api-secret"
 *       }
 *     }
 *   }
 * }
 */

const http = require("http");
const https = require("https");

const BOT_API_URL = process.env.BOT_API_URL || "http://localhost:3000";
const BOT_API_SECRET = process.env.BOT_API_SECRET || "";

// --- Minimal MCP stdio transport ---

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  processBuffer();
});

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.slice(headerEnd + 4); continue; }

    const length = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + length) break;

    const body = buffer.slice(bodyStart, bodyStart + length);
    buffer = buffer.slice(bodyStart + length);

    try {
      handleMessage(JSON.parse(body));
    } catch (e) {
      sendError(null, -32700, "Parse error");
    }
  }
}

function send(msg) {
  const json = JSON.stringify(msg);
  const out = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
  process.stdout.write(out);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

// --- Bot API client ---

async function botFetch(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BOT_API_URL);
    const client = url.protocol === "https:" ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "X-API-Key": BOT_API_SECRET,
        "Accept": "application/json"
      },
      timeout: 15000
    };

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    req.end();
  });
}

// --- Tool definitions ---

const TOOLS = [
  {
    name: "bot_health",
    description: "Get bot health status: database, exchange, circuit breakers, readiness.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "bot_dashboard",
    description: "Get full dashboard: capital, active trades with live PnL, daily stats, latest trades.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "bot_stats",
    description: "Get trade statistics: win rate, PnL by strategy, by market regime, rankings by period.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "bot_capital_history",
    description: "Get capital history for charting. Range: 1D, 1W, 1M, ALL.",
    inputSchema: {
      type: "object",
      properties: { range: { type: "string", enum: ["1D", "1W", "1M", "ALL"], default: "ALL" } }
    }
  },
  {
    name: "bot_trades",
    description: "List trades with optional filters: pair, side (BUY/SELL), status (open/closed/cancelled).",
    inputSchema: {
      type: "object",
      properties: {
        pair: { type: "string", description: "e.g. ETHUSDT" },
        side: { type: "string", enum: ["BUY", "SELL"] },
        status: { type: "string", enum: ["open", "closed", "cancelled"] }
      }
    }
  },
  {
    name: "bot_missed_opportunities",
    description: "Get signals that were scored but NOT executed, with reasons why.",
    inputSchema: {
      type: "object",
      properties: {
        pair: { type: "string" },
        limit: { type: "number", default: 50 }
      }
    }
  },
  {
    name: "bot_signal_debug",
    description: "Get real-time signal analysis for a pair: indicator scores, readiness state, blocking reasons.",
    inputSchema: {
      type: "object",
      properties: {
        pair: { type: "string", default: "ETHUSDT" },
        side: { type: "string", enum: ["BUY", "SELL"], default: "BUY" }
      },
      required: ["pair"]
    }
  },
  {
    name: "bot_settings",
    description: "Get current bot settings: trading mode, risk config, active strategies, thresholds.",
    inputSchema: { type: "object", properties: {}, required: [] }
  }
];

async function callTool(name, args) {
  switch (name) {
    case "bot_health":
      return botFetch("/health");
    case "bot_dashboard":
      return botFetch("/api/dashboard");
    case "bot_stats":
      return botFetch("/api/dashboard/stats");
    case "bot_capital_history":
      return botFetch(`/api/dashboard/capital-history?range=${args?.range || "ALL"}`);
    case "bot_trades": {
      const params = new URLSearchParams();
      if (args?.pair) params.set("pair", args.pair);
      if (args?.side) params.set("side", args.side);
      if (args?.status) params.set("status", args.status);
      const qs = params.toString();
      return botFetch(`/api/trades${qs ? `?${qs}` : ""}`);
    }
    case "bot_missed_opportunities": {
      const params = new URLSearchParams();
      if (args?.pair) params.set("pair", args.pair);
      params.set("limit", String(args?.limit || 50));
      return botFetch(`/api/dashboard/missed-opportunities?${params}`);
    }
    case "bot_signal_debug":
      return botFetch(`/api/dashboard/signal-debug?pair=${args?.pair || "ETHUSDT"}&side=${args?.side || "BUY"}`);
    case "bot_settings":
      return botFetch("/api/dashboard/settings");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- MCP message handler ---

function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case "initialize":
      sendResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "trading-bot", version: "1.0.0" }
      });
      break;

    case "notifications/initialized":
      break;

    case "tools/list":
      sendResult(id, { tools: TOOLS });
      break;

    case "tools/call":
      callTool(params.name, params.arguments || {})
        .then((result) => {
          sendResult(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
          });
        })
        .catch((err) => {
          sendResult(id, {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true
          });
        });
      break;

    default:
      sendError(id, -32601, `Method not found: ${method}`);
  }
}

// Keep alive
process.stdin.resume();
