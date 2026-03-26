const express = require("express");
const { body, query, validationResult } = require("express-validator");

module.exports = function createDashboardRouter(context) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    try {
      const snapshot = await context.buildDashboardSnapshot();
      return res.json({ ok: true, ...snapshot });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get(
    "/capital-history",
    [query("range").optional().isIn(["1D", "1W", "1M", "ALL"])],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      try {
        const history = await context.getCapitalHistory(req.query.range || "ALL");
        return res.json({ ok: true, history });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  router.get("/stats", async (_req, res) => {
    try {
      const stats = await context.getTradeStatistics();
      return res.json({ ok: true, stats });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get(
    "/signal-debug",
    [
      query("pair").optional().isString(),
      query("side").optional().isIn(["BUY", "SELL"])
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      try {
        const debug = await context.buildSignalDebugSnapshot({
          pair: req.query.pair || context.runtime.tradingPairs[0],
          side: req.query.side || "BUY",
          triggerSource: "manual"
        });

        return res.json({ ok: true, debug });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  router.get("/settings", async (_req, res) => {
    return res.json({
      ok: true,
      settings: context.getRuntimeSettings()
    });
  });

  router.patch(
    "/settings",
    [
      body("botEnabled").optional().isBoolean(),
      body("tradingMode").optional().isIn(["paper", "live"]),
      body("scoreThreshold").optional().isInt({ min: 1, max: 12 }),
      body("riskPerTrade").optional().isFloat({ min: 0.001, max: 0.1 }),
      body("compoundRatio").optional().isFloat({ min: 0, max: 1 }),
      body("tradingPairs").optional().isArray({ min: 1 }),
      body("activeStrategies").optional().isArray({ min: 1 }),
      body("championRunId").optional({ values: "falsy" }).isInt({ min: 1 }),
      body("challengerRunId").optional({ values: "falsy" }).isInt({ min: 1 })
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      try {
        const settings = context.updateRuntimeSettings(req.body);
        return res.json({ ok: true, settings });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  return router;
};
