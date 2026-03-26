import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || ""
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
