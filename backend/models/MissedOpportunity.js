const db = require("./db");

class MissedOpportunityModel {
  async create(payload) {
    const result = await db.execute(
      `INSERT INTO missed_opportunities (pair, timestamp, score, reason, indicators_snapshot)
       VALUES (:pair, :timestamp, :score, :reason, CAST(:indicatorsSnapshot AS JSON))`,
      {
        pair: payload.pair,
        timestamp: payload.timestamp || new Date(),
        score: payload.score,
        reason: String(payload.reason || "").slice(0, 255),
        indicatorsSnapshot: JSON.stringify(payload.indicatorsSnapshot || {})
      }
    );

    return result.insertId;
  }

  async getRecent({ pair, limit = 50, offset = 0 } = {}) {
    const conditions = ["1=1"];
    const params = { limit: Number(limit), offset: Number(offset) };

    if (pair) {
      conditions.push("pair = :pair");
      params.pair = pair;
    }

    const rows = await db.query(
      `SELECT id, pair, timestamp, score, reason, indicators_snapshot, created_at
       FROM missed_opportunities
       WHERE ${conditions.join(" AND ")}
       ORDER BY timestamp DESC
       LIMIT :limit OFFSET :offset`,
      params
    );

    return rows.map((row) => ({
      ...row,
      indicators_snapshot:
        typeof row.indicators_snapshot === "string"
          ? JSON.parse(row.indicators_snapshot)
          : (row.indicators_snapshot || {})
    }));
  }

  async getStats() {
    const [row] = await db.query(
      `SELECT
         COUNT(*) AS total,
         AVG(score) AS avg_score,
         MAX(score) AS max_score,
         MIN(score) AS min_score,
         COUNT(DISTINCT pair) AS distinct_pairs
       FROM missed_opportunities
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    return row || { total: 0, avg_score: 0, max_score: 0, min_score: 0, distinct_pairs: 0 };
  }
}

module.exports = new MissedOpportunityModel();
