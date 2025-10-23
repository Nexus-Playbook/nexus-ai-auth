import { Injectable } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private httpRequestsCounter: Counter<string>;
  private httpRequestDuration: Histogram<string>;

  constructor() {
    // Clear existing metrics to avoid registration conflicts
    register.clear();

    this.httpRequestsCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });
  }

  incrementRequestCount(method: string, route: string, statusCode: string) {
    this.httpRequestsCounter.inc({ method, route, status_code: statusCode });
  }

  recordRequestDuration(method: string, route: string, duration: number) {
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  getMetrics() {
    return register.metrics();
  }
}