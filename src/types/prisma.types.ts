// Prisma types for the auth service
// This file re-exports and extends actual Prisma types

import { Request } from 'express';
import { User, Team, TeamMember, Role, Plan, TeamRole } from '.prisma/client';

// Re-export the actual Prisma types
export { User, Team, TeamMember, Role, Plan, TeamRole };

// Request/Response types
export interface UserWithoutPassword extends Omit<User, 'passwordHash'> {}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: UserWithoutPassword;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  teamId?: string;
}

// Extended request types for controllers
export interface AuthenticatedRequest extends Request {
  user: UserWithoutPassword;
}
