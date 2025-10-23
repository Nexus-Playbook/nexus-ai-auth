import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';
import { User, Role, JwtPayload, AuthTokens, UserWithoutPassword } from '../types/prisma.types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private auditService: AuditService,
  ) {}

  async signup(email: string, password: string, name: string): Promise<AuthTokens> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        metadata: { name },
      },
    });

    // Log signup event
    await this.auditService.log(user.id, AuditAction.SIGNUP, { email, name });

    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Log login event
    await this.auditService.log(user.id, AuditAction.LOGIN, { email });

    return this.generateTokens(user);
  }

  async githubLogin(profile: any): Promise<AuthTokens> {
    const { emails, displayName, username } = profile;
    const email = emails[0]?.value;

    if (!email) {
      throw new BadRequestException('Email not provided by GitHub');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          metadata: {
            name: displayName || username,
            githubProfile: profile,
            provider: 'github',
          },
        },
      });
    } else {
      // Update last login and GitHub profile info
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          metadata: {
            ...((user.metadata as any) || {}),
            githubProfile: profile,
          },
        },
      });
    }

    return this.generateTokens(user);
  }

  async googleLogin(profile: any): Promise<AuthTokens> {
    const { email, name, picture, googleId } = profile;

    if (!email) {
      throw new BadRequestException('Email not provided by Google');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user with auto-team creation
      user = await this.prisma.user.create({
        data: {
          email,
          metadata: {
            name,
            picture,
            googleId,
            provider: 'google',
          },
        },
      });

      // Auto-create team for new Google OAuth users
      await this.prisma.team.create({
        data: {
          name: `${name}'s Team`,
          members: {
            create: {
              userId: user.id,
              roleInTeam: 'LEAD',
            },
          },
        },
      });
    } else {
      // Update last login and Google profile info
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          metadata: {
            ...((user.metadata as any) || {}),
            googleProfile: { name, picture, googleId },
          },
        },
      });
    }

    return this.generateTokens(user);
  }

  async validateUser(payload: JwtPayload): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      // Check if refresh token is blacklisted
      const isBlacklisted = await this.redisService.isBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string, userId: string): Promise<{ message: string }> {
    try {
      // Add refresh token to blacklist with 7-day expiry (same as token expiry)
      const expirySeconds = 7 * 24 * 60 * 60; // 7 days
      await this.redisService.addToBlacklist(refreshToken, expirySeconds);
      
      // Log logout event
      await this.auditService.log(userId, AuditAction.LOGOUT);
      
      return { message: 'Logged out successfully' };
    } catch (error) {
      // Even if Redis fails, we should still allow logout
      return { message: 'Logged out successfully' };
    }
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'default-secret',
      expiresIn: '7d',
    });

    // Remove password hash from user object
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    };
  }
}