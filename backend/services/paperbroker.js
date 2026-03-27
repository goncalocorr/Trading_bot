const fs = require("fs");
const path = require("path");

const binanceService = require("./binance");
const RuntimeStateModel = require("../models/RuntimeState");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simulated fee rate (Binance spot taker = 0.1%). Applied to market order
// execution prices so paper PnL reflects real trading costs.
const PAPER_FEE_RATE = Number(process.env.PAPER_FEE_RATE || process.env.BACKTEST_FEE_RATE || 0.001);

const STATE_KEY = "paper_broker_state";
// Legacy JSON path kept for one-time migration only.
const PAPER_STATE_DIR = path.join(__dirname, "..", "data");
const PAPER_STATE_PATH = path.join(PAPER_STATE_DIR, "paper-broker-state.json");

class PaperBroker {
  constructor() {
    this.nextOrderId = Date.now();
    this.nextOrderListId = Date.now();
    this.orders = new Map();
    this.orderLists = new Map();
    this.tradeHistory = [];
    // Promise-based singleton: concurrent calls to init() share the same promise
    // instead of racing through the _initialized flag check.
    this._initPromise = null;
  }

  /**
   * Must be called once after the database is ready (called from startServer).
   * Loads state from MySQL, falling back to the legacy JSON file for migration.
   * Safe to call multiple times — subsequent calls return the same promise.
   */
  async init() {
    if (!this._initPromise) {
      this._initPromise = this._doInit();
    }

    return this._initPromise;
  }

  async _doInit() {
    try {
      const saved = await RuntimeStateModel.getValue(STATE_KEY);

      if (saved) {
        this._applyState(saved);
      } else {
        // One-time migration: try to load from legacy JSON file.
        this._tryLoadLegacyJson();
        if (this._hasAnyState()) {
          await this._persistAsync();
        }
      }
    } catch (error) {
      console.warn(`Paper broker MySQL init failed, falling back to JSON: ${error.message}`);
      this._tryLoadLegacyJson();
    }
  }

  _hasAnyState() {
    return this.orders.size > 0 || this.orderLists.size > 0 || this.tradeHistory.length > 0;
  }

  _applyState(parsedState) {
    this.nextOrderId = Number(parsedState.nextOrderId || this.nextOrderId);
    this.nextOrderListId = Number(parsedState.nextOrderListId || this.nextOrderListId);
    this.orders = new Map(
      (Array.isArray(parsedState.orders) ? parsedState.orders : []).map((order) => [Number(order.orderId), order])
    );
    this.orderLists = new Map(
      (Array.isArray(parsedState.orderLists) ? parsedState.orderLists : []).map((orderList) => [
        Number(orderList.orderListId),
        orderList
      ])
    );
    this.tradeHistory = Array.isArray(parsedState.tradeHistory) ? parsedState.tradeHistory : [];
  }

  _tryLoadLegacyJson() {
    try {
      if (!fs.existsSync(PAPER_STATE_PATH)) {
        return;
      }

      const rawState = fs.readFileSync(PAPER_STATE_PATH, "utf8");
      const parsedState = JSON.parse(rawState);
      this._applyState(parsedState);
    } catch (error) {
      console.warn(`Paper broker legacy JSON state could not be restored: ${error.message}`);
    }
  }

  async _persistAsync() {
    try {
      await RuntimeStateModel.setValue(STATE_KEY, this.serializeState());
    } catch (error) {
      console.warn(`Paper broker MySQL persist failed: ${error.message}`);
    }
  }

  generateOrderId() {
    this.nextOrderId += 1;
    return this.nextOrderId;
  }

  generateOrderListId() {
    this.nextOrderListId += 1;
    return this.nextOrderListId;
  }

  serializeState() {
    return {
      nextOrderId: this.nextOrderId,
      nextOrderListId: this.nextOrderListId,
      orders: [...this.orders.values()],
      orderLists: [...this.orderLists.values()],
      tradeHistory: this.tradeHistory
    };
  }

