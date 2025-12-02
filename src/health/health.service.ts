import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Health check - Basic liveness probe
   * Returns if service is running (doesn't check dependencies)
   * Use for: Kubernetes liveness probe, uptime monitoring
   */
  async getHealthStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'nexus-ai-auth',
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  /**
   * Readiness check - Checks if service can handle requests
   * Validates database and Redis connectivity
   * Use for: Kubernetes readiness probe, load balancer health checks
   */
  async getReadinessStatus() {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
    };

    const isReady = checks.database.healthy && checks.redis.healthy;

    return {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'nexus-ai-auth',
      checks,
    };
  }

  /**
   * Check PostgreSQL database connectivity
   */
  private async checkDatabase(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }
}
