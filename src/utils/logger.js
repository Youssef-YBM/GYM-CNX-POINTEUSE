const winston = require('winston');
const path = require('path');
const { logging, server } = require('../config/constants.js');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = logging.filePath;
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}] ${message}${stack ? '\n' + stack : ''}`;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: logging.level ?? '',
    format: logFormat,
    defaultMeta: { service: 'gymya-hikvision' },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),

        // File transport for errors
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 9242880, // 9MB
            maxFiles: 9
        }),
    ],

    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log')
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log')
        })
    ]
});

// In development, don't log to files
// if (server.env === 'development') {
//     logger.remove(logger.transports[1]); // Remove error file transport
//     logger.remove(logger.transports[1]); // Remove combined file transport (index shifts after removal)
// }

// Create convenience functions
const log = {
    info: (message, meta = {}) => logger.info(message, meta),
    error: (message, error = null, meta = {}) => {
        if (error instanceof Error) {
            logger.error(message, { error: error.message, stack: error.stack, ...meta });
        } else {
            logger.error(message, { error, ...meta });
        }
    },
    warn: (message, meta = {}) => logger.warn(message, meta),
    debug: (message, meta = {}) => logger.debug(message, meta),
    http: (message, meta = {}) => logger.http(message, meta)
};

// Legacy function for backward compatibility
const logSimple = (message) => {
    logger.info(message);
};

module.exports = { log };
