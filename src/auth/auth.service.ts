import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';
import { User, Role, JwtPayload, AuthTokens, UserWithoutPassword } from '../types/prisma.types';
import { SignupDto, GoogleAuthDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private auditService: AuditService,
  ) {}

  async signup(signupData: SignupDto): Promise<AuthTokens> {
    const { email, password, name, phoneNumber, gender, dateOfBirth, termsAccepted } = signupData;

    if (!termsAccepted) {
      throw new BadRequestException('Terms and conditions must be accepted');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with enhanced fields
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phoneNumber,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        role: 'MEMBER', // Default role
        isActive: true,
        oauthProvider: null, // Manual signup
      },
    });

    // Auto-create a personal team for new users
    const team = await this.prisma.team.create({
      data: {
        name: `${name}'s Team`,
        ownerId: user.id, // User is the owner of their team
      },
    });

    // Add user as owner of the team
    await this.prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        roleInTeam: 'OWNER',
        assignedBy: user.id, // Self-assigned as owner
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
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          name: displayName || username || 'GitHub User',
          isActive: true,
          oauthProvider: 'GITHUB',
          oauthId: username,
          role: 'MEMBER',
          passwordHash: null,
        },
      });

      // Auto-create team for new GitHub OAuth users
      const team = await this.prisma.team.create({
        data: {
          name: `${user.name}'s Team`,
          ownerId: user.id,
        },
      });

      // Add user as owner of their team
      await this.prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          roleInTeam: 'OWNER',
          assignedBy: user.id,
        },
      });
    } else {
      // Update last login and profile info if needed
      const updateData: any = {
        lastLogin: new Date(),
      };

      // Update OAuth info if not set
      if (!user.oauthProvider) {
        updateData.oauthProvider = 'GITHUB';
        updateData.oauthId = username;
      }

      // Update name if not set
      if (!user.name && (displayName || username)) {
        updateData.name = displayName || username;
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
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
          name: name || 'Google User',
          email,
          isActive: true,
          oauthProvider: 'GOOGLE',
          oauthId: googleId,
          avatarUrl: picture,
          role: 'MEMBER', // Default role for OAuth users
          passwordHash: null, // OAuth users don't have passwords
        },
      });

      // Auto-create team for new Google OAuth users
      const team = await this.prisma.team.create({
        data: {
          name: `${user.name}'s Team`,
          ownerId: user.id,
        },
      });

      // Add user as owner of their team
      await this.prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          roleInTeam: 'OWNER',
          assignedBy: user.id,
        },
      });
    } else {
      // Update last login and Google profile info if needed
      const updateData: any = {
        lastLogin: new Date(),
      };

      // Update OAuth info if not set
      if (!user.oauthProvider) {
        updateData.oauthProvider = 'GOOGLE';
        updateData.oauthId = googleId;
      }

      // Update avatar if not set
      if (!user.avatarUrl && picture) {
        updateData.avatarUrl = picture;
      }

      // Update name if not set
      if (!user.name && name) {
        updateData.name = name;
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
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
    // Get user's primary team for JWT payload
    const userTeam = await this.prisma.teamMember.findFirst({
      where: { userId: user.id },
      include: { team: true },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      teamId: userTeam?.teamId || null,
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