const crypto = require("crypto");

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  constructor(baseContext = {}) {
    this.baseContext = baseContext;
    this.minLevel = LOG_LEVELS[String(process.env.LOG_LEVEL || "info").toLowerCase()] || LOG_LEVELS.info;
  }

  child(context = {}) {
    const childLogger = new Logger({
      ...this.baseContext,
      ...context
    });
    childLogger.minLevel = this.minLevel;
    return childLogger;
  }

  withCorrelationId(correlationId) {
    return this.child({ correlationId: correlationId || crypto.randomBytes(6).toString("hex") });
  }

  debug(event, metadata = {}) {
    this.write("debug", event, metadata);
  }

  info(event, metadata = {}) {
    this.write("info", event, metadata);
  }

  warn(event, metadata = {}) {
    this.write("warn", event, metadata);
  }

  error(event, metadata = {}) {
    this.write("error", event, metadata);
  }

  write(level, event, metadata = {}) {
    const numericLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;

    if (numericLevel < this.minLevel) {
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      level,
      event,
      ...this.baseContext,
      ...metadata
    };
    const serialized = JSON.stringify(payload);

    if (level === "error") {
      console.error(serialized);
      return;
    }

    if (level === "warn") {
      console.warn(serialized);
      return;
    }

    console.log(serialized);
  }
}

module.exports = new Logger({ service: "trading-bot-backend" });
