const db = require("./db");
const BacktestRunMarkModel = require("./BacktestRunMark");

class BacktestRunModel {
  async createBacktestRun(payload) {
    const result = await db.execute(
      `INSERT INTO backtest_runs (
        pair,
        timeframe,
        date_from,
        date_to,
        config,
        summary,
        result
      ) VALUES (
        :pair,
        :timeframe,
        :dateFrom,
        :dateTo,
        :config,
        :summary,
        :result
      )`,
      {
        pair: payload.pair,
        timeframe: payload.timeframe,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        config: JSON.stringify(payload.config || {}),
        summary: JSON.stringify(payload.summary || {}),
        result: JSON.stringify(payload.result || {})
      }
    );

    return this.getBacktestRunById(result.insertId);
  }

  async getBacktestRunById(id) {
    const rows = await db.query(`SELECT * FROM backtest_runs WHERE id = :id LIMIT 1`, { id });

    if (!rows[0]) {
      return null;
    }

    const run = this.mapRun(rows[0]);
    const mark = await BacktestRunMarkModel.getMarkByRunId(run.id);
    return {
      ...run,
      mark
    };
  }

  async listBacktestRuns({ pair, limit = 20 } = {}) {
    const conditions = [];
    const params = {};

    if (pair) {
      conditions.push("pair = :pair");
      params.pair = String(pair).toUpperCase();
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await db.query(
      `SELECT *
       FROM backtest_runs
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ${Number(limit)}`,
      params
    );
    const runs = rows.map((row) => this.mapRun(row));
    const markMap = await BacktestRunMarkModel.getMarksByRunIds(runs.map((run) => run.id));

    return runs.map((run) => ({
      ...run,
      mark: markMap.get(run.id) || null
    }));
  }

  mapRun(row) {
    return {
      ...row,
      config: this.safeJsonParse(row.config),
      summary: this.safeJsonParse(row.summary),
      result: this.safeJsonParse(row.result)
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

module.exports = new BacktestRunModel();