  persistState() {
    // Fire-and-forget async persist to MySQL. In-memory state is always authoritative.
    this._persistAsync();
  }

  async getBestBookTicker(symbol) {
    await this.syncSymbol(symbol);
    return binanceService.getBestBookTicker(symbol);
  }

  async getSymbolPrice(symbol) {
    await this.syncSymbol(symbol);
    return binanceService.getSymbolPrice(symbol);
  }

  async getOpenOrders(symbol) {
    await this.syncSymbol(symbol);
    const normalizedSymbol = symbol ? symbol.toUpperCase() : null;
    const regularOrders = [...this.orders.values()].filter((order) => {
      const openStatus = ["NEW", "PARTIALLY_FILLED"].includes(order.status);
      const symbolMatches = normalizedSymbol ? order.symbol === normalizedSymbol : true;
      return openStatus && symbolMatches;
    });
    const ocoOrders = [...this.orderLists.values()].filter((orderList) => {
      const symbolMatches = normalizedSymbol ? orderList.symbol === normalizedSymbol : true;
      return orderList.status === "EXECUTING" && symbolMatches;
    });

    return [
      ...regularOrders.map((order) => ({ ...order })),
      ...ocoOrders.map((orderList) => ({
        symbol: orderList.symbol,
        orderListId: orderList.orderListId,
        contingencyType: "OCO",
        side: orderList.side,
        price: String(orderList.price),
        stopPrice: String(orderList.stopPrice),
        origQty: String(orderList.origQty),
        executedQty: "0.00000000",
        status: orderList.status,
        type: "OCO",
        transactTime: orderList.transactTime
      }))
    ];
  }

  async getOrder(symbol, orderId) {
    await this.syncSymbol(symbol);
    const order = this.orders.get(Number(orderId));

    if (!order || order.symbol !== String(symbol).toUpperCase()) {
      throw new Error(`Paper order not found: ${orderId}`);
    }

    return { ...order };
  }

  async getMyTrades(symbol, options = {}) {
    await this.syncSymbol(symbol);
    const normalizedSymbol = String(symbol).toUpperCase();

    return this.tradeHistory.filter((trade) => {
      if (trade.symbol !== normalizedSymbol) {
        return false;
      }

      if (options.startTime && Number(trade.time) < Number(options.startTime)) {
        return false;
      }

      if (options.endTime && Number(trade.time) > Number(options.endTime)) {
        return false;
      }

      return true;
    });
  }

  async placeMarketOrder({ symbol, side, quantity, newClientOrderId }) {
    const normalizedSymbol = String(symbol).toUpperCase();
    const normalizedSide = String(side).toUpperCase();
    const ticker = await binanceService.getBestBookTicker(normalizedSymbol);
    // Apply fee as price adjustment so PnL already reflects trading costs:
    // BUY pays slightly more (ask × (1 + fee)), SELL receives slightly less (bid × (1 - fee))
    const rawPrice =
      normalizedSide === "BUY" ? Number(ticker.askPrice || ticker.bidPrice) : Number(ticker.bidPrice || ticker.askPrice);
    const executionPrice = normalizedSide === "BUY" ? rawPrice * (1 + PAPER_FEE_RATE) : rawPrice * (1 - PAPER_FEE_RATE);
    const orderId = this.generateOrderId();
    const order = {
      symbol: normalizedSymbol,
      orderId,
      clientOrderId: newClientOrderId || `paper-market-${orderId}`,
      price: String(executionPrice),
      origQty: String(quantity),
      executedQty: String(quantity),
      cummulativeQuoteQty: String(Number(quantity) * executionPrice),
      status: "FILLED",
      timeInForce: "GTC",
      type: "MARKET",
      side: normalizedSide,
      transactTime: Date.now(),
      fills: [
        {
          price: String(executionPrice),
          qty: String(quantity),
          commission: String(Number(quantity) * Number(executionPrice || price || 0) * PAPER_FEE_RATE),
          commissionAsset: "USDT"
        }
      ]
    };

    this.orders.set(orderId, order);
    this.recordTradeFill(order, executionPrice, quantity);
    this.persistState();

    return { ...order };
  }

