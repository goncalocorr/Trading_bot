const crypto = require("crypto");
const db = require("../models/db");

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return String(value).toLowerCase() === "true";
}

function generateOrderId(prefix) {
  const uid = crypto.randomBytes(8).toString("hex");
  return `${prefix}-${uid}`;
}

function getAverageExecutionPrice(order, fallbackPrice) {
  const executedQty = Number(order.executedQty || 0);
  const cumulativeQuoteQty = Number(order.cummulativeQuoteQty || 0);

  if (executedQty > 0 && cumulativeQuoteQty > 0) {
    return cumulativeQuoteQty / executedQty;
  }

  if (Array.isArray(order.fills) && order.fills.length > 0) {
    const totalQty = order.fills.reduce((sum, fill) => sum + Number(fill.qty || 0), 0);
    const totalQuote = order.fills.reduce(
      (sum, fill) => sum + Number(fill.qty || 0) * Number(fill.price || 0),
      0
    );

    if (totalQty > 0) {
      return totalQuote / totalQty;
    }
  }

  return Number(order.price || fallbackPrice || 0);
}

function getOcoStopLimitPrice(stopLoss) {
  return Number(stopLoss) * 0.999;
}

function calculateDurationSeconds(openedAt, closedAt = new Date()) {
  const openTime = new Date(openedAt).getTime();
  const closeTime = new Date(closedAt).getTime();

  if (Number.isNaN(openTime) || Number.isNaN(closeTime)) {
    return null;
  }

  return Math.max(0, Math.round((closeTime - openTime) / 1000));
}

class ExecutionOrchestrator {
  constructor({
    executionEngine,
    tradeModel,
    orderModel,
    riskManager,
    telegramService,
    logger
  }) {
    this.executionEngine = executionEngine;
    this.tradeModel = tradeModel;
    this.orderModel = orderModel;
    this.riskManager = riskManager;
    this.telegramService = telegramService;
    this.logger = logger;
  }

  async recordOrder(role, payload) {
    return this.orderModel.createOrder({
      tradeId: payload.tradeId || null,
      pair: payload.pair,
      role,
      side: payload.side,
      orderType: payload.orderType,
      exchangeOrderId: payload.exchangeOrderId || null,
      exchangeOrderListId: payload.exchangeOrderListId || null,
      exchangeClientOrderId: payload.exchangeClientOrderId || null,
      quantity: payload.quantity,
      price: payload.price ?? null,
      stopPrice: payload.stopPrice ?? null,
      status: payload.status,
      metadata: payload.metadata || {},
      openedAt: payload.openedAt || new Date(),
      closedAt: payload.closedAt || null
    });
  }

  async settleTrackedOrders(tradeId, nextStatus, metadata = {}, roles = []) {
    const trackedOrders = await this.orderModel.listOrders({
      tradeId,
      status: "open",
      limit: 100
    });

    for (const order of trackedOrders) {
      if (roles.length > 0 && !roles.includes(order.role)) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await this.orderModel.updateOrder(order.id, {
        status: nextStatus,
        closedAt: new Date(),
        metadata: {
          ...(order.metadata || {}),
          ...metadata
        }
      });
    }
  }

  async buildExchangeClosureSnapshot(trade) {
    const openedAtTimestamp = new Date(trade.opened_at).getTime();

    try {
      const exchangeTrades = await this.executionEngine.getMyTrades(trade.pair, {
        limit: 100,
        startTime: openedAtTimestamp
      });
      const sellTrades = exchangeTrades
        .filter((item) => !item.isBuyer && Number(item.time) >= openedAtTimestamp)
        .sort((left, right) => Number(left.time) - Number(right.time));

      let accumulatedQuantity = 0;
      let accumulatedQuote = 0;
      let lastFillTime = openedAtTimestamp;

      for (const fill of sellTrades) {
        const fillQuantity = Number(fill.qty || 0);
        const fillPrice = Number(fill.price || 0);

        accumulatedQuantity += fillQuantity;
        accumulatedQuote += fillQuantity * fillPrice;
        lastFillTime = Math.max(lastFillTime, Number(fill.time || openedAtTimestamp));

        if (accumulatedQuantity >= Number(trade.quantity) * 0.99) {
          break;
        }
      }

      if (accumulatedQuantity > 0) {
        return {
          exitPrice: accumulatedQuote / accumulatedQuantity,
          closedAt: new Date(lastFillTime),
          source: "exchange_trade_history"
        };
      }
    } catch (error) {
      this.logger?.warn("exchange_closure_snapshot_failed", {
        pair: trade.pair,
        tradeId: trade.id,
        message: error.message
      });
      // Fall back to ticker-based estimation if trade history lookup fails.
    }

    const latestPrice = await this.executionEngine.getSymbolPrice(trade.pair);

    return {
      exitPrice: Number(latestPrice.price),
      closedAt: new Date(),
      source: "ticker_fallback"
    };
  }

  async finalizeTradeClosure(trade, { exitPrice, closedAt = new Date(), cancelReason, status = "closed", metadata = {} }) {
    const result = this.riskManager.calculateTradeResult({
      side: trade.side || "BUY",
      entryPrice: trade.entry_price,
      exitPrice,
      quantity: trade.quantity
    });
    const durationSeconds = calculateDurationSeconds(trade.opened_at, closedAt);

    // Compute capital update before the transaction (pure arithmetic, no DB write).
    const capitalState = await this.riskManager.getLatestCapitalState();
    if (!capitalState) {
      this.logger?.error("finalize_trade_closure_no_capital_state", { tradeId: trade.id });
      throw new Error(`Cannot finalize trade ${trade.id}: capital state unavailable.`);
    }
    const capitalUpdate = this.riskManager.applyCompoundProfit({
      currentCapital: capitalState.capitalValue,
      currentRealizedProfit: capitalState.realizedProfit,
      tradePnl: result.pnl
    });

    // Atomically close the trade and record the capital change so a crash between
    // the two writes cannot leave the DB in an inconsistent state.
    await db.withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE trades
         SET exit_price        = :exitPrice,
             status            = :status,
             result_pnl        = :resultPnl,
             result_percent    = :resultPercent,
             closed_at         = :closedAt,
             duration_seconds  = :durationSeconds,
             cancel_reason     = :cancelReason,
             updated_at        = CURRENT_TIMESTAMP
         WHERE id = :id`,
        {
          id: trade.id,
          exitPrice,
          status,
          resultPnl: result.pnl,
          resultPercent: result.resultPercent,
          closedAt,
          durationSeconds,
          cancelReason: cancelReason || null
        }
      );
      await conn.execute(
        `INSERT INTO capital_history (timestamp, capital_value, realized_profit, unrealized_pnl)
         VALUES (:timestamp, :capitalValue, :realizedProfit, :unrealizedPnl)`,
        {
          timestamp: closedAt,
          capitalValue: capitalUpdate.newCapital,
          realizedProfit: capitalUpdate.newRealizedProfit,
          unrealizedPnl: 0
        }
      );
    });

    const updatedTrade = await this.tradeModel.getTradeById(trade.id);

    await this.settleTrackedOrders(
      trade.id,
      cancelReason === "exchange_closed" ? "filled" : "cancelled",
      {
        closedBy: cancelReason || status,
        closureStatus: status
      },
      ["protection", "adjustment"]
    );

    await this.telegramService.notifyTradeClosed({
      pair: updatedTrade.pair,
      side: updatedTrade.side,
      exitPrice: updatedTrade.exit_price,
      resultPnl: updatedTrade.result_pnl,
      resultPercent: updatedTrade.result_percent,
      durationSeconds: updatedTrade.duration_seconds,
      status: updatedTrade.status,
      metadata
    });

    return {
      ok: true,
      action: "trade_closed",
      trade: updatedTrade
    };
  }

  async executeBuyTrade({ pair, scoreResult, triggerSource, metadata, buildTradeRiskPlan }) {
    this.logger?.info("buy_trade_execution_started", {
      pair,
      triggerSource,
      executionMode: scoreResult?.score?.executionMode || null,
      totalScore: scoreResult?.score?.totalScore || null
    });
    const bookTicker = await this.executionEngine.getBestBookTicker(pair);
    const limitReferencePrice = Number(bookTicker.bidPrice || 0);
    const marketReferencePrice = Number(bookTicker.askPrice || 0);
    const entryReferencePrice =
      scoreResult.score.executionMode === "MARKET" ? marketReferencePrice : limitReferencePrice;
    const atr = Number(scoreResult.snapshots.indicators["15m"]?.atr14 || 0);
    const riskPlan = await buildTradeRiskPlan({
      side: "BUY",
      entryPrice: entryReferencePrice,
      atr,
      pair
    });

    if (riskPlan.positionSizing.quantity <= 0) {
      this.logger?.warn("buy_trade_blocked_no_capital", {
        pair,
        triggerSource
      });
      return {
        ok: false,
        action: "blocked",
        reason: "No available spot capital for a new position."
      };
    }

    let entryOrder;

    if (scoreResult.score.executionMode === "MARKET") {
      entryOrder = await this.executionEngine.placeMarketOrder({
        symbol: pair,
        side: "BUY",
        quantity: riskPlan.positionSizing.quantity,
        newClientOrderId: generateOrderId("buy")
      });
    } else {
      entryOrder = await this.executionEngine.placeLimitOrder({
        symbol: pair,
        side: "BUY",
        quantity: riskPlan.positionSizing.quantity,
        price: entryReferencePrice,
        newClientOrderId: generateOrderId("limit-buy")
      });

      const finalOrderState = await this.executionEngine.waitForOrderFill(pair, entryOrder.orderId, {
        timeoutMs: 5 * 60 * 1000,
        pollIntervalMs: 5000
      });

      if (finalOrderState.status !== "FILLED") {
        if (["NEW", "PARTIALLY_FILLED"].includes(finalOrderState.status)) {
          await this.executionEngine.cancelOrder(pair, entryOrder.orderId);
        }

        return {
          ok: false,
          action: "limit_order_cancelled",
          reason: "Limit order was not filled within 5 minutes."
        };
      }

      entryOrder = finalOrderState;
    }

    const executedQuantity = Number(entryOrder.executedQty || riskPlan.positionSizing.quantity);
    const entryPrice = getAverageExecutionPrice(entryOrder, entryReferencePrice);
    const strategyId = metadata?.strategyId || metadata?.strategy || "";
    const exits = this.riskManager.calculateExitLevels({
      side: "BUY",
      entryPrice,
      atr,
      strategyId
    });
    const breakEvenTriggerPrice = entryPrice + exits.stopDistance;

    let ocoOrder = null;
    const maxOcoRetries = 3;

    for (let attempt = 1; attempt <= maxOcoRetries; attempt++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        ocoOrder = await this.executionEngine.placeOcoOrder({
          symbol: pair,
          side: "SELL",
          quantity: executedQuantity,
          price: exits.takeProfit,
          stopPrice: exits.stopLoss,
          stopLimitPrice: getOcoStopLimitPrice(exits.stopLoss),
          listClientOrderId: generateOrderId(`oco-r${attempt}`)
        });
        break;
      } catch (error) {
        this.logger?.warn("buy_trade_oco_attempt_failed", {
          pair,
          triggerSource,
          attempt,
          maxRetries: maxOcoRetries,
          message: error.message
        });

        if (attempt < maxOcoRetries) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        } else {
          ocoOrder = { error: error.message };
        }
      }
    }

    if (ocoOrder?.error) {
      this.logger?.error("buy_trade_oco_failed_all_retries", {
        pair,
        triggerSource,
        message: ocoOrder.error,
        retriesExhausted: maxOcoRetries
      });
      const emergencyCloseOrder = await this.executionEngine.closeSpotPositionAtMarket({
        symbol: pair,
        side: "SELL",
        quantity: executedQuantity,
        newClientOrderId: generateOrderId("emergency-close")
      });

      return {
        ok: false,
        action: "oco_protection_failed",
        reason: `OCO protection failed after ${maxOcoRetries} retries, position closed: ${ocoOrder.error}`,
        entryOrder,
        emergencyCloseOrder
      };
    }

    const trade = await this.tradeModel.createTrade({
      pair,
      side: "BUY",
      orderType: scoreResult.score.executionMode,
      exchangeOrderId: entryOrder.orderId || null,
      exchangeClientOrderId: entryOrder.clientOrderId || null,
      ocoOrderListId: ocoOrder?.orderListId || null,
      quantity: executedQuantity,
      entryPrice,
      stopLoss: exits.stopLoss,
      takeProfit: exits.takeProfit,
      scoreTotal: scoreResult.score.totalScore,
      scoreBreakdown: scoreResult.score,
      indicatorsSnapshot: scoreResult.snapshots.indicators,
      sentimentSnapshot: scoreResult.snapshots.sentiment,
      metadata: {
        ...metadata,
        patterns: scoreResult.snapshots.patterns,
        orderBook: scoreResult.snapshots.orderBook,
        ocoOrder,
        breakEvenActivated: false,
        breakEvenTriggerPrice,
        breakEvenTargetStopLoss: entryPrice
      },
      triggerSource
    });

    await this.recordOrder("entry", {
      tradeId: trade.id,
      pair,
      side: "BUY",
      orderType: scoreResult.score.executionMode,
      exchangeOrderId: entryOrder.orderId || null,
      exchangeClientOrderId: entryOrder.clientOrderId || null,
      quantity: executedQuantity,
      price: entryPrice,
      status: "filled",
      metadata: {
        triggerSource,
        executionMode: scoreResult.score.executionMode,
        tradingMode: this.executionEngine.getModeLabel()
      },
      closedAt: new Date()
    });

    await this.recordOrder("protection", {
      tradeId: trade.id,
      pair,
      side: "SELL",
      orderType: "OCO",
      exchangeOrderListId: ocoOrder?.orderListId || null,
      exchangeClientOrderId: ocoOrder?.listClientOrderId || null,
      quantity: executedQuantity,
      price: exits.takeProfit,
      stopPrice: exits.stopLoss,
      status: "open",
      metadata: {
        triggerSource,
        tradingMode: this.executionEngine.getModeLabel()
      }
    });

    await this.telegramService.notifyTradeOpened({
      pair: trade.pair,
      side: trade.side,
      orderType: trade.order_type,
      entryPrice: trade.entry_price,
      quantity: trade.quantity,
      stopLoss: trade.stop_loss,
      takeProfit: trade.take_profit,
      scoreTotal: trade.score_total,
      scoreBreakdown: trade.score_breakdown
    });
    this.logger?.info("buy_trade_opened", {
      pair,
      tradeId: trade.id,
      triggerSource,
      quantity: executedQuantity,
      entryPrice
    });

    return {
      ok: true,
      action: "trade_opened",
      trade,
      entryOrder,
      ocoOrder
    };
  }

  async executeSellSignal({ pair, triggerSource, metadata }) {
    const openTrades = await this.tradeModel.getOpenTrades();
    const existingLongs = openTrades.filter((trade) => trade.pair === pair && trade.side === "BUY");

    if (existingLongs.length === 0) {
      this.logger?.info("sell_signal_skipped", {
        pair,
        triggerSource
      });
      return {
        ok: false,
        action: "spot_sell_skipped",
        reason: "No open BUY trade found for this pair. Spot mode does not open naked short positions."
      };
    }

    const results = [];

    for (const trade of existingLongs) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.closeTrade(
        trade.id,
        triggerSource === "manual" ? "manual_sell_signal" : "sell_signal",
        metadata
      );
      results.push(result);
    }

    this.logger?.info("sell_signal_closed_positions", {
      pair,
      triggerSource,
      closedCount: results.length
    });

    return {
      ok: true,
      action: "all_positions_closed",
      closedCount: results.length,
      results
    };
  }

  async closeTrade(tradeId, cancelReason = "manual_cancel", metadata = {}) {
    const trade = await this.tradeModel.getTradeById(tradeId);

    if (!trade) {
      throw new Error("Trade not found.");
    }

    if (trade.status !== "open") {
      throw new Error("Only open trades can be cancelled or closed.");
    }

    try {
      if (trade.oco_order_list_id) {
        await this.executionEngine.cancelOrderList(trade.pair, trade.oco_order_list_id);
      } else if (trade.exchange_order_id && trade.order_type === "LIMIT") {
        await this.executionEngine.cancelOrder(trade.pair, trade.exchange_order_id);
      } else {
        await this.executionEngine.cancelAllOpenOrders(trade.pair);
      }
    } catch (_error) {
      // The position can still be force-closed even if some protective orders are already gone.
    }

    const closeOrder = await this.executionEngine.closeSpotPositionAtMarket({
      symbol: trade.pair,
      side: "SELL",
      quantity: trade.quantity,
      newClientOrderId: generateOrderId("close")
    });

    const exitPrice = getAverageExecutionPrice(closeOrder, trade.entry_price);
    const closureTimestamp = new Date();
    await this.recordOrder("exit", {
      tradeId: trade.id,
      pair: trade.pair,
      side: "SELL",
      orderType: "MARKET",
      exchangeOrderId: closeOrder.orderId || null,
      exchangeClientOrderId: closeOrder.clientOrderId || null,
      quantity: trade.quantity,
      price: exitPrice,
      status: "filled",
      metadata,
      closedAt: closureTimestamp
    });

    const finalized = await this.finalizeTradeClosure(trade, {
      exitPrice,
      closedAt: closureTimestamp,
      cancelReason,
      status: cancelReason === "manual_cancel" ? "cancelled" : "closed",
      metadata
    });
    this.logger?.info("trade_closed", {
      tradeId: trade.id,
      pair: trade.pair,
      cancelReason,
      status: finalized.trade?.status || null
    });

    return {
      ...finalized,
      closeOrder
    };
  }

  async activateBreakEvenProtection(trade) {
    const currentMetadata = trade.metadata || {};
    let protectionCancelled = false;

    try {
      if (trade.oco_order_list_id) {
        await this.executionEngine.cancelOrderList(trade.pair, trade.oco_order_list_id);
        protectionCancelled = true;
      }

      const replacementOco = await this.executionEngine.placeOcoOrder({
        symbol: trade.pair,
        side: "SELL",
        quantity: trade.quantity,
        price: trade.take_profit,
        stopPrice: trade.entry_price,
        stopLimitPrice: getOcoStopLimitPrice(trade.entry_price),
        listClientOrderId: generateOrderId("breakeven-oco")
      });

      await this.tradeModel.updateTradeProtection(trade.id, {
        stopLoss: trade.entry_price,
        takeProfit: trade.take_profit,
        ocoOrderListId: replacementOco?.orderListId || null,
        metadata: {
          ...currentMetadata,
          ocoOrder: replacementOco,
          breakEvenActivated: true,
          breakEvenActivatedAt: new Date().toISOString(),
          previousStopLoss: trade.stop_loss,
          breakEvenTargetStopLoss: trade.entry_price
        }
      });

      await this.settleTrackedOrders(
        trade.id,
        "cancelled",
        {
          replacedBy: "break_even_upgrade"
        },
        ["protection", "adjustment"]
      );

      await this.recordOrder("adjustment", {
        tradeId: trade.id,
        pair: trade.pair,
        side: "SELL",
        orderType: "OCO",
        exchangeOrderListId: replacementOco?.orderListId || null,
        exchangeClientOrderId: replacementOco?.listClientOrderId || null,
        quantity: trade.quantity,
        price: trade.take_profit,
        stopPrice: trade.entry_price,
        status: "open",
        metadata: {
          kind: "break_even_upgrade",
          tradingMode: this.executionEngine.getModeLabel()
        }
      });
    } catch (error) {
      if (protectionCancelled) {
        await this.closeTrade(trade.id, "break_even_protection_failed", {
          error: error.message
        });
      }

      throw error;
    }
  }

  async updateTrailingStop(trade, newStopLoss, highWaterMark) {
    const currentMetadata = trade.metadata || {};
    let protectionCancelled = false;

    try {
      if (trade.oco_order_list_id) {
        await this.executionEngine.cancelOrderList(trade.pair, trade.oco_order_list_id);
        protectionCancelled = true;
      }

      const replacementOco = await this.executionEngine.placeOcoOrder({
        symbol: trade.pair,
        side: "SELL",
        quantity: trade.quantity,
        price: trade.take_profit,
        stopPrice: newStopLoss,
        stopLimitPrice: getOcoStopLimitPrice(newStopLoss),
        listClientOrderId: generateOrderId("trail-oco")
      });

      await this.tradeModel.updateTradeProtection(trade.id, {
        stopLoss: newStopLoss,
        takeProfit: trade.take_profit,
        ocoOrderListId: replacementOco?.orderListId || null,
        metadata: {
          ...currentMetadata,
          ocoOrder: replacementOco,
          trailingHighWaterMark: highWaterMark,
          trailingStopUpdatedAt: new Date().toISOString(),
          previousStopLoss: trade.stop_loss
        }
      });

      await this.settleTrackedOrders(trade.id, "cancelled", { replacedBy: "trailing_stop_upgrade" }, ["protection", "adjustment"]);
      await this.recordOrder("adjustment", {
        tradeId: trade.id,
        pair: trade.pair,
        side: "SELL",
        orderType: "OCO",
        exchangeOrderListId: replacementOco?.orderListId || null,
        exchangeClientOrderId: replacementOco?.listClientOrderId || null,
        quantity: trade.quantity,
        price: trade.take_profit,
        stopPrice: newStopLoss,
        status: "open",
        metadata: { kind: "trailing_stop_upgrade", tradingMode: this.executionEngine.getModeLabel() }
      });

      this.logger?.info("trailing_stop_updated", {
        tradeId: trade.id,
        pair: trade.pair,
        newStopLoss,
        highWaterMark
      });
    } catch (error) {
      if (protectionCancelled) {
        await this.closeTrade(trade.id, "trailing_stop_protection_failed", { error: error.message });
      }

      throw error;
    }
  }

  async manageOpenTrades() {
    const openTrades = await this.tradeModel.getOpenTrades();
    const buyTrades = openTrades.filter((trade) => trade.side === "BUY");

    if (buyTrades.length === 0) {
      return;
    }

    const trailingEnabled = parseBooleanEnv(process.env.TRAILING_STOP_ENABLED, true);
    const uniquePairs = [...new Set(buyTrades.map((trade) => trade.pair))];
    const latestPrices = {};
    const openOrderListIdsByPair = {};

    for (const pair of uniquePairs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const [price, openOrders] = await Promise.all([
          this.executionEngine.getSymbolPrice(pair),
          this.executionEngine.getOpenOrders(pair)
        ]);
        latestPrices[pair] = Number(price.price);
        openOrderListIdsByPair[pair] = new Set(
          openOrders
            .map((order) => Number(order.orderListId))
            .filter((value) => Number.isFinite(value) && value > 0)
        );
      } catch (_error) {
        latestPrices[pair] = null;
        openOrderListIdsByPair[pair] = new Set();
      }
    }

    for (const trade of buyTrades) {
      const marketPrice = latestPrices[trade.pair];
      const metadata = trade.metadata || {};
      const hasOpenProtection =
        !trade.oco_order_list_id ||
        openOrderListIdsByPair[trade.pair]?.has(Number(trade.oco_order_list_id));

      if (!Number.isFinite(marketPrice) || !hasOpenProtection) {
        continue;
      }

      // Phase 1: Activate break-even when price reaches +1R.
      if (!metadata.breakEvenActivated) {
        const triggerPrice = Number(
          metadata.breakEvenTriggerPrice || trade.entry_price + (trade.entry_price - trade.stop_loss)
        );

        if (marketPrice >= triggerPrice) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await this.activateBreakEvenProtection(trade);
          } catch (error) {
            this.logger?.error("break_even_activation_failed", {
              tradeId: trade.id,
              pair: trade.pair,
              message: error.message
            });
          }
        }

        continue;
      }

      // Phase 2: Trail the stop after break-even is active.
      if (!trailingEnabled) {
        continue;
      }

      // Use the original stop distance stored when break-even was activated.
      const originalStopLoss = Number(metadata.previousStopLoss || trade.stop_loss);
      const originalStopDistance = trade.entry_price - originalStopLoss;

      if (originalStopDistance <= 0) {
        continue;
      }

      const trailingMultiplier = Number(process.env.TRAILING_STOP_MULTIPLIER || 1.0);
      const trailingDistance = originalStopDistance * trailingMultiplier;
      const currentHighWaterMark = Number(metadata.trailingHighWaterMark || trade.entry_price);
      const newHighWaterMark = Math.max(currentHighWaterMark, marketPrice);
      const newTrailingStop = newHighWaterMark - trailingDistance;
      const currentStopLoss = Number(trade.stop_loss);

      // Only update if the new trailing stop is meaningfully higher than the current one.
      if (newTrailingStop > currentStopLoss + originalStopDistance * 0.05) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.updateTrailingStop(trade, newTrailingStop, newHighWaterMark);
        } catch (error) {
          this.logger?.error("trailing_stop_update_failed", {
            tradeId: trade.id,
            pair: trade.pair,
            message: error.message
          });
        }
      } else if (newHighWaterMark > currentHighWaterMark) {
        // Track the new high-water mark even if stop didn't move yet.
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.tradeModel.updateTradeProtection(trade.id, {
            stopLoss: currentStopLoss,
            takeProfit: trade.take_profit,
            ocoOrderListId: trade.oco_order_list_id,
            metadata: { ...metadata, trailingHighWaterMark: newHighWaterMark }
          });
        } catch (_error) {
          // Non-critical — just tracking, ignore failure.
        }
      }
    }
  }
}

module.exports = ExecutionOrchestrator;
