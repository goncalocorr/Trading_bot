const db = require("./db");

class RuntimeStateModel {
  async getValue(stateKey) {
    const rows = await db.query(
      `SELECT state_value
       FROM runtime_state
       WHERE state_key = :stateKey
       LIMIT 1`,
      { stateKey }
    );

    return rows[0] ? this.safeJsonParse(rows[0].state_value) : null;
  }

  async getMany(stateKeys = []) {
    if (!Array.isArray(stateKeys) || stateKeys.length === 0) {
      return {};
    }

    const placeholders = stateKeys.map((_, index) => `:key${index}`).join(", ");
    const params = stateKeys.reduce((accumulator, stateKey, index) => ({
      ...accumulator,
      [`key${index}`]: stateKey
    }), {});
    const rows = await db.query(
      `SELECT state_key, state_value
       FROM runtime_state
       WHERE state_key IN (${placeholders})`,
      params
    );

    return rows.reduce((accumulator, row) => ({
      ...accumulator,
      [row.state_key]: this.safeJsonParse(row.state_value)
    }), {});
  }

  async setValue(stateKey, stateValue) {
    await db.execute(
      `INSERT INTO runtime_state (state_key, state_value)
       VALUES (:stateKey, CAST(:stateValue AS JSON))
       ON DUPLICATE KEY UPDATE
         state_value = VALUES(state_value),
         updated_at = CURRENT_TIMESTAMP`,
      {
        stateKey,
        stateValue: JSON.stringify(stateValue ?? null)
      }
    );

    return this.getValue(stateKey);
  }

  async setMany(entries = {}) {
    const items = Object.entries(entries);

    for (const [stateKey, stateValue] of items) {
      // eslint-disable-next-line no-await-in-loop
      await this.setValue(stateKey, stateValue);
    }

    return this.getMany(items.map(([stateKey]) => stateKey));
  }

  safeJsonParse(value) {
    if (value === undefined || value === null) {
      return null;
    }

    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch (_error) {
      return null;
    }
  }
}

module.exports = new RuntimeStateModel();