  async placeLimitOrder({ symbol, side, quantity, price, timeInForce = "GTC", newClientOrderId }) {
    const normalizedSymbol = String(symbol).toUpperCase();
    const normalizedSide = String(side).toUpperCase();
    const orderId = this.generateOrderId();
    const order = {
      symbol: normalizedSymbol,
      orderId,
      clientOrderId: newClientOrderId || `paper-limit-${orderId}`,
      price: String(price),
      origQty: String(quantity),
      executedQty: "0",
      cummulativeQuoteQty: "0",
      status: "NEW",
      timeInForce,
      type: "LIMIT",
      side: normalizedSide,
      transactTime: Date.now(),
      fills: []
    };

    this.orders.set(orderId, order);
    await this.tryFillLimitOrder(order);
    this.persistState();
    return { ...this.orders.get(orderId) };
  }

  async placeOcoOrder({
    symbol,
    side,
    quantity,
    price,
    stopPrice,
    stopLimitPrice,
    listClientOrderId
  }) {
    const normalizedSymbol = String(symbol).toUpperCase();
    const normalizedSide = String(side).toUpperCase();
    const orderListId = this.generateOrderListId();
    const orderList = {
      symbol: normalizedSymbol,
      orderListId,
      listClientOrderId: listClientOrderId || `paper-oco-${orderListId}`,
      contingencyType: "OCO",
      side: normalizedSide,
      origQty: Number(quantity),
      price: Number(price),
      stopPrice: Number(stopPrice),
      stopLimitPrice: Number(stopLimitPrice || stopPrice),
      status: "EXECUTING",
      transactTime: Date.now()
    };

    this.orderLists.set(orderListId, orderList);
    this.persistState();
    return { ...orderList };
  }

  async cancelOrder(symbol, orderId) {
    const order = await this.getOrder(symbol, orderId);

    if (!["NEW", "PARTIALLY_FILLED"].includes(order.status)) {
      return order;
    }

    const updated = {
      ...order,
      status: "CANCELED"
    };
    this.orders.set(Number(orderId), updated);
    this.persistState();
    return { ...updated };
  }

  async cancelAllOpenOrders(symbol) {
    await this.syncSymbol(symbol);
    const normalizedSymbol = String(symbol).toUpperCase();
    const cancelled = [];

    for (const order of this.orders.values()) {
      if (order.symbol !== normalizedSymbol || !["NEW", "PARTIALLY_FILLED"].includes(order.status)) {
        continue;
      }

      const updated = {
        ...order,
        status: "CANCELED"
      };
      this.orders.set(order.orderId, updated);
      cancelled.push({ ...updated });
    }

    for (const orderList of this.orderLists.values()) {
      if (orderList.symbol !== normalizedSymbol || orderList.status !== "EXECUTING") {
        continue;
      }

      orderList.status = "ALL_DONE";
      cancelled.push({ ...orderList });
    }

    this.persistState();
    return cancelled;
  }

  async cancelOrderList(symbol, orderListId) {
    await this.syncSymbol(symbol);
    const orderList = this.orderLists.get(Number(orderListId));

    if (!orderList || orderList.symbol !== String(symbol).toUpperCase()) {
      throw new Error(`Paper OCO order list not found: ${orderListId}`);
    }

    orderList.status = "ALL_DONE";
    this.orderLists.set(Number(orderListId), orderList);
    this.persistState();
    return { ...orderList };
  }

  async closeSpotPositionAtMarket({ symbol, quantity, side = "SELL", newClientOrderId }) {
    return this.placeMarketOrder({
      symbol,
      side,
      quantity,
      newClientOrderId
    });
  }

  async waitForOrderFill(symbol, orderId, { timeoutMs = 300000, pollIntervalMs = 5000 } = {}) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const order = await this.getOrder(symbol, orderId);

      if (order.status === "FILLED") {
        return order;
      }

      if (["CANCELED", "REJECTED", "EXPIRED"].includes(order.status)) {
        return order;
      }

