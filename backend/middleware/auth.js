const API_SECRET = process.env.API_SECRET || "";

/**
 * Simple API key authentication middleware.
 * Clients must send the key in the X-API-Key header.
 * If API_SECRET is not configured, the middleware is disabled (open access).
 */
function requireApiKey(req, res, next) {
  if (!API_SECRET) {
    return next();
  }

  const provided = req.headers["x-api-key"] || "";

  if (provided !== API_SECRET) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  return next();
}

module.exports = { requireApiKey };
