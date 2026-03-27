import axios from "axios";

const apiKey = import.meta.env.VITE_API_SECRET || "";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: apiKey ? { "X-API-Key": apiKey } : {}
});

export async function fetchDashboard() {
  const { data } = await api.get("/api/dashboard");
  return data;
}

export async function fetchCapitalHistory(range = "ALL") {
  const { data } = await api.get("/api/dashboard/capital-history", {
    params: { range }
  });
  return data;
}

export async function fetchTradeStats() {
  const { data } = await api.get("/api/dashboard/stats");
  return data;
}

export async function fetchSignalDebug(pair = "BTCUSDT", side = "BUY") {
  const { data } = await api.get("/api/dashboard/signal-debug", {
    params: { pair, side }
  });
  return data;
}

export async function fetchSettings() {
  const { data } = await api.get("/api/dashboard/settings");
  return data;
}

export async function updateSettings(payload) {
  const { data } = await api.patch("/api/dashboard/settings", payload);
  return data;
}

export async function fetchTrades(filters = {}) {
  const { data } = await api.get("/api/trades", {
    params: filters
  });
  return data;
}

export async function fetchTradeOrders(id) {
  const { data } = await api.get(`/api/trades/${id}/orders`);
  return data;
}

export async function triggerManualTrade(payload) {
  const { data } = await api.post("/api/trades/manual", payload);
  return data;
}

export async function cancelTrade(id) {
  const { data } = await api.delete(`/api/trades/${id}/cancel`);
  return data;
}

export async function runBacktest(payload) {
  const { data } = await api.post("/api/backtest", payload);
  return data;
}

export async function fetchBacktestRuns(params = {}) {
  const { data } = await api.get("/api/backtest/runs", {
    params
  });
  return data;
}

export async function fetchBacktestRun(id) {
  const { data } = await api.get(`/api/backtest/runs/${id}`);
  return data;
}

export async function fetchBacktestStrategies() {
  const { data } = await api.get("/api/backtest/strategies");
  return data;
}

export async function compareBacktests(payload) {
  const { data } = await api.post("/api/backtest/compare", payload);
  return data;
}

export async function runBacktestExperiments(payload) {
  const { data } = await api.post("/api/backtest/experiments", payload);
  return data;
}

export async function favoriteBacktestRun(id, payload) {
  const { data } = await api.patch(`/api/backtest/runs/${id}/favorite`, payload);
  return data;
}

export async function promoteBacktestRun(id, payload = {}) {
  const { data } = await api.patch(`/api/backtest/runs/${id}/promote`, payload);
  return data;
}

export async function approveBacktestRunLive(id) {
  const { data } = await api.patch(`/api/backtest/runs/${id}/approve-live`);
  return data;
}

export async function fetchMissedOpportunities({ pair, limit, offset } = {}) {
  const { data } = await api.get("/api/dashboard/missed-opportunities", {
    params: { pair, limit, offset }
  });
  return data;
}
