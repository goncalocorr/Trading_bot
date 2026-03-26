const db = require("./db");

class OrderModel {
  async createOrder(payload) {
    const result = await db.execute(
      `INSERT INTO orders (
        trade_id,
        pair,
        role,
        side,
        order_type,
        exchange_order_id,
        exchange_order_list_id,
        exchange_client_order_id,
        quantity,
        price,
        stop_price,
        status,
        metadata,
        opened_at,
        closed_at
      ) VALUES (
        :tradeId,
        :pair,
        :role,
        :side,
        :orderType,
        :exchangeOrderId,
        :exchangeOrderListId,
        :exchangeClientOrderId,
        :quantity,
        :price,
        :stopPrice,
        :status,
        :metadata,
        :openedAt,
        :closedAt
      )`,
      {
        tradeId: payload.tradeId || null,
        pair: payload.pair,
        role: payload.role,
        side: payload.side,
        orderType: payload.orderType,
        exchangeOrderId: payload.exchangeOrderId || null,
        exchangeOrderListId: payload.exchangeOrderListId || null,
        exchangeClientOrderId: payload.exchangeClientOrderId || null,
        quantity: payload.quantity,
        price: payload.price || null,
        stopPrice: payload.stopPrice || null,
        status: payload.status || "pending",
        metadata: JSON.stringify(payload.metadata || {}),
        openedAt: payload.openedAt || new Date(),
        closedAt: payload.closedAt || null
      }
    );

    return this.getOrderById(result.insertId);
  }

  async getOrderById(id) {
    const rows = await db.query(`SELECT * FROM orders WHERE id = :id LIMIT 1`, { id });
    return rows[0] ? this.mapOrder(rows[0]) : null;
  }

  async getOrdersByTradeId(tradeId) {
    const rows = await db.query(
      `SELECT *
       FROM orders
       WHERE trade_id = :tradeId
       ORDER BY opened_at ASC, id ASC`,
      { tradeId }
    );

    return rows.map((row) => this.mapOrder(row));
  }

  async listOrders(filters = {}) {
    const conditions = [];
    const params = {};

    if (filters.tradeId) {
      conditions.push("trade_id = :tradeId");
      params.tradeId = filters.tradeId;
    }

    if (filters.pair) {
      conditions.push("pair = :pair");
      params.pair = String(filters.pair).toUpperCase();
    }

    if (filters.role) {
      conditions.push("role = :role");
      params.role = filters.role;
    }

    if (filters.status) {
      conditions.push("status = :status");
      params.status = filters.status;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Number(filters.limit || 100);
    const rows = await db.query(
      `SELECT *
       FROM orders
       ${whereClause}
       ORDER BY opened_at DESC, id DESC
       LIMIT ${limit}`,
      params
    );

    return rows.map((row) => this.mapOrder(row));
  }

  async updateOrder(id, payload) {
    await db.execute(
      `UPDATE orders
       SET
         trade_id = COALESCE(:tradeId, trade_id),
         exchange_order_id = COALESCE(:exchangeOrderId, exchange_order_id),
         exchange_order_list_id = COALESCE(:exchangeOrderListId, exchange_order_list_id),
         exchange_client_order_id = COALESCE(:exchangeClientOrderId, exchange_client_order_id),
         quantity = COALESCE(:quantity, quantity),
         price = COALESCE(:price, price),
         stop_price = COALESCE(:stopPrice, stop_price),
         status = COALESCE(:status, status),
         metadata = COALESCE(:metadata, metadata),
         closed_at = COALESCE(:closedAt, closed_at),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id,
        tradeId: payload.tradeId || null,
        exchangeOrderId: payload.exchangeOrderId || null,
        exchangeOrderListId: payload.exchangeOrderListId || null,
        exchangeClientOrderId: payload.exchangeClientOrderId || null,
        quantity: payload.quantity ?? null,
        price: payload.price ?? null,
        stopPrice: payload.stopPrice ?? null,
        status: payload.status || null,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
        closedAt: payload.closedAt || null
      }
    );

    return this.getOrderById(id);
  }

  mapOrder(row) {
    return {
      ...row,
      trade_id: row.trade_id === null ? null : Number(row.trade_id),
      exchange_order_id: row.exchange_order_id === null ? null : Number(row.exchange_order_id),
      exchange_order_list_id:
        row.exchange_order_list_id === null ? null : Number(row.exchange_order_list_id),
      quantity: Number(row.quantity),
      price: row.price === null ? null : Number(row.price),
      stop_price: row.stop_price === null ? null : Number(row.stop_price),
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

module.exports = new OrderModel();
