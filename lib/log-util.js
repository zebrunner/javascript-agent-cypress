const { createLogger, format, transports } = require('winston');

const { combine, timestamp, printf } = format;
require('winston-daily-rotate-file');

class LogUtil {
  constructor(configResolver) {
    const myFormat = printf(({ level, message, timestamp: myFormatTimestamp }) => `${myFormatTimestamp} ${level}: ${message}`);

    const loggingEnabled = configResolver.getLoggingEnabled();

    // var transportConsole;
    // if(logTo && logTo.includes('console')){
    //     transportConsole = new transports.Console({ level: loggingLevel });
    // }

    if (loggingEnabled && loggingEnabled === true) {
      const loggingLevel = configResolver.getLoggingLevel();
      const transportFile = new (transports.DailyRotateFile)({
        dirname: 'log',
        filename: 'zebrunner-client-%DATE%.log',
        datePattern: 'yyyy-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        level: loggingLevel === undefined ? 'info' : loggingLevel,
      });

      this.logger = new (createLogger)({
        format: combine(
          timestamp(),
          myFormat,
        ),
        transports: [transportFile],
      });
    }
  }

  info(filename, message) {
    if (this.logger) {
      this.logger.log({ level: 'info', message: `[${filename}] ${message}` });
    }
  }

  warn(filename, message) {
    if (this.logger) {
      this.logger.log({ level: 'warn', message: `[${filename}] ${message}` });
    }
  }

  error(filename, message) {
    if (this.logger) {
      this.logger.log({ level: 'error', message: `[${filename}] ${message}` });
    }
  }

  debug(filename, message) {
    if (this.logger) {
      this.logger.log({ level: 'debug', message: `[${filename}] ${message}` });
    }
  }
}

module.exports = {
  LogUtil,
};
