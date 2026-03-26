const express = require("express");
const { body, validationResult } = require("express-validator");

module.exports = function createBacktestRouter(context) {
  const router = express.Router();

  router.post(
    "/",
    [
      body("pair").optional().isString().notEmpty(),
      body("dateFrom").isISO8601(),
      body("dateTo").isISO8601(),
      body("timeframe").optional().isString().notEmpty()
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
          timeframe: req.body.timeframe || "15m"
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
