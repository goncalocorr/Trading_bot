const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const DEFAULT_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const DEFAULT_TIMEOUT = 15000;
const RELEVANT_EVENT_KEYWORDS = ["fed", "fomc", "cpi", "nfp", "non-farm", "interest rate"];

class MacroEventsService {
  constructor() {
    this.http = axios.create({
      timeout: DEFAULT_TIMEOUT
    });
    this.state = {
      paused: false,
      event: null,
      pauseWindowStart: null,
      pauseWindowEnd: null
    };
  }

  normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  isRelevantEventName(name) {
    const normalizedName = this.normalizeText(name);
    return RELEVANT_EVENT_KEYWORDS.some((keyword) => normalizedName.includes(keyword));
  }

  isHighImpact(event) {
    const impact = this.normalizeText(event.impact || event.importance || event.volatility || event.rating);
    return impact.includes("high") || impact.includes("3") || impact.includes("red");
  }

  parseEventTime(event) {
    if (event.timestamp) {
      const timestamp = Number(event.timestamp);
      return Number.isFinite(timestamp)
        ? new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000)
        : null;
    }

    if (event.date && event.time) {
      const combined = `${event.date} ${event.time}`.trim();
      const parsed = new Date(combined);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (event.datetime) {
      const parsed = new Date(event.datetime);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  normalizeEvent(rawEvent) {
    const eventTime = this.parseEventTime(rawEvent);

    return {
      title: rawEvent.title || rawEvent.event || rawEvent.name || "Unnamed event",
      country: rawEvent.country || rawEvent.currency || null,
      impact: rawEvent.impact || rawEvent.importance || rawEvent.volatility || null,
      actual: rawEvent.actual || null,
      forecast: rawEvent.forecast || null,
      previous: rawEvent.previous || null,
      time: eventTime,
      raw: rawEvent
    };
  }

  async fetchWeeklyEvents() {
    const url = process.env.ECONOMIC_CALENDAR_URL || DEFAULT_CALENDAR_URL;
    const response = await this.http.get(url);
    const rawEvents = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.events)
        ? response.data.events
        : [];

    return rawEvents
      .map((event) => this.normalizeEvent(event))
      .filter((event) => event.time instanceof Date && !Number.isNaN(event.time.getTime()));
  }

  filterRelevantEvents(events = []) {
    return events.filter((event) => this.isHighImpact(event) && this.isRelevantEventName(event.title));
  }

  buildPauseWindow(event) {
    const eventTime = new Date(event.time);
    const start = new Date(eventTime.getTime() - 30 * 60 * 1000);
    const end = new Date(eventTime.getTime() + 30 * 60 * 1000);

    return {
      event,
      start,
      end
    };
  }

  getCurrentPauseStatus(relevantEvents = [], referenceDate = new Date()) {
    const activeWindow = relevantEvents
      .map((event) => this.buildPauseWindow(event))
      .find((window) => referenceDate >= window.start && referenceDate <= window.end);

    const upcomingWindow = relevantEvents
      .map((event) => this.buildPauseWindow(event))
      .find((window) => referenceDate < window.start);

    if (activeWindow) {
      this.state.paused = true;
      this.state.event = activeWindow.event;
      this.state.pauseWindowStart = activeWindow.start;
      this.state.pauseWindowEnd = activeWindow.end;

      return {
        paused: true,
        reason: `Macro event window active for ${activeWindow.event.title}.`,
        event: activeWindow.event,
        pauseWindowStart: activeWindow.start,
        pauseWindowEnd: activeWindow.end,
        upcoming: null
      };
    }

    this.state.paused = false;
    this.state.event = null;
    this.state.pauseWindowStart = null;
    this.state.pauseWindowEnd = null;

    return {
      paused: false,
      reason: "No active macro event pause.",
      event: null,
      pauseWindowStart: null,
      pauseWindowEnd: null,
      upcoming: upcomingWindow
        ? {
            event: upcomingWindow.event,
            pauseWindowStart: upcomingWindow.start,
            pauseWindowEnd: upcomingWindow.end,
            minutesUntilPause: Math.max(0, Math.round((upcomingWindow.start - referenceDate) / 60000))
          }
        : null
    };
  }

  async evaluateMacroPause(referenceDate = new Date()) {
    try {
      const events = await this.fetchWeeklyEvents();
      const relevantEvents = this.filterRelevantEvents(events);

      return {
        ok: true,
        events: relevantEvents,
        status: this.getCurrentPauseStatus(relevantEvents, referenceDate)
      };
    } catch (error) {
      return {
        ok: false,
        events: [],
        status: {
          paused: false,
          reason: `Macro events unavailable: ${error.message}`,
          event: null,
          pauseWindowStart: null,
          pauseWindowEnd: null,
          upcoming: null
        }
      };
    }
  }
}

module.exports = new MacroEventsService();
