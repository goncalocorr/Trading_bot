const db = require("./db");

class ReportModel {
  async createReport({ type, period, data }) {
    await db.execute(
      `INSERT INTO reports (type, period, data)
       VALUES (:type, :period, :data)
       ON DUPLICATE KEY UPDATE
         data = VALUES(data),
         created_at = CURRENT_TIMESTAMP`,
      {
        type,
        period,
        data: JSON.stringify(data || {})
      }
    );

    return this.getReportByPeriod(type, period);
  }

  async getReportByPeriod(type, period) {
    const rows = await db.query(
      `SELECT *
       FROM reports
       WHERE type = :type AND period = :period
       LIMIT 1`,
      {
        type,
        period
      }
    );

    return rows[0] ? this.mapReport(rows[0]) : null;
  }

  async listReports(type, limit = 20) {
    const params = type ? { type } : {};
    params.limit = Math.max(1, Math.min(1000, Number(limit || 20)));
    const rows = await db.query(
      `SELECT *
       FROM reports
       ${type ? "WHERE type = :type" : ""}
       ORDER BY created_at DESC, id DESC
       LIMIT :limit`,
      params
    );

    return rows.map((row) => this.mapReport(row));
  }

  mapReport(row) {
    return {
      ...row,
      data: this.safeJsonParse(row.data)
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

module.exports = new ReportModel();