      await sleep(pollIntervalMs);
    }

    return this.getOrder(symbol, orderId);
  }

  async syncSymbol(symbol) {
    const normalizedSymbol = String(symbol).toUpperCase();
    const ticker = await binanceService.getBestBookTicker(normalizedSymbol);
    const bidPrice = Number(ticker.bidPrice || ticker.askPrice || 0);
    const askPrice = Number(ticker.askPrice || ticker.bidPrice || 0);

    for (const order of [...this.orders.values()]) {
      if (order.symbol !== normalizedSymbol || order.status !== "NEW" || order.type !== "LIMIT") {
        continue;
      }

      if (this.shouldFillLimitOrder(order, bidPrice, askPrice)) {
        this.fillOrder(order, Number(order.price), Number(order.origQty));
      }
    }

    for (const orderList of [...this.orderLists.values()]) {
      if (orderList.symbol !== normalizedSymbol || orderList.status !== "EXECUTING") {
        continue;
      }

      if (orderList.side === "SELL" && bidPrice >= orderList.price) {
        this.fillOrderList(orderList, orderList.price);
        continue;
      }

      if (orderList.side === "SELL" && bidPrice <= orderList.stopPrice) {
        this.fillOrderList(orderList, orderList.stopPrice);
      }
    }
  }

  shouldFillLimitOrder(order, bidPrice, askPrice) {
    const orderPrice = Number(order.price);

    if (order.side === "BUY") {
      return askPrice <= orderPrice;
    }

    return bidPrice >= orderPrice;
  }

  async tryFillLimitOrder(order) {
    const ticker = await binanceService.getBestBookTicker(order.symbol);
    const bidPrice = Number(ticker.bidPrice || ticker.askPrice || 0);
    const askPrice = Number(ticker.askPrice || ticker.bidPrice || 0);

    if (this.shouldFillLimitOrder(order, bidPrice, askPrice)) {
      this.fillOrder(order, Number(order.price), Number(order.origQty));
    }
  }

  fillOrder(order, executionPrice, quantity) {
    const updated = {
      ...order,
      status: "FILLED",
      executedQty: String(quantity),
      cummulativeQuoteQty: String(Number(quantity) * executionPrice),
      transactTime: Date.now(),
      fills: [
        {
          price: String(executionPrice),
          qty: String(quantity),
          commission: String(Number(quantity) * Number(executionPrice) * PAPER_FEE_RATE),
          commissionAsset: "USDT"
        }
      ]
    };

    this.orders.set(order.orderId, updated);
    this.recordTradeFill(updated, executionPrice, quantity);
    this.persistState();
  }

  fillOrderList(orderList, executionPrice) {
    orderList.status = "ALL_DONE";
    orderList.transactTime = Date.now();
    this.orderLists.set(orderList.orderListId, orderList);
    this.tradeHistory.push({
      symbol: orderList.symbol,
      id: this.generateOrderId(),
      orderId: orderList.orderListId,
      orderListId: orderList.orderListId,
      price: String(executionPrice),
      qty: String(orderList.origQty),
      quoteQty: String(orderList.origQty * executionPrice),
      commission: String(Number(orderList.origQty) * Number(executionPrice) * PAPER_FEE_RATE),
      commissionAsset: "USDT",
      time: orderList.transactTime,
      isBuyer: orderList.side === "BUY",
      isMaker: false,
      isBestMatch: true
    });
    this.persistState();
  }

  recordTradeFill(order, executionPrice, quantity) {
    this.tradeHistory.push({
      symbol: order.symbol,
      id: this.generateOrderId(),
      orderId: order.orderId,
      orderListId: -1,
      price: String(executionPrice),
      qty: String(quantity),
      quoteQty: String(Number(quantity) * executionPrice),
      commission: String(Number(quantity) * Number(executionPrice) * PAPER_FEE_RATE),
      commissionAsset: "USDT",
      time: order.transactTime,
      isBuyer: order.side === "BUY",
      isMaker: order.type === "LIMIT",
      isBestMatch: true
    });
  }
}

module.exports = new PaperBroker();
