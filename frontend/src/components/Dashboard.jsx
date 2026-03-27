import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
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

const Backtest = lazy(() => import("./Backtest"));
const SettingsPanel = lazy(() => import("./SettingsPanel"));
const TradeHistory = lazy(() => import("./TradeHistory"));

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "History" },
  { id: "missed", label: "Missed" },
  { id: "backtest", label: "Backtest" },
  { id: "settings", label: "Settings" }
];

function PanelLoader() {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-slate-300 backdrop-blur">
      Loading panel...
    </section>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function buildManualSignalFeedback(result = {}) {
  if (!result) {
    return null;
  }

  if (result.ok && result.action === "trade_opened") {
    return {
      tone: "success",
      message: `Trade opened successfully for ${result.trade?.pair || "the selected pair"}.`
    };
  }

  if (result.ok && result.action === "all_positions_closed") {
    return {
      tone: "success",
      message: `Closed ${result.closedCount || 0} open position(s) for the selected pair.`
    };
  }

  if (result.action === "blocked") {
    return {
      tone: "warning",
      message: result.reason || "Manual signal was blocked by the strategy rules."
    };
  }

  if (result.action === "missed_opportunity") {
    return {
      tone: "info",
      message: result.reason || "Signal was logged as a missed opportunity."
    };
  }

  if (result.action === "ignored") {
    return {
      tone: "info",
      message: result.reason || "Signal was ignored by the scoring system."
    };
  }

  if (result.action === "spot_sell_skipped") {
    return {
      tone: "info",
      message: result.reason || "No open spot position was available to close."
    };
  }

  return {
    tone: result.ok ? "success" : "warning",
    message: result.reason || "Manual signal processed."
  };
}

function normalizeNumericInput(value, fallback = 0) {
  const normalized = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : fallback;
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dashboardData, setDashboardData] = useState(null);
  const [capitalHistory, setCapitalHistory] = useState([]);
  const [signalDebug, setSignalDebug] = useState(null);
  const [historyRange, setHistoryRange] = useState("ALL");
  const [tradeHistory, setTradeHistory] = useState([]);
  const [tradeFilters, setTradeFilters] = useState({
    pair: "",
    side: "",
    status: "",
    dateFrom: "",
    dateTo: ""
  });
  const [manualSignal, setManualSignal] = useState({
    pair: "BTCUSDT",
    side: "BUY"
  });
  const [backtestForm, setBacktestForm] = useState({
    pair: "BTCUSDT",
    dateFrom: "",
    dateTo: "",
    timeframe: "15m",
    activeStrategies: [],
    mode: "standard",
    feeRate: 0.001,
    slippageBps: 5,
    walkForwardTrainDays: 30,
    walkForwardTestDays: 7,
    walkForwardStepDays: 7,
    maxCombinationSize: 2
  });
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestRuns, setBacktestRuns] = useState([]);
  const [selectedBacktestRun, setSelectedBacktestRun] = useState(null);
  const [availableBacktestStrategies, setAvailableBacktestStrategies] = useState([]);
  const [backtestComparisons, setBacktestComparisons] = useState([]);
  const [backtestExperiments, setBacktestExperiments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    botEnabled: true,
    tradingMode: "paper",
    autonomyMode: "manual",
    shadowModeEnabled: false,
    autonomyHeartbeatEnabled: false,
    autoSwapEnabled: false,
    autoApproveLiveEnabled: false,
    autoLiveDeployEnabled: false,
    scoreThreshold: 8,
    riskPerTrade: 0.01,
    compoundRatio: 0.5,
    tradingPairs: "BTCUSDT",
    activeStrategies: [],
    championRunId: null,
    challengerRunId: null,
    regimeChampionTrendRunId: null,
    regimeChampionSidewaysRunId: null,
    regimeChampionVolatileRunId: null,
    approvedLiveRunId: null
  });
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

  const headlineCards = useMemo(() => {
    const capital = dashboardData?.capital || {};

    return [
      { label: "Current Capital", value: formatCurrency(capital.current), accent: "text-amber-300" },
      { label: "Realized Profit", value: formatCurrency(capital.realizedProfit), accent: "text-emerald-300" },
      { label: "Unrealized P&L", value: formatCurrency(capital.unrealizedPnl), accent: "text-sky-300" },
      { label: "Bot Status", value: dashboardData?.botStatus || "Loading", accent: "text-white" }
    ];
  }, [dashboardData]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingDashboard(true);
        const [dashboardResponse, historyResponse, tradesResponse, settingsResponse, backtestRunsResponse, backtestStrategiesResponse] = await Promise.all([
          fetchDashboard(),
          fetchCapitalHistory(historyRange),
          fetchTrades(),
          fetchSettings(),
          fetchBacktestRuns({ limit: 10 }),
          fetchBacktestStrategies()
        ]);

        setDashboardData(dashboardResponse);
        setCapitalHistory(historyResponse.history || []);
        setTradeHistory(tradesResponse.trades || []);
        setSettings(settingsResponse.settings || null);
        setBacktestRuns(backtestRunsResponse.runs || []);
        setAvailableBacktestStrategies(backtestStrategiesResponse.strategies || []);
        setBacktestForm((current) => ({
          ...current,
          activeStrategies:
            current.activeStrategies.length > 0
              ? current.activeStrategies
              : (backtestStrategiesResponse.strategies || [])
                  .filter((strategy) => strategy.activeByDefault)
                  .map((strategy) => strategy.id)
        }));
        if ((backtestRunsResponse.runs || []).length > 0) {
          const latestRunResponse = await fetchBacktestRun(backtestRunsResponse.runs[0].id);
          setSelectedBacktestRun(latestRunResponse.run || null);
        }
        setSettingsForm({
          botEnabled: settingsResponse.settings?.botEnabled ?? true,
          tradingMode: settingsResponse.settings?.tradingMode ?? "paper",
          autonomyMode: settingsResponse.settings?.autonomyMode ?? "manual",
          shadowModeEnabled: settingsResponse.settings?.shadowModeEnabled ?? false,
          autonomyHeartbeatEnabled: settingsResponse.settings?.autonomyHeartbeatEnabled ?? false,
          autoSwapEnabled: settingsResponse.settings?.autoSwapEnabled ?? false,
          autoApproveLiveEnabled: settingsResponse.settings?.autoApproveLiveEnabled ?? false,
          autoLiveDeployEnabled: settingsResponse.settings?.autoLiveDeployEnabled ?? false,
          scoreThreshold: settingsResponse.settings?.scoreThreshold ?? 8,
          riskPerTrade: settingsResponse.settings?.riskPerTrade ?? 0.01,
          compoundRatio: settingsResponse.settings?.compoundRatio ?? 0.5,
          tradingPairs: (settingsResponse.settings?.tradingPairs || ["BTCUSDT"]).join(","),
          activeStrategies: settingsResponse.settings?.activeStrategies || [],
          championRunId: settingsResponse.settings?.championRunId || null,
          challengerRunId: settingsResponse.settings?.challengerRunId || null,
          regimeChampionTrendRunId: settingsResponse.settings?.regimeChampionTrendRunId || null,
          regimeChampionSidewaysRunId: settingsResponse.settings?.regimeChampionSidewaysRunId || null,
          regimeChampionVolatileRunId: settingsResponse.settings?.regimeChampionVolatileRunId || null,
          approvedLiveRunId: settingsResponse.settings?.approvedLiveRunId || null
        });
        setError("");
        setManualFeedback(null);
      } catch (requestError) {
        setError(requestError.response?.data?.message || requestError.message);
      } finally {
        setLoadingDashboard(false);
      }
    };

    load();
    const intervalId = window.setInterval(load, 15000);

    return () => window.clearInterval(intervalId);
  }, [historyRange]);

  useEffect(() => {
    let active = true;

    const loadSignalDebug = async () => {
      try {
        setSignalDebugLoading(true);
        const response = await fetchSignalDebug(manualSignal.pair, manualSignal.side);

        if (active) {
          setSignalDebug(response.debug || null);
        }
      } catch (_requestError) {
        if (active) {
          setSignalDebug(null);
        }
      } finally {
        if (active) {
          setSignalDebugLoading(false);
        }
      }
    };

    loadSignalDebug();

    return () => {
      active = false;
    };
  }, [manualSignal.pair, manualSignal.side]);

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
      setManualFeedback(buildManualSignalFeedback(response.result));
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
      title: "Force paper trade?",
      message: `This will open a BUY on ${manualSignal.pair} bypassing all scoring guards. For pipeline validation only.`,
      confirmLabel: "Force trade",
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
          setManualFeedback(buildManualSignalFeedback(response.result));
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

    if (uniqueStrategies.length === 0) {
      setError("Select at least one strategy to compare.");
      return;
    }

    const strategySets = [];

    if (uniqueStrategies.length > 1) {
      strategySets.push({
        label: "Selected Combo",
        strategies: uniqueStrategies
      });
    }

    uniqueStrategies.forEach((strategyId) => {
      strategySets.push({
        label: strategyId,
        strategies: [strategyId]
      });
    });

    setBacktestComparisonLoading(true);

    try {
      const response = await compareBacktests({
        ...backtestForm,
        strategySets
      });
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

    if (selectedStrategies.length === 0) {
      setError("Select at least one strategy to run experiments.");
      return;
    }

    setBacktestExperimentLoading(true);

    try {
      const response = await runBacktestExperiments({
        ...backtestForm,
        strategyIds: selectedStrategies,
        maxCombinationSize: Number(backtestForm.maxCombinationSize || 2)
      });
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
        scoreThreshold: Math.round(normalizeNumericInput(settingsForm.scoreThreshold, 8)),
        riskPerTrade: normalizeNumericInput(settingsForm.riskPerTrade, 0.01),
        compoundRatio: normalizeNumericInput(settingsForm.compoundRatio, 0.5),
        tradingPairs: settingsForm.tradingPairs.split(",").map((pair) => pair.trim()).filter(Boolean),
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
        scoreThreshold: response.settings?.scoreThreshold ?? current.scoreThreshold,
        riskPerTrade: response.settings?.riskPerTrade ?? current.riskPerTrade,
        compoundRatio: response.settings?.compoundRatio ?? current.compoundRatio,
        tradingPairs: Array.isArray(response.settings?.tradingPairs)
          ? response.settings.tradingPairs.join(",")
          : current.tradingPairs,
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
      await favoriteBacktestRun(runId, {
        isFavorite,
        favoriteLabel
      });
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#111827_45%,_#1e293b_100%)] text-slate-100">
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmClass={confirmModal.confirmClass}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((c) => ({ ...c, open: false }))}
      />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/55 p-7 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-amber-200">
                Binance Spot Control Room
              </span>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Passive crypto bot dashboard with live risk context, scoring, and execution controls.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Designed for cautious capital deployment, transparent scoring, and fast intervention when market conditions shift.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:w-[420px]">
              <div className="grid gap-3 sm:grid-cols-2">
                {headlineCards.map((card) => (
                  <div key={card.label} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                    <p className={`mt-2 text-xl font-semibold ${card.accent}`}>{card.value}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setLoadingDashboard(true); }}
                disabled={loadingDashboard}
                className="flex items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                {loadingDashboard ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                )}
                {loadingDashboard ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-[24px] border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {manualFeedback ? (
          <div
            className={`mt-6 rounded-[24px] px-5 py-4 text-sm ${
              manualFeedback.tone === "success"
                ? "border border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                : manualFeedback.tone === "warning"
                  ? "border border-amber-400/25 bg-amber-500/10 text-amber-100"
                  : "border border-sky-400/25 bg-sky-500/10 text-sky-100"
            }`}
          >
            {manualFeedback.message}
          </div>
        ) : null}

        <section className="mt-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-slate-950/45 p-5 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-white text-slate-950"
                    : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
            <input
              value={manualSignal.pair}
              onChange={(event) => setManualSignal((current) => ({ ...current, pair: event.target.value.toUpperCase() }))}
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
              placeholder="BTCUSDT"
            />
            <select
              value={manualSignal.side}
              onChange={(event) => setManualSignal((current) => ({ ...current, side: event.target.value }))}
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <button
              type="button"
              onClick={handleManualTrigger}
              disabled={actionLoading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-200 disabled:opacity-50"
            >
              {actionLoading && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
              {actionLoading ? "Submitting…" : "Manual signal"}
            </button>
          </div>
          {settings?.tradingMode === "paper" && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleForceTestTrade}
                disabled={actionLoading}
                className="rounded-2xl border border-orange-500/40 bg-orange-500/10 px-5 py-2.5 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-50"
              >
                Force test trade (paper)
              </button>
              <span className="text-xs text-slate-500">Bypasses scoring — validates pipeline only</span>
            </div>
          )}
        </section>

        <div className="mt-6 space-y-6">
          {activeTab === "overview" ? (
            <>
              <CapitalChart
                data={capitalHistory}
                range={historyRange}
                onRangeChange={handleRangeChange}
                loading={loadingDashboard || loadingHistory}
              />
              <SignalDebugPanel debug={signalDebug} loading={signalDebugLoading} />
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <ActiveTrades
                  trades={dashboardData?.activeTrades || []}
                  onCancel={handleCancelTrade}
                  actionLoading={actionLoading}
                />
                <StatsPanel stats={dashboardData?.stats || {}} />
              </div>
              <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-white">Latest Trades</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    The most recent executions and closures returned by the backend snapshot.
                  </p>
                </div>

                <div className="space-y-3">
                  {(dashboardData?.latestTrades || []).length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-8 text-sm text-slate-400">
                      No recent trades available yet.
                    </div>
                  ) : (
                    (dashboardData?.latestTrades || []).map((trade) => (
                      <article
                        key={trade.id}
                        className="grid gap-3 rounded-[22px] border border-white/10 bg-slate-950/45 p-4 md:grid-cols-6"
                      >
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pair</p>
                          <p className="mt-2 text-sm font-semibold text-white">{trade.pair}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Strategy</p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {trade.metadata?.strategyId || trade.metadata?.strategy || "manual"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Side</p>
                          <p className="mt-2 text-sm font-semibold text-white">{trade.side}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                          <p className="mt-2 text-sm font-semibold text-white">{trade.status}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">PnL</p>
                          <p className={`mt-2 text-sm font-semibold ${Number(trade.result_pnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {formatCurrency(trade.result_pnl || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Opened</p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {trade.opened_at ? new Date(trade.opened_at).toLocaleString() : "n/a"}
                          </p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "history" ? (
            <Suspense fallback={<PanelLoader />}>
              <TradeHistory
                trades={tradeHistory}
                filters={tradeFilters}
                onFilterChange={(field, value) => setTradeFilters((current) => ({ ...current, [field]: value }))}
                onApplyFilters={refreshTradeHistory}
              />
            </Suspense>
          ) : null}

          {activeTab === "missed" ? (
            <MissedOpportunities
              tradingPairs={settings?.tradingPairs || []}
            />
          ) : null}

          {activeTab === "backtest" ? (
            <Suspense fallback={<PanelLoader />}>
              <Backtest
                form={backtestForm}
                onChange={(field, value) => setBacktestForm((current) => ({ ...current, [field]: value }))}
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
          ) : null}

          {activeTab === "settings" ? (
            <Suspense fallback={<PanelLoader />}>
              <SettingsPanel
                settings={settings}
                form={settingsForm}
                onChange={(field, value) => setSettingsForm((current) => ({ ...current, [field]: value }))}
                onSave={handleSaveSettings}
                saving={settingsSaving}
                strategies={availableBacktestStrategies}
              />
            </Suspense>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default Dashboard;
