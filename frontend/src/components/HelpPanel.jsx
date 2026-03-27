import { useMemo } from "react";
import { useI18n } from "../i18n/I18nProvider";

const helpCopy = {
  en: {
    title: "Help",
    subtitle: "Operational guide for how the bot works, what each option means, how the strategies behave, and how to run it safely.",
    introTitle: "What This Bot Does",
    introText: "This bot scans configured crypto pairs, scores potential setups, and can open, manage, and close trades automatically. It was designed to let you research first in paper mode, validate strategies, and only later move toward live deployment with strict controls.",
    flowTitle: "How The Bot Works",
    flowSteps: [
      "1. Market scan: the backend fetches candles for the configured pairs and timeframes.",
      "2. Strategy scan: each active strategy proposes possible BUY or SELL signals.",
      "3. Score and guards: the scorer checks confirmation factors such as RSI, multi-timeframe context, trend, market regime, and blockers.",
      "4. Execution decision: if the score and safety guards allow it, the bot opens a trade in paper or live mode.",
      "5. Trade management: protection, order state, timeline, and governance are tracked while the position is open.",
      "6. Review and learning: backtests, paper validation, champion/challenger, and analytics help you decide what to keep using."
    ],
    tabsTitle: "What Each Tab Is For",
    tabs: [
      {
        title: "Overview",
        text: "Daily operating screen. Use it to see capital, signal debug, active trades, latest trades, and overall statistics."
      },
      {
        title: "History",
        text: "Audit screen. Use it to inspect past trades, open the execution timeline, and review the score breakdown that led to each trade."
      },
      {
        title: "Missed",
        text: "Research screen for blocked opportunities. Useful to understand if the bot is too strict or if the market simply did not offer valid setups."
      },
      {
        title: "Backtest",
        text: "Research lab. Run historical tests, compare strategy sets, save runs, mark favorites, promote champions, and evaluate walk-forward performance."
      },
      {
        title: "Settings",
        text: "Operational control panel. Change trading mode, autonomy, risk, tracked pairs, active strategies, and runtime behaviour."
      },
      {
        title: "Help",
        text: "Reference guide. Use this tab when you want to understand the bot, not just operate it."
      }
    ],
    optionsTitle: "Settings Explained",
    options: [
      {
        name: "Bot enabled",
        what: "Turns the runtime loop on or off.",
        why: "Use enabled when you want scans and automation to run. Use paused when you want the bot to stop opening new trades.",
        example: "Example: leave it enabled in paper mode overnight, and pause it before changing strategies or pairs."
      },
      {
        name: "Trading mode",
        what: "Defines whether trades are simulated or sent to the exchange.",
        why: "Paper mode is the safe testing mode. Live mode is only for approved, monitored deployment.",
        example: "Example: use paper while validating a new setup, and only consider live after enough paper evidence."
      },
      {
        name: "Autonomy mode",
        what: "Controls how independent the bot is.",
        why: "Manual is for controlled use, supervised_auto is the safest real automation step, and full_auto is the most aggressive operational mode.",
        example: "Example: manual for debugging, supervised_auto for paper soak tests, full_auto only after strong validation."
      },
      {
        name: "Shadow mode",
        what: "Runs a shadow decision loop without normal deployment intent.",
        why: "Useful to compare what the bot would do without trusting it yet with real execution decisions.",
        example: "Example: keep live mode supervised but enable shadow mode to see what the autonomous strategy selector would choose."
      },
      {
        name: "Heartbeat alerts",
        what: "Sends periodic Telegram summaries.",
        why: "Good for remote monitoring so you know the bot is alive, healthy, and still scanning.",
        example: "Example: enable it when the bot runs on a VPS or overnight."
      },
      {
        name: "Auto-swap champion",
        what: "Allows challenger logic to promote a better paper candidate over the current champion.",
        why: "It reduces manual governance but should only be used once you trust the validation loop.",
        example: "Example: keep it disabled at first, then enable it after observing several stable paper comparisons."
      },
      {
        name: "Auto-approve live",
        what: "Lets the validation system mark a run as ready for live automatically.",
        why: "Powerful, but only safe after your thresholds, paper data, and governance are mature.",
        example: "Example: leave disabled until you have confidence in champion/challenger behaviour."
      },
      {
        name: "Auto-live deploy",
        what: "Allows approved logic to move into live deployment automatically.",
        why: "This is the highest-risk setting in the app.",
        example: "Example: keep disabled unless you are intentionally running a production-grade autonomous setup."
      },
      {
        name: "Score threshold",
        what: "Minimum score required before the bot will consider execution.",
        why: "Higher threshold means fewer but cleaner setups. Lower threshold means more activity but more noise.",
        example: "Example: 8 is a cautious baseline. 9-10 is stricter. 6-7 is faster but riskier."
      },
      {
        name: "Risk per trade",
        what: "Base fraction of capital the bot risks on each trade.",
        why: "This is one of the most important safety controls.",
        example: "Example: 0.01 means around 1% base risk per trade. Safer users often stay around 0.005 to 0.01."
      },
      {
        name: "Compound ratio",
        what: "Controls how much growth feeds back into future size.",
        why: "Higher values grow faster in good periods but amplify swings.",
        example: "Example: 0.5 is balanced. Lower is more conservative."
      },
      {
        name: "Trading pairs",
        what: "List of pairs the bot scans.",
        why: "More pairs produce more data and more opportunities, but also more noise and complexity.",
        example: "Example: ETHUSDT,XRPUSDT is a focused set. Adding too many pairs too early makes analysis harder."
      },
      {
        name: "Active strategies",
        what: "Defines which strategy modules are allowed to propose trades.",
        why: "This is how you control whether the bot trades continuation setups, reversions, or legacy logic.",
        example: "Example: use pullback_continuation + mean_reversion for a diversified but still understandable setup."
      }
    ],
    strategiesTitle: "How The Strategies Work",
    strategies: [
      {
        name: "pullback_continuation",
        description: "Trend-following BUY strategy.",
        logic: [
          "Looks for a bullish 1H and 4H structure.",
          "Needs the 15m price to be above EMA200.",
          "Accepts a pullback into the EMA9/EMA21 zone with ATR-based breathing room.",
          "Needs RSI in a healthy pullback zone and volume above average.",
          "Avoids sideways 15m conditions."
        ],
        bestFor: "Best in clean uptrends with orderly pullbacks.",
        risk: "Weak in bearish phases because it tries to buy continuation that never resumes."
      },
      {
        name: "mean_reversion",
        description: "Reversal / fade strategy.",
        logic: [
          "Triggers when RSI goes into an extreme zone.",
          "BUY when oversold and SELL when overbought.",
          "Avoids fighting the strongest structural trend extremes.",
          "More tolerant of mixed context than a trend-following strategy."
        ],
        bestFor: "Best when the market stretches too far and snaps back.",
        risk: "Can suffer in strong directional markets if a move keeps extending."
      },
      {
        name: "multi_timeframe_rsi",
        description: "Legacy strategy based on higher-timeframe direction plus 15m RSI extremes.",
        logic: [
          "Follows the higher-timeframe direction.",
          "Looks for RSI extremes on 15m.",
          "Usually enters later than the other two strategies."
        ],
        bestFor: "Can work when trend and timing are clean.",
        risk: "Often too rigid and can underperform when the trend is already weakening."
      }
    ],
    recipesTitle: "Recommended Ways To Run The Bot",
    recipes: [
      {
        name: "Safest setup",
        goal: "Maximum control and lowest operational risk.",
        settings: [
          "Trading mode: paper",
          "Autonomy mode: supervised_auto",
          "Auto-swap: disabled",
          "Auto-approve live: disabled",
          "Auto-live deploy: disabled",
          "Score threshold: 8 or 9",
          "Risk per trade: 0.005 to 0.01",
          "Pairs: 1 to 2 highly liquid pairs"
        ],
        why: "Best for learning, overnight testing, and collecting evidence without taking real exchange risk."
      },
      {
        name: "Balanced setup",
        goal: "Faster learning with manageable complexity.",
        settings: [
          "Trading mode: paper",
          "Autonomy mode: supervised_auto",
          "Heartbeat alerts: enabled",
          "Score threshold: 7 or 8",
          "Risk per trade: around 0.01",
          "Pairs: 2 to 4 selected liquid pairs",
          "Strategies: continuation plus mean reversion"
        ],
        why: "Good for gathering more trades and comparing strategy behaviour without jumping into live."
      },
      {
        name: "Fastest learning setup",
        goal: "Collect more data quickly.",
        settings: [
          "Trading mode: paper only",
          "Autonomy mode: supervised_auto",
          "Score threshold: 6 or 7",
          "More pairs, but still liquid ones only",
          "Strategies: multiple active"
        ],
        why: "Useful if you want more samples fast, but it will also produce more noise and weaker-quality trades."
      }
    ],
    safetyTitle: "Safest Path To Use The Bot",
    safetySteps: [
      "1. Start in paper mode.",
      "2. Keep autonomy in supervised_auto.",
      "3. Use a small set of liquid pairs.",
      "4. Run backtests and walk-forward before trusting a strategy set.",
      "5. Observe paper trades for days, not just a few signals.",
      "6. Only consider live after paper validation and clear health stability.",
      "7. Keep auto-live deploy disabled until you are fully confident."
    ],
    quickExamplesTitle: "Practical Examples",
    quickExamples: [
      {
        title: "I want the bot to be as safe as possible",
        text: "Use paper + supervised_auto + score threshold 8/9 + risk per trade around 1% or less + auto-live features disabled."
      },
      {
        title: "I want more results quickly",
        text: "Use paper + supervised_auto + score threshold 6/7 + 2 to 4 liquid pairs. Expect more trades but lower average quality."
      },
      {
        title: "I want to study strategy quality",
        text: "Use Backtest and walk-forward, then compare runs, promote favorites, and monitor champion/challenger in paper before changing live behaviour."
      }
    ]
  },
  "pt-PT": {
    title: "Ajuda",
    subtitle: "Guia operacional para perceber como o bot funciona, o que significa cada opção, como se comportam as estratégias e como o correr com segurança.",
    introTitle: "O Que Este Bot Faz",
    introText: "Este bot analisa pares de criptomoedas configurados, atribui score a possíveis setups e pode abrir, gerir e fechar trades automaticamente. Foi desenhado para começares em paper mode, validares estratégias e só depois aproximares-te do live com controlos rigorosos.",
    flowTitle: "Como O Bot Funciona",
    flowSteps: [
      "1. Scan de mercado: o backend vai buscar candles para os pares e timeframes configurados.",
      "2. Scan de estratégias: cada estratégia ativa propõe possíveis sinais BUY ou SELL.",
      "3. Score e guardas: o scorer verifica confirmações como RSI, contexto multi-timeframe, tendência, regime de mercado e blockers.",
      "4. Decisão de execução: se o score e as guardas de segurança permitirem, o bot abre uma trade em paper ou live.",
      "5. Gestão da trade: proteção, estado das ordens, timeline e governação são acompanhados enquanto a posição está aberta.",
      "6. Revisão e aprendizagem: backtests, paper validation, champion/challenger e analytics ajudam-te a decidir o que manter."
    ],
    tabsTitle: "Para Que Serve Cada Tab",
    tabs: [
      {
        title: "Overview",
        text: "Ecrã diário de operação. Usa-o para ver capital, signal debug, trades ativas, últimas trades e estatísticas gerais."
      },
      {
        title: "History",
        text: "Ecrã de auditoria. Serve para inspecionar trades passadas, abrir a execution timeline e rever o score breakdown que levou a cada trade."
      },
      {
        title: "Missed",
        text: "Ecrã de research para oportunidades bloqueadas. Útil para perceber se o bot está demasiado restritivo ou se o mercado simplesmente não ofereceu setups válidos."
      },
      {
        title: "Backtest",
        text: "Laboratório de research. Corre testes históricos, compara conjuntos de estratégias, guarda runs, marca favoritas, promove champions e avalia walk-forward."
      },
      {
        title: "Settings",
        text: "Painel operacional. Muda o modo de trading, autonomia, risco, pares monitorizados, estratégias ativas e comportamento runtime."
      },
      {
        title: "Help",
        text: "Guia de referência. Usa esta tab quando queres perceber o bot, não apenas operá-lo."
      }
    ],
    optionsTitle: "Definições Explicadas",
    options: [
      {
        name: "Bot enabled",
        what: "Liga ou desliga o loop runtime.",
        why: "Usa enabled quando queres scans e automação ativos. Usa paused quando queres impedir novas trades.",
        example: "Exemplo: deixa enabled durante a noite em paper mode e pausa antes de mudares estratégias ou pares."
      },
      {
        name: "Trading mode",
        what: "Define se as trades são simuladas ou enviadas para a exchange.",
        why: "Paper mode é o modo seguro de teste. Live mode só deve ser usado em deployment aprovado e monitorizado.",
        example: "Exemplo: usa paper enquanto validas um setup novo e só pondera live depois de haver evidência suficiente."
      },
      {
        name: "Autonomy mode",
        what: "Controla o grau de independência do bot.",
        why: "Manual é para uso controlado, supervised_auto é o passo mais seguro de automação real, e full_auto é o modo operacional mais agressivo.",
        example: "Exemplo: manual para debugging, supervised_auto para soak tests em paper, full_auto só depois de validação forte."
      },
      {
        name: "Shadow mode",
        what: "Corre um loop shadow de decisão sem intenção normal de deployment.",
        why: "Útil para comparares o que o bot faria sem ainda confiares nele para decisões reais.",
        example: "Exemplo: mantém live supervisionado mas ativa shadow mode para ver o que o seletor automático escolheria."
      },
      {
        name: "Heartbeat alerts",
        what: "Envia resumos periódicos por Telegram.",
        why: "Bom para monitorização remota, para saberes se o bot está vivo, saudável e ainda a fazer scans.",
        example: "Exemplo: ativa quando o bot corre numa VPS ou durante a noite."
      },
      {
        name: "Auto-swap champion",
        what: "Permite à lógica challenger promover um candidato melhor sobre o champion atual.",
        why: "Reduz governação manual, mas só deve ser usado quando já confias no ciclo de validação.",
        example: "Exemplo: deixa desativado no início e ativa apenas depois de várias comparações paper estáveis."
      },
      {
        name: "Auto-approve live",
        what: "Permite ao sistema de validação marcar automaticamente uma run como pronta para live.",
        why: "É poderoso, mas só é seguro quando thresholds, dados paper e governação já estão maduros.",
        example: "Exemplo: mantém desativado até teres confiança no comportamento champion/challenger."
      },
      {
        name: "Auto-live deploy",
        what: "Permite que uma lógica aprovada passe automaticamente para deployment live.",
        why: "É a definição com maior risco em toda a aplicação.",
        example: "Exemplo: mantém desativado a não ser que estejas mesmo a correr um setup autónomo de produção."
      },
      {
        name: "Score threshold",
        what: "Score mínimo exigido antes de o bot considerar execução.",
        why: "Threshold mais alto significa menos setups mas mais limpos. Threshold mais baixo significa mais atividade mas também mais ruído.",
        example: "Exemplo: 8 é uma base cautelosa. 9-10 é mais estrito. 6-7 é mais rápido mas mais arriscado."
      },
      {
        name: "Risk per trade",
        what: "Fração base de capital que o bot arrisca por trade.",
        why: "É um dos controlos de segurança mais importantes.",
        example: "Exemplo: 0.01 significa cerca de 1% de risco base por trade. Utilizadores mais conservadores costumam ficar entre 0.005 e 0.01."
      },
      {
        name: "Compound ratio",
        what: "Controla quanto do crescimento volta a entrar no tamanho futuro.",
        why: "Valores mais altos fazem crescer mais depressa em bons períodos, mas amplificam oscilações.",
        example: "Exemplo: 0.5 é equilibrado. Mais baixo é mais conservador."
      },
      {
        name: "Trading pairs",
        what: "Lista de pares que o bot monitoriza.",
        why: "Mais pares dão mais dados e mais oportunidades, mas também mais ruído e complexidade.",
        example: "Exemplo: ETHUSDT,XRPUSDT é um conjunto focado. Adicionar demasiados pares demasiado cedo complica a análise."
      },
      {
        name: "Active strategies",
        what: "Define que módulos de estratégia podem propor trades.",
        why: "É assim que controlas se o bot negocia continuação, reversão ou lógica legada.",
        example: "Exemplo: usa pullback_continuation + mean_reversion para um setup diversificado mas ainda fácil de entender."
      }
    ],
    strategiesTitle: "Como Funcionam As Estratégias",
    strategies: [
      {
        name: "pullback_continuation",
        description: "Estratégia BUY de continuação de tendência.",
        logic: [
          "Procura estrutura bullish em 1H e 4H.",
          "Exige preço 15m acima da EMA200.",
          "Aceita pullback para a zona EMA9/EMA21 com margem baseada em ATR.",
          "Precisa de RSI numa zona saudável de pullback e volume acima da média.",
          "Evita condições laterais em 15m."
        ],
        bestFor: "Funciona melhor em uptrends limpas com pullbacks organizados.",
        risk: "Fica fraca em fases bearish porque tenta comprar uma continuação que nunca retoma."
      },
      {
        name: "mean_reversion",
        description: "Estratégia de reversão / fade.",
        logic: [
          "Dispara quando o RSI entra numa zona extrema.",
          "BUY quando está oversold e SELL quando está overbought.",
          "Evita lutar contra os extremos mais fortes da estrutura de tendência.",
          "É mais tolerante a contexto misto do que uma estratégia trend-following."
        ],
        bestFor: "Funciona melhor quando o mercado estica demasiado e depois corrige.",
        risk: "Pode sofrer em mercados muito direcionais se o movimento continuar a estender."
      },
      {
        name: "multi_timeframe_rsi",
        description: "Estratégia legada baseada em direção de higher timeframe mais extremos de RSI em 15m.",
        logic: [
          "Segue a direção do higher timeframe.",
          "Procura extremos de RSI em 15m.",
          "Costuma entrar mais tarde do que as outras duas estratégias."
        ],
        bestFor: "Pode funcionar quando tendência e timing estão muito limpos.",
        risk: "Muitas vezes é rígida demais e pode render mal quando a tendência já está a enfraquecer."
      }
    ],
    recipesTitle: "Formas Recomendadas De Usar O Bot",
    recipes: [
      {
        name: "Modo mais seguro",
        goal: "Máximo controlo e menor risco operacional.",
        settings: [
          "Trading mode: paper",
          "Autonomy mode: supervised_auto",
          "Auto-swap: disabled",
          "Auto-approve live: disabled",
          "Auto-live deploy: disabled",
          "Score threshold: 8 ou 9",
          "Risk per trade: 0.005 a 0.01",
          "Pares: 1 a 2 pares muito líquidos"
        ],
        why: "É o melhor modo para aprender, testar durante a noite e recolher evidência sem risco real de exchange."
      },
      {
        name: "Modo equilibrado",
        goal: "Aprendizagem mais rápida com complexidade controlada.",
        settings: [
          "Trading mode: paper",
          "Autonomy mode: supervised_auto",
          "Heartbeat alerts: enabled",
          "Score threshold: 7 ou 8",
          "Risk per trade: cerca de 0.01",
          "Pares: 2 a 4 pares líquidos selecionados",
          "Estratégias: continuação + mean reversion"
        ],
        why: "Bom para recolher mais trades e comparar o comportamento das estratégias sem saltar já para live."
      },
      {
        name: "Modo mais rápido",
        goal: "Recolher mais dados rapidamente.",
        settings: [
          "Trading mode: paper apenas",
          "Autonomy mode: supervised_auto",
          "Score threshold: 6 ou 7",
          "Mais pares, mas só líquidos",
          "Várias estratégias ativas"
        ],
        why: "Útil se queres mais amostras depressa, mas vai também produzir mais ruído e trades de qualidade média inferior."
      }
    ],
    safetyTitle: "Caminho Mais Seguro Para Usar O Bot",
    safetySteps: [
      "1. Começa em paper mode.",
      "2. Mantém a autonomia em supervised_auto.",
      "3. Usa um conjunto pequeno de pares líquidos.",
      "4. Corre backtests e walk-forward antes de confiar num strategy set.",
      "5. Observa paper trades durante dias, não apenas alguns sinais.",
      "6. Só pondera live depois de paper validation e estabilidade clara de health.",
      "7. Mantém auto-live deploy desativado até confiares totalmente."
    ],
    quickExamplesTitle: "Exemplos Práticos",
    quickExamples: [
      {
        title: "Quero o bot o mais seguro possível",
        text: "Usa paper + supervised_auto + score threshold 8/9 + risk per trade perto de 1% ou menos + features auto-live desativadas."
      },
      {
        title: "Quero mais resultados rapidamente",
        text: "Usa paper + supervised_auto + score threshold 6/7 + 2 a 4 pares líquidos. Vais ter mais trades, mas também menor qualidade média."
      },
      {
        title: "Quero estudar a qualidade das estratégias",
        text: "Usa o Backtest e o walk-forward, depois compara runs, promove favoritas e acompanha champion/challenger em paper antes de mudar o comportamento live."
      }
    ]
  }
};

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-slate-300">{subtitle}</p> : null}
    </div>
  );
}

