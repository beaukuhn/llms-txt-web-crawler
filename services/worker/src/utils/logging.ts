// src/utils/logging.ts - Centralized logging utilities

/**
 * Log levels for the application
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug'
}

/**
 * Formats an error message consistently
 * @param error The error object or string
 * @returns Formatted error message
 */
export function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Centralized logging function
 * @param level Log level
 * @param message Log message
 * @param data Additional data to log
 */
export function log(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` | ${JSON.stringify(data)}` : '';
    
    switch (level) {
        case LogLevel.ERROR:
            console.error(`[${timestamp}] ERROR: ${message}${logData}`);
            break;
        case LogLevel.WARN:
            console.warn(`[${timestamp}] WARN: ${message}${logData}`);
            break;
        case LogLevel.DEBUG:
            console.debug(`[${timestamp}] DEBUG: ${message}${logData}`);
            break;
        case LogLevel.INFO:
        default:
            console.log(`[${timestamp}] INFO: ${message}${logData}`);
    }
}

// Convenience methods
export const logError = (message: string, data?: any) => log(LogLevel.ERROR, message, data);
export const logWarn = (message: string, data?: any) => log(LogLevel.WARN, message, data);
export const logInfo = (message: string, data?: any) => log(LogLevel.INFO, message, data);
export const logDebug = (message: string, data?: any) => log(LogLevel.DEBUG, message, data); 