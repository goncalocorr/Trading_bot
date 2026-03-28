import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ActiveTrades from "./ActiveTrades";
import CapitalChart from "./CapitalChart";
import ConfirmModal from "./ConfirmModal";
import MissedOpportunities from "./MissedOpportunities";
import SignalDebugPanel from "./SignalDebugPanel";
import StatsPanel from "./StatsPanel";
import {
  cancelTrade,
  compareBacktests,
  favoriteBacktestRun,
  fetchBacktestStrategies,
  fetchBacktestRun,
  fetchBacktestRuns,
  fetchCapitalHistory,
  fetchDashboard,
  fetchSignalDebug,
  fetchSettings,
  fetchTrades,
  approveBacktestRunLive,
  forcePaperTest,
  promoteBacktestRun,
  runBacktest,
  runBacktestExperiments,
  triggerManualTrade,
  updateSettings
} from "../lib/api";
import { useI18n } from "../i18n/I18nProvider";

const Backtest = lazy(() => import("./Backtest"));
const HelpPanel = lazy(() => import("./HelpPanel"));
const SettingsPanel = lazy(() => import("./SettingsPanel"));
const TradeHistory = lazy(() => import("./TradeHistory"));

/* ── Icons (inline SVG) ── */

const icons = {
  overview: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  history: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  ),
  missed: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  backtest: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  help: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  menu: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  refresh: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  spinner: (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
};

/* ── Helpers ── */

function PanelLoader() {
  const { t } = useI18n();
  return (
    <section className="glass-card p-6 text-sm text-slate-300 animate-pulse-soft">
      {t("common.loadingPanel")}
    </section>
  );
}

function buildManualSignalFeedback(result = {}, t) {
  if (!result) return null;

  if (result.ok && result.action === "trade_opened") {
    return { tone: "success", message: t("dashboard.manual.tradeOpened", { pair: result.trade?.pair || result.pair || "?" }) };
  }
  if (result.ok && result.action === "all_positions_closed") {
    return { tone: "success", message: t("dashboard.manual.positionsClosed", { count: result.closedCount || 0 }) };
  }
  if (result.action === "blocked") {
    return { tone: "warning", message: result.reason || t("dashboard.manual.blocked") };
  }
  if (result.action === "missed_opportunity") {
    return { tone: "info", message: result.reason || t("dashboard.manual.missed") };
  }
  if (result.action === "ignored") {
    return { tone: "info", message: result.reason || t("dashboard.manual.ignored") };
  }
  if (result.action === "spot_sell_skipped") {
    return { tone: "info", message: result.reason || t("dashboard.manual.sellSkipped") };
  }
  return { tone: result.ok ? "success" : "warning", message: result.reason || t("dashboard.manual.processed") };
}

function normalizeNumericInput(value, fallback = 0) {
  const normalized = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : fallback;
}

/* ── Feedback toast ── */

function FeedbackToast({ feedback, onDismiss }) {
  if (!feedback) return null;
  const colors = {
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    info: "border-sky-400/30 bg-sky-500/10 text-sky-200"
  };
  return (
    <div className={`animate-fade-in glass-card px-4 py-3 text-sm ${colors[feedback.tone] || colors.info}`}>
      <div className="flex items-center justify-between gap-3">
        <span>{feedback.message}</span>
        <button type="button" onClick={onDismiss} className="text-white/40 hover:text-white/80 transition">&times;</button>
      </div>
    </div>
  );
}

/* ── Status badge ── */

