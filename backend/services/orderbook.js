const binanceService = require("./binance");

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function sumLevels(levels = []) {
  return levels.reduce((total, [price, quantity]) => total + toNumber(price) * toNumber(quantity), 0);
}

function sumQuantities(levels = []) {
  return levels.reduce((total, [, quantity]) => total + toNumber(quantity), 0);
}

function calculateSpreadPercent(bestBid, bestAsk) {
  const bid = toNumber(bestBid);
  const ask = toNumber(bestAsk);

  if (bid <= 0 || ask <= 0) {
    return 100;
  }

  return ((ask - bid) / bid) * 100;
}

function analyzeRawOrderBook(orderBook = {}) {
  const bids = Array.isArray(orderBook.bids) ? orderBook.bids : [];
  const asks = Array.isArray(orderBook.asks) ? orderBook.asks : [];

  const bestBid = bids[0]?.[0] || 0;
  const bestAsk = asks[0]?.[0] || 0;
  const totalBidVolume = sumQuantities(bids);
  const totalAskVolume = sumQuantities(asks);
  const totalBidNotional = sumLevels(bids);
  const totalAskNotional = sumLevels(asks);
  const totalVolume = totalBidVolume + totalAskVolume;
  const buyPressureRatio = totalVolume === 0 ? 0.5 : totalBidVolume / totalVolume;
  const spreadPercent = calculateSpreadPercent(bestBid, bestAsk);
  const acceptableSpread = spreadPercent < 0.1;

  let directionalBias = "neutral";

  if (buyPressureRatio > 0.6) {
    directionalBias = "bullish";
  } else if (buyPressureRatio < 0.4) {
    directionalBias = "bearish";
  }

  return {
    bestBid: toNumber(bestBid),
    bestAsk: toNumber(bestAsk),
    spreadPercent,
    acceptableSpread,
    buyPressureRatio,
    totalBidVolume,
    totalAskVolume,
    totalBidNotional,
    totalAskNotional,
    directionalBias
  };
}

function evaluateOrderBookForSignal(orderBookAnalysis, signalSide) {
  const normalizedSide = String(signalSide || "").toUpperCase();
  const spreadAccepted = orderBookAnalysis.acceptableSpread;
  const confirmsSignal =
    (normalizedSide === "BUY" && orderBookAnalysis.directionalBias === "bullish") ||
    (normalizedSide === "SELL" && orderBookAnalysis.directionalBias === "bearish");

  return {
    spreadAccepted,
    confirmsSignal,
    signalSide: normalizedSide,
    reason: !spreadAccepted
      ? "Spread above 0.1%, market too illiquid."
      : confirmsSignal
        ? "Order book pressure confirms the signal."
        : "Order book pressure does not confirm the signal."
  };
}

async function getOrderBookSnapshot(symbol, limit = 20) {
  const rawOrderBook = await binanceService.getOrderBook(symbol, limit);
  const analysis = analyzeRawOrderBook(rawOrderBook);

  return {
    symbol: symbol.toUpperCase(),
    rawOrderBook,
    analysis
  };
}

async function getSignalAwareOrderBook(symbol, signalSide, limit = 20) {
  const snapshot = await getOrderBookSnapshot(symbol, limit);
  const evaluation = evaluateOrderBookForSignal(snapshot.analysis, signalSide);

  return {
    ...snapshot,
    evaluation
  };
}

module.exports = {
  analyzeRawOrderBook,
  calculateSpreadPercent,
  evaluateOrderBookForSignal,
  getOrderBookSnapshot,
  getSignalAwareOrderBook
};
