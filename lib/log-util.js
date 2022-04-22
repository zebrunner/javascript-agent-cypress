const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;
require('winston-daily-rotate-file');

class LogUtil {

    constructor(configResolver) {
        const myFormat = printf(({ level, message, label, timestamp }) => {
            return `${timestamp} ${level}: ${message}`;
        });

        const loggingLevel = configResolver.getLoggingLevel();
        const logToConsole = configResolver.getLogToConsole();
          
        const transportFile = new (transports.DailyRotateFile)({
            dirname: 'log',
            filename: 'zebrunner-client-%DATE%.log',
            datePattern: 'yyyy-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: loggingLevel === undefined ? 'info' : loggingLevel
        });
        const transportConsole = new transports.Console({ level: loggingLevel });
        var transportArr = logToConsole ? [transportFile, transportConsole] : [transportFile];

        this.logger = new (createLogger)({
            format: combine(
              timestamp(),
              myFormat
            ),
            transports: transportArr
        });
    }
      
    info(filename, message){
        this.logger.log({level: 'info', message: `[${filename}] ${message}`})
    }
    
    warn(filename, message){
        this.logger.log({level: 'warn', message: `[${filename}] ${message}`})
    }
    
    error(filename, message){
        this.logger.log({level: 'error', message: `[${filename}] ${message}`})
    }
    
    debug(filename, message){
        this.logger.log({level: 'debug', message: `[${filename}] ${message}`})
    }
}


  
module.exports = {
    LogUtil
}