function BotStatusBadge({ status, mode }) {
  const { t } = useI18n();
  const isOnline = status === "running" || status === "online" || status === "active";
  return (
    <div className="flex items-center gap-2.5">
      <span className={isOnline ? "status-dot-ok" : "status-dot-warn"} />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white truncate">{status || t("common.loading")}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{mode || "paper"}</p>
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */

function Dashboard() {
  const { locale, setLocale, availableLocales, t, formatCurrency, formatDateTime } = useI18n();

  // ── Navigation
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Data
  const [dashboardData, setDashboardData] = useState(null);
  const [capitalHistory, setCapitalHistory] = useState([]);
  const [signalDebug, setSignalDebug] = useState(null);
  const [historyRange, setHistoryRange] = useState("ALL");
  const [tradeHistory, setTradeHistory] = useState([]);
  const [tradeFilters, setTradeFilters] = useState({ pair: "", side: "", status: "", dateFrom: "", dateTo: "" });
  const [manualSignal, setManualSignal] = useState({ pair: "BTCUSDT", side: "BUY" });

  // ── Backtest
  const [backtestForm, setBacktestForm] = useState({
    pair: "BTCUSDT", dateFrom: "", dateTo: "", timeframe: "15m",
    activeStrategies: [], mode: "standard", feeRate: 0.001, slippageBps: 5,
    walkForwardTrainDays: 30, walkForwardTestDays: 7, walkForwardStepDays: 7,
    maxCombinationSize: 2
  });
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestRuns, setBacktestRuns] = useState([]);
  const [selectedBacktestRun, setSelectedBacktestRun] = useState(null);
  const [availableBacktestStrategies, setAvailableBacktestStrategies] = useState([]);
  const [backtestComparisons, setBacktestComparisons] = useState([]);
  const [backtestExperiments, setBacktestExperiments] = useState([]);

  // ── Settings
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    botEnabled: true, tradingMode: "paper", autonomyMode: "manual",
    shadowModeEnabled: false, autonomyHeartbeatEnabled: false,
    autoSwapEnabled: false, autoApproveLiveEnabled: false, autoLiveDeployEnabled: false,
    notificationLocale: "en", scoreThreshold: 8, riskPerTrade: 0.01,
    compoundRatio: 0.5, tradingPairs: "BTCUSDT", activeStrategies: [],
    championRunId: null, challengerRunId: null,
    regimeChampionTrendRunId: null, regimeChampionSidewaysRunId: null,
    regimeChampionVolatileRunId: null, approvedLiveRunId: null
  });

  // ── UI state
  const [confirmModal, setConfirmModal] = useState({ open: false, title: "", message: "", confirmLabel: "", confirmClass: "", onConfirm: null });
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestRunsLoading, setBacktestRunsLoading] = useState(false);
  const [backtestComparisonLoading, setBacktestComparisonLoading] = useState(false);
  const [backtestExperimentLoading, setBacktestExperimentLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [signalDebugLoading, setSignalDebugLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualFeedback, setManualFeedback] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const refreshTimerRef = useRef(null);

  // ── Tab definitions
  const tabs = useMemo(() => [
    { id: "overview", label: t("tab.overview"), icon: icons.overview },
    { id: "history", label: t("tab.history"), icon: icons.history },
    { id: "missed", label: t("tab.missed"), icon: icons.missed },
    { id: "backtest", label: t("tab.backtest"), icon: icons.backtest },
    { id: "settings", label: t("tab.settings"), icon: icons.settings },
    { id: "help", label: t("tab.help"), icon: icons.help }
  ], [t]);

  // ── Headline metrics
  const headlineCards = useMemo(() => {
    const capital = dashboardData?.capital || {};
    return [
      { label: t("dashboard.currentCapital"), value: formatCurrency(capital.current), accent: "text-amber-300", icon: "$" },
      { label: t("dashboard.realizedProfit"), value: formatCurrency(capital.realizedProfit), accent: Number(capital.realizedProfit || 0) >= 0 ? "text-emerald-300" : "text-rose-300", icon: "%" },
      { label: t("dashboard.unrealizedPnl"), value: formatCurrency(capital.unrealizedPnl), accent: Number(capital.unrealizedPnl || 0) >= 0 ? "text-sky-300" : "text-rose-300", icon: "~" }
    ];
  }, [dashboardData, formatCurrency, t]);

  // ── Data loading
  const load = useCallback(async () => {
    try {
      setLoadingDashboard(true);
      const [
        dashboardResult, historyResult, tradesResult, settingsResult,
        backtestRunsResult, backtestStrategiesResult
      ] = await Promise.allSettled([
        fetchDashboard(),
        fetchCapitalHistory(historyRange),
        fetchTrades(),
        fetchSettings(),
        fetchBacktestRuns({ limit: 10 }),
        fetchBacktestStrategies()
      ]);

      const dashboardResponse = dashboardResult.status === "fulfilled" ? dashboardResult.value : null;
      const historyResponse = historyResult.status === "fulfilled" ? historyResult.value : null;
      const tradesResponse = tradesResult.status === "fulfilled" ? tradesResult.value : null;
      const settingsResponse = settingsResult.status === "fulfilled" ? settingsResult.value : null;
      const backtestRunsResponse = backtestRunsResult.status === "fulfilled" ? backtestRunsResult.value : null;
      const backtestStrategiesResponse = backtestStrategiesResult.status === "fulfilled" ? backtestStrategiesResult.value : null;

      if (dashboardResponse) setDashboardData(dashboardResponse);
      if (historyResponse) setCapitalHistory(historyResponse.history || []);
      if (tradesResponse) setTradeHistory(tradesResponse.trades || []);
      if (settingsResponse) setSettings(settingsResponse.settings || null);
      if (backtestRunsResponse) setBacktestRuns(backtestRunsResponse.runs || []);
      if (backtestStrategiesResponse) setAvailableBacktestStrategies(backtestStrategiesResponse.strategies || []);
      if (backtestStrategiesResponse) {
        setBacktestForm((current) => ({
          ...current,
          activeStrategies: current.activeStrategies.length > 0
            ? current.activeStrategies
            : (backtestStrategiesResponse.strategies || []).filter((s) => s.activeByDefault).map((s) => s.id)
        }));
      }
      if ((backtestRunsResponse?.runs || []).length > 0) {
        try {
          const latestRunResponse = await fetchBacktestRun(backtestRunsResponse.runs[0].id);
          setSelectedBacktestRun(latestRunResponse.run || null);
        } catch { /* non-critical */ }
      }
      if (settingsResponse?.settings) {
        setSettingsForm({
          botEnabled: settingsResponse.settings.botEnabled ?? true,
          tradingMode: settingsResponse.settings.tradingMode ?? "paper",
          autonomyMode: settingsResponse.settings.autonomyMode ?? "manual",
          shadowModeEnabled: settingsResponse.settings.shadowModeEnabled ?? false,
          autonomyHeartbeatEnabled: settingsResponse.settings.autonomyHeartbeatEnabled ?? false,
          autoSwapEnabled: settingsResponse.settings.autoSwapEnabled ?? false,
          autoApproveLiveEnabled: settingsResponse.settings.autoApproveLiveEnabled ?? false,
          autoLiveDeployEnabled: settingsResponse.settings.autoLiveDeployEnabled ?? false,
          notificationLocale: settingsResponse.settings.notificationLocale ?? "en",
          scoreThreshold: settingsResponse.settings.scoreThreshold ?? 8,
          riskPerTrade: settingsResponse.settings.riskPerTrade ?? 0.01,
          compoundRatio: settingsResponse.settings.compoundRatio ?? 0.5,
          tradingPairs: (settingsResponse.settings.tradingPairs || ["BTCUSDT"]).join(","),
          activeStrategies: settingsResponse.settings.activeStrategies || [],
          championRunId: settingsResponse.settings.championRunId || null,
          challengerRunId: settingsResponse.settings.challengerRunId || null,
          regimeChampionTrendRunId: settingsResponse.settings.regimeChampionTrendRunId || null,
          regimeChampionSidewaysRunId: settingsResponse.settings.regimeChampionSidewaysRunId || null,
          regimeChampionVolatileRunId: settingsResponse.settings.regimeChampionVolatileRunId || null,
          approvedLiveRunId: settingsResponse.settings.approvedLiveRunId || null
        });
      }
      setError("");
      setManualFeedback(null);
      setLastRefresh(new Date());
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setLoadingDashboard(false);
    }
  }, [historyRange]);

  // ── Auto-refresh
  useEffect(() => {
    load();
    if (autoRefresh) {
      refreshTimerRef.current = window.setInterval(load, 15000);
    }
    return () => {
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current);
    };
  }, [load, autoRefresh]);

  // ── Signal debug
  useEffect(() => {
    let active = true;
    const loadSignalDebug = async () => {
      try {
        setSignalDebugLoading(true);
        const response = await fetchSignalDebug(manualSignal.pair, manualSignal.side);
        if (active) setSignalDebug(response.debug || null);
      } catch {
        if (active) setSignalDebug(null);
      } finally {
        if (active) setSignalDebugLoading(false);
      }
    };
    loadSignalDebug();
    return () => { active = false; };
  }, [manualSignal.pair, manualSignal.side]);

  // ── Handlers
  const refreshTradeHistory = async () => {
    const response = await fetchTrades({
      pair: tradeFilters.pair || undefined,
      side: tradeFilters.side || undefined,
      status: tradeFilters.status || undefined,
      dateFrom: tradeFilters.dateFrom || undefined,
      dateTo: tradeFilters.dateTo || undefined
    });
    setTradeHistory(response.trades || []);
  };

  const handleRangeChange = async (nextRange) => {
    setHistoryRange(nextRange);
    setLoadingHistory(true);
    try {
      const response = await fetchCapitalHistory(nextRange);
      setCapitalHistory(response.history || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleManualTrigger = async () => {
    setActionLoading(true);
    try {
      const response = await triggerManualTrade(manualSignal);
      const dashboardResponse = await fetchDashboard();
      const debugResponse = await fetchSignalDebug(manualSignal.pair, manualSignal.side);
      setDashboardData(dashboardResponse);
      setSignalDebug(debugResponse.debug || null);
      await refreshTradeHistory();
      setError("");
      setManualFeedback(buildManualSignalFeedback(response.result, t));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
      setManualFeedback(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceTestTrade = () => {
    setConfirmModal({
      open: true,
      title: t("dashboard.forceTradeTitle"),
      message: t("dashboard.forceTradeMessage", { pair: manualSignal.pair }),
      confirmLabel: t("dashboard.forceTradeConfirm"),
      confirmClass: "bg-orange-500 text-white hover:bg-orange-400",
      onConfirm: async () => {
        setConfirmModal((c) => ({ ...c, open: false }));
        setActionLoading(true);
        try {
          const response = await forcePaperTest(manualSignal.pair);
          const dashboardResponse = await fetchDashboard();
          setDashboardData(dashboardResponse);
          await refreshTradeHistory();
          setError("");
          setManualFeedback(buildManualSignalFeedback(response.result, t));
        } catch (requestError) {
          setError(requestError.response?.data?.message || requestError.message);
          setManualFeedback(null);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleCancelTrade = async (id) => {
    setActionLoading(true);
    try {
      await cancelTrade(id);
      const dashboardResponse = await fetchDashboard();
      setDashboardData(dashboardResponse);
      await refreshTradeHistory();
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBacktest = async () => {
    setBacktestLoading(true);
    try {
      const response = await runBacktest(backtestForm);
      setBacktestResult(response.result || null);
      if (response.runId) {
        const [runsResponse, selectedRunResponse] = await Promise.all([
          fetchBacktestRuns({ limit: 10, pair: backtestForm.pair }),
          fetchBacktestRun(response.runId)
        ]);
        setBacktestRuns(runsResponse.runs || []);
        setSelectedBacktestRun(selectedRunResponse.run || null);
      }
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBacktestLoading(false);
    }
  };

  const handleCompareBacktests = async () => {
    const selectedStrategies = Array.isArray(backtestForm.activeStrategies) ? backtestForm.activeStrategies : [];
    const uniqueStrategies = [...new Set(selectedStrategies)];
    if (uniqueStrategies.length === 0) { setError("Select at least one strategy to compare."); return; }
    const strategySets = [];
    if (uniqueStrategies.length > 1) strategySets.push({ label: "Selected Combo", strategies: uniqueStrategies });
    uniqueStrategies.forEach((id) => strategySets.push({ label: id, strategies: [id] }));
    setBacktestComparisonLoading(true);
    try {
      const response = await compareBacktests({ ...backtestForm, strategySets });
      setBacktestComparisons(response.comparisons || []);
      const runsResponse = await fetchBacktestRuns({ limit: 10, pair: backtestForm.pair });
      setBacktestRuns(runsResponse.runs || []);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBacktestComparisonLoading(false);
    }
  };

  const handleRunBacktestExperiments = async () => {
    const selectedStrategies = Array.isArray(backtestForm.activeStrategies) ? backtestForm.activeStrategies : [];
    if (selectedStrategies.length === 0) { setError("Select at least one strategy to run experiments."); return; }
    setBacktestExperimentLoading(true);
    try {
      const response = await runBacktestExperiments({ ...backtestForm, strategyIds: selectedStrategies, maxCombinationSize: Number(backtestForm.maxCombinationSize || 2) });
      setBacktestExperiments(response.comparisons || []);
      const runsResponse = await fetchBacktestRuns({ limit: 10, pair: backtestForm.pair });
      setBacktestRuns(runsResponse.runs || []);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBacktestExperimentLoading(false);
    }
  };

  const handleSelectBacktestRun = async (runId) => {
    setBacktestRunsLoading(true);
    try {
      const response = await fetchBacktestRun(runId);
      setSelectedBacktestRun(response.run || null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBacktestRunsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const response = await updateSettings({
        botEnabled: settingsForm.botEnabled,
        tradingMode: settingsForm.tradingMode,
        autonomyMode: settingsForm.autonomyMode,
        shadowModeEnabled: Boolean(settingsForm.shadowModeEnabled),
        autonomyHeartbeatEnabled: Boolean(settingsForm.autonomyHeartbeatEnabled),
        autoSwapEnabled: Boolean(settingsForm.autoSwapEnabled),
        autoApproveLiveEnabled: Boolean(settingsForm.autoApproveLiveEnabled),
        autoLiveDeployEnabled: Boolean(settingsForm.autoLiveDeployEnabled),
        notificationLocale: settingsForm.notificationLocale || "en",
        scoreThreshold: Math.round(normalizeNumericInput(settingsForm.scoreThreshold, 8)),
        riskPerTrade: normalizeNumericInput(settingsForm.riskPerTrade, 0.01),
        compoundRatio: normalizeNumericInput(settingsForm.compoundRatio, 0.5),
        tradingPairs: settingsForm.tradingPairs.split(",").map((p) => p.trim()).filter(Boolean),
        activeStrategies: settingsForm.activeStrategies
      });
      setSettings(response.settings || null);
      setSettingsForm((current) => ({
        ...current,
        botEnabled: response.settings?.botEnabled ?? current.botEnabled,
        tradingMode: response.settings?.tradingMode || current.tradingMode,
        autonomyMode: response.settings?.autonomyMode || current.autonomyMode,
        shadowModeEnabled: response.settings?.shadowModeEnabled ?? current.shadowModeEnabled,
        autonomyHeartbeatEnabled: response.settings?.autonomyHeartbeatEnabled ?? current.autonomyHeartbeatEnabled,
        autoSwapEnabled: response.settings?.autoSwapEnabled ?? current.autoSwapEnabled,
        autoApproveLiveEnabled: response.settings?.autoApproveLiveEnabled ?? current.autoApproveLiveEnabled,
        autoLiveDeployEnabled: response.settings?.autoLiveDeployEnabled ?? current.autoLiveDeployEnabled,
        notificationLocale: response.settings?.notificationLocale || current.notificationLocale,
        scoreThreshold: response.settings?.scoreThreshold ?? current.scoreThreshold,
        riskPerTrade: response.settings?.riskPerTrade ?? current.riskPerTrade,
        compoundRatio: response.settings?.compoundRatio ?? current.compoundRatio,
        tradingPairs: Array.isArray(response.settings?.tradingPairs) ? response.settings.tradingPairs.join(",") : current.tradingPairs,
        activeStrategies: response.settings?.activeStrategies || current.activeStrategies,
        championRunId: response.settings?.championRunId ?? current.championRunId,
        challengerRunId: response.settings?.challengerRunId ?? current.challengerRunId,
        regimeChampionTrendRunId: response.settings?.regimeChampionTrendRunId ?? current.regimeChampionTrendRunId,
        regimeChampionSidewaysRunId: response.settings?.regimeChampionSidewaysRunId ?? current.regimeChampionSidewaysRunId,
        regimeChampionVolatileRunId: response.settings?.regimeChampionVolatileRunId ?? current.regimeChampionVolatileRunId,
        approvedLiveRunId: response.settings?.approvedLiveRunId ?? current.approvedLiveRunId
      }));
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleFavoriteBacktestRun = async (runId, isFavorite, favoriteLabel = "") => {
    try {
      await favoriteBacktestRun(runId, { isFavorite, favoriteLabel });
      const [runsResponse, selectedRunResponse] = await Promise.all([
        fetchBacktestRuns({ limit: 10, pair: backtestForm.pair }),
        fetchBacktestRun(runId)
      ]);
      setBacktestRuns(runsResponse.runs || []);
      setSelectedBacktestRun(selectedRunResponse.run || null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    }
  };

  const handlePromoteBacktestRun = async (runId, slot = "champion", regimeId = null) => {
    try {
      const response = await promoteBacktestRun(runId, { slot, regimeId });
      setSettings(response.settings || null);
      setSettingsForm((current) => ({
        ...current,
        tradingMode: response.settings?.tradingMode || current.tradingMode,
        activeStrategies: response.settings?.activeStrategies || current.activeStrategies,
        championRunId: response.settings?.championRunId ?? current.championRunId,
        challengerRunId: response.settings?.challengerRunId ?? current.challengerRunId,
        regimeChampionTrendRunId: response.settings?.regimeChampionTrendRunId ?? current.regimeChampionTrendRunId,
        regimeChampionSidewaysRunId: response.settings?.regimeChampionSidewaysRunId ?? current.regimeChampionSidewaysRunId,
        regimeChampionVolatileRunId: response.settings?.regimeChampionVolatileRunId ?? current.regimeChampionVolatileRunId
      }));
      const [runsResponse, selectedRunResponse] = await Promise.all([
        fetchBacktestRuns({ limit: 10, pair: backtestForm.pair }),
        fetchBacktestRun(runId)
      ]);
      setBacktestRuns(runsResponse.runs || []);
      setSelectedBacktestRun(selectedRunResponse.run || null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    }
  };

  const handleApproveBacktestRunLive = async (runId) => {
    try {
      const response = await approveBacktestRunLive(runId);
      setSettings(response.settings || null);
      setSettingsForm((current) => ({
        ...current,
        tradingMode: response.settings?.tradingMode || current.tradingMode,
        approvedLiveRunId: response.settings?.approvedLiveRunId ?? current.approvedLiveRunId
      }));
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    }
  };

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  // ── Render
  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_rgba(251,191,36,0.08),_transparent_50%),linear-gradient(to_bottom,_#020617,_#0f172a)] text-slate-100">
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmClass={confirmModal.confirmClass}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((c) => ({ ...c, open: false }))}
      />

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col
        border-r border-white/[0.06] bg-slate-950/80 backdrop-blur-xl
        transition-transform duration-300 ease-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 text-lg font-bold">
              T
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Trading Bot</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Dashboard</p>
            </div>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            {icons.close}
          </button>
        </div>

        {/* Bot status */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <BotStatusBadge
            status={dashboardData?.botStatus}
            mode={settings?.tradingMode}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={activeTab === tab.id ? "nav-item-active" : "nav-item-inactive"}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="px-4 py-4 border-t border-white/[0.06] space-y-3">
          {/* Auto-refresh toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.04] transition"
          >
            <span className="flex items-center gap-2">
              <span className={`status-dot ${autoRefresh ? "bg-emerald-400" : "bg-slate-600"}`} />
              Auto-refresh
            </span>
            <span className="text-[10px] text-slate-600">{autoRefresh ? "15s" : "OFF"}</span>
          </button>

          {/* Last refresh */}
          {lastRefresh && (
            <p className="text-[10px] text-slate-600 text-center">
              {formatDateTime(lastRefresh, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}

          {/* Language */}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 outline-none"
          >
            {availableLocales.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar (mobile) */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-slate-950/90 backdrop-blur-lg px-4 py-3 lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="text-slate-300 hover:text-white">
            {icons.menu}
          </button>
          <h2 className="text-sm font-semibold text-white">
            {tabs.find((t) => t.id === activeTab)?.label}
          </h2>
          <button
            type="button"
            onClick={load}
            disabled={loadingDashboard}
            className="text-slate-300 hover:text-white disabled:opacity-50"
          >
            {loadingDashboard ? icons.spinner : icons.refresh}
          </button>
        </div>

        <div className="p-4 lg:p-6 xl:p-8 space-y-5 max-w-[1400px]">
          {/* ── Page header ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
              {activeTab === "overview" && (
                <p className="mt-1 text-sm text-slate-400">{t("dashboard.subtitle")}</p>
              )}
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <button
                type="button"
                onClick={load}
                disabled={loadingDashboard}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                {loadingDashboard ? icons.spinner : icons.refresh}
                {loadingDashboard ? t("common.refreshing") : t("common.refresh")}
              </button>
            </div>
          </div>

          {/* ── Error/feedback ── */}
          {error && (
            <div className="animate-fade-in glass-card border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
          <FeedbackToast feedback={manualFeedback} onDismiss={() => setManualFeedback(null)} />

          {/* ── TAB: Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-5 animate-fade-in">
              {/* Metrics row */}
              <div className="grid gap-4 sm:grid-cols-3">
                {headlineCards.map((card) => (
                  <div key={card.label} className="metric-card">
                    <p className="metric-label">{card.label}</p>
                    <p className={`metric-value ${card.accent}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Manual signal bar */}
              <div className="glass-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                    <input
                      value={manualSignal.pair}
                      onChange={(e) => setManualSignal((c) => ({ ...c, pair: e.target.value.toUpperCase() }))}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40 transition"
                      placeholder="BTCUSDT"
                    />
                    <select
                      value={manualSignal.side}
                      onChange={(e) => setManualSignal((c) => ({ ...c, side: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none"
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleManualTrigger}
                      disabled={actionLoading}
                      className="flex items-center justify-center gap-2 rounded-xl bg-amber-400/90 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-300 disabled:opacity-50"
                    >
                      {actionLoading && icons.spinner}
                      {actionLoading ? t("dashboard.submitting") : t("dashboard.manualSignal")}
                    </button>
                  </div>
                  {settings?.tradingMode === "paper" && (
                    <button
                      type="button"
                      onClick={handleForceTestTrade}
                      disabled={actionLoading}
                      className="rounded-xl border border-orange-500/30 bg-orange-500/[0.08] px-4 py-2.5 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/[0.15] disabled:opacity-50 whitespace-nowrap"
                    >
                      {t("dashboard.forceTestTrade")}
                    </button>
                  )}
                </div>
              </div>

              {/* Capital chart */}
              <CapitalChart
                data={capitalHistory}
                range={historyRange}
                onRangeChange={handleRangeChange}
                loading={loadingDashboard || loadingHistory}
              />

              {/* Signal debug */}
              <SignalDebugPanel debug={signalDebug} loading={signalDebugLoading} />

              {/* Active trades + Stats */}
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <ActiveTrades
                  trades={dashboardData?.activeTrades || []}
                  onCancel={handleCancelTrade}
                  actionLoading={actionLoading}
                />
                <StatsPanel stats={dashboardData?.stats || {}} />
              </div>

              {/* Latest trades */}
              <section className="glass-card p-5">
                <h3 className="text-base font-semibold text-white mb-1">{t("dashboard.latestTrades")}</h3>
                <p className="text-xs text-slate-500 mb-4">{t("dashboard.latestTradesHint")}</p>

                <div className="space-y-2">
                  {(dashboardData?.latestTrades || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-sm text-slate-500">
                      {t("dashboard.noLatestTrades")}
                    </div>
                  ) : (
                    (dashboardData?.latestTrades || []).map((trade) => (
                      <article
                        key={trade.id}
                        className="glass-card-hover grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6"
                      >
                        <div>
                          <p className="metric-label">{t("dashboard.field.pair")}</p>
                          <p className="mt-1 text-sm font-semibold text-white">{trade.pair}</p>
                        </div>
                        <div>
                          <p className="metric-label">{t("dashboard.field.strategy")}</p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {trade.metadata?.strategyId || trade.metadata?.strategy || t("common.manual")}
                          </p>
                        </div>
                        <div>
                          <p className="metric-label">{t("dashboard.field.side")}</p>
                          <p className={`mt-1 text-sm font-semibold ${trade.side === "BUY" ? "text-emerald-300" : "text-rose-300"}`}>
                            {trade.side}
                          </p>
                        </div>
                        <div>
                          <p className="metric-label">{t("dashboard.field.status")}</p>
                          <p className="mt-1 text-sm font-semibold text-white">{trade.status}</p>
                        </div>
                        <div>
                          <p className="metric-label">{t("dashboard.field.pnl")}</p>
                          <p className={`mt-1 text-sm font-semibold ${Number(trade.result_pnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {formatCurrency(trade.result_pnl || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="metric-label">{t("dashboard.field.opened")}</p>
                          <p className="mt-1 text-sm text-slate-300">{formatDateTime(trade.opened_at)}</p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ── TAB: History ── */}
          {activeTab === "history" && (
            <Suspense fallback={<PanelLoader />}>
              <TradeHistory
                trades={tradeHistory}
                filters={tradeFilters}
                onFilterChange={(field, value) => setTradeFilters((c) => ({ ...c, [field]: value }))}
                onApplyFilters={refreshTradeHistory}
              />
            </Suspense>
          )}

          {/* ── TAB: Missed ── */}
          {activeTab === "missed" && (
            <MissedOpportunities tradingPairs={settings?.tradingPairs || []} />
          )}

          {/* ── TAB: Backtest ── */}
          {activeTab === "backtest" && (
            <Suspense fallback={<PanelLoader />}>
              <Backtest
                form={backtestForm}
                onChange={(field, value) => setBacktestForm((c) => ({ ...c, [field]: value }))}
                onRun={handleBacktest}
                loading={backtestLoading}
                result={backtestResult}
                strategies={availableBacktestStrategies}
                runs={backtestRuns}
                selectedRun={selectedBacktestRun}
                onSelectRun={handleSelectBacktestRun}
                runsLoading={backtestRunsLoading}
                comparisons={backtestComparisons}
                comparisonLoading={backtestComparisonLoading}
                onCompare={handleCompareBacktests}
                experiments={backtestExperiments}
                experimentLoading={backtestExperimentLoading}
                onRunExperiments={handleRunBacktestExperiments}
                onFavoriteRun={handleFavoriteBacktestRun}
                onPromoteRun={handlePromoteBacktestRun}
                onApproveLive={handleApproveBacktestRunLive}
              />
            </Suspense>
          )}

          {/* ── TAB: Settings ── */}
          {activeTab === "settings" && (
            <Suspense fallback={<PanelLoader />}>
              <SettingsPanel
                settings={settings}
                form={settingsForm}
                onChange={(field, value) => setSettingsForm((c) => ({ ...c, [field]: value }))}
                onSave={handleSaveSettings}
                saving={settingsSaving}
                strategies={availableBacktestStrategies}
              />
            </Suspense>
          )}

          {/* ── TAB: Help ── */}
          {activeTab === "help" && (
            <Suspense fallback={<PanelLoader />}>
              <HelpPanel />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
