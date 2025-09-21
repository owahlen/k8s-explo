import { createLogger, format, transports } from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

const logger = createLogger({
    level: logLevel,
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
    ),
    transports: [
        new transports.Console(),
    ],
});

export default logger;
