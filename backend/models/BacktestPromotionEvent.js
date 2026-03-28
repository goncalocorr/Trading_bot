const db = require("./db");

class BacktestPromotionEventModel {
  async createEvent(payload = {}) {
    const result = await db.execute(
      `INSERT INTO backtest_promotion_events (
        run_id,
        slot,
        action,
        metadata
      ) VALUES (
        :runId,
        :slot,
        :action,
        :metadata
      )`,
      {
        runId: payload.runId || null,
        slot: payload.slot || "champion",
        action: payload.action || "updated",
        metadata: JSON.stringify(payload.metadata || {})
      }
    );

    return this.getEventById(result.insertId);
  }

  async getEventById(id) {
    const rows = await db.query(`SELECT * FROM backtest_promotion_events WHERE id = :id LIMIT 1`, { id });
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async listEvents({ slot, limit = 20 } = {}) {
    const conditions = [];
    const params = {};

    if (slot) {
      conditions.push("slot = :slot");
      params.slot = slot;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.limit = Math.max(1, Math.min(1000, Number(limit || 20)));
    const rows = await db.query(
      `SELECT *
       FROM backtest_promotion_events
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT :limit`,
      params
    );

    return rows.map((row) => this.mapRow(row));
  }

  mapRow(row) {
    return {
      ...row,
      run_id: row.run_id === null ? null : Number(row.run_id),
      metadata: this.safeJsonParse(row.metadata)
    };
  }

  safeJsonParse(value) {
    if (!value) {
      return null;
    }

    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch (_error) {
      return null;
    }
  }
}

module.exports = new BacktestPromotionEventModel();
