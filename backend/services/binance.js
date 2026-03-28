const crypto = require("crypto");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const DEFAULT_TESTNET_BASE_URL = "https://testnet.binance.vision";
const DEFAULT_LIVE_BASE_URL = "https://api.binance.com";
const DEFAULT_RECV_WINDOW = 5000;
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_DEPTH_LIMIT = 20;
const DEFAULT_CANDLE_LIMIT = 250;
const MAX_KLINES_PER_REQUEST = 1000;

const EXCHANGE_FILTER_KEYS = {
  LOT_SIZE: "LOT_SIZE",
  MARKET_LOT_SIZE: "MARKET_LOT_SIZE",
  PRICE_FILTER: "PRICE_FILTER",
  MIN_NOTIONAL: "MIN_NOTIONAL",
  NOTIONAL: "NOTIONAL"
};

class BinanceService {
  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || "";
    this.apiSecret = process.env.BINANCE_SECRET || "";
    this.isTestnet = String(process.env.BINANCE_TESTNET || "true").toLowerCase() === "true";
    this.baseURL = this.isTestnet
      ? process.env.BINANCE_TESTNET_BASE_URL || DEFAULT_TESTNET_BASE_URL
      : process.env.BINANCE_BASE_URL || DEFAULT_LIVE_BASE_URL;
    this.recvWindow = Number(process.env.BINANCE_RECV_WINDOW || DEFAULT_RECV_WINDOW);
    this.symbolInfoCache = new Map();
    this.timeOffsetMs = 0;

    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        "X-MBX-APIKEY": this.apiKey
      }
    });
  }

  validateCredentials() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Binance API credentials are missing. Check BINANCE_API_KEY and BINANCE_SECRET.");
    }
  }

  buildQueryString(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      query.append(key, String(value));
    });

    return query.toString();
  }

  sign(queryString) {
    return crypto.createHmac("sha256", this.apiSecret).update(queryString).digest("hex");
  }

  async syncServerTime() {
    if (this._syncingTime) return { serverTime: 0, timeOffsetMs: this.timeOffsetMs };
    this._syncingTime = true;
    try {
      const response = await this.http.request({
        method: "GET",
        url: "/api/v3/time"
      });
      const serverTime = Number(response.data?.serverTime || 0);

      if (Number.isFinite(serverTime) && serverTime > 0) {
        this.timeOffsetMs = serverTime - Date.now();
      }

      return {
        serverTime,
        timeOffsetMs: this.timeOffsetMs
      };
    } finally {
      this._syncingTime = false;
    }
  }

  getAdjustedTimestamp() {
    return Date.now() + this.timeOffsetMs;
  }

  isTimestampDriftError(error) {
    return Number(error?.code) === -1021 || String(error?.message || "").toLowerCase().includes("timestamp");
  }

  isRateLimitError(error) {
    return Number(error?.status) === 429 || Number(error?.status) === 418;
  }

  isRetryableError(error) {
    const status = Number(error?.status || 0);
    const message = String(error?.message || "").toLowerCase();
    return (
      this.isRateLimitError(error) ||
      status === 502 ||
      status === 503 ||
      message.includes("no response received") ||
      message.includes("timeout") ||
      message.includes("econnreset")
    );
  }

  async request({ method = "GET", url, params = {}, signed = false, data }) {
    const maxRetries = 3;

    const attemptRequest = async () => {
      const finalParams = { ...params };

      if (signed) {
        this.validateCredentials();
        finalParams.timestamp = this.getAdjustedTimestamp();
        finalParams.recvWindow = this.recvWindow;
      }

      const queryString = this.buildQueryString(finalParams);
      const signature = signed ? this.sign(queryString) : null;
      const requestUrl = signature ? `${url}?${queryString}&signature=${signature}` : queryString ? `${url}?${queryString}` : url;

      const response = await this.http.request({
        method,
        url: requestUrl,
        data
      });

      return response.data;
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await attemptRequest();
      } catch (error) {
        const formattedError = this.formatRequestError(error);

        if (signed && this.isTimestampDriftError(formattedError)) {
          try {
            await this.syncServerTime();
            return await attemptRequest();
          } catch (retryError) {
            throw this.formatRequestError(retryError);
          }
        }

        if (attempt < maxRetries && this.isRetryableError(formattedError)) {
          const retryAfter = this.isRateLimitError(formattedError)
            ? Math.min(30000, 2000 * Math.pow(2, attempt))
            : 1000 * attempt;
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          continue;
        }

        throw formattedError;
      }
    }
  }

  formatRequestError(error) {
    if (error.response) {
      const { status, data, config } = error.response;
      const exchangeMessage = data?.msg || data?.message || "Unknown Binance error";
      const formattedError = new Error(`Binance request failed (${status}): ${exchangeMessage}`);
      formattedError.status = status;
      formattedError.code = data?.code;
      formattedError.details = data;
      formattedError.endpoint = config?.url;
      return formattedError;
    }

    if (error.request) {
      return new Error("Binance request failed: no response received from exchange.");
    }

    return error;
  }

  async ping() {
    await this.request({ url: "/api/v3/ping" });
    return true;
  }

  async getServerTime() {
    return this.request({ url: "/api/v3/time" });
  }

  async getExchangeInfo(symbol) {
    const params = symbol ? { symbol: symbol.toUpperCase() } : {};
    return this.request({ url: "/api/v3/exchangeInfo", params });
  }

  async getSymbolInfo(symbol, { forceRefresh = false } = {}) {
    const normalizedSymbol = symbol.toUpperCase();

    if (!forceRefresh && this.symbolInfoCache.has(normalizedSymbol)) {
      return this.symbolInfoCache.get(normalizedSymbol);
    }

    const exchangeInfo = await this.getExchangeInfo(normalizedSymbol);
    const symbolInfo = exchangeInfo?.symbols?.find((item) => item.symbol === normalizedSymbol);

    if (!symbolInfo) {
      throw new Error(`Binance symbol not found: ${normalizedSymbol}`);
    }

    this.symbolInfoCache.set(normalizedSymbol, symbolInfo);
    return symbolInfo;
  }

  async getAccountInfo() {
    return this.request({
      url: "/api/v3/account",
      signed: true
    });
  }

  async getBalances() {
    const account = await this.getAccountInfo();
    return account.balances || [];
  }

  async getAssetBalance(asset) {
    const normalizedAsset = asset.toUpperCase();
    const balances = await this.getBalances();
    return balances.find((balance) => balance.asset === normalizedAsset) || null;
  }

  async getSymbolPrice(symbol) {
    return this.request({
      url: "/api/v3/ticker/price",
      params: { symbol: symbol.toUpperCase() }
    });
  }

  async getBestBookTicker(symbol) {
    return this.request({
      url: "/api/v3/ticker/bookTicker",
      params: { symbol: symbol.toUpperCase() }
    });
  }

  async get24hrTicker(symbol) {
    return this.request({
      url: "/api/v3/ticker/24hr",
      params: { symbol: symbol.toUpperCase() }
    });
  }

  async getOrderBook(symbol, limit = DEFAULT_DEPTH_LIMIT) {
    return this.request({
      url: "/api/v3/depth",
      params: {
        symbol: symbol.toUpperCase(),
        limit
      }
    });
  }

  async getCandles(symbol, interval = "15m", options = {}) {
    const params = {
      symbol: symbol.toUpperCase(),
      interval,
      limit: options.limit || DEFAULT_CANDLE_LIMIT
    };

    if (options.startTime) {
      params.startTime = options.startTime;
    }

    if (options.endTime) {
      params.endTime = options.endTime;
    }

    const candles = await this.request({
      url: "/api/v3/klines",
      params
    });

    return candles.map((candle) => this.normalizeCandle(candle));
  }

  async getAllCandles(symbol, interval = "15m", options = {}) {
    const normalizedSymbol = symbol.toUpperCase();
    const startTime = Number(options.startTime || 0);
    const endTime = Number(options.endTime || 0);
    const limitPerRequest = Math.min(Number(options.limitPerRequest || MAX_KLINES_PER_REQUEST), MAX_KLINES_PER_REQUEST);
    const maxIterations = Number(options.maxIterations || 5000);
    const allCandles = [];
    let nextStartTime = startTime;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      // eslint-disable-next-line no-await-in-loop
      const batch = await this.getCandles(normalizedSymbol, interval, {
        startTime: nextStartTime || undefined,
        endTime: endTime || undefined,
        limit: limitPerRequest
      });

      if (batch.length === 0) {
        break;
      }

      allCandles.push(...batch);

      if (batch.length < limitPerRequest) {
        break;
      }

      const lastCloseTime = Number(batch[batch.length - 1].closeTime);

      if (!Number.isFinite(lastCloseTime) || (endTime && lastCloseTime >= endTime)) {
        break;
      }

      nextStartTime = lastCloseTime + 1;
    }

    return allCandles;
  }

  async getMultiTimeframeCandles(symbol, timeframes = ["5m", "15m", "1h", "4h"], options = {}) {
    const entries = await Promise.all(
      timeframes.map(async (interval) => {
        const candles = await this.getCandles(symbol, interval, options);
        return [interval, candles];
      })
    );

    return Object.fromEntries(entries);
  }

  normalizeCandle(rawCandle) {
    return {
      openTime: Number(rawCandle[0]),
      open: Number(rawCandle[1]),
      high: Number(rawCandle[2]),
      low: Number(rawCandle[3]),
      close: Number(rawCandle[4]),
      volume: Number(rawCandle[5]),
      closeTime: Number(rawCandle[6]),
      quoteAssetVolume: Number(rawCandle[7]),
      tradeCount: Number(rawCandle[8]),
      takerBuyBaseVolume: Number(rawCandle[9]),
      takerBuyQuoteVolume: Number(rawCandle[10]),
      ignore: Number(rawCandle[11] || 0)
    };
  }

  async getOpenOrders(symbol) {
    const params = symbol ? { symbol: symbol.toUpperCase() } : {};

    return this.request({
      url: "/api/v3/openOrders",
      params,
      signed: true
    });
  }

  async getOrder(symbol, orderId) {
    return this.request({
      url: "/api/v3/order",
      params: {
        symbol: symbol.toUpperCase(),
        orderId
      },
      signed: true
    });
  }

  async getMyTrades(symbol, options = {}) {
    return this.request({
      url: "/api/v3/myTrades",
      params: {
        symbol: symbol.toUpperCase(),
        limit: options.limit || 50,
        startTime: options.startTime,
        endTime: options.endTime,
        fromId: options.fromId
      },
      signed: true
    });
  }

  async cancelOrder(symbol, orderId) {
    return this.request({
      method: "DELETE",
      url: "/api/v3/order",
      params: {
        symbol: symbol.toUpperCase(),
        orderId
      },
      signed: true
    });
  }

  async cancelAllOpenOrders(symbol) {
    return this.request({
      method: "DELETE",
      url: "/api/v3/openOrders",
      params: {
        symbol: symbol.toUpperCase()
      },
      signed: true
    });
  }

  async cancelOrderList(symbol, orderListId) {
    return this.request({
      method: "DELETE",
      url: "/api/v3/orderList",
      params: {
        symbol: symbol.toUpperCase(),
        orderListId
      },
      signed: true
    });
  }

  extractFilters(symbolInfo) {
    const filters = Object.fromEntries((symbolInfo.filters || []).map((filter) => [filter.filterType, filter]));

    return {
      lotSize: filters[EXCHANGE_FILTER_KEYS.LOT_SIZE] || null,
      marketLotSize: filters[EXCHANGE_FILTER_KEYS.MARKET_LOT_SIZE] || null,
      priceFilter: filters[EXCHANGE_FILTER_KEYS.PRICE_FILTER] || null,
      minNotional: filters[EXCHANGE_FILTER_KEYS.MIN_NOTIONAL] || filters[EXCHANGE_FILTER_KEYS.NOTIONAL] || null
    };
  }

  getPrecisionFromStep(step) {
    if (!step) {
      return 8;
    }

    const stepAsString = String(step);

    if (!stepAsString.includes(".")) {
      return 0;
    }

    return stepAsString.replace(/0+$/, "").split(".")[1]?.length || 0;
  }

  floorToStep(value, step) {
    const numericValue = Number(value);
    const numericStep = Number(step);

    if (!Number.isFinite(numericValue) || !Number.isFinite(numericStep) || numericStep <= 0) {
      return numericValue;
    }

    const precision = this.getPrecisionFromStep(step);
    const floored = Math.floor(numericValue / numericStep) * numericStep;

    return Number(floored.toFixed(precision));
  }

  async normalizeQuantity(symbol, quantity, { market = false } = {}) {
    const symbolInfo = await this.getSymbolInfo(symbol);
    const filters = this.extractFilters(symbolInfo);
    const sizeFilter = market && filters.marketLotSize ? filters.marketLotSize : filters.lotSize;

    if (!sizeFilter) {
      return Number(quantity);
    }

    const normalizedQuantity = this.floorToStep(quantity, sizeFilter.stepSize);

    if (Number(normalizedQuantity) < Number(sizeFilter.minQty)) {
      throw new Error(
        `Quantity ${normalizedQuantity} is below the minimum allowed quantity ${sizeFilter.minQty} for ${symbol.toUpperCase()}.`
      );
    }

    if (Number(normalizedQuantity) > Number(sizeFilter.maxQty)) {
      throw new Error(
        `Quantity ${normalizedQuantity} is above the maximum allowed quantity ${sizeFilter.maxQty} for ${symbol.toUpperCase()}.`
      );
    }

    return normalizedQuantity;
  }

  async normalizePrice(symbol, price) {
    const symbolInfo = await this.getSymbolInfo(symbol);
    const filters = this.extractFilters(symbolInfo);

    if (!filters.priceFilter) {
      return Number(price);
    }

    const normalizedPrice = this.floorToStep(price, filters.priceFilter.tickSize);

    if (Number(normalizedPrice) < Number(filters.priceFilter.minPrice)) {
      throw new Error(
        `Price ${normalizedPrice} is below the minimum allowed price ${filters.priceFilter.minPrice} for ${symbol.toUpperCase()}.`
      );
    }

    if (Number(normalizedPrice) > Number(filters.priceFilter.maxPrice)) {
      throw new Error(
        `Price ${normalizedPrice} is above the maximum allowed price ${filters.priceFilter.maxPrice} for ${symbol.toUpperCase()}.`
      );
    }

    return normalizedPrice;
  }

  async ensureMinNotional(symbol, quantity, referencePrice) {
    const symbolInfo = await this.getSymbolInfo(symbol);
    const filters = this.extractFilters(symbolInfo);

    if (!filters.minNotional) {
      return true;
    }

    const notional = Number(quantity) * Number(referencePrice);
    const minNotionalValue = Number(filters.minNotional.minNotional || filters.minNotional.notional || 0);

    if (notional < minNotionalValue) {
      throw new Error(
        `Order notional ${notional.toFixed(8)} is below Binance minimum notional ${minNotionalValue} for ${symbol.toUpperCase()}.`
      );
    }

    return true;
  }

  async createOrder(params) {
    return this.request({
      method: "POST",
      url: "/api/v3/order",
      params,
      signed: true
    });
  }

  async placeMarketOrder({ symbol, side, quantity, quoteOrderQty, newClientOrderId }) {
    const normalizedSymbol = symbol.toUpperCase();
    const normalizedSide = side.toUpperCase();
    const payload = {
      symbol: normalizedSymbol,
      side: normalizedSide,
      type: "MARKET",
      newOrderRespType: "FULL"
    };

    if (newClientOrderId) {
      payload.newClientOrderId = newClientOrderId;
    }

    if (quoteOrderQty) {
      payload.quoteOrderQty = Number(quoteOrderQty);
    } else {
      const normalizedQuantity = await this.normalizeQuantity(normalizedSymbol, quantity, { market: true });
      payload.quantity = normalizedQuantity;
    }

    return this.createOrder(payload);
  }

  async placeLimitOrder({ symbol, side, quantity, price, timeInForce = "GTC", newClientOrderId }) {
    const normalizedSymbol = symbol.toUpperCase();
    const normalizedSide = side.toUpperCase();
    const normalizedPrice = await this.normalizePrice(normalizedSymbol, price);
    const normalizedQuantity = await this.normalizeQuantity(normalizedSymbol, quantity);

    await this.ensureMinNotional(normalizedSymbol, normalizedQuantity, normalizedPrice);

    const payload = {
      symbol: normalizedSymbol,
      side: normalizedSide,
      type: "LIMIT",
      timeInForce,
      quantity: normalizedQuantity,
      price: normalizedPrice,
      newOrderRespType: "FULL"
    };

    if (newClientOrderId) {
      payload.newClientOrderId = newClientOrderId;
    }

    return this.createOrder(payload);
  }

  async placeOcoOrder({
    symbol,
    side,
    quantity,
    price,
    stopPrice,
    stopLimitPrice,
    stopLimitTimeInForce = "GTC",
    listClientOrderId,
    limitClientOrderId,
    stopClientOrderId
  }) {
    const normalizedSymbol = symbol.toUpperCase();
    const normalizedSide = side.toUpperCase();
    const normalizedQuantity = await this.normalizeQuantity(normalizedSymbol, quantity);
    const normalizedPrice = await this.normalizePrice(normalizedSymbol, price);
    const normalizedStopPrice = await this.normalizePrice(normalizedSymbol, stopPrice);
    const normalizedStopLimitPrice = await this.normalizePrice(
      normalizedSymbol,
      stopLimitPrice || stopPrice
    );

    await this.ensureMinNotional(normalizedSymbol, normalizedQuantity, normalizedPrice);

    const payload = {
      symbol: normalizedSymbol,
      side: normalizedSide,
      quantity: normalizedQuantity,
      price: normalizedPrice,
      stopPrice: normalizedStopPrice,
      stopLimitPrice: normalizedStopLimitPrice,
      stopLimitTimeInForce
    };

    if (listClientOrderId) {
      payload.listClientOrderId = listClientOrderId;
    }

    if (limitClientOrderId) {
      payload.limitClientOrderId = limitClientOrderId;
    }

    if (stopClientOrderId) {
      payload.stopClientOrderId = stopClientOrderId;
    }

    return this.request({
      method: "POST",
      url: "/api/v3/order/oco",
      params: payload,
      signed: true
    });
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

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return this.getOrder(symbol, orderId);
  }

  getExecutionMode(score) {
    if (score >= 9) {
      return "MARKET";
    }

    if (score >= 7) {
      return "LIMIT";
    }

    return "SKIP";
  }

  isTradableSpotSymbol(symbolInfo) {
    return (
      Boolean(symbolInfo?.isSpotTradingAllowed) &&
      symbolInfo?.status === "TRADING" &&
      Array.isArray(symbolInfo?.permissions) &&
      symbolInfo.permissions.includes("SPOT")
    );
  }
}

module.exports = new BinanceService();
