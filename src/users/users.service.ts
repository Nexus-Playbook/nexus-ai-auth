import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/users.dto';
import { AuditService, AuditAction } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        gender: true,
        dateOfBirth: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        oauthProvider: true,
        createdAt: true,
        lastLogin: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        gender: true,
        dateOfBirth: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        oauthProvider: true,
        createdAt: true,
        lastLogin: true,
      },
    });
  }

  // Fix #8: Add findAll method for user management
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        gender: true,
        dateOfBirth: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        oauthProvider: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, etc.
        { createdAt: 'asc' }
      ],
    });
  }

  async updateUser(userId: string, updateData: UpdateUserDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        gender: true,
        dateOfBirth: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        oauthProvider: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    // Log the update action
    await this.auditService.log(userId, AuditAction.UPDATE_PROFILE, {
      updatedFields: Object.keys(updateData),
    });

    return updatedUser;
  }
}