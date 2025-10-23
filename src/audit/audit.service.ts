import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum AuditAction {
  SIGNUP = 'SIGNUP',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  INVITE = 'INVITE',
  JOIN_TEAM = 'JOIN_TEAM',
  LEAVE_TEAM = 'LEAVE_TEAM',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(userId: string, action: AuditAction, payload?: any): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          payload: payload ? JSON.stringify(payload) : null,
        },
      });
    } catch (error) {
      // Log audit failures but don't break the main flow
      console.error('Audit logging failed:', error);
    }
  }

  async getAuditLogs(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            email: true,
            metadata: true,
          },
        },
      },
    });
  }
}