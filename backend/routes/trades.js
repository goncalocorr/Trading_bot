const express = require("express");
const { body, param, query, validationResult } = require("express-validator");

module.exports = function createTradesRouter(context) {
  const router = express.Router();

  router.get(
    "/",
    [
      query("pair").optional().isString(),
      query("side").optional().isIn(["BUY", "SELL"]),
      query("status").optional().isIn(["open", "closed", "cancelled"]),
      query("dateFrom").optional().isISO8601(),
      query("dateTo").optional().isISO8601()
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      try {
        const trades = await context.tradeModel.listTrades(req.query);
        return res.json({ ok: true, trades });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  router.get("/active", async (_req, res) => {
    try {
      const trades = await context.tradeModel.getOpenTrades();
      return res.json({ ok: true, trades });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  });

  router.get(
    "/:id",
    [param("id").isInt({ min: 1 })],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      try {
        const trade = await context.tradeModel.getTradeById(req.params.id);

        if (!trade) {
          return res.status(404).json({ ok: false, message: "Trade not found." });
        }

        return res.json({ ok: true, trade });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  router.get(
    "/:id/orders",
    [param("id").isInt({ min: 1 })],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      try {
        const trade = await context.tradeModel.getTradeById(req.params.id);

        if (!trade) {
          return res.status(404).json({ ok: false, message: "Trade not found." });
        }

        const orders = await context.orderModel.getOrdersByTradeId(req.params.id);
        return res.json({ ok: true, orders });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  router.post(
    "/manual",
    [
      body("pair").optional().isString().notEmpty(),
      body("side").isString().isIn(["BUY", "SELL"]),
      body("metadata").optional().isObject()
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      try {
        const result = await context.processSignal({
          pair: req.body.pair || context.runtime.tradingPairs[0],
          side: req.body.side,
          triggerSource: "manual",
          metadata: req.body.metadata || {}
        });

        return res.json({ ok: true, result });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  router.post(
    "/force-paper-test",
    [
      body("pair").optional().isString().notEmpty(),
      body("confirm").isBoolean().equals("true")
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      if (context.runtime.tradingMode !== "paper") {
        return res.status(403).json({ ok: false, message: "Force trade only allowed in paper mode." });
      }

      try {
        const result = await context.forcePaperTrade({
          pair: req.body.pair || context.runtime.tradingPairs[0],
          side: "BUY"
        });

        return res.json({ ok: true, result });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  return router;
};
