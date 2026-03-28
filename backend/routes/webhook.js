const crypto = require("crypto");
const express = require("express");
const { body, validationResult } = require("express-validator");

module.exports = function createWebhookRouter(context) {
  const router = express.Router();

  router.post(
    "/",
    [
      body("secret").isString().notEmpty(),
      body("pair").optional().isString().notEmpty(),
      body("side").isString().isIn(["BUY", "SELL"]),
      body("metadata").optional().isObject()
    ],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          ok: false,
          errors: errors.array()
        });
      }

      const expected = process.env.WEBHOOK_SECRET || "";
      const provided = String(req.body.secret || "");

      if (
        !expected ||
        provided.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
      ) {
        return res.status(401).json({
          ok: false,
          message: "Invalid webhook secret."
        });
      }

      try {
        const result = await context.processSignal({
          pair: req.body.pair || context.runtime.tradingPairs?.[0] || "BTCUSDT",
          side: req.body.side,
          triggerSource: "webhook",
          metadata: req.body.metadata || {}
        });

        return res.json({
          ok: true,
          result
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
