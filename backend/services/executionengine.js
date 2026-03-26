const dotenv = require("dotenv");

const binanceService = require("./binance");
const paperBroker = require("./paperbroker");

dotenv.config();

const DEFAULT_TRADING_MODE = "paper";

class ExecutionEngine {
  getMode() {
    const mode = String(process.env.TRADING_MODE || DEFAULT_TRADING_MODE).toLowerCase();
    return mode === "live" ? "live" : "paper";
  }

  isPaperMode() {
    return this.getMode() === "paper";
  }

  getModeLabel() {
    return this.isPaperMode() ? "PAPER" : "LIVE";
  }

  getExecutionService() {
    return this.isPaperMode() ? paperBroker : binanceService;
  }

  async getBestBookTicker(symbol) {
    return this.getExecutionService().getBestBookTicker(symbol);
  }

  async getSymbolPrice(symbol) {
    return this.getExecutionService().getSymbolPrice(symbol);
  }

  async getOpenOrders(symbol) {
    return this.getExecutionService().getOpenOrders(symbol);
  }

  async getMyTrades(symbol, options = {}) {
    return this.getExecutionService().getMyTrades(symbol, options);
  }

  async placeMarketOrder(params) {
    return this.getExecutionService().placeMarketOrder(params);
  }

  async placeLimitOrder(params) {
    return this.getExecutionService().placeLimitOrder(params);
  }

  async placeOcoOrder(params) {
    return this.getExecutionService().placeOcoOrder(params);
  }

  async cancelOrder(symbol, orderId) {
    return this.getExecutionService().cancelOrder(symbol, orderId);
  }

  async cancelAllOpenOrders(symbol) {
    return this.getExecutionService().cancelAllOpenOrders(symbol);
  }

  async cancelOrderList(symbol, orderListId) {
    return this.getExecutionService().cancelOrderList(symbol, orderListId);
  }

  async closeSpotPositionAtMarket(params) {
    return this.getExecutionService().closeSpotPositionAtMarket(params);
  }

  async waitForOrderFill(symbol, orderId, options = {}) {
    return this.getExecutionService().waitForOrderFill(symbol, orderId, options);
  }
}

module.exports = new ExecutionEngine();
