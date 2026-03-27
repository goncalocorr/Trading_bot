const crypto = require("crypto");

const API_SECRET = process.env.API_SECRET || "";

function requireApiKey(req, res, next) {
  // In production, API_SECRET must be set — refuse open access.
  if (!API_SECRET) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ ok: false, message: "API_SECRET not configured. Set it before running in production." });
    }
    return next();
  }

  const provided = req.headers["x-api-key"] || "";

  if (
    provided.length !== API_SECRET.length ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(API_SECRET))
  ) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  return next();
}

module.exports = { requireApiKey };
