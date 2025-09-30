/**
 * Unified Logging Service
 * Replaces console.log with structured logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private level: LogLevel;
  private isProduction: boolean;

  constructor(level: LogLevel = LogLevel.INFO, isProduction: boolean = false) {
    this.level = level;
    this.isProduction = isProduction;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const context = entry.context ? JSON.stringify(entry.context) : '';
    const error = entry.error ? `\nError: ${entry.error.stack}` : '';
    
    return `[${timestamp}] [${levelName}] ${entry.message} ${context}${error}`;
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry: LogEntry = {
        level: LogLevel.DEBUG,
        message,
        timestamp: new Date(),
        context
      };
      
      if (this.isProduction) {
        // In production, send to logging service
        this.sendToLoggingService(entry);
      } else {
        console.log(this.formatMessage(entry));
      }
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry: LogEntry = {
        level: LogLevel.INFO,
        message,
        timestamp: new Date(),
        context
      };
      
      console.log(this.formatMessage(entry));
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry: LogEntry = {
        level: LogLevel.WARN,
        message,
        timestamp: new Date(),
        context
      };
      
      console.warn(this.formatMessage(entry));
    }
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry: LogEntry = {
        level: LogLevel.ERROR,
        message,
        timestamp: new Date(),
        context,
        error
      };
      
      console.error(this.formatMessage(entry));
    }
  }

  private sendToLoggingService(entry: LogEntry): void {
    // TODO: Implement logging service integration
    // This could send to services like DataDog, New Relic, or custom logging API
  }
}

// Export singleton instance
export const logger = new Logger(
  process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
  process.env.NODE_ENV === 'production'
);

export default logger;
