const translations = {
  en: {
    "language.label": "Language",
    "language.english": "English",
    "language.portuguese": "Portuguese (Portugal)",
    "common.loading": "Loading",
    "common.loadingPanel": "Loading panel...",
    "common.refresh": "Refresh",
    "common.refreshing": "Refreshing...",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.saveSettings": "Save settings",
    "common.savingSettings": "Saving settings...",
    "common.notAvailable": "n/a",
    "common.yes": "Yes",
    "common.no": "No",
    "common.enabled": "Enabled",
    "common.disabled": "Disabled",
    "common.none": "None",
    "common.unknown": "Unknown",
    "common.aligned": "Aligned",
    "common.notAligned": "Not aligned",
    "common.blocked": "Blocked",
    "common.open": "Open",
    "common.closed": "Closed",
    "common.cancelled": "Cancelled",
    "common.manual": "manual",
    "tab.overview": "Overview",
    "tab.history": "History",
    "tab.missed": "Missed",
    "tab.backtest": "Backtest",
    "tab.settings": "Settings",
    "tab.help": "Help",
    "dashboard.badge": "Binance Spot Control Room",
    "dashboard.title": "Passive crypto bot dashboard with live risk context, scoring, and execution controls.",
    "dashboard.subtitle": "Designed for cautious capital deployment, transparent scoring, and fast intervention when market conditions shift.",
    "dashboard.currentCapital": "Current Capital",
    "dashboard.realizedProfit": "Realized Profit",
    "dashboard.unrealizedPnl": "Unrealized P&L",
    "dashboard.botStatus": "Bot Status",
    "dashboard.manualSignal": "Manual signal",
    "dashboard.submitting": "Submitting...",
    "dashboard.forceTestTrade": "Force test trade (paper)",
    "dashboard.forceTestTradeHint": "Bypasses scoring and validates the execution pipeline only",
    "dashboard.forceTradeTitle": "Force paper trade?",
    "dashboard.forceTradeMessage": "This will open a BUY on {pair} bypassing all scoring guards. For pipeline validation only.",
    "dashboard.forceTradeConfirm": "Force trade",
    "dashboard.latestTrades": "Latest Trades",
    "dashboard.latestTradesHint": "The most recent executions and closures returned by the backend snapshot.",
    "dashboard.noLatestTrades": "No recent trades available yet.",
    "dashboard.field.pair": "Pair",
    "dashboard.field.strategy": "Strategy",
    "dashboard.field.side": "Side",
    "dashboard.field.status": "Status",
    "dashboard.field.pnl": "PnL",
    "dashboard.field.opened": "Opened",
    "dashboard.manual.tradeOpened": "Trade opened successfully for {pair}.",
    "dashboard.manual.positionsClosed": "Closed {count} open position(s) for the selected pair.",
    "dashboard.manual.blocked": "Manual signal was blocked by the strategy rules.",
    "dashboard.manual.missed": "Signal was logged as a missed opportunity.",
    "dashboard.manual.ignored": "Signal was ignored by the scoring system.",
    "dashboard.manual.sellSkipped": "No open spot position was available to close.",
    "dashboard.manual.processed": "Manual signal processed.",
    "chart.title": "Capital Growth",
    "chart.subtitle": "Track capital evolution across realized profit and market movement.",
    "chart.loading": "Loading capital history...",
    "active.title": "Active Trades",
    "active.subtitle": "Open spot positions with live mark-to-market P&L.",
    "active.count": "{count} open",
    "active.empty": "No active trades right now.",
    "active.cancelTitle": "Cancel trade?",
    "active.cancelMessage": "Cancel the open {side} position on {pair}? The OCO protection orders will also be cancelled.",
    "active.cancelConfirm": "Yes, cancel",
    "active.entry": "Entry",
    "active.market": "Market",
    "active.stop": "Stop",
    "active.target": "Target",
    "active.protection": "Protection",
    "active.lastStep": "Last step",
    "active.qty": "Qty",
    "active.livePnl": "Live P&L",
    "active.pnlPercent": "P&L %",
    "active.capital": "Capital",
    "active.maxLoss": "Max loss",
    "active.cancelButton": "Cancel",
    "signal.title": "Signal Debug",
    "signal.subtitle": "Live preview of alignment, score, blockers and market regime for the selected manual signal.",
    "signal.loading": "Refreshing signal diagnostics...",
    "signal.empty": "No signal diagnostics available yet.",
    "signal.readiness": "Readiness",
    "signal.primaryReason": "Primary reason",
    "signal.score": "Score",
    "signal.multiTf": "1H + 4H",
    "signal.marketRegime": "Market Regime",
    "signal.tradeable": "Tradeable",
    "signal.sideways": "Sideways",
    "signal.fearGreed": "Fear & Greed",
    "signal.timeframeAlignment": "Timeframe Alignment",
    "signal.blockers": "Blockers",
    "signal.noBlockers": "No blockers detected for the current manual signal preview.",
    "signal.executionContext": "Execution context",
    "signal.botStatus": "Bot status",
    "signal.runtimeThreshold": "Runtime threshold",
    "signal.expectedMode": "Expected mode",
    "signal.spread": "Spread",
    "signal.rsi": "RSI",
    "signal.atr": "ATR",
    "signal.ema200": "EMA200",
    "signal.above": "Above",
    "signal.below": "Below",
    "signal.mixedTrend": "Mixed trend",
    "signal.sidewaysRegime": "Sideways regime",
    "signal.tradeableRegime": "Tradeable regime",
    "signal.goldenCross": "Golden cross",
    "signal.deathCross": "Death cross",
    "signal.valueRsi": "Value {value} | RSI {rsi}",
    "signal.marketDetails": "ATR {atr}% | EMA compression {compression}%",
    "stats.title": "Statistics",
    "stats.subtitle": "Win rate, trade quality and simple risk-adjusted performance.",
    "stats.winRate": "Win Rate",
    "stats.totalTrades": "Total Trades",
    "stats.avgProfit": "Avg Profit",
    "stats.avgLoss": "Avg Loss",
    "stats.bestTrade": "Best Trade",
    "stats.worstTrade": "Worst Trade",
    "stats.winStreak": "Win Streak",
    "stats.sharpeRatio": "Sharpe Ratio",
    "history.title": "Trade History",
    "history.subtitle": "Filter past trades and inspect the exact score breakdown behind every entry.",
    "history.applyFilters": "Apply filters",
    "history.allSides": "All sides",
    "history.allStatus": "All status",
    "history.scoreBreakdown": "Score Breakdown",
    "history.marketSnapshot": "Market Snapshot",
    "history.executionTimeline": "Execution Timeline",
    "history.noBreakdown": "No breakdown available.",
    "history.noSnapshot": "No snapshot available.",
    "history.totalScore": "Total score",
    "history.decision": "Decision",
    "history.rsi15m": "RSI 14 (15m)",
    "history.atr15m": "ATR 14 (15m)",
    "history.trendBias15m": "Trend bias (15m)",
    "history.volumeAboveAvg": "Volume above avg",
    "history.marketState": "Market state",
    "history.trending": "Trending",
    "history.multiTfDirection": "Multi-TF direction",
    "history.yes": "Yes",
    "history.no": "No",
    "missed.total7d": "Total (7d)",
    "missed.avgScore": "Avg score",
    "missed.bestScore": "Best score",
    "missed.pairs": "Pairs",
    "missed.filterByPair": "Filter by pair:",
    "missed.allPairs": "All pairs",
    "missed.loading": "Loading...",
    "missed.empty": "No missed opportunities recorded yet.",
    "missed.time": "Time",
    "missed.reasonBlocked": "Reason blocked",
    "settings.title": "Settings",
    "settings.subtitle": "Runtime controls for bot state, score threshold, risk and tracked pairs.",
    "settings.botEnabled": "Bot enabled",
    "settings.tradingMode": "Trading mode",
    "settings.autonomyMode": "Autonomy mode",
    "settings.shadowMode": "Shadow mode",
    "settings.heartbeatAlerts": "Heartbeat alerts",
    "settings.telegramLanguage": "Telegram language",
    "settings.autoSwap": "Auto-swap champion",
    "settings.autoApprove": "Auto-approve live",
    "settings.autoLiveDeploy": "Auto-live deploy",
    "settings.scoreThreshold": "Score threshold",
    "settings.riskPerTrade": "Risk per trade",
    "settings.compoundRatio": "Compound ratio",
    "settings.tradingPairs": "Trading pairs",
    "settings.activeStrategies": "Active strategies",
    "settings.paper": "Paper",
    "settings.live": "Live",
    "settings.manual": "Manual",
    "settings.supervisedAuto": "Supervised auto",
    "settings.fullAuto": "Full auto",
    "settings.paused": "Paused",
    "settings.operationalSnapshot": "Operational Snapshot",
    "settings.operationalSnapshotHint": "Clean runtime view of autonomy, governance and recovery state.",
    "settings.bot": "Bot",
    "settings.trading": "Trading",
    "settings.autonomyLabel": "Autonomy",
    "settings.champion": "Champion",
    "settings.liveApproval": "Live Approval",
    "settings.noActivePauseReason": "No active pause reason.",
    "settings.autoPause": "Auto pause: {reason}",
    "settings.noChallengerAssigned": "No challenger assigned.",
    "settings.notApproved": "Not approved",
    "settings.autoLiveEnabled": "Auto-live deploy enabled.",
    "settings.manualLiveOnly": "Manual live deployment only.",
    "settings.regimeChampions": "Regime Champions",
    "settings.notAssigned": "Not assigned",
    "settings.regimeChampionsHint": "Per-regime champion slots used by adaptive governance.",
    "settings.activeStrategiesCard": "Active Strategies",
    "settings.pairsDetail": "Pairs: {pairs}",
    "settings.autonomyFlags": "Autonomy Flags",
    "settings.allDisabled": "All disabled",
    "settings.autonomyFlagsHint": "Feature flags for supervised and full-auto behaviour.",
    "settings.recoveryHealth": "Recovery And Health",
    "settings.recoveryHealthHint": "Quick visibility into circuit breakers, last autonomy snapshot and startup recovery.",
    "settings.executionFailures": "Execution Failures",
    "settings.exchangeFailures": "Exchange Failures",
    "settings.lastAutonomySnapshot": "Last Autonomy Snapshot",
    "settings.shadowSummary": "Shadow Summary",
    "settings.noBreakerReason": "No breaker reason recorded.",
    "settings.neverTriggered": "Never triggered.",
    "settings.noAutonomySnapshot": "No autonomy snapshot yet.",
    "settings.shadowNotRun": "Shadow scan has not run yet.",
    "settings.startupStatus": "Startup Status",
    "settings.startupPassed": "Startup checks passed",
    "settings.startupPending": "Startup checks pending or degraded",
    "settings.strictMode": "Strict mode: {mode} | Last run: {time}",
    "settings.modeEnabled": "enabled",
    "settings.modeDisabled": "disabled",
    "timeline.loading": "Loading execution timeline...",
    "timeline.empty": "No tracked execution orders for this trade yet.",
    "timeline.entry": "Entry",
    "timeline.protection": "Protection",
    "timeline.adjustment": "Adjustment",
    "timeline.exit": "Exit",
    "timeline.opened": "Opened {time}",
    "timeline.closed": "Closed {time}",
    "timeline.qty": "Qty",
    "timeline.price": "Price"
    ,"backtest.title": "Backtesting"
    ,"backtest.subtitle": "Replay historical Binance candles with the same core risk and score logic."
    ,"backtest.warning": "Backtest sentiment is assumed neutral and order book pressure is approximated from candle close position within the candle range. These are known approximations for strategy validation, not exact performance predictions."
    ,"backtest.strategies": "Strategies"
    ,"backtest.selectedStrategies": "{count} strategy(ies) selected"
    ,"backtest.noStrategySelected": "No strategy selected. The default active set will be used."
    ,"backtest.mode.standard": "Standard"
    ,"backtest.mode.walkForward": "Walk Forward"
    ,"backtest.feeRate": "Fee rate"
    ,"backtest.slippageBps": "Slippage bps"
    ,"backtest.maxComboSize": "Max combo size"
    ,"backtest.trainDays": "Train days"
    ,"backtest.testDays": "Test days"
    ,"backtest.stepDays": "Step days"
    ,"backtest.run": "Run backtest"
    ,"backtest.running": "Running backtest..."
    ,"backtest.compare": "Compare strategy sets"
    ,"backtest.comparing": "Comparing strategy sets..."
    ,"backtest.autoRun": "Auto-run experiments"
    ,"backtest.autoRunning": "Running auto experiments..."
    ,"backtest.setComparison": "Strategy Set Comparison"
    ,"backtest.setComparisonHint": "Compare the selected combo against each selected strategy on its own."
    ,"backtest.setComparisonEmpty": "No comparison results yet. Select one or more strategies and run a comparison."
    ,"backtest.experimentRunner": "Auto Experiment Runner"
    ,"backtest.experimentRunnerHint": "Generate strategy combinations automatically up to the selected combo size and rank them by return."
    ,"backtest.experimentRunnerEmpty": "No experiment batch results yet. Select strategies, choose a combo size and run the auto experiments."
    ,"backtest.savedRuns": "Saved Runs"
    ,"backtest.savedRunsHint": "Recent experiments you can reopen and compare without rerunning."
    ,"backtest.noSavedRuns": "No saved backtest runs yet."
    ,"backtest.favorite": "favorite"
    ,"backtest.paperPromoted": "paper promoted"
    ,"backtest.defaultSet": "default set"
    ,"backtest.unfavorite": "Unfavorite"
    ,"backtest.markFavorite": "Favorite"
    ,"backtest.setChampion": "Set champion"
    ,"backtest.setChallenger": "Set challenger"
    ,"backtest.trendChampion": "Trend champion"
    ,"backtest.sidewaysChampion": "Sideways champion"
    ,"backtest.volatileChampion": "Volatile champion"
    ,"backtest.approveLive": "Approve live"
    ,"backtest.selectedRun": "Selected Run Detail"
    ,"backtest.latestResult": "Latest Backtest Result"
    ,"backtest.savedRunCreated": "Saved run #{id} created {time}"
    ,"backtest.freshResult": "Fresh result from the most recent run."
    ,"backtest.savedRun": "saved run"
    ,"backtest.return": "Return"
    ,"backtest.maxDrawdown": "Max Drawdown"
    ,"backtest.trades": "Trades"
    ,"backtest.sentiment": "Sentiment"
    ,"backtest.orderBook": "Order Book"
    ,"backtest.execution": "Execution"
    ,"backtest.spotSimulation": "Spot simulation"
    ,"backtest.comparisonLatest": "Comparison vs Latest Run"
    ,"backtest.comparisonLatestHint": "Quick delta between the selected saved run and the most recent backtest you executed."
    ,"backtest.returnDelta": "Return Delta"
    ,"backtest.winRateDelta": "Win Rate Delta"
    ,"backtest.drawdownDelta": "Drawdown Delta"
    ,"backtest.tradeCountDelta": "Trade Count Delta"
    ,"backtest.walkForwardWindows": "Walk-Forward Windows"
    ,"backtest.walkForwardWindowsHint": "In-sample vs out-of-sample checkpoints across the selected range."
    ,"backtest.window": "Window"
    ,"backtest.inSample": "In Sample"
    ,"backtest.outOfSample": "Out Of Sample"
    ,"backtest.capital": "Capital"
    ,"backtest.tradeLogPreview": "Trade Log Preview"
    ,"backtest.tradeLogPreviewHint": "First {count} simulated trades from this run."
    ,"backtest.noTradesForRun": "No trades available for this run."
    ,"backtest.trade": "Trade"
    ,"backtest.status": "Status"
    ,"backtest.noRunSelected": "Run a backtest or select a saved run to inspect the capital curve and trade log."
    ,"backtest.loading": "Loading"
    ,"backtest.set": "Set"
    },
  "pt-PT": {
    "language.label": "Idioma",
    "language.english": "Inglês",
    "language.portuguese": "Português (Portugal)",
    "common.loading": "A carregar",
    "common.loadingPanel": "A carregar painel...",
    "common.refresh": "Atualizar",
    "common.refreshing": "A atualizar...",
    "common.cancel": "Cancelar",
    "common.confirm": "Confirmar",
    "common.saveSettings": "Guardar definições",
    "common.savingSettings": "A guardar definições...",
    "common.notAvailable": "n/d",
    "common.yes": "Sim",
    "common.no": "Não",
    "common.enabled": "Ativado",
    "common.disabled": "Desativado",
    "common.none": "Nenhum",
    "common.unknown": "Desconhecido",
    "common.aligned": "Alinhado",
    "common.notAligned": "Não alinhado",
    "common.blocked": "Bloqueado",
    "common.open": "Aberto",
    "common.closed": "Fechado",
    "common.cancelled": "Cancelado",
    "common.manual": "manual",
    "tab.overview": "Visão Geral",
    "tab.history": "Histórico",
    "tab.missed": "Falhados",
    "tab.backtest": "Backtest",
    "tab.settings": "Definições",
    "tab.help": "Ajuda",
    "dashboard.badge": "Centro de Controlo Binance Spot",
    "dashboard.title": "Dashboard do bot cripto passivo com contexto de risco em tempo real, scoring e controlos de execução.",
    "dashboard.subtitle": "Pensado para gestão cautelosa de capital, scoring transparente e intervenção rápida quando o mercado muda.",
    "dashboard.currentCapital": "Capital Atual",
    "dashboard.realizedProfit": "Lucro Realizado",
    "dashboard.unrealizedPnl": "P&L Não Realizado",
    "dashboard.botStatus": "Estado do Bot",
    "dashboard.manualSignal": "Sinal manual",
    "dashboard.submitting": "A submeter...",
    "dashboard.forceTestTrade": "Forçar trade de teste (paper)",
    "dashboard.forceTestTradeHint": "Ignora o scoring e valida apenas o pipeline de execução",
    "dashboard.forceTradeTitle": "Forçar trade paper?",
    "dashboard.forceTradeMessage": "Isto vai abrir um BUY em {pair} ignorando todos os bloqueios de scoring. Apenas para validar o pipeline.",
    "dashboard.forceTradeConfirm": "Forçar trade",
    "dashboard.latestTrades": "Últimas Trades",
    "dashboard.latestTradesHint": "As execuções e fechos mais recentes devolvidos pelo snapshot do backend.",
    "dashboard.noLatestTrades": "Ainda não existem trades recentes.",
    "dashboard.field.pair": "Par",
    "dashboard.field.strategy": "Estratégia",
    "dashboard.field.side": "Lado",
    "dashboard.field.status": "Estado",
    "dashboard.field.pnl": "P&L",
    "dashboard.field.opened": "Aberta",
    "dashboard.manual.tradeOpened": "Trade aberta com sucesso para {pair}.",
    "dashboard.manual.positionsClosed": "Foram fechadas {count} posição(ões) abertas para o par selecionado.",
    "dashboard.manual.blocked": "O sinal manual foi bloqueado pelas regras da estratégia.",
    "dashboard.manual.missed": "O sinal foi registado como oportunidade falhada.",
    "dashboard.manual.ignored": "O sinal foi ignorado pelo sistema de scoring.",
    "dashboard.manual.sellSkipped": "Não existia nenhuma posição spot aberta para fechar.",
    "dashboard.manual.processed": "Sinal manual processado.",
    "chart.title": "Crescimento do Capital",
    "chart.subtitle": "Acompanha a evolução do capital entre lucro realizado e movimento de mercado.",
    "chart.loading": "A carregar histórico do capital...",
    "active.title": "Trades Ativas",
    "active.subtitle": "Posições spot abertas com P&L mark-to-market em tempo real.",
    "active.count": "{count} abertas",
    "active.empty": "Não existem trades ativas neste momento.",
    "active.cancelTitle": "Cancelar trade?",
    "active.cancelMessage": "Cancelar a posição {side} aberta em {pair}? As ordens de proteção OCO também serão canceladas.",
    "active.cancelConfirm": "Sim, cancelar",
    "active.entry": "Entrada",
    "active.market": "Mercado",
    "active.stop": "Stop",
    "active.target": "Alvo",
    "active.protection": "Proteção",
    "active.lastStep": "Último passo",
    "active.qty": "Qtd",
    "active.livePnl": "P&L Atual",
    "active.pnlPercent": "P&L %",
    "active.capital": "Capital",
    "active.maxLoss": "Perda máxima",
    "active.cancelButton": "Cancelar",
    "signal.title": "Debug do Sinal",
    "signal.subtitle": "Pré-visualização ao vivo do alinhamento, score, bloqueios e regime de mercado para o sinal manual selecionado.",
    "signal.loading": "A atualizar diagnóstico do sinal...",
    "signal.empty": "Ainda não há diagnóstico de sinal disponível.",
    "signal.readiness": "Readiness",
    "signal.primaryReason": "Razão principal",
    "signal.score": "Score",
    "signal.multiTf": "1H + 4H",
    "signal.marketRegime": "Regime de Mercado",
    "signal.tradeable": "Transacionável",
    "signal.sideways": "Lateral",
    "signal.fearGreed": "Fear & Greed",
    "signal.timeframeAlignment": "Alinhamento por Timeframe",
    "signal.blockers": "Bloqueios",
    "signal.noBlockers": "Não foram detetados bloqueios para a pré-visualização atual do sinal manual.",
    "signal.executionContext": "Contexto de execução",
    "signal.botStatus": "Estado do bot",
    "signal.runtimeThreshold": "Threshold runtime",
    "signal.expectedMode": "Modo esperado",
    "signal.spread": "Spread",
    "signal.rsi": "RSI",
    "signal.atr": "ATR",
    "signal.ema200": "EMA200",
    "signal.above": "Acima",
    "signal.below": "Abaixo",
    "signal.mixedTrend": "Tendência mista",
    "signal.sidewaysRegime": "Regime lateral",
    "signal.tradeableRegime": "Regime transacionável",
    "signal.goldenCross": "Golden cross",
    "signal.deathCross": "Death cross",
    "signal.valueRsi": "Valor {value} | RSI {rsi}",
    "signal.marketDetails": "ATR {atr}% | Compressão EMA {compression}%",
    "stats.title": "Estatísticas",
    "stats.subtitle": "Win rate, qualidade das trades e desempenho simples ajustado ao risco.",
    "stats.winRate": "Win Rate",
    "stats.totalTrades": "Total de Trades",
    "stats.avgProfit": "Lucro Médio",
    "stats.avgLoss": "Perda Média",
    "stats.bestTrade": "Melhor Trade",
    "stats.worstTrade": "Pior Trade",
    "stats.winStreak": "Série de Ganhos",
    "stats.sharpeRatio": "Rácio Sharpe",
    "history.title": "Histórico de Trades",
    "history.subtitle": "Filtra trades passadas e inspeciona o score exato por trás de cada entrada.",
    "history.applyFilters": "Aplicar filtros",
    "history.allSides": "Todos os lados",
    "history.allStatus": "Todos os estados",
    "history.scoreBreakdown": "Detalhe do Score",
    "history.marketSnapshot": "Snapshot de Mercado",
    "history.executionTimeline": "Timeline de Execução",
    "history.noBreakdown": "Sem detalhe disponível.",
    "history.noSnapshot": "Sem snapshot disponível.",
    "history.totalScore": "Score total",
    "history.decision": "Decisão",
    "history.rsi15m": "RSI 14 (15m)",
    "history.atr15m": "ATR 14 (15m)",
    "history.trendBias15m": "Bias de tendência (15m)",
    "history.volumeAboveAvg": "Volume acima da média",
    "history.marketState": "Estado do mercado",
    "history.trending": "Tendencial",
    "history.multiTfDirection": "Direção Multi-TF",
    "history.yes": "Sim",
    "history.no": "Não",
    "missed.total7d": "Total (7d)",
    "missed.avgScore": "Score médio",
    "missed.bestScore": "Melhor score",
    "missed.pairs": "Pares",
    "missed.filterByPair": "Filtrar por par:",
    "missed.allPairs": "Todos os pares",
    "missed.loading": "A carregar...",
    "missed.empty": "Ainda não existem oportunidades falhadas registadas.",
    "missed.time": "Hora",
    "missed.reasonBlocked": "Razão do bloqueio",
    "settings.title": "Definições",
    "settings.subtitle": "Controlos runtime para o estado do bot, threshold de score, risco e pares monitorizados.",
    "settings.botEnabled": "Bot ativado",
    "settings.tradingMode": "Modo de trading",
    "settings.autonomyMode": "Modo de autonomia",
    "settings.shadowMode": "Modo shadow",
    "settings.heartbeatAlerts": "Alertas heartbeat",
    "settings.telegramLanguage": "Idioma do Telegram",
    "settings.autoSwap": "Auto-swap do champion",
    "settings.autoApprove": "Auto-aprovar live",
    "settings.autoLiveDeploy": "Auto deploy live",
    "settings.scoreThreshold": "Threshold de score",
    "settings.riskPerTrade": "Risco por trade",
    "settings.compoundRatio": "Rácio de compound",
    "settings.tradingPairs": "Pares de trading",
    "settings.activeStrategies": "Estratégias ativas",
    "settings.paper": "Paper",
    "settings.live": "Live",
    "settings.manual": "Manual",
    "settings.supervisedAuto": "Auto supervisionado",
    "settings.fullAuto": "Auto total",
    "settings.paused": "Pausado",
    "settings.operationalSnapshot": "Snapshot Operacional",
    "settings.operationalSnapshotHint": "Vista limpa do runtime de autonomia, governação e recuperação.",
    "settings.bot": "Bot",
    "settings.trading": "Trading",
    "settings.autonomyLabel": "Autonomia",
    "settings.champion": "Champion",
    "settings.liveApproval": "Aprovação Live",
    "settings.noActivePauseReason": "Sem razão ativa de pausa.",
    "settings.autoPause": "Pausa automática: {reason}",
    "settings.noChallengerAssigned": "Sem challenger atribuído.",
    "settings.notApproved": "Não aprovado",
    "settings.autoLiveEnabled": "Auto deploy live ativado.",
    "settings.manualLiveOnly": "Apenas deploy live manual.",
    "settings.regimeChampions": "Champions por Regime",
    "settings.notAssigned": "Não atribuído",
    "settings.regimeChampionsHint": "Slots de champion por regime usados pela governação adaptativa.",
    "settings.activeStrategiesCard": "Estratégias Ativas",
    "settings.pairsDetail": "Pares: {pairs}",
    "settings.autonomyFlags": "Flags de Autonomia",
    "settings.allDisabled": "Tudo desativado",
    "settings.autonomyFlagsHint": "Flags de comportamento supervisionado e full-auto.",
    "settings.recoveryHealth": "Recuperação e Saúde",
    "settings.recoveryHealthHint": "Visibilidade rápida sobre circuit breakers, último snapshot de autonomia e recuperação no arranque.",
    "settings.executionFailures": "Falhas de Execução",
    "settings.exchangeFailures": "Falhas da Exchange",
    "settings.lastAutonomySnapshot": "Último Snapshot de Autonomia",
    "settings.shadowSummary": "Resumo Shadow",
    "settings.noBreakerReason": "Sem razão de breaker registada.",
    "settings.neverTriggered": "Nunca disparou.",
    "settings.noAutonomySnapshot": "Ainda não existe snapshot de autonomia.",
    "settings.shadowNotRun": "O scan shadow ainda não correu.",
    "settings.startupStatus": "Estado do Arranque",
    "settings.startupPassed": "Checks de arranque concluídos com sucesso",
    "settings.startupPending": "Checks de arranque pendentes ou degradados",
    "settings.strictMode": "Modo estrito: {mode} | Última execução: {time}",
    "settings.modeEnabled": "ativado",
    "settings.modeDisabled": "desativado",
    "timeline.loading": "A carregar timeline de execução...",
    "timeline.empty": "Ainda não existem ordens de execução registadas para esta trade.",
    "timeline.entry": "Entrada",
    "timeline.protection": "Proteção",
    "timeline.adjustment": "Ajuste",
    "timeline.exit": "Saída",
    "timeline.opened": "Aberta {time}",
    "timeline.closed": "Fechada {time}",
    "timeline.qty": "Qtd",
    "timeline.price": "Preço"
    ,"backtest.title": "Backtesting"
    ,"backtest.subtitle": "Reproduz candles históricas da Binance com a mesma lógica principal de risco e score."
    ,"backtest.warning": "No backtest, o sentimento é assumido como neutro e a pressão do order book é aproximada pela posição do fecho dentro da vela. São aproximações conhecidas para validar estratégias, não previsões exatas de performance."
    ,"backtest.strategies": "Estratégias"
    ,"backtest.selectedStrategies": "{count} estratégia(s) selecionada(s)"
    ,"backtest.noStrategySelected": "Nenhuma estratégia selecionada. Será usado o conjunto ativo por defeito."
    ,"backtest.mode.standard": "Standard"
    ,"backtest.mode.walkForward": "Walk Forward"
    ,"backtest.feeRate": "Taxa de fee"
    ,"backtest.slippageBps": "Slippage bps"
    ,"backtest.maxComboSize": "Tamanho máx. do combo"
    ,"backtest.trainDays": "Dias treino"
    ,"backtest.testDays": "Dias teste"
    ,"backtest.stepDays": "Dias step"
    ,"backtest.run": "Correr backtest"
    ,"backtest.running": "A correr backtest..."
    ,"backtest.compare": "Comparar conjuntos de estratégias"
    ,"backtest.comparing": "A comparar conjuntos de estratégias..."
    ,"backtest.autoRun": "Correr experiências automáticas"
    ,"backtest.autoRunning": "A correr experiências automáticas..."
    ,"backtest.setComparison": "Comparação de Conjuntos"
    ,"backtest.setComparisonHint": "Compara o combo selecionado com cada estratégia individualmente."
    ,"backtest.setComparisonEmpty": "Ainda não existem resultados de comparação. Seleciona uma ou mais estratégias e corre a comparação."
    ,"backtest.experimentRunner": "Motor de Experiências Automáticas"
    ,"backtest.experimentRunnerHint": "Gera combinações de estratégias automaticamente até ao tamanho escolhido e ordena por retorno."
    ,"backtest.experimentRunnerEmpty": "Ainda não existem resultados de batch. Seleciona estratégias, escolhe o tamanho do combo e corre as experiências automáticas."
    ,"backtest.savedRuns": "Runs Guardadas"
    ,"backtest.savedRunsHint": "Experiências recentes que podes reabrir e comparar sem voltar a correr."
    ,"backtest.noSavedRuns": "Ainda não existem runs de backtest guardadas."
    ,"backtest.favorite": "favorita"
    ,"backtest.paperPromoted": "promovida para paper"
    ,"backtest.defaultSet": "conjunto por defeito"
    ,"backtest.unfavorite": "Remover favorito"
    ,"backtest.markFavorite": "Favorito"
    ,"backtest.setChampion": "Definir champion"
    ,"backtest.setChallenger": "Definir challenger"
    ,"backtest.trendChampion": "Champion trend"
    ,"backtest.sidewaysChampion": "Champion sideways"
    ,"backtest.volatileChampion": "Champion volatile"
    ,"backtest.approveLive": "Aprovar live"
    ,"backtest.selectedRun": "Detalhe da Run Selecionada"
    ,"backtest.latestResult": "Resultado do Último Backtest"
    ,"backtest.savedRunCreated": "Run guardada #{id} criada em {time}"
    ,"backtest.freshResult": "Resultado fresco da run mais recente."
    ,"backtest.savedRun": "run guardada"
    ,"backtest.return": "Retorno"
    ,"backtest.maxDrawdown": "Drawdown Máximo"
    ,"backtest.trades": "Trades"
    ,"backtest.sentiment": "Sentimento"
    ,"backtest.orderBook": "Order Book"
    ,"backtest.execution": "Execução"
    ,"backtest.spotSimulation": "Simulação spot"
    ,"backtest.comparisonLatest": "Comparação vs Última Run"
    ,"backtest.comparisonLatestHint": "Diferença rápida entre a run guardada selecionada e o backtest mais recente que executaste."
    ,"backtest.returnDelta": "Delta de Retorno"
    ,"backtest.winRateDelta": "Delta de Win Rate"
    ,"backtest.drawdownDelta": "Delta de Drawdown"
    ,"backtest.tradeCountDelta": "Delta de Trades"
    ,"backtest.walkForwardWindows": "Janelas Walk-Forward"
    ,"backtest.walkForwardWindowsHint": "Checkpoints in-sample e out-of-sample ao longo do período selecionado."
    ,"backtest.window": "Janela"
    ,"backtest.inSample": "In Sample"
    ,"backtest.outOfSample": "Out Of Sample"
    ,"backtest.capital": "Capital"
    ,"backtest.tradeLogPreview": "Pré-visualização do Trade Log"
    ,"backtest.tradeLogPreviewHint": "Primeiras {count} trades simuladas desta run."
    ,"backtest.noTradesForRun": "Não existem trades disponíveis para esta run."
    ,"backtest.trade": "Trade"
    ,"backtest.status": "Estado"
    ,"backtest.noRunSelected": "Corre um backtest ou seleciona uma run guardada para inspecionar a curva de capital e o trade log."
    ,"backtest.loading": "A carregar"
    ,"backtest.set": "Conjunto"
    }
};

export default translations;
