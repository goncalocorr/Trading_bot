const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const DEFAULT_FEAR_GREED_URL = "https://api.alternative.me/fng/";
const DEFAULT_CRYPTOPANIC_URL = "https://cryptopanic.com/api/v1/posts/";
const DEFAULT_TIMEOUT = 12000;
const DEFAULT_NEWS_LIMIT = 10;

const POSITIVE_KEYWORDS = [
  "surge",
  "breakout",
  "rally",
  "bullish",
  "approval",
  "adoption",
  "buy",
  "growth",
  "gain",
  "partnership",
  "record high",
  "inflow",
  "recovery",
  "upgrade"
];

const NEGATIVE_KEYWORDS = [
  "crash",
  "dump",
  "bearish",
  "hack",
  "lawsuit",
  "ban",
  "fear",
  "selloff",
  "liquidation",
  "outflow",
  "fraud",
  "loss",
  "drop",
  "recession",
  "rate hike"
];

class SentimentService {
  constructor() {
    this.http = axios.create({
      timeout: DEFAULT_TIMEOUT
    });
  }

  normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  scoreHeadline(headline) {
    const normalizedHeadline = this.normalizeText(headline);
    let score = 0;

    POSITIVE_KEYWORDS.forEach((keyword) => {
      if (normalizedHeadline.includes(keyword)) {
        score += 1;
      }
    });

    NEGATIVE_KEYWORDS.forEach((keyword) => {
      if (normalizedHeadline.includes(keyword)) {
        score -= 1;
      }
    });

    return score;
  }

  classifyHeadline(score) {
    if (score > 0) {
      return "positive";
    }

    if (score < 0) {
      return "negative";
    }

    return "neutral";
  }

  async fetchFearAndGreed() {
    const url = process.env.FEAR_GREED_API_URL || DEFAULT_FEAR_GREED_URL;

    try {
      const response = await this.http.get(url);
      const latest = response.data?.data?.[0];

      if (!latest) {
        throw new Error("Fear & Greed API returned no data.");
      }

      const value = Number(latest.value);
      const classification = latest.value_classification || this.classifyFearGreed(value);

      return {
        value,
        classification,
        timestamp: latest.timestamp ? Number(latest.timestamp) * 1000 : Date.now(),
        source: url,
        isExtremeFear: value < 20,
        isExtremeGreed: value > 80,
        allowsBuy: value <= 80,
        allowsSell: value >= 20
      };
    } catch (error) {
      return {
        value: null,
        classification: "unknown",
        timestamp: Date.now(),
        source: url,
        isExtremeFear: false,
        isExtremeGreed: false,
        allowsBuy: true,
        allowsSell: true,
        error: error.message
      };
    }
  }

  classifyFearGreed(value) {
    if (value < 20) {
      return "Extreme Fear";
    }

    if (value < 40) {
      return "Fear";
    }

    if (value <= 60) {
      return "Neutral";
    }

    if (value <= 80) {
      return "Greed";
    }

    return "Extreme Greed";
  }

  buildCryptoPanicUrl({ pair = "BTCUSDT", limit = DEFAULT_NEWS_LIMIT } = {}) {
    const apiKey = process.env.CRYPTOPANIC_API_KEY || "";
    const baseCurrency = pair.replace(/USDT|BUSD|USDC|EUR|BTC|ETH$/i, "") || "BTC";
    const params = new URLSearchParams({
      currencies: baseCurrency,
      public: "true",
      kind: "news",
      filter: "important",
      regions: "en",
      limit: String(limit)
    });

    if (apiKey) {
      params.append("auth_token", apiKey);
    }

    return `${DEFAULT_CRYPTOPANIC_URL}?${params.toString()}`;
  }

