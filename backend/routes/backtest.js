const express = require("express");
const { body, validationResult } = require("express-validator");
const ExperimentInsights = require("../services/experimentinsights");

module.exports = function createBacktestRouter(context) {
  const router = express.Router();
  const experimentInsights = new ExperimentInsights();

  async function recordPromotionEvent({ runId, slot, action, metadata = {} }) {
    return context.backtestPromotionEvents.createEvent({
      runId,
      slot,
      action,
      metadata
    });
  }

  async function persistBacktestRun({ requestBody, result }) {
    return context.backtestRuns.createBacktestRun({
      pair: result.pair,
      timeframe: result.timeframe,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      config: {
        activeStrategies: Array.isArray(requestBody.activeStrategies) && requestBody.activeStrategies.length > 0
          ? requestBody.activeStrategies
          : String(process.env.ACTIVE_STRATEGIES || "multi_timeframe_rsi")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
        mode: requestBody.mode || "standard",
        tradingMode: context.runtime.tradingMode,
        scoreThreshold: Number(process.env.SCORE_THRESHOLD || 8),
        riskPerTrade: Number(process.env.RISK_PER_TRADE || 0.01),
        compoundRatio: Number(process.env.COMPOUND_RATIO || 0.5),
        feeRate: requestBody.feeRate ?? Number(process.env.BACKTEST_FEE_RATE || 0.001),
        slippageBps: requestBody.slippageBps ?? Number(process.env.BACKTEST_SLIPPAGE_BPS || 5),
        walkForwardTrainDays: requestBody.walkForwardTrainDays ?? Number(process.env.WALK_FORWARD_TRAIN_DAYS || 30),
        walkForwardTestDays: requestBody.walkForwardTestDays ?? Number(process.env.WALK_FORWARD_TEST_DAYS || 7),
        walkForwardStepDays: requestBody.walkForwardStepDays ?? Number(process.env.WALK_FORWARD_STEP_DAYS || 7)
      },
      summary: {
        totalReturnPercent: result.totalReturnPercent,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
        tradeCount: result.tradeCount,
        endingCapital: result.endingCapital,
        strategyRankingByPeriod: result.strategyRankingByPeriod || [],
        assumptions: result.assumptions
      },
      result
    });
  }

  function buildComparisonConfig(baseBody, strategies, label) {
    return {
      requestBody: {
        ...baseBody,
        activeStrategies: strategies
      },
      label: label || strategies.join(" + "),
      strategies
    };
  }

  async function executeComparisonSet({ baseBody, strategySets }) {
    const comparisons = [];

    for (const strategySet of strategySets) {
      const comparisonConfig = buildComparisonConfig(baseBody, strategySet.strategies, strategySet.label);
      // eslint-disable-next-line no-await-in-loop
      const result = await context.backtester.runBacktest({
        pair: baseBody.pair || context.runtime.tradingPairs[0],
        dateFrom: baseBody.dateFrom,
        dateTo: baseBody.dateTo,
        timeframe: baseBody.timeframe || "15m",
        mode: baseBody.mode || "standard",
        activeStrategies: comparisonConfig.strategies,
        feeRate: baseBody.feeRate,
        slippageBps: baseBody.slippageBps,
        walkForwardTrainDays: baseBody.walkForwardTrainDays,
        walkForwardTestDays: baseBody.walkForwardTestDays,
        walkForwardStepDays: baseBody.walkForwardStepDays
      });
      // eslint-disable-next-line no-await-in-loop
      const run = await persistBacktestRun({
        requestBody: comparisonConfig.requestBody,
        result
      });

      comparisons.push({
        label: comparisonConfig.label,
        strategies: comparisonConfig.strategies,
        runId: run.id,
        totalReturnPercent: result.totalReturnPercent,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
        tradeCount: result.tradeCount,
        endingCapital: result.endingCapital,
        result
      });
    }

    return comparisons.sort((left, right) => Number(right.totalReturnPercent || 0) - Number(left.totalReturnPercent || 0));
  }

  function buildStrategyCombinations(strategyIds = [], maxCombinationSize = 2) {
    const normalized = [...new Set(strategyIds)].filter(Boolean);
    const combinations = [];

    function walk(startIndex, current) {
      if (current.length > 0 && current.length <= maxCombinationSize) {
        combinations.push([...current]);
      }

      if (current.length >= maxCombinationSize) {
        return;
      }

      for (let index = startIndex; index < normalized.length; index += 1) {
        current.push(normalized[index]);
        walk(index + 1, current);
        current.pop();
      }
    }

    walk(0, []);
    return combinations;
  }

  router.get("/strategies", async (_req, res) => {
    try {
      return res.json({
        ok: true,
        strategies: context.strategyRegistry.listStrategies()
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error.message
      });
    }
  });

  router.get("/runs", async (req, res) => {
    try {
      const runs = await context.backtestRuns.listBacktestRuns({
        pair: req.query.pair,
        limit: req.query.limit || 20
      });

      return res.json({
        ok: true,
        runs: runs.map((run) => ({
          id: run.id,
          pair: run.pair,
          timeframe: run.timeframe,
          dateFrom: run.date_from,
          dateTo: run.date_to,
          summary: run.summary,
          config: run.config,
          createdAt: run.created_at,
          mark: run.mark || null
        }))
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error.message
      });
    }
  });

  router.get("/runs/:id", async (req, res) => {
    try {
      const run = await context.backtestRuns.getBacktestRunById(req.params.id);

      if (!run) {
        return res.status(404).json({
          ok: false,
          message: "Backtest run not found."
        });
      }

      return res.json({
        ok: true,
        run: {
          id: run.id,
          pair: run.pair,
          timeframe: run.timeframe,
          dateFrom: run.date_from,
          dateTo: run.date_to,
          config: run.config,
          summary: run.summary,
          result: run.result,
          createdAt: run.created_at,
          mark: run.mark || null
        }
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error.message
      });
    }
  });

  router.patch(
    "/runs/:id/favorite",
    [
      body("isFavorite").isBoolean(),
      body("favoriteLabel").optional().isString(),
      body("notes").optional().isString()
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          ok: false,
          errors: errors.array()
        });
      }

      try {
        const run = await context.backtestRuns.getBacktestRunById(req.params.id);

        if (!run) {
          return res.status(404).json({
            ok: false,
            message: "Backtest run not found."
          });
        }

        const mark = await context.backtestRunMarks.upsertMark(run.id, {
          isFavorite: req.body.isFavorite,
          favoriteLabel: req.body.favoriteLabel,
          promotedToPaper: run.mark?.promoted_to_paper || false,
          promotedAt: run.mark?.promoted_at || null,
          notes: req.body.notes || run.mark?.notes || null
        });

        return res.json({
          ok: true,
          mark
        });
      } catch (error) {
        return res.status(500).json({
          ok: false,
          message: error.message
        });
      }
    }
  );

  router.patch(
    "/runs/:id/promote",
    [
      body("slot").optional().isIn(["champion", "challenger"]),
      body("regimeId").optional().isIn(["trend", "sideways", "volatile"])
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          ok: false,
          errors: errors.array()
        });
      }

    try {
      const run = await context.backtestRuns.getBacktestRunById(req.params.id);

      if (!run) {
        return res.status(404).json({
          ok: false,
          message: "Backtest run not found."
        });
      }

      const slot = req.body.slot || "champion";
      const regimeId = req.body.regimeId || null;
      const previousRunId = slot === "champion" ? context.runtime.championRunId : context.runtime.challengerRunId;
      const activeStrategies = Array.isArray(run.config?.activeStrategies) && run.config.activeStrategies.length > 0
        ? run.config.activeStrategies
        : context.strategyRegistry.getActiveStrategies().map((strategy) => strategy.id);
      const settingsPayload = slot === "champion"
        ? {
            tradingMode: "paper",
            botEnabled: true,
            activeStrategies,
            championRunId: run.id,
            approvedLiveRunId: null
          }
        : {
            challengerRunId: run.id
          };

      if (regimeId === "trend") {
        settingsPayload.regimeChampionTrendRunId = run.id;
      }

      if (regimeId === "sideways") {
        settingsPayload.regimeChampionSidewaysRunId = run.id;
      }

      if (regimeId === "volatile") {
        settingsPayload.regimeChampionVolatileRunId = run.id;
      }

      const settings = context.updateRuntimeSettings(settingsPayload);
      const mark = await context.backtestRunMarks.upsertMark(run.id, {
        isFavorite: run.mark?.is_favorite || false,
        favoriteLabel: run.mark?.favorite_label || null,
        promotedToPaper: true,
        promotedAt: new Date(),
        notes: run.mark?.notes || null
      });
      await recordPromotionEvent({
        runId: run.id,
        slot,
        action: "promoted",
        metadata: {
          activeStrategies,
          tradingMode: settings.tradingMode,
          regimeId
        }
      });
      if (previousRunId && Number(previousRunId) !== Number(run.id)) {
        await recordPromotionEvent({
          runId: previousRunId,
          slot,
          action: "replaced",
          metadata: {
            replacedByRunId: run.id
          }
        });
      }
      return res.json({
        ok: true,
        settings,
        mark
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error.message
      });
    }
  });

  router.patch("/runs/:id/approve-live", async (req, res) => {
    try {
      const run = await context.backtestRuns.getBacktestRunById(req.params.id);

      if (!run) {
        return res.status(404).json({
          ok: false,
          message: "Backtest run not found."
        });
      }

      if (Number(context.runtime.championRunId || 0) !== Number(run.id)) {
        return res.status(400).json({
          ok: false,
          message: "Only the current champion run can be approved for live mode."
        });
      }

      const trades = await context.tradeModel.listTrades({ limit: 250 });
      const validation = await context.paperValidationService.buildSummary(trades);

      if (!validation.approvalGate?.canApproveLive) {
        return res.status(400).json({
          ok: false,
          message: validation.approvalGate?.reason || "Champion is not ready for live approval."
        });
      }

      const settings = context.updateRuntimeSettings({
        approvedLiveRunId: run.id,
        tradingMode: "live",
        botEnabled: true
      });
      await recordPromotionEvent({
        runId: run.id,
        slot: "champion",
        action: "approved_live",
        metadata: {
          approvalGate: validation.approvalGate
        }
      });

      return res.json({
        ok: true,
        settings
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error.message
      });
    }
  });

  router.post(
    "/",
    [
      body("pair").optional().isString().notEmpty(),
      body("dateFrom").isISO8601(),
      body("dateTo").isISO8601(),
      body("timeframe").optional().isString().notEmpty(),
      body("mode").optional().isIn(["standard", "walk_forward"]),
      body("activeStrategies").optional().isArray(),
      body("feeRate").optional().isFloat({ min: 0, max: 0.05 }),
      body("slippageBps").optional().isFloat({ min: 0, max: 500 }),
      body("walkForwardTrainDays").optional().isInt({ min: 7, max: 365 }),
      body("walkForwardTestDays").optional().isInt({ min: 1, max: 180 }),
      body("walkForwardStepDays").optional().isInt({ min: 1, max: 180 })
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          ok: false,
          errors: errors.array()
        });
      }

      try {
        const result = await context.backtester.runBacktest({
          pair: req.body.pair || context.runtime.tradingPairs[0],
          dateFrom: req.body.dateFrom,
          dateTo: req.body.dateTo,
          timeframe: req.body.timeframe || "15m",
          mode: req.body.mode || "standard",
          activeStrategies: req.body.activeStrategies,
          feeRate: req.body.feeRate,
          slippageBps: req.body.slippageBps,
          walkForwardTrainDays: req.body.walkForwardTrainDays,
          walkForwardTestDays: req.body.walkForwardTestDays,
          walkForwardStepDays: req.body.walkForwardStepDays
        });
        const run = await persistBacktestRun({
          requestBody: req.body,
          result
        });

        return res.json({
          ok: true,
          result,
          runId: run.id
        });
      } catch (error) {
        return res.status(500).json({
          ok: false,
          message: error.message
        });
      }
    }
  );

  router.post(
    "/compare",
    [
      body("pair").optional().isString().notEmpty(),
      body("dateFrom").isISO8601(),
      body("dateTo").isISO8601(),
      body("timeframe").optional().isString().notEmpty(),
      body("mode").optional().isIn(["standard", "walk_forward"]),
      body("strategySets").isArray({ min: 1 }),
      body("strategySets.*.label").optional().isString().notEmpty(),
      body("strategySets.*.strategies").isArray({ min: 1 }),
      body("feeRate").optional().isFloat({ min: 0, max: 0.05 }),
      body("slippageBps").optional().isFloat({ min: 0, max: 500 }),
      body("walkForwardTrainDays").optional().isInt({ min: 7, max: 365 }),
      body("walkForwardTestDays").optional().isInt({ min: 1, max: 180 }),
      body("walkForwardStepDays").optional().isInt({ min: 1, max: 180 })
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          ok: false,
          errors: errors.array()
        });
      }

      try {
        const comparisons = await executeComparisonSet({
          baseBody: req.body,
          strategySets: req.body.strategySets
        });

        return res.json({
          ok: true,
          comparisons: experimentInsights.annotate(comparisons)
        });
      } catch (error) {
        return res.status(500).json({
          ok: false,
          message: error.message
        });
      }
    }
  );

  router.post(
    "/experiments",
    [
      body("pair").optional().isString().notEmpty(),
      body("dateFrom").isISO8601(),
      body("dateTo").isISO8601(),
      body("timeframe").optional().isString().notEmpty(),
      body("mode").optional().isIn(["standard", "walk_forward"]),
      body("strategyIds").isArray({ min: 1 }),
      body("maxCombinationSize").optional().isInt({ min: 1, max: 5 }),
      body("feeRate").optional().isFloat({ min: 0, max: 0.05 }),
      body("slippageBps").optional().isFloat({ min: 0, max: 500 }),
      body("walkForwardTrainDays").optional().isInt({ min: 7, max: 365 }),
      body("walkForwardTestDays").optional().isInt({ min: 1, max: 180 }),
      body("walkForwardStepDays").optional().isInt({ min: 1, max: 180 })
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          ok: false,
          errors: errors.array()
        });
      }

      try {
        const strategySets = buildStrategyCombinations(
          req.body.strategyIds,
          Number(req.body.maxCombinationSize || 2)
        ).map((strategies) => ({
          label: strategies.join(" + "),
          strategies
        }));

        const comparisons = await executeComparisonSet({
          baseBody: req.body,
          strategySets
        });

        return res.json({
          ok: true,
          generatedCount: strategySets.length,
          comparisons: experimentInsights.annotate(comparisons)
        });
      } catch (error) {
        return res.status(500).json({
          ok: false,
          message: error.message
        });
      }
    }
  );

  return router;
};
