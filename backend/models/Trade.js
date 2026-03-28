const db = require("./db");

class TradeModel {
  async createTrade(payload) {
    const result = await db.execute(
      `INSERT INTO trades (
        pair,
        side,
        order_type,
        exchange_order_id,
        exchange_client_order_id,
        oco_order_list_id,
        quantity,
        entry_price,
        stop_loss,
        take_profit,
        score_total,
        score_breakdown,
        indicators_snapshot,
        sentiment_snapshot,
        metadata,
        status,
        trigger_source,
        opened_at
      ) VALUES (
        :pair,
        :side,
        :orderType,
        :exchangeOrderId,
        :exchangeClientOrderId,
        :ocoOrderListId,
        :quantity,
        :entryPrice,
        :stopLoss,
        :takeProfit,
        :scoreTotal,
        :scoreBreakdown,
        :indicatorsSnapshot,
        :sentimentSnapshot,
        :metadata,
        :status,
        :triggerSource,
        :openedAt
      )`,
      {
        pair: payload.pair,
        side: payload.side,
        orderType: payload.orderType,
        exchangeOrderId: payload.exchangeOrderId || null,
        exchangeClientOrderId: payload.exchangeClientOrderId || null,
        ocoOrderListId: payload.ocoOrderListId || null,
        quantity: payload.quantity,
        entryPrice: payload.entryPrice,
        stopLoss: payload.stopLoss,
        takeProfit: payload.takeProfit,
        scoreTotal: payload.scoreTotal,
        scoreBreakdown: JSON.stringify(payload.scoreBreakdown || {}),
        indicatorsSnapshot: JSON.stringify(payload.indicatorsSnapshot || {}),
        sentimentSnapshot: JSON.stringify(payload.sentimentSnapshot || {}),
        metadata: JSON.stringify(payload.metadata || {}),
        status: payload.status || "open",
        triggerSource: payload.triggerSource,
        openedAt: payload.openedAt || new Date()
      }
    );

    return this.getTradeById(result.insertId);
  }

  async getTradeById(id) {
    const rows = await db.query(`SELECT * FROM trades WHERE id = :id LIMIT 1`, { id });
    return rows[0] ? this.mapTrade(rows[0]) : null;
  }

  async listTrades(filters = {}) {
    const conditions = [];
    const params = {};

    if (filters.pair) {
      conditions.push("pair = :pair");
      params.pair = String(filters.pair).toUpperCase();
    }

    if (filters.side) {
      conditions.push("side = :side");
      params.side = String(filters.side).toUpperCase();
    }

    if (filters.status) {
      conditions.push("status = :status");
      params.status = filters.status;
    }

    if (filters.dateFrom) {
      conditions.push("opened_at >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("opened_at <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.limit = Math.max(1, Math.min(1000, Number(filters.limit || 100)));

    const rows = await db.query(
      `SELECT *
       FROM trades
       ${whereClause}
       ORDER BY opened_at DESC, id DESC
       LIMIT :limit`,
      params
    );

    return rows.map((row) => this.mapTrade(row));
  }

  async getOpenTrades() {
    const rows = await db.query(
      `SELECT *
       FROM trades
       WHERE status = 'open'
       ORDER BY opened_at DESC, id DESC`
    );

    return rows.map((row) => this.mapTrade(row));
  }

  async updateTradeClosure(id, payload) {
    await db.execute(
      `UPDATE trades
       SET
         exit_price = :exitPrice,
         status = :status,
         result_pnl = :resultPnl,
         result_percent = :resultPercent,
         closed_at = :closedAt,
         duration_seconds = :durationSeconds,
         cancel_reason = :cancelReason,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id,
        exitPrice: payload.exitPrice,
        status: payload.status,
        resultPnl: payload.resultPnl,
        resultPercent: payload.resultPercent,
        closedAt: payload.closedAt || new Date(),
        durationSeconds: payload.durationSeconds || null,
        cancelReason: payload.cancelReason || null
      }
    );

    return this.getTradeById(id);
  }

  async updateTradeProtection(id, payload) {
    await db.execute(
      `UPDATE trades
       SET
         stop_loss = :stopLoss,
         take_profit = :takeProfit,
         oco_order_list_id = :ocoOrderListId,
         metadata = :metadata,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id,
        stopLoss: payload.stopLoss,
        takeProfit: payload.takeProfit,
        ocoOrderListId: payload.ocoOrderListId || null,
        metadata: JSON.stringify(payload.metadata || {})
      }
    );

    return this.getTradeById(id);
  }

  async createMissedOpportunity(payload) {
    const result = await db.execute(
      `INSERT INTO missed_opportunities (
        pair,
        timestamp,
        score,
        reason,
        indicators_snapshot
      ) VALUES (
        :pair,
        :timestamp,
        :score,
        :reason,
        :indicatorsSnapshot
      )`,
      {
        pair: payload.pair,
        timestamp: payload.timestamp || new Date(),
        score: payload.score,
        reason: (payload.reason || '').slice(0, 255),
        indicatorsSnapshot: JSON.stringify(payload.indicatorsSnapshot || {})
      }
    );

    return result.insertId;
  }

  mapTrade(row) {
    return {
      ...row,
      exchange_order_id: row.exchange_order_id === null ? null : Number(row.exchange_order_id),
      oco_order_list_id: row.oco_order_list_id === null ? null : Number(row.oco_order_list_id),
      quantity: Number(row.quantity),
      entry_price: Number(row.entry_price),
      exit_price: row.exit_price === null ? null : Number(row.exit_price),
      stop_loss: Number(row.stop_loss),
      take_profit: Number(row.take_profit),
      score_total: Number(row.score_total),
      result_pnl: row.result_pnl === null ? null : Number(row.result_pnl),
      result_percent: row.result_percent === null ? null : Number(row.result_percent),
      score_breakdown: this.safeJsonParse(row.score_breakdown),
      indicators_snapshot: this.safeJsonParse(row.indicators_snapshot),
      sentiment_snapshot: this.safeJsonParse(row.sentiment_snapshot),
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

module.exports = new TradeModel();
