const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || "";
    this.chatId = process.env.TELEGRAM_CHAT_ID || "";
    this.localeResolver = null;
    this.http = axios.create({
      timeout: 12000
    });
  }

  setLocaleResolver(resolver) {
    this.localeResolver = typeof resolver === "function" ? resolver : null;
  }

  isConfigured() {
    return Boolean(this.token && this.chatId);
  }

  normalizeLocale(value) {
    return String(value || "").toLowerCase() === "pt-pt" ? "pt-PT" : "en";
  }

  getLocale(payload = {}) {
    const resolved = payload?.notificationLocale
      || payload?.locale
      || (this.localeResolver ? this.localeResolver(payload) : null)
      || process.env.TELEGRAM_NOTIFICATION_LOCALE
      || "en";

    return this.normalizeLocale(resolved);
  }

  getStrings(locale = "en") {
    const strings = {
      en: {
        ok: "OK",
        no: "NO",
        tradeOpened: "Trade opened",
        tradeClosed: "Trade closed",
        pair: "Pair",
        side: "Side",
        orderType: "Order type",
        entry: "Entry",
        quantity: "Quantity",
        stopLoss: "Stop Loss",
        takeProfit: "Take Profit",
        score: "Score",
        signal: "Signal",
        signalUpdate: "UPDATE",
        ready: "READY",
        nearReady: "NEAR_READY",
        blocked: "BLOCKED",
        exit: "Exit",
        pnl: "PnL",
        pnlPercent: "PnL %",
        duration: "Duration",
        status: "Status",
        tradingPaused: "Trading paused",
        reason: "Reason",
        drawdownReason: "Daily drawdown limit hit",
        dailyPnl: "Daily PnL",
        drawdownValue: "Drawdown value",
        threshold: "Threshold",
        resumeAt: "Resume at",
        macroPause: "Macro pause",
        event: "Event",
        unknownEvent: "Unknown event",
        pauseFrom: "Pause from",
        report: "report",
        dailySummary: "daily summary",
        weeklySummary: "weekly summary",
        monthlySummary: "monthly summary",
        paperMode: "Paper mode",
        liveMode: "Live mode",
        period: "Period",
        noReasonProvided: "No reason provided.",
        higherTf: "Higher TF",
        aligned: "aligned",
        notAligned: "not aligned",
        neutral: "neutral",
        marketRegime: "Market regime",
        sideways: "sideways",
        tradeable: "tradeable",
        fearGreed: "Fear & Greed",
        strategyDegradation: "Strategy degradation alert",
        strategy: "Strategy",
        tradesReviewed: "Trades reviewed",
        totalPnl: "Total PnL",
        paperValidationUpdate: "Paper validation update",
        slot: "Slot",
        action: "Action",
        run: "Run",
        trades: "Trades",
        winRate: "Win rate",
        paperRecommendation: "Paper recommendation",
        champion: "Champion",
        challenger: "Challenger",
        none: "none",
        recommendation: "Recommendation",
        pnlDelta: "PnL delta",
        winRateDelta: "Win rate delta",
        circuitBreaker: "Circuit breaker triggered",
        failureType: "Failure type",
        error: "Error",
        executionFailures: "Execution failures",
        exchangeFailures: "Exchange failures",
        autonomyHeartbeat: "Autonomy heartbeat",
        mode: "Mode",
        trading: "Trading",
        regime: "Regime",
        strategies: "Strategies",
        liveGate: "Live gate",
        pairs: "Pairs",
        autoPause: "Auto pause",
        autonomyLabel: "Autonomy"
      },
      "pt-PT": {
        ok: "OK",
        no: "NAO",
        tradeOpened: "Trade aberta",
        tradeClosed: "Trade fechada",
        pair: "Par",
        side: "Lado",
        orderType: "Tipo de ordem",
        entry: "Entrada",
        quantity: "Quantidade",
        stopLoss: "Stop Loss",
        takeProfit: "Take Profit",
        score: "Score",
        signal: "Sinal",
        signalUpdate: "ATUALIZACAO",
        ready: "PRONTO",
        nearReady: "QUASE_PRONTO",
        blocked: "BLOQUEADO",
        exit: "Saida",
        pnl: "PnL",
        pnlPercent: "PnL %",
        duration: "Duracao",
        status: "Estado",
        tradingPaused: "Trading em pausa",
        reason: "Razao",
        drawdownReason: "Limite de drawdown diario atingido",
        dailyPnl: "PnL diario",
        drawdownValue: "Valor do drawdown",
        threshold: "Limite",
        resumeAt: "Retoma em",
        macroPause: "Pausa macro",
        event: "Evento",
        unknownEvent: "Evento desconhecido",
        pauseFrom: "Pausa desde",
        report: "relatorio",
        dailySummary: "resumo diario",
        weeklySummary: "resumo semanal",
        monthlySummary: "resumo mensal",
        paperMode: "Modo paper",
        liveMode: "Modo live",
        period: "Periodo",
        noReasonProvided: "Sem razao indicada.",
        higherTf: "TF superior",
        aligned: "alinhado",
        notAligned: "nao alinhado",
        neutral: "neutro",
        marketRegime: "Regime de mercado",
        sideways: "lateral",
        tradeable: "transacionavel",
        fearGreed: "Fear & Greed",
        strategyDegradation: "Alerta de degradacao da estrategia",
        strategy: "Estrategia",
        tradesReviewed: "Trades analisadas",
        totalPnl: "PnL total",
        paperValidationUpdate: "Atualizacao da validacao paper",
        slot: "Slot",
        action: "Acao",
        run: "Run",
        trades: "Trades",
        winRate: "Taxa de acerto",
        paperRecommendation: "Recomendacao paper",
        champion: "Champion",
        challenger: "Challenger",
        none: "nenhum",
        recommendation: "Recomendacao",
        pnlDelta: "Delta de PnL",
        winRateDelta: "Delta da taxa de acerto",
        circuitBreaker: "Circuit breaker disparado",
        failureType: "Tipo de falha",
        error: "Erro",
        executionFailures: "Falhas de execucao",
        exchangeFailures: "Falhas da exchange",
        autonomyHeartbeat: "Heartbeat da autonomia",
        mode: "Modo",
        trading: "Trading",
        regime: "Regime",
        strategies: "Estrategias",
        liveGate: "Gate live",
        pairs: "Pares",
        autoPause: "Pausa automatica",
        autonomyLabel: "Autonomia"
      }
    };

    return strings[this.normalizeLocale(locale)] || strings.en;
  }

  localizeText(text, locale = "en") {
    if (!text || locale !== "pt-PT") {
      return text;
    }

    const s = this.getStrings(locale);
    const exactMatches = {
      "RSI confirms signal direction": "RSI confirma a direcao do sinal",
      "EMA trend confirms signal direction": "Tendencia EMA confirma a direcao do sinal",
      "EMA structure not hostile to mean reversion": "Estrutura EMA nao hostil a mean reversion",
      "Multi-timeframe alignment (1H + 4H)": "Alinhamento multi-timeframe (1H + 4H)",
      "Higher timeframes not strongly hostile": "Timeframes superiores nao estao fortemente contra",
      "Volume above 20-period average": "Volume acima da media de 20 periodos",
      "Fear & Greed not extreme": "Fear & Greed nao extremo",
      "News sentiment neutral or positive": "Sentimento das noticias neutro ou positivo",
      "Candlestick pattern confirms": "Padrao de velas confirma",
      "Order book pressure confirms": "Pressao do order book confirma",
      "Spread acceptable (<0.1%)": "Spread aceitavel (<0.1%)",
      "Signal is blocked by the current strategy conditions.": "O sinal esta bloqueado pelas condicoes atuais da estrategia.",
      "Signal passes the strategy, risk and execution checks.": "O sinal passa os checks de estrategia, risco e execucao.",
      "The setup is improving, but one or more confirmations are still missing.": "O setup esta a melhorar, mas ainda faltam uma ou mais confirmacoes.",
      "Signal is executable.": "O sinal e executavel.",
      "Signal is not executable under the current strategy rules.": "O sinal nao e executavel com as regras atuais da estrategia.",
      "Higher timeframe alignment (1H + 4H) does not support this trade direction.": "O alinhamento dos timeframes superiores (1H + 4H) nao suporta esta direcao da trade.",
      "Daily drawdown limit hit": "Limite de drawdown diario atingido",
      "No higher timeframe context available.": "Sem contexto de timeframes superiores disponivel.",
      "Order book analysis unavailable.": "Analise do order book indisponivel."
    };

    if (exactMatches[text]) {
      return exactMatches[text];
    }

    const patterns = [
      [/^Signal approved with score (\d+)\/(\d+)\.$/, "Sinal aprovado com score $1/$2."],
      [/^Signal logged as missed opportunity with score (\d+)\/(\d+)\.$/, "Sinal registado como oportunidade falhada com score $1/$2."],
      [/^Signal ignored with score (\d+)\/(\d+)\.$/, "Sinal ignorado com score $1/$2."],
      [/^daily summary: (.+)$/, `${s.dailySummary}: $1`],
      [/^weekly summary: (.+)$/, `${s.weeklySummary}: $1`],
      [/^monthly summary: (.+)$/, `${s.monthlySummary}: $1`],
      [/^Paper mode: (.+)$/, `${s.paperMode}: $1`],
      [/^Live mode: (.+)$/, `${s.liveMode}: $1`],
      [/^Autonomy: (.+) \| Trading: (.+) \| Regime: (.+)$/, `${s.autonomyLabel}: $1 | ${s.trading}: $2 | ${s.regime}: $3`]
    ];

    for (const [pattern, replacement] of patterns) {
      if (pattern.test(text)) {
        return text.replace(pattern, replacement);
      }
    }

    return text;
  }

  localizeReadinessState(state, locale = "en") {
    const normalizedState = String(state || "").toUpperCase();
    const s = this.getStrings(locale);

    if (normalizedState === "READY") {
      return s.ready;
    }

    if (normalizedState === "NEAR_READY") {
      return s.nearReady;
    }

    if (normalizedState === "BLOCKED") {
      return s.blocked;
    }

    return normalizedState || s.signalUpdate;
  }

  getApiUrl(method) {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  formatScoreBreakdown(scoreBreakdown = {}, locale = "en") {
    const s = this.getStrings(locale);
    const items = Array.isArray(scoreBreakdown.items) ? scoreBreakdown.items : [];

    return items
      .map((item) => `${item.passed ? s.ok : s.no} ${this.localizeText(item.label, locale)}: ${item.points}/${item.maxPoints}`)
      .join("\n");
  }

  formatTradeOpenedMessage(trade = {}) {
    const locale = this.getLocale(trade);
    const s = this.getStrings(locale);
    return [
      s.tradeOpened,
      `${s.pair}: ${trade.pair}`,
      `${s.side}: ${trade.side}`,
      `${s.orderType}: ${trade.orderType}`,
      `${s.entry}: ${trade.entryPrice}`,
      `${s.quantity}: ${trade.quantity}`,
      `${s.stopLoss}: ${trade.stopLoss}`,
      `${s.takeProfit}: ${trade.takeProfit}`,
      `${s.score}: ${trade.scoreTotal}/12`,
      trade.scoreBreakdown ? this.formatScoreBreakdown(trade.scoreBreakdown, locale) : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatTradeClosedMessage(trade = {}) {
    const s = this.getStrings(this.getLocale(trade));
    return [
      s.tradeClosed,
      `${s.pair}: ${trade.pair}`,
      `${s.side}: ${trade.side}`,
      `${s.exit}: ${trade.exitPrice}`,
      `${s.pnl}: ${trade.resultPnl}`,
      `${s.pnlPercent}: ${trade.resultPercent}`,
      `${s.duration}: ${trade.durationSeconds || 0}s`,
      trade.status ? `${s.status}: ${trade.status}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatDrawdownPauseMessage(payload = {}) {
    const s = this.getStrings(this.getLocale(payload));
    return [
      s.tradingPaused,
      `${s.reason}: ${s.drawdownReason}`,
      `${s.dailyPnl}: ${payload.dailyPnl}`,
      `${s.drawdownValue}: ${payload.drawdownValue}`,
      `${s.threshold}: ${payload.thresholdValue}`,
      payload.resumeAt ? `${s.resumeAt}: ${new Date(payload.resumeAt).toISOString()}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatMacroPauseMessage(payload = {}) {
    const s = this.getStrings(this.getLocale(payload));
    return [
      s.macroPause,
      `${s.event}: ${payload.event?.title || s.unknownEvent}`,
      payload.pauseWindowStart ? `${s.pauseFrom}: ${new Date(payload.pauseWindowStart).toISOString()}` : null,
      payload.pauseWindowEnd ? `${s.resumeAt}: ${new Date(payload.pauseWindowEnd).toISOString()}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatReportMessage(report = {}) {
    const locale = this.getLocale(report);
    const s = this.getStrings(locale);
    return [
      `${String(report.type || s.report).toUpperCase()} ${s.report}`,
      `${s.period}: ${report.period || "n/a"}`,
      this.localizeText(report.summary, locale) || null,
      this.localizeText(report.paperSummary, locale) || null,
      this.localizeText(report.liveSummary, locale) || null,
      this.localizeText(report.autonomySummary, locale) || null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatSignalReadinessMessage(payload = {}) {
    const s = this.getStrings(this.getLocale(payload));
    const timeframeSummary = [
      `15m: ${payload.timeframes?.["15m"]?.trend?.bias || "neutral"}`,
      `1h: ${payload.timeframes?.["1h"]?.trend?.bias || "neutral"}`,
      `4h: ${payload.timeframes?.["4h"]?.trend?.bias || "neutral"}`
    ].join(" | ");

    return [
      `${s.signal} ${this.localizeReadinessState(payload.readiness?.state || "UPDATE", this.getLocale(payload))}`,
      `${s.pair}: ${payload.pair || "n/a"}`,
      `${s.side}: ${payload.side || "BUY"}`,
      `${s.mode}: ${payload.tradingMode || "n/a"}`,
      `${s.score}: ${payload.score?.totalScore || 0}/${payload.score?.maxScore || 12}`,
      `${s.reason}: ${this.localizeText(payload.primaryReason || payload.readiness?.reason || s.noReasonProvided, this.getLocale(payload))}`,
      `${s.higherTf}: ${payload.diagnostics?.multiTimeframe?.aligned ? s.aligned : s.notAligned} (${payload.diagnostics?.multiTimeframe?.direction || s.neutral})`,
      `${s.marketRegime}: ${payload.diagnostics?.marketState?.isSideways ? s.sideways : s.tradeable}`,
      `${s.fearGreed}: ${payload.diagnostics?.fearGreed?.classification || "n/a"}`,
      timeframeSummary
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatStrategyDegradationMessage(payload = {}) {
    const locale = this.getLocale(payload);
    const s = this.getStrings(locale);
    return [
      s.strategyDegradation,
      `${s.strategy}: ${payload.strategyId || "unknown"}`,
      `${s.tradesReviewed}: ${payload.tradeCount || 0}`,
      `${s.winRate}: ${Number(payload.winRate || 0).toFixed(2)}%`,
      `${s.totalPnl}: ${Number(payload.pnlTotal || 0).toFixed(4)}`,
      this.localizeText(payload.reason, locale) || null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatPaperValidationUpdate(payload = {}) {
    const locale = this.getLocale(payload);
    const s = this.getStrings(locale);
    return [
      this.localizeText(payload.title, locale) || s.paperValidationUpdate,
      payload.slot ? `${s.slot}: ${payload.slot}` : null,
      payload.action ? `${s.action}: ${payload.action}` : null,
      payload.runId ? `${s.run}: #${payload.runId}` : null,
      this.localizeText(payload.reason, locale) || null,
      payload.performance
        ? `${s.trades}: ${payload.performance.tradeCount || 0} | ${s.winRate}: ${Number(payload.performance.winRate || 0).toFixed(2)}% | ${s.pnl}: ${Number(payload.performance.pnlTotal || 0).toFixed(4)}`
        : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatPaperValidationRecommendation(payload = {}) {
    const locale = this.getLocale(payload);
    const s = this.getStrings(locale);
    return [
      this.localizeText(payload.title, locale) || s.paperRecommendation,
      payload.championRunId ? `${s.champion}: #${payload.championRunId}` : `${s.champion}: ${s.none}`,
      payload.challengerRunId ? `${s.challenger}: #${payload.challengerRunId}` : null,
      payload.recommendation?.action ? `${s.recommendation}: ${payload.recommendation.action}` : null,
      this.localizeText(payload.recommendation?.reason, locale) || null,
      payload.headToHead
        ? `${s.pnlDelta}: ${Number(payload.headToHead.pnlDelta || 0).toFixed(4)} | ${s.winRateDelta}: ${Number(payload.headToHead.winRateDelta || 0).toFixed(2)}%`
        : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatCircuitBreakerMessage(payload = {}) {
    const locale = this.getLocale(payload);
    const s = this.getStrings(locale);
    return [
      s.circuitBreaker,
      payload.reason ? `${s.reason}: ${this.localizeText(payload.reason, locale)}` : null,
      payload.failureType ? `${s.failureType}: ${payload.failureType}` : null,
      payload.error ? `${s.error}: ${payload.error}` : null,
      payload.counters
        ? `${s.executionFailures}: ${Number(payload.counters.executionFailures || 0)} | ${s.exchangeFailures}: ${Number(payload.counters.exchangeFailures || 0)}`
        : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  formatAutonomyHeartbeat(payload = {}) {
    const s = this.getStrings(this.getLocale(payload));
    const pairStateLines = Object.entries(payload.pairStates || {})
      .map(([key, state]) => `  ${key}: ${state}`)
      .join("\n");

    return [
      s.autonomyHeartbeat,
      payload.mode ? `${s.mode}: ${payload.mode}` : null,
      payload.tradingMode ? `${s.trading}: ${payload.tradingMode}` : null,
      payload.currentRegimeId ? `${s.regime}: ${payload.currentRegimeId}` : null,
      payload.strategySelection?.strategyIds?.length
        ? `${s.strategies}: ${payload.strategySelection.strategyIds.join(", ")}`
        : null,
      payload.liveReadiness?.approvalGate?.status
        ? `${s.liveGate}: ${payload.liveReadiness.approvalGate.status}`
        : null,
      pairStateLines ? `${s.pairs}:\n${pairStateLines}` : null,
      payload.autoPauseReason ? `${s.autoPause}: ${payload.autoPauseReason}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  async sendMessage(text, options = {}) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        skipped: true,
        reason: "Telegram not configured."
      };
    }

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.http.post(this.getApiUrl("sendMessage"), {
          chat_id: this.chatId,
          text,
          parse_mode: options.parseMode || "HTML",
          disable_web_page_preview: true
        });

        return {
          ok: true,
          data: response.data
        };
      } catch (error) {
        const status = error.response?.status;
        const isRetryable = !status || status === 429 || status >= 500;
        if (attempt < maxRetries && isRetryable) {
          const delay = status === 429 ? 3000 : 1000 * attempt;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return {
          ok: false,
          skipped: false,
          reason: error.response?.data?.description || error.message
        };
      }
    }
  }

  async notifyTradeOpened(trade) {
    return this.sendMessage(this.formatTradeOpenedMessage(trade));
  }

  async notifyTradeClosed(trade) {
    return this.sendMessage(this.formatTradeClosedMessage(trade));
  }

  async notifyDrawdownPause(payload) {
    return this.sendMessage(this.formatDrawdownPauseMessage(payload));
  }

  async notifyMacroPause(payload) {
    return this.sendMessage(this.formatMacroPauseMessage(payload));
  }

  async notifyReport(report) {
    return this.sendMessage(this.formatReportMessage(report));
  }

  async notifySignalReadiness(payload) {
    return this.sendMessage(this.formatSignalReadinessMessage(payload));
  }

  async notifyStrategyDegradation(payload) {
    return this.sendMessage(this.formatStrategyDegradationMessage(payload));
  }

  async notifyPaperValidationUpdate(payload) {
    return this.sendMessage(this.formatPaperValidationUpdate(payload));
  }

  async notifyPaperValidationRecommendation(payload) {
    return this.sendMessage(this.formatPaperValidationRecommendation(payload));
  }

  async notifyCircuitBreakerTriggered(payload) {
    return this.sendMessage(this.formatCircuitBreakerMessage(payload));
  }

  async notifyStartupWithOpenTrades(openTrades = []) {
    const locale = this.getLocale();
    const pairs = [...new Set(openTrades.map((t) => t.pair))].join(", ");
    const count = openTrades.length;
    const msg = locale === "pt-PT"
      ? `\u26A0\uFE0F Bot reiniciado com <b>${count}</b> trade(s) em aberto: <b>${pairs}</b>\nVerifica as posicoes antes de operar.`
      : `\u26A0\uFE0F Bot restarted with <b>${count}</b> open trade(s): <b>${pairs}</b>\nReview open positions before trading.`;
    return this.sendMessage(msg);
  }

  async notifyAutonomyHeartbeat(payload) {
    return this.sendMessage(this.formatAutonomyHeartbeat(payload));
  }
}

module.exports = new TelegramService();