function HelpPanel() {
  const { locale } = useI18n();
  const copy = useMemo(() => helpCopy[locale] || helpCopy.en, [locale]);

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">{copy.title}</h2>
        <p className="mt-1 text-sm text-slate-300">{copy.subtitle}</p>
      </div>

      <div className="space-y-6">
        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <SectionTitle title={copy.introTitle} />
          <p className="text-sm leading-7 text-slate-200">{copy.introText}</p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <SectionTitle title={copy.flowTitle} />
          <div className="space-y-3">
            {copy.flowSteps.map((step) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                {step}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <SectionTitle title={copy.tabsTitle} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {copy.tabs.map((tab) => (
              <article key={tab.title} className="rounded-[20px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">{tab.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{tab.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <SectionTitle title={copy.optionsTitle} />
          <div className="space-y-4">
            {copy.options.map((option) => (
              <article key={option.name} className="rounded-[20px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">{option.name}</p>
                <p className="mt-3 text-sm text-slate-300"><span className="font-semibold text-slate-100">O que faz:</span> {option.what}</p>
                <p className="mt-2 text-sm text-slate-300"><span className="font-semibold text-slate-100">Justificação:</span> {option.why}</p>
                <p className="mt-2 text-sm text-slate-300"><span className="font-semibold text-slate-100">Exemplo:</span> {option.example}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <SectionTitle title={copy.strategiesTitle} />
          <div className="space-y-4">
            {copy.strategies.map((strategy) => (
              <article key={strategy.name} className="rounded-[20px] border border-white/10 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold text-white">{strategy.name}</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                    {strategy.description}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {strategy.logic.map((line) => (
                    <p key={line} className="text-sm text-slate-300">{line}</p>
                  ))}
                </div>
                <p className="mt-3 text-sm text-emerald-200"><span className="font-semibold text-emerald-100">Best fit:</span> {strategy.bestFor}</p>
                <p className="mt-2 text-sm text-amber-200"><span className="font-semibold text-amber-100">Risk:</span> {strategy.risk}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <SectionTitle title={copy.recipesTitle} />
          <div className="grid gap-4 xl:grid-cols-3">
            {copy.recipes.map((recipe) => (
              <article key={recipe.name} className="rounded-[20px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">{recipe.name}</p>
                <p className="mt-2 text-sm text-sky-200">{recipe.goal}</p>
                <div className="mt-4 space-y-2">
                  {recipe.settings.map((item) => (
                    <p key={item} className="text-sm text-slate-300">{item}</p>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-300">{recipe.why}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <SectionTitle title={copy.safetyTitle} />
          <div className="space-y-3">
            {copy.safetySteps.map((step) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                {step}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-5">
          <SectionTitle title={copy.quickExamplesTitle} />
          <div className="grid gap-4 xl:grid-cols-3">
            {copy.quickExamples.map((example) => (
              <article key={example.title} className="rounded-[20px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">{example.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{example.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HelpPanel;
