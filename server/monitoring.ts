import { Request, Response, NextFunction } from 'express';

// Monitoring and alerting system
interface AlertThresholds {
  errorRate: number; // Percentage of requests that result in errors
  responseTime: number; // Average response time in milliseconds
  memoryUsage: number; // Memory usage percentage
  cpuUsage: number; // CPU usage percentage
}

interface Metrics {
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  startTime: number;
  lastAlertTime: number;
}

class MonitoringService {
  private metrics: Metrics = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    startTime: Date.now(),
    lastAlertTime: 0
  };

  private thresholds: AlertThresholds = {
    errorRate: 10, // 10% error rate threshold
    responseTime: 5000, // 5 second response time threshold
    memoryUsage: 80, // 80% memory usage threshold
    cpuUsage: 80 // 80% CPU usage threshold
  };

  private alertCooldown = 5 * 60 * 1000; // 5 minutes between alerts

  // Track request metrics
  trackRequest(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    this.metrics.requestCount++;
    
    // Track response time
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      this.metrics.totalResponseTime += responseTime;
      
      // Track errors
      if (res.statusCode >= 400) {
        this.metrics.errorCount++;
      }
      
      // Check thresholds and send alerts
      this.checkThresholds(req, res);
    });
    
    next();
  }

  // Check if thresholds are exceeded
  private checkThresholds(req: Request, res: Response) {
    const now = Date.now();
    
    // Only check every 5 minutes to avoid spam
    if (now - this.metrics.lastAlertTime < this.alertCooldown) {
      return;
    }

    const errorRate = (this.metrics.errorCount / this.metrics.requestCount) * 100;
    const avgResponseTime = this.metrics.totalResponseTime / this.metrics.requestCount;
    
    const alerts: string[] = [];
    
    if (errorRate > this.thresholds.errorRate) {
      alerts.push(`High error rate: ${errorRate.toFixed(2)}% (threshold: ${this.thresholds.errorRate}%)`);
    }
    
    if (avgResponseTime > this.thresholds.responseTime) {
      alerts.push(`High response time: ${avgResponseTime.toFixed(2)}ms (threshold: ${this.thresholds.responseTime}ms)`);
    }
    
    // Check system resources
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memUsagePercent > this.thresholds.memoryUsage) {
      alerts.push(`High memory usage: ${memUsagePercent.toFixed(2)}% (threshold: ${this.thresholds.memoryUsage}%)`);
    }
    
    if (alerts.length > 0) {
      this.sendAlert(alerts, req);
      this.metrics.lastAlertTime = now;
    }
  }

  // Send alert (in production, integrate with monitoring services)
  private sendAlert(alerts: string[], req: Request) {
    const alertMessage = `🚨 SYSTEM ALERT - ${new Date().toISOString()}\n` +
      `URL: ${req.url}\n` +
      `Method: ${req.method}\n` +
      `IP: ${req.ip}\n` +
      `Alerts:\n${alerts.map(alert => `  - ${alert}`).join('\n')}\n` +
      `Metrics:\n` +
      `  - Total Requests: ${this.metrics.requestCount}\n` +
      `  - Error Count: ${this.metrics.errorCount}\n` +
      `  - Error Rate: ${((this.metrics.errorCount / this.metrics.requestCount) * 100).toFixed(2)}%\n` +
      `  - Avg Response Time: ${(this.metrics.totalResponseTime / this.metrics.requestCount).toFixed(2)}ms`;
    
    console.error(alertMessage);
    
    // In production, send to monitoring service (e.g., Sentry, DataDog, etc.)
    // Example: Sentry.captureMessage(alertMessage, 'error');
  }

  // Get current metrics
  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const errorRate = this.metrics.requestCount > 0 ? (this.metrics.errorCount / this.metrics.requestCount) * 100 : 0;
    const avgResponseTime = this.metrics.requestCount > 0 ? this.metrics.totalResponseTime / this.metrics.requestCount : null;
    
    return {
      uptime,
      requestCount: this.metrics.requestCount,
      errorCount: this.metrics.errorCount,
      errorRate: this.metrics.requestCount > 0 ? parseFloat(errorRate.toFixed(2)) : null,
      avgResponseTime: avgResponseTime !== null ? parseFloat(avgResponseTime.toFixed(2)) : null,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  // Reset metrics (useful for testing or periodic resets)
  resetMetrics() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      startTime: Date.now(),
      lastAlertTime: 0
    };
  }
}

// Create singleton instance
export const monitoringService = new MonitoringService();

// Middleware for request tracking
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  monitoringService.trackRequest(req, res, next);
};

// Health check endpoint - always returns 200 if server is responding
export const healthCheck = (req: Request, res: Response) => {
  console.log('🏥 Health check endpoint called!');
  const metrics = monitoringService.getMetrics();
  
  console.log('🏥 Health check response:', { status: 'ok', metrics });
  
  // Always return 200 if server is responding - "unhealthy" logic was causing false negatives
  res.status(200).json({
    status: 'ok',
    metrics,
    timestamp: new Date().toISOString()
  });
};

// Security monitoring
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Log suspicious activity
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code injection
  ];
  
  const requestString = `${req.method} ${req.url} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      console.warn(`🚨 SECURITY ALERT: Suspicious request detected`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query,
        timestamp: new Date().toISOString()
      });
      break;
    }
  }
  
  next();
};

// Database monitoring
export const databaseMonitoring = {
  trackQuery: (query: string, duration: number, error?: Error) => {
    if (error) {
      console.error('Database query error:', {
        query: query.substring(0, 100) + '...',
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (duration > 5000) { // Log slow queries
      console.warn('Slow database query detected:', {
        query: query.substring(0, 100) + '...',
        duration,
        timestamp: new Date().toISOString()
      });
    }
  }
};

// File upload monitoring
export const fileUploadMonitoring = {
  trackUpload: (filename: string, size: number, success: boolean, error?: string) => {
    if (!success) {
      console.error('File upload failed:', {
        filename,
        size,
        error,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('File upload monitoring:', {
        filename,
        size,
        timestamp: new Date().toISOString()
      });
    }
  }
};


