const test = require("node:test");
const assert = require("node:assert/strict");

const { computeScoreBreakdown } = require("../services/scorer");

function buildSentimentSnapshot() {
  return {
    evaluations: {
      fearGreed: {
        scoreEligible: true
      },
      news: {
        scoreEligible: true,
        scoreAdjustment: 0
      }
    },
    fearGreed: {
      value: 50,
      classification: "Neutral"
    },
    newsSummary: {
      overallSentiment: "neutral"
    }
  };
}

function buildOrderBookSnapshot(confirmsSignal = true) {
  return {
    evaluation: {
      confirmsSignal,
      spreadAccepted: true
    },
    analysis: {
      spreadPercent: 0.05
    }
  };
}

test("mean reversion can reach executable score without trend-following alignment", () => {
  const result = computeScoreBreakdown({
    signalSide: "BUY",
    strategyId: "mean_reversion",
    indicatorSnapshot: {
      "15m": {
        rsi14: 28,
        trend: {
          bias: "neutral",
          goldenCross: false,
          deathCross: false,
          priceAboveEma200: true
        },
        volume: {
          isAboveAverage: true
        }
      },
      multiTimeframe: {
        aligned: false,
        aligned1h: false,
        direction: "neutral",
        direction1h: "neutral"
      }
    },
    sentimentSnapshot: buildSentimentSnapshot(),
    patternSnapshot: {
      matched: true
    },
    orderBookSnapshot: buildOrderBookSnapshot(true),
    executionThreshold: 8
  });

  assert.ok(result.totalScore >= 8);
});

test("mean reversion still gets blocked by strongly opposed higher timeframes in scoring", () => {
  const result = computeScoreBreakdown({
    signalSide: "BUY",
    strategyId: "mean_reversion",
    indicatorSnapshot: {
      "15m": {
        rsi14: 25,
        trend: {
          bias: "bearish",
          goldenCross: false,
          deathCross: true,
          priceAboveEma200: false
        },
        volume: {
          isAboveAverage: true
        }
      },
      multiTimeframe: {
        aligned: true,
        aligned1h: true,
        direction: "SELL",
        direction1h: "SELL"
      }
    },
    sentimentSnapshot: buildSentimentSnapshot(),
    patternSnapshot: {
      matched: false
    },
    orderBookSnapshot: buildOrderBookSnapshot(false),
    executionThreshold: 8
  });

  const multiTfItem = result.items.find((item) => item.label === "Higher timeframes not strongly hostile");
  assert.equal(multiTfItem?.points, 0);
});
