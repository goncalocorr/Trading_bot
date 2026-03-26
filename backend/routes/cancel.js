const express = require("express");
const { param, validationResult } = require("express-validator");

module.exports = function createCancelRouter(context) {
  const router = express.Router();

  router.delete(
    "/:id/cancel",
    [param("id").isInt({ min: 1 })],
    async (req, res) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      try {
        const result = await context.cancelTrade(req.params.id, "manual_cancel");
        return res.json({ ok: true, result });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    }
  );

  return router;
};
