const db = require("./db");

class BacktestRunMarkModel {
  async getMarkByRunId(runId) {
    const rows = await db.query(`SELECT * FROM backtest_run_marks WHERE run_id = :runId LIMIT 1`, { runId });
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async getMarksByRunIds(runIds = []) {
    const normalized = [...new Set(runIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];

    if (normalized.length === 0) {
      return new Map();
    }

    const rows = await db.query(
      `SELECT * FROM backtest_run_marks WHERE run_id IN (${normalized.join(",")})`
    );

    return new Map(rows.map((row) => [Number(row.run_id), this.mapRow(row)]));
  }

  async upsertMark(runId, payload = {}) {
    await db.execute(
      `INSERT INTO backtest_run_marks (
        run_id,
        is_favorite,
        favorite_label,
        promoted_to_paper,
        promoted_at,
        notes
      ) VALUES (
        :runId,
        :isFavorite,
        :favoriteLabel,
        :promotedToPaper,
        :promotedAt,
        :notes
      )
      ON DUPLICATE KEY UPDATE
        is_favorite = VALUES(is_favorite),
        favorite_label = VALUES(favorite_label),
        promoted_to_paper = VALUES(promoted_to_paper),
        promoted_at = VALUES(promoted_at),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP`,
      {
        runId,
        isFavorite: payload.isFavorite ? 1 : 0,
        favoriteLabel: payload.favoriteLabel || null,
        promotedToPaper: payload.promotedToPaper ? 1 : 0,
        promotedAt: payload.promotedAt || null,
        notes: payload.notes || null
      }
    );

    return this.getMarkByRunId(runId);
  }

  mapRow(row) {
    return {
      ...row,
      run_id: Number(row.run_id),
      is_favorite: Boolean(row.is_favorite),
      promoted_to_paper: Boolean(row.promoted_to_paper)
    };
  }
}

module.exports = new BacktestRunMarkModel();
