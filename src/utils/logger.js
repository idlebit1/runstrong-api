class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.currentLevel = this.levels[process.env.LOG_LEVEL] || this.levels.info;
  }

  log(level, message, data = null) {
    if (this.levels[level] <= this.currentLevel) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...(data && { data })
      };
      
      console.log(JSON.stringify(logEntry));
    }
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }
}

module.exports = new Logger();