  async fetchNews(pair = "BTCUSDT", { limit = DEFAULT_NEWS_LIMIT } = {}) {
    const url = this.buildCryptoPanicUrl({ pair, limit });

    try {
      const response = await this.http.get(url);
      const results = Array.isArray(response.data?.results) ? response.data.results : [];

      const seen = new Set();
      return results
        .map((item) => {
          const headline = item.title || "";
          const score = this.scoreHeadline(headline);

          return {
            title: headline,
            url: item.url || null,
            publishedAt: item.published_at || null,
            score,
            sentiment: this.classifyHeadline(score),
            source: item.source?.title || "CryptoPanic"
          };
        })
        .filter((item) => {
          const key = item.title.toLowerCase().trim().slice(0, 80);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    } catch (error) {
      return [
        {
          title: "News sentiment unavailable",
          url: null,
          publishedAt: null,
          score: 0,
          sentiment: "neutral",
          source: "fallback",
          unavailable: true,
          error: error.message
        }
      ];
    }
  }

  summarizeNews(newsItems = []) {
    const isUnavailable = newsItems.length === 1 && Boolean(newsItems[0]?.unavailable);
    const totalScore = newsItems.reduce((sum, item) => sum + Number(item.score || 0), 0);
    const negativeCount = newsItems.filter((item) => item.sentiment === "negative").length;
    const positiveCount = newsItems.filter((item) => item.sentiment === "positive").length;
    const overallSentiment = totalScore > 1 ? "positive" : totalScore < -1 ? "negative" : "neutral";

    return {
      totalArticles: newsItems.length,
      totalScore,
      positiveCount,
      negativeCount,
      overallSentiment,
      isUnavailable,
      heavilyNegative: !isUnavailable && (totalScore <= -2 || negativeCount >= Math.ceil(newsItems.length / 2)),
      neutralOrPositive: !isUnavailable && totalScore >= 0
    };
  }

  evaluateFearGreedForSignal(signalSide, fearGreed) {
    const normalizedSide = String(signalSide || "").toUpperCase();

    if (!fearGreed || fearGreed.value === null) {
      return {
        allowed: true,
        scoreEligible: false,
        reason: "Fear & Greed unavailable."
      };
    }

    // Extreme Greed while trying to BUY: avoid chasing tops.
    if (normalizedSide === "BUY" && fearGreed.isExtremeGreed) {
      return {
        allowed: false,
        scoreEligible: false,
        reason: "Extreme Greed: avoid buying at market tops."
      };
    }

    // Extreme Fear while trying to SELL: avoid selling at market bottoms.
    if (normalizedSide === "SELL" && fearGreed.isExtremeFear) {
      return {
        allowed: false,
        scoreEligible: false,
        reason: "Extreme Fear: avoid selling at market bottoms."
      };
    }

    // Extreme Fear for BUY is a contrarian bullish signal — the crowd is maximally fearful,
    // historically associated with market bottoms.
    if (normalizedSide === "BUY" && fearGreed.isExtremeFear) {
      return {
        allowed: true,
        scoreEligible: true,
        contrarian: true,
        reason: "Extreme Fear is a contrarian BUY signal (market bottoms)."
      };
    }

    return {
      allowed: true,
      scoreEligible: fearGreed.value >= 20 && fearGreed.value <= 80,
      reason: "Fear & Greed acceptable for signal."
    };
  }

  evaluateNewsForSignal(signalSide, newsSummary) {
    const normalizedSide = String(signalSide || "").toUpperCase();

    if (!newsSummary) {
      return {
        scoreAdjustment: 0,
        scoreEligible: false,
        reason: "News summary unavailable."
      };
    }

    if (normalizedSide === "BUY" && newsSummary.heavilyNegative) {
      return {
        scoreAdjustment: -1,
        scoreEligible: false,
        reason: "Heavily negative news detected."
      };
    }

    if (normalizedSide === "SELL" && newsSummary.overallSentiment === "negative") {
      return {
        scoreAdjustment: 1,
        scoreEligible: true,
        reason: "Negative news supports sell bias."
      };
    }

    return {
      scoreAdjustment: 0,
      scoreEligible: newsSummary.neutralOrPositive,
      reason: "News is neutral or supportive."
    };
  }

  async getSentimentSnapshot({ pair = "BTCUSDT", signalSide = "BUY" } = {}) {
    const [fearGreed, news] = await Promise.all([this.fetchFearAndGreed(), this.fetchNews(pair)]);
    const newsSummary = this.summarizeNews(news);
    const fearGreedEvaluation = this.evaluateFearGreedForSignal(signalSide, fearGreed);
    const newsEvaluation = this.evaluateNewsForSignal(signalSide, newsSummary);

    return {
      pair,
      signalSide: String(signalSide).toUpperCase(),
      fearGreed,
      news,
      newsSummary,
      evaluations: {
        fearGreed: fearGreedEvaluation,
        news: newsEvaluation
      }
    };
  }
}

module.exports = new SentimentService();
