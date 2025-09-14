// Enhanced logging utility for better backend logging visibility

export interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

export const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  private logLevel: number;
  private enableStructuredLogs: boolean;

  constructor() {
    // Read log level from environment, default to INFO
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    this.logLevel = LOG_LEVELS[envLogLevel as keyof LogLevel] ?? LOG_LEVELS.INFO;
    
    // Enable structured JSON logs if specified
    this.enableStructuredLogs = process.env.STRUCTURED_LOGS === 'true';
  }

  private shouldLog(level: number): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, component: string, message: string, meta?: any): void {
    if (this.enableStructuredLogs) {
      // JSON structured logging
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        component,
        message,
        ...(meta && { meta }),
        pid: process.pid
      };
      console.log(JSON.stringify(logEntry));
    } else {
      // Enhanced console logging with better visibility
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level}] [${component}]`;
      
      if (meta) {
        console.log(`${prefix} ${message}`, meta);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  debug(component: string, message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      this.formatMessage('DEBUG', component, message, meta);
    }
  }

  info(component: string, message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      this.formatMessage('INFO', component, message, meta);
    }
  }

  warn(component: string, message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      this.formatMessage('WARN', component, message, meta);
    }
  }

  error(component: string, message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      this.formatMessage('ERROR', component, message, meta);
    }
  }

  // Convenience methods for specific components
  ingest(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    this[level]('INGEST', message, meta);
  }

  store(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    this[level]('STORE', message, meta);
  }

  sse(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    this[level]('SSE', message, meta);
  }

  websocket(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    this[level]('WEBSOCKET', message, meta);
  }

  api(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    this[level]('API', message, meta);
  }

  // Log server startup information
  startup(port: number, mode: 'development' | 'production'): void {
    this.info('SERVER', `🚀 Alive observability platform starting`, {
      port,
      mode,
      pid: process.pid,
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    });
    
    this.info('CONFIG', `📋 Logging configuration`, {
      logLevel: Object.keys(LOG_LEVELS)[this.logLevel],
      structuredLogs: this.enableStructuredLogs,
      environment: process.env.NODE_ENV || 'development'
    });
  }

  // Log connection statistics
  connectionStats(sseClients: number, wsClients: number): void {
    this.info('CONNECTIONS', `📊 Active connections`, {
      sseClients,
      wsClients,
      total: sseClients + wsClients
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for backward compatibility
export default logger;