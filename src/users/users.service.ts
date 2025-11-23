import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
}