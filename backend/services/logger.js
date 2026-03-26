class Logger {
  constructor(baseContext = {}) {
    this.baseContext = baseContext;
  }

  child(context = {}) {
    return new Logger({
      ...this.baseContext,
      ...context
    });
